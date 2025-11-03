import { db } from "@/core/database/db";
import { userBalanceTable, userBonusTable, type UserBalance, type UserBalanceSelect } from "@/core/database/schema";
import { operatorTable } from "@/core/database/schema/game";
import { configurationManager } from "@/shared/config";
import { and, asc, eq, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { gameplayLogger, type LogContext } from "../gameplay-logging.service";
import * as crypto from "crypto";

const PositiveInt = z.number().int().positive("Amount must be a positive integer (cents).");
const NonNegativeInt = z.number().int().min(0, "Amount must be a non-negative integer (cents).");
/**
 * Balance management system for real vs bonus balance handling
 *
 */
export const BetSchema = z.object({
	userId: z.string().min(1),
	betAmount: NonNegativeInt, // 0 for a free spin
	isFreeSpin: z.boolean().default(false),
});
export type BetInput = z.infer<typeof BetSchema>;

export const WinSchema = z.object({
	userId: z.string().min(1),
	winAmount: NonNegativeInt, // 0 for a losing spin
	isFreeSpinWin: z.boolean().default(false),
});
export type WinInput = z.infer<typeof WinSchema>;
export const DepositSchema = z.object({
	userId: z.string().min(1),
	amount: PositiveInt, // in cents
});
export type DepositInput = z.infer<typeof DepositSchema>;

export const WithdrawSchema = z.object({
	userId: z.string().min(1),
	amount: PositiveInt, // in cents
});
export type WithdrawInput = z.infer<typeof WithdrawSchema>;

export interface BonusInfo {
	id: string;
	awardedAmount: number;
	wageringRequirement: number;
	wageredAmount: number;
	remainingAmount: number;
	expiryDate?: Date;
	gameRestrictions?: string[];
}

export interface BalanceDeductionRequest {
	userId: string;
	amount: number; // Amount in cents
	gameId: string;
	preferredBalanceType?: "real" | "bonus" | "auto";
}

export interface BalanceDeductionResult {
	success: boolean;
	balanceType: "real" | "bonus" | "mixed";
	deductedFrom: {
		real: number;
		bonuses: Array<{
			bonusId: string;
			amount: number;
			remainingWagering: number;
		}>;
	};
	wageringProgress: Array<{
		bonusId: string;
		progressBefore: number;
		progressAfter: number;
		completed: boolean;
	}>;
	error?: string;
}

export interface BalanceAdditionRequest {
	userId: string;
	amount: number; // Amount in cents
	balanceType: "real" | "bonus";
	reason: string;
	gameId?: string;
}

export interface BalanceOperation {
	userId: string;
	amount: number; // Amount in cents
	reason: string;
	gameId?: string;
	operatorId?: string;
}

export interface BalanceCheck {
	userId: string;
	amount: number; // Amount in cents
}

// export interface PlayerBalance {
//   userId: string;
//   realBalance: number;
//   bonusBalance: number;
//   totalBalance: number;
// }

/**
 * Applies wagering to all active requirements and checks for bonus conversion.
 * This is a core private method.
 */

async function deductFromBonusBalance(
	userId: string,
	amount: number,
	gameId: string,
	tx: any,
): Promise<Array<{ bonusId: string; amount: number; remainingWagering: number }>> {
	// Get active bonuses ordered by creation date
	const activeBonuses = await tx.query.userBonusTable.findMany({
		where: and(eq(userBonusTable.userId, userId), eq(userBonusTable.status, "ACTIVE")),
		with: {
			bonus: true,
		},
		orderBy: [asc(userBonusTable.createdAt)],
	});

	let remainingAmount = amount;
	const bonusDeductions: Array<{
		bonusId: string;
		amount: number;
		remainingWagering: number;
	}> = [];
	let iterationCount = 0;
	const maxIterations = 100;

	for (const playerBonus of activeBonuses) {
		iterationCount++;
		if (iterationCount > maxIterations) {
			gameplayLogger.error("Infinite loop prevention: exceeded max iterations in deductFromBonusBalance");
			throw new Error("Potential infinite loop detected in bonus deduction");
		}

		if (remainingAmount <= 0) break;

		const bonusInfo = playerBonus.bonus;
		const currentAmount = Number(playerBonus.amount);
		const currentWagered = Number(playerBonus.processAmount);
		const goalAmount = Number(playerBonus.goalAmount);

		// Check if game is allowed for this bonus
		if (bonusInfo.slot === false && gameId) {
			// This is a simplified check - should be more sophisticated
			continue; // Skip this bonus if game not allowed
		}

		const amountFromThisBonus = Math.min(remainingAmount, currentAmount);
		const newAmount = currentAmount - amountFromThisBonus;
		const newWagered = currentWagered + amountFromThisBonus;

		// Update player bonus
		await tx
			.update(userBonusTable)
			.set({
				amount: newAmount,
				processAmount: newWagered,
				updatedAt: new Date(),
			})
			.where(eq(userBonusTable.id, playerBonus.id));

		bonusDeductions.push({
			bonusId: playerBonus.id,
			amount: amountFromThisBonus,
			remainingWagering: Math.max(0, goalAmount - newWagered),
		});

		// Convert bonus to real balance if wagering complete
		if (newWagered >= goalAmount) {
			// await convertBonusToReal(tx, userId, newAmount);
		}

		// Delete bonus task if balance depleted
		if (newAmount <= 0) {
			await tx.delete(userBonusTable).where(eq(userBonusTable.id, playerBonus.id));
		}

		remainingAmount -= amountFromThisBonus;
	}

	if (remainingAmount > 0) {
		throw new Error("Insufficient bonus balance across all active bonuses");
	}

	return bonusDeductions;
}
async function getActiveBonusTotals(userIdToFind: string) {
	// This query groups all matching records into one result row
	// and calculates the sum for each specified column.
	const totals = await db
		.select({
			totalAwarded: sum(userBonusTable.awardedAmount),
			totalWageringRequired: sum(userBonusTable.wageringRequired),
			totalWageringProgress: sum(userBonusTable.wageringProgress),
		})
		.from(userBonusTable)
		.where(and(eq(userBonusTable.userId, userIdToFind), eq(userBonusTable.status, "ACTIVE")));

	// The result is an array with one object, e.g.:
	// [{
	//   totalAwarded: '50000',
	//   totalWageringRequired: '1500000',
	//   totalWageringProgress: '25000'
	// }]
	const result = totals[0];

	if (!result || result.totalAwarded === null) {
		console.log("No active bonuses found for this player.");
		return {
			totalAwarded: 0,
			totalWageringRequired: 0,
			totalWageringProgress: 0,
		};
	}
	// IMPORTANT: sum() returns a string. You must parse it.
	return {
		totalAwarded: parseInt(result.totalAwarded, 10),
		totalWageringRequired: parseInt(result.totalWageringRequired ?? "0", 10),
		totalWageringProgress: parseInt(result.totalWageringProgress ?? "0", 10),
	};
}

export async function deductBetAmount(request: BalanceDeductionRequest, tx?: any): Promise<BalanceDeductionResult> {
	try {
		const performDeduction = async (transaction: any) => {
			// Get current player balance
			const playerBalance = await transaction.query.userBalanceTable.findFirst({
				where: eq(userBalanceTable.userId, request.userId),
			});

			if (!playerBalance) {
				throw new Error("Player balance not found");
			}

			const realBalance = Number(playerBalance.realBalance);
			const totalBonusBalance = Number(playerBalance.bonusBalance);

			// Determine balance type to use
			let balanceType: "real" | "bonus" | "mixed" = "real";
			let amountToDeductFromReal = 0;
			let amountToDeductFromBonus = 0;

			if (request.preferredBalanceType === "real" && realBalance >= request.amount) {
				// Use real balance only
				amountToDeductFromReal = request.amount;
				balanceType = "real";
			} else if (request.preferredBalanceType === "bonus" && totalBonusBalance >= request.amount) {
				// Use bonus balance only
				amountToDeductFromBonus = request.amount;
				balanceType = "bonus";
			} else {
				// Auto mode: use real first, then bonus
				if (realBalance > 0) {
					amountToDeductFromReal = Math.min(realBalance, request.amount);
					const remainingAmount = request.amount - amountToDeductFromReal;

					if (remainingAmount > 0 && totalBonusBalance >= remainingAmount) {
						amountToDeductFromBonus = remainingAmount;
						balanceType = "mixed";
					} else if (remainingAmount > 0) {
						throw new Error("Insufficient total balance");
					}
				} else if (totalBonusBalance >= request.amount) {
					amountToDeductFromBonus = request.amount;
					balanceType = "bonus";
				} else {
					throw new Error("Insufficient total balance");
				}
			}

			const wageringProgress: BalanceDeductionResult["wageringProgress"] = [];

			// Get current wagering requirements
			const currentBalance = await transaction.query.userBalanceTable.findFirst({
				where: eq(userBalanceTable.userId, request.userId),
			});

			if (!currentBalance) {
				throw new Error("Player balance not found during wagering update");
			}

			const currentDepositWrRemaining = Number(currentBalance.depositWrRemaining);
			const currentBonusWrRemaining = Number(currentBalance.bonusWrRemaining);

			// Calculate wagering reduction
			let depositWrReduction = 0;
			let bonusWrReduction = 0;

			if (balanceType === "real") {
				// When using real balance, reduce deposit wagering requirement
				depositWrReduction = Math.min(amountToDeductFromReal, currentDepositWrRemaining);
			} else if (balanceType === "bonus") {
				// When using bonus balance, reduce bonus wagering requirement
				bonusWrReduction = Math.min(amountToDeductFromBonus, currentBonusWrRemaining);
			} else if (balanceType === "mixed") {
				// When mixed, reduce both proportionally
				const realRatio = amountToDeductFromReal / request.amount;
				depositWrReduction = Math.floor(currentDepositWrRemaining * realRatio);
				bonusWrReduction = Math.min(amountToDeductFromBonus, currentBonusWrRemaining);
			}

			// Deduct from real balance if needed
			if (amountToDeductFromReal > 0) {
				await transaction
					.update(userBalanceTable)
					.set({
						realBalance: realBalance - amountToDeductFromReal,
						totalWagered: sql`${userBalanceTable.totalWagered} + ${amountToDeductFromReal}`,
						depositWrRemaining: sql`${userBalanceTable.depositWrRemaining} - ${depositWrReduction}`,
					})
					.where(eq(userBalanceTable.userId, request.userId));
			}

			// Deduct from bonus balance(s) if needed
			let bonuses: Array<{
				bonusId: string;
				amount: number;
				remainingWagering: number;
			}> = [];
			if (amountToDeductFromBonus > 0) {
				bonuses = await deductFromBonusBalance(request.userId, amountToDeductFromBonus, request.gameId, transaction);

				// Reduce bonus wagering requirement
				await transaction
					.update(userBalanceTable)
					.set({
						bonusWrRemaining: sql`${userBalanceTable.bonusWrRemaining} - ${bonusWrReduction}`,
					})
					.where(eq(userBalanceTable.userId, request.userId));
			}

			return {
				success: true,
				balanceType,
				deductedFrom: {
					real: amountToDeductFromReal,
					bonuses,
				},
				wageringProgress,
			};
		};

		// Use provided transaction or create new one for atomicity
		if (tx) {
			return await performDeduction(tx);
		} else {
			return await db.transaction(async (transaction) => {
				return await performDeduction(transaction);
			});
		}
	} catch (error) {
		gameplayLogger.error("Balance deduction failed:", error as LogContext);
		return {
			success: false,
			balanceType: "real",
			deductedFrom: { real: 0, bonuses: [] },
			wageringProgress: [],
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Add winnings to appropriate balance
 */
export async function addWinnings(
	request: BalanceAdditionRequest,
	tx?: any,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
	try {
		const creditResult = await creditToBalance(request.userId, request.amount, request.balanceType, "win", tx);

		return creditResult;
	} catch (error) {
		gameplayLogger.error("Add winnings failed:", error as LogContext);
		return {
			success: false,
			newBalance: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function handleDeposit(input: DepositInput, tx?: any): Promise<UserBalanceSelect> {
	const settings = configurationManager.getConfiguration();

	const { userId, amount } = DepositSchema.parse(input);

	const performDeposit = async (transaction: any) => {
		// First, get the default operator (The House)
		const operator = await transaction.query.operatorTable.findFirst({
			where: eq(operatorTable.name, "The House"),
		});

		if (!operator) {
			throw new Error("Default operator 'The House' not found");
		}

		// Check if operator has sufficient balance
		const currentOperatorBalance = Number(operator.balance);
		if (currentOperatorBalance < amount) {
			throw new Error(`Insufficient operator balance. Required: ${amount}, Available: ${currentOperatorBalance}`);
		}

		// Deduct the deposit amount from operator's balance
		await transaction
			.update(operatorTable)
			.set({
				balance: sql`${operatorTable.balance} - ${amount}`,
				updatedAt: new Date(),
			})
			.where(eq(operatorTable.id, operator.id));

		// Ensure user balance exists
		const balance = await getOrCreateBalance(userId);
		const depositWROwed = amount * settings.depositWrMultiplier;

		// Update user's balance
		const updatedBalances = await transaction
			.update(userBalanceTable)
			.set({
				realBalance: sql`${userBalanceTable.realBalance} + ${amount}`,
				totalDeposited: sql`${userBalanceTable.totalDeposited} + ${amount}`,
				depositWrRemaining: sql`${userBalanceTable.depositWrRemaining} + ${depositWROwed}`,
				updatedAt: new Date(),
			})
			.where(eq(userBalanceTable.userId, userId))
			.returning();

		if (!updatedBalances || updatedBalances.length === 0) {
			throw new Error("Failed to update balance after deposit");
		}

		const updatedBalance = updatedBalances[0];
		if (!updatedBalance) throw new Error(" no balance found");

		return updatedBalance;
	};

	// Use provided transaction or create new one for atomicity
	if (tx) {
		return await performDeposit(tx);
	} else {
		return await db.transaction(async (transaction) => {
			return await performDeposit(transaction);
		});
	}
}

/**
 * Get detailed balance information including active bonuses
 */
export async function getDetailedBalance(userId: string): Promise<{
	realBalance: number;
	bonusBalance: number;
	activeBonuses: BonusInfo[];
	totalBalance: number;
} | null> {
	const playerBalance = await db.query.userBalanceTable.findFirst({
		where: eq(userBalanceTable.userId, userId),
	});

	if (!playerBalance) {
		return null;
	}

	// Get active bonuses with details
	const activeBonuses = await db.query.userBonusTable.findMany({
		where: and(eq(userBonusTable.userId, userId), eq(userBonusTable.status, "ACTIVE")),
		orderBy: [asc(userBonusTable.createdAt)],
	});

	const bonusDetails: BonusInfo[] = activeBonuses.map(
		(pb: { id: any; awardedAmount: any; wageringRequired: number; wageringProgress: number; expiresAt: any }) => ({
			id: pb.id,
			awardedAmount: Number(pb.awardedAmount),
			wageringRequirement: Number(pb.wageringRequired), /// Number(pb.amount), // Calculate multiplier
			wageredAmount: Number(pb.wageringProgress),
			remainingAmount: Number(pb.wageringRequired - pb.wageringProgress),
			expiryDate: pb.expiresAt || undefined, //(pb.expiresAt)?.expiresAt
			// ? new Date((pb.expiresAt as any).expireDate)
			// : undefined,
			gameRestrictions: [], // Should be populated from bonus configuration
		}),
	);

	return {
		realBalance: Number(playerBalance.realBalance),
		bonusBalance: Number(playerBalance.bonusBalance),
		activeBonuses: bonusDetails,
		totalBalance: Number(playerBalance.realBalance) + Number(playerBalance.bonusBalance),
	};
}

export async function getOrCreateBalance(userId: string): Promise<UserBalanceSelect> {
	const balances = await db.select().from(userBalanceTable).where(eq(userBalanceTable.userId, userId)).limit(1);

	if (balances.length > 0) {
		return balances[0]!;
	}

	// Create a new balance with explicit default values
	const newBalance = {
		id: crypto.randomUUID(), // Generate UUID for the balance record
		userId,
		realBalance: 0,
		bonusBalance: 0,
		freeSpinsRemaining: 0,
		depositWrRemaining: 0,
		bonusWrRemaining: 0,
		totalDeposited: 0,
		totalWithdrawn: 0,
		totalWagered: 0,
		totalWon: 0,
		totalBonusGranted: 0,
		totalFreeSpinWins: 0,
	};

	const insertedBalances = await db.insert(userBalanceTable).values(newBalance).returning();

	if (!insertedBalances || insertedBalances.length === 0) {
		throw new Error("Failed to create balance record for user");
	}
	if (!insertedBalances[0]) throw new Error(" no balance found");

	return insertedBalances[0];
}

/**
 * Calculate total wagering progress across all bonuses
 */
export async function getWageringProgress(userId: string): Promise<{
	totalRequired: number;
	totalWagered: number;
	overallProgress: number;
	bonuses: Array<{
		id: string;
		required: number;
		wagered: number;
		progress: number;
		completed: boolean;
	}>;
}> {
	const activeBonuses = await db.query.userBonusTable.findMany({
		where: and(eq(userBonusTable.userId, userId), eq(userBonusTable.status, "PENDING")),
		with: {
			bonus: true, // Add this to load the bonus relation
		},
	});

	let totalRequired = 0;
	let totalWagered = 0;

	const bonusProgress = activeBonuses.map((pb: { wageringRequired: any; wageringProgress: any; id: any }) => {
		const required = Number(pb.wageringRequired);
		const wagered = Number(pb.wageringProgress);
		const progress = required > 0 ? wagered / required : 0;
		const completed = wagered >= required;

		totalRequired += required;
		totalWagered += wagered;

		return {
			id: pb.id,
			required,
			wagered,
			progress,
			completed,
		};
	});

	return {
		totalRequired,
		totalWagered,
		overallProgress: totalRequired > 0 ? totalWagered / totalRequired : 0,
		bonuses: bonusProgress,
	};
}

/**
 * Create a balance record for a new user
 */
export async function createBalanceForNewUser(userId: string): Promise<void> {
	await db.insert(userBalanceTable).values({
		id: crypto.randomUUID(), // Generate UUID for the balance record
		userId: userId,
	});
}

/**
 * Check if player has sufficient balance for bet
 * Prioritizes real balance over bonus balance
 */
export async function checkBalance(
	playerBalance: UserBalance,
	betAmount: number,
): Promise<{
	sufficient: boolean;
	balanceType: "real" | "bonus";
	availableAmount: number;
}> {
	if (!playerBalance) {
		return { sufficient: false, balanceType: "real", availableAmount: 0 };
	}
	// Check real balance first (preferred)

	if (playerBalance.realBalance + playerBalance.bonusBalance >= betAmount) {
		return {
			sufficient: true,
			balanceType: "real",
			availableAmount: playerBalance.realBalance + playerBalance.bonusBalance,
		};
	}
	// Insufficient total balance
	return {
		sufficient: false,
		balanceType: "real", // Default to real when insufficient
		availableAmount: playerBalance.realBalance + playerBalance.bonusBalance,
	};
}

/**
 * Debit from player balance atomically
 * Uses database transactions for consistency
 */
async function debitFromBalance(
	userId: string,
	amount: number,
	balanceType: "real" | "bonus",
): Promise<{ success: boolean; newBalance: number; error?: string }> {
	try {
		const result = await db.transaction(async (tx) => {
			// Get current balance
			const currentBalance = await tx.query.userBalanceTable.findFirst({
				where: eq(userBalanceTable.userId, userId),
			});

			if (!currentBalance) {
				throw new Error(`Player ${userId} not found`);
			}

			const realBalance = Number(currentBalance.realBalance);
			const bonusBalance = Number(currentBalance.bonusBalance);

			let newBalance: number;
			let updateField: any;

			if (balanceType === "real") {
				if (realBalance < amount) {
					throw new Error("Insufficient real balance");
				}
				newBalance = realBalance - amount;
				updateField = { realBalance: newBalance };
			} else {
				if (bonusBalance < amount) {
					throw new Error("Insufficient bonus balance");
				}
				newBalance = bonusBalance - amount;
				updateField = { bonusBalance: newBalance };
			}

			// Update balance
			await tx
				.update(userBalanceTable)
				.set({
					...updateField,
					updatedAt: new Date(),
				})
				.where(eq(userBalanceTable.userId, userId));

			return { success: true, newBalance };
		});

		return result;
	} catch (error) {
		gameplayLogger.error("Debit operation failed:", error as LogContext);
		return {
			success: false,
			newBalance: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Credit to player balance atomically
 */
async function creditToBalance(
	userId: string,
	amount: number,
	balanceType: "real" | "bonus",
	creditToBalanceType: "deposit" | "bet" | "win",
	tx?: any,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
	try {
		const settings = configurationManager.getConfiguration();

		const performCredit = async (transaction: any) => {
			// Get current balance within the transaction for atomicity
			const currentBalance = await transaction.query.userBalanceTable.findFirst({
				where: eq(userBalanceTable.userId, userId),
			});

			if (!currentBalance) {
				throw new Error(`Player ${userId} not found`);
			}

			const realBalance = Number(currentBalance.realBalance);
			const bonusBalance = Number(currentBalance.bonusBalance);
			const depositWRRemaining = Number(currentBalance.depositWrRemaining);
			const bonusWRRemaining = Number(currentBalance.bonusWrRemaining);
			const totalDeposited = Number(currentBalance.totalDeposited);
			const totalWagered = Number(currentBalance.totalWagered);
			const totalWon = Number(currentBalance.totalWon);

			let newBalance: number;
			let updateField: any;
			let wrOwed: number;
			if (balanceType === "real") {
				newBalance = Math.floor(realBalance + amount);
				wrOwed = Math.floor(depositWRRemaining + amount);
				updateField = { realBalance: newBalance, depositWRRemaining: wrOwed };
			} else {
				newBalance = Math.floor(bonusBalance + amount);
				wrOwed = Math.floor(
					bonusWRRemaining + amount * ((settings.wageringConfig as any)?.defaultWageringMultiplier || 30),
				);
				updateField = { bonusBalance: newBalance, bonusWRRemaining: wrOwed };
			}
			if (creditToBalanceType == "deposit") {
				const newTotalDeposited = Math.floor(totalDeposited + amount);
				updateField.totalDeposited = newTotalDeposited;
			}
			if (creditToBalanceType == "bet") {
				const newTotalWagered = Math.floor(totalWagered + amount);
				updateField.totalWagered = newTotalWagered;
			}
			if (creditToBalanceType == "win") {
				const newTotalWon = Math.floor(totalWon + amount);
				updateField.totalWon = newTotalWon;
			}
			// Update balance atomically within the same transaction
			await transaction
				.update(userBalanceTable)
				.set({
					...updateField,
					updatedAt: new Date(),
				})
				.where(eq(userBalanceTable.userId, userId));

			return { success: true, newBalance };
		};

		// Use provided transaction or create new one for atomicity
		if (tx) {
			return await performCredit(tx);
		} else {
			return await db.transaction(async (transaction) => {
				return await performCredit(transaction);
			});
		}
	} catch (error) {
		gameplayLogger.error("Credit operation failed:", error as LogContext);
		return {
			success: false,
			newBalance: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

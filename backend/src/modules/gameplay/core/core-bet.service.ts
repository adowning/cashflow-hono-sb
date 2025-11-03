/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { db } from "@/core/database/db";
import { transactionLogTable, userTable, userBalanceTable, gameTable, gameSessionTable } from "@/core/database/schema";
import { validateBet } from "@/modules/gameplay/core/restrictions.service";
import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";
import { addWinnings, deductBetAmount } from "./balance-management.service";
import { gameplayLogger, type LogContext } from "../gameplay-logging.service";

// Interfaces and Schemas
export interface BetRequest {
	userId: string;
	gameId: string;
	wagerAmount: number; // Amount in cents
	operatorId?: string;
	sessionId?: string;
	affiliateName?: string;
}

export interface GameOutcome {
	winAmount: number;
	gameData?: Record<string, unknown>; // Game-specific outcome data
	jackpotWin?: {
		group: string;
		amount: number;
	};
}

// Sanitization function for strings to prevent log injection
function sanitizeString(str: string): string {
	return str.replace(/[\r\n\t\b\f\v\\"]/g, "").trim();
}

export const betRequestSchema = z.object({
	userId: z.string().min(1, "userId cannot be empty").transform(sanitizeString),
	gameId: z.string().min(1, "gameId cannot be empty").transform(sanitizeString),
	wagerAmount: z.number().positive("wagerAmount must be positive").finite("wagerAmount must be a valid number"),
	operatorId: z
		.string()
		.optional()
		.transform((val) => (val ? sanitizeString(val) : val)),
	sessionId: z
		.string()
		.optional()
		.transform((val) => (val ? sanitizeString(val) : val)),
	affiliateName: z
		.string()
		.optional()
		.transform((val) => (val ? sanitizeString(val) : val)),
});

export const gameOutcomeSchema = z.object({
	winAmount: z.number().min(0, "winAmount cannot be negative").finite("winAmount must be a valid number"),
	gameData: z.record(z.string(), z.unknown()).optional(),
	jackpotWin: z
		.object({
			group: z.string(),
			amount: z.number().min(0),
		})
		.optional(),
});

/**
 * Helper function to add winnings within a transaction context
 */
async function addWinningsWithinTransaction(
	tx: any,
	balanceDeduction: any,
	userId: string,
	gameId: string,
	winAmount: number,
) {
	let winningsAddition: {
		success: boolean;
		newBalance: number;
		error?: string;
	} = {
		success: true,
		newBalance: 0,
	};
	let realWinnings = 0;
	let bonusWinnings = 0;

	if (winAmount > 0) {
		if (balanceDeduction.balanceType === "mixed") {
			const totalDeducted =
				balanceDeduction.deductedFrom.real +
				balanceDeduction.deductedFrom.bonuses.reduce((sum: any, b: { amount: any }) => sum + b.amount, 0);

			if (totalDeducted === 0) {
				realWinnings = winAmount;
				bonusWinnings = 0;
				winningsAddition = await addWinnings(
					{
						userId,
						amount: winAmount,
						balanceType: "real",
						reason: `Game win - ${gameId}`,
						gameId,
					},
					tx,
				);
			} else {
				const realDeducted = balanceDeduction.deductedFrom.real;
				const realRatio = realDeducted / totalDeducted;
				realWinnings = Math.round(winAmount * realRatio);
				bonusWinnings = winAmount - realWinnings;

				const realAddition = await addWinnings(
					{
						userId,
						amount: realWinnings,
						balanceType: "real",
						reason: `Game win - ${gameId} (real portion)`,
						gameId,
					},
					tx,
				);

				const bonusAddition = await addWinnings(
					{
						userId,
						amount: bonusWinnings,
						balanceType: "bonus",
						reason: `Game win - ${gameId} (bonus portion)`,
						gameId,
					},
					tx,
				);

				winningsAddition = {
					success: realAddition.success && bonusAddition.success,
					newBalance: bonusAddition.newBalance,
					error: realAddition.error || bonusAddition.error,
				};
			}
		} else {
			const balanceType = balanceDeduction.balanceType === "bonus" ? "bonus" : "real";
			winningsAddition = await addWinnings(
				{
					userId,
					amount: winAmount,
					balanceType,
					reason: `Game win - ${gameId}`,
					gameId,
				},
				tx,
			);

			if (balanceType === "real") {
				realWinnings = winAmount;
			} else {
				bonusWinnings = winAmount;
			}
		}

		if (!winningsAddition.success) {
			throw new Error(`Winnings addition failed: ${winningsAddition.error}`);
		}
	}

	return { winningsAddition, realWinnings, bonusWinnings };
}

export async function executeCoreBet(betRequest: BetRequest, gameOutcome: GameOutcome) {
	const validatedBetRequest = betRequestSchema.parse(betRequest);
	const validatedGameOutcome = gameOutcomeSchema.parse(gameOutcome);

	const [user, userBalance, game, gameSession] = await Promise.all([
		db.query.userTable.findFirst({
			where: (userTable, { eq }) => eq(userTable.id, validatedBetRequest.userId),
			with: {
				userBalances: true,
			},
		}),
		db.query.userBalanceTable.findFirst({
			where: (userBalanceTable, { eq }) => eq(userBalanceTable.userId, validatedBetRequest.userId),
		}),
		db.query.gameTable.findFirst({
			where: (gameTable, { eq }) => eq(gameTable.id, validatedBetRequest.gameId),
		}),
		db.query.gameSessionTable.findFirst({
			where: (gameSessionTable, { and }) =>
				and(
					eq(gameSessionTable.userId, validatedBetRequest.userId),
					eq(gameSessionTable.gameId, validatedBetRequest.gameId),
					eq(gameSessionTable.status, "ACTIVE"),
				),
		}),
	]);

	if (!user) {
		throw new Error("User not found");
	}

	const validation = await validateBet(user, validatedBetRequest.wagerAmount, validatedBetRequest.gameId);

	if (!validation.valid) {
		throw new Error(validation.reason || "Bet validation failed");
	}

	if (!game) {
		throw new Error(`Game ${validatedBetRequest.gameId} not found`);
	}
	if (!userBalance) {
		throw new Error("User balance not found");
	}

	const balanceTransactionResult = await db.transaction(async (tx) => {
		const balanceDeduction = await deductBetAmount(
			{
				userId: userBalance.userId,
				amount: validatedBetRequest.wagerAmount,
				gameId: validatedBetRequest.gameId,
				preferredBalanceType: "auto",
			},
			tx,
		);

		if (!balanceDeduction.success) {
			throw new Error(balanceDeduction.error || "Balance deduction failed");
		}

		const winningsAddition = await addWinningsWithinTransaction(
			tx,
			balanceDeduction,
			userBalance.userId,
			validatedBetRequest.gameId,
			validatedGameOutcome.winAmount,
		);

		const finalBalances = {
			realBalance: userBalance.realBalance - balanceDeduction.deductedFrom.real + winningsAddition.realWinnings,
			bonusBalance:
				userBalance.bonusBalance -
				balanceDeduction.deductedFrom.bonuses.reduce((sum, b) => sum + b.amount, 0) +
				winningsAddition.bonusWinnings,
		};

		return {
			balanceDeduction,
			finalBalances,
		};
	});

	const { balanceDeduction, finalBalances } = balanceTransactionResult;

	return {
		userId: validatedBetRequest.userId,
		gameId: validatedBetRequest.gameId,
		wagerAmount: validatedBetRequest.wagerAmount,
		winAmount: validatedGameOutcome.winAmount,
		realBalanceBefore: userBalance.realBalance,
		bonusBalanceBefore: userBalance.bonusBalance,
		realBalanceAfter: finalBalances.realBalance,
		bonusBalanceAfter: finalBalances.bonusBalance,
		balanceType: balanceDeduction.balanceType,
	};
}

/**
 * Get bet processing statistics from the last 24 hours.
 */
export async function getBetProcessingStats(): Promise<{
	totalBets: number;
	averageProcessingTime: number; // Calculated from actual logged processing_time data
	successRate: number;
	totalWagered: number;
	totalGGR: number;
}> {
	try {
		const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const results = await db
			.select({
				totalBets: sql`count(CASE WHEN type IN ('BET', 'BONUS') THEN 1 END)`, // Count wager transactionLogTable only
				successfulBets: sql`count(CASE WHEN type IN ('BET', 'BONUS') AND status = 'COMPLETED' THEN 1 END)`, // Completed wagers
				totalWagered: sql`coalesce(sum(CASE WHEN type IN ('BET', 'BONUS') THEN wager_amount ELSE 0 END), 0)`, // Sum wager amounts
				totalWon: sql`coalesce(sum(CASE WHEN type = 'WIN' THEN amount ELSE 0 END), 0)`, // Sum win amounts from WIN transactionLogTable
				averageProcessingTime: sql`coalesce(avg(CASE WHEN processing_time > 0 AND processing_time < 10000 THEN processing_time ELSE NULL END), 0)`, // Filter valid processing times (0-10s range)
			})
			.from(transactionLogTable)
			.where(sql`${transactionLogTable.createdAt} >= ${twentyFourHoursAgo}`);

		const stats = results[0];
		if (!stats) {
			return {
				totalBets: 0,
				averageProcessingTime: 0,
				successRate: 100,
				totalWagered: 0,
				totalGGR: 0,
			};
		}

		const totalBets = Number(stats.totalBets);
		const successfulBets = Number(stats.successfulBets);
		const totalWagered = Number(stats.totalWagered);
		const totalWon = Number(stats.totalWon);
		const averageProcessingTime = Number(stats.averageProcessingTime); // Now from DB

		const successRate = totalBets > 0 ? (successfulBets / totalBets) * 100 : 100;
		const totalGGR = totalWagered - totalWon;

		return {
			totalBets,
			averageProcessingTime,
			successRate,
			totalWagered,
			totalGGR,
		};
	} catch (error) {
		gameplayLogger.error("Failed to get bet processing stats:", error as LogContext);
		return {
			totalBets: 0,
			averageProcessingTime: 0,
			successRate: 100,
			totalWagered: 0,
			totalGGR: 0,
		};
	}
}

/**
 * Jackpot contribution system with 3 types: MINOR, MAJOR, GRAND
 * Admin-configurable rates and game type assignments
 * REFACTORED with correct enum types and normalized history tables
 */

import { db } from "@/core/database/db";
import {
	jackpotTable,
	jackpotWinHistoryTable,
	jackpotContributionHistoryTable,
	getDefaultJackpotConfig,
	type JackpotWinHistory,
	type JackpotContributionHistory,
	type Jackpot as JackpotModel,
} from "@/core/database/schema/jackpot";
import { configurationManager } from "@/shared/config";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { appLogger, createOperationContext } from "@/core/logger/app-logger";
import {
	type LogContext as JackpotErrorContext,
	categorizeError,
	createConcurrencyError,
	createDatabaseError,
	createInsufficientFundsError,
	createSystemError,
	createValidationError,
	AppError as JackpotError,
} from "@/core/errors/app-errors";

// ========================================
// VALIDATION SCHEMAS (Zod)
// ========================================

// --- REFACTORED: Use uppercase DB enum values ---
export const JackpotTypeSchema = z.enum(["MINOR", "MAJOR", "GRAND"]);

// Config object keys can remain lowercase
const JackpotTypeConfigSchema = z
	.object({
		rate: z.number().min(0).max(1, "Contribution rate must be between 0 and 1 (0-100%)").optional(),
		seedAmount: z.number().int().positive("Seed amount must be a positive integer (cents)").optional(),
		maxAmount: z.number().int().positive().optional(),
	})
	.refine((data) => !data.maxAmount || !data.seedAmount || data.maxAmount > data.seedAmount, {
		message: "Maximum amount must be greater than seed amount",
	});

// Config object keys are lowercase: 'minor', 'major', 'mega'
export const JackpotConfigSchema = z.object({
	minor: JackpotTypeConfigSchema,
	major: JackpotTypeConfigSchema,
	mega: JackpotTypeConfigSchema,
});

export const JackpotContributionRequestSchema = z.object({
	gameId: z.string().min(1, "Game ID cannot be empty").trim(),
	wagerAmount: z.number().int().positive("Wager amount must be a positive integer (cents)"),
});

export const JackpotWinRequestSchema = z.object({
	// --- REFACTORED: Use uppercase schema ---
	type: JackpotTypeSchema,
	gameId: z.string().min(1, "Game ID cannot be empty").trim(),
	userId: z.string().uuid("User ID must be a valid UUID"),
	winAmount: z.number().int().positive("Win amount must be a positive integer (cents)").optional(),
});

export const JackpotConfigUpdateSchema = JackpotConfigSchema.partial();

// ========================================
// ENHANCED TYPE DEFINITIONS
// ========================================

export type JackpotType = z.infer<typeof JackpotTypeSchema>;
export type { JackpotModel };

export interface JackpotConfig {
	minor: z.infer<typeof JackpotTypeConfigSchema>;
	major: z.infer<typeof JackpotTypeConfigSchema>;
	mega: z.infer<typeof JackpotTypeConfigSchema>;
}

export interface JackpotPool {
	type: JackpotType;
	currentAmount: number;
	totalContributions: number;
	totalWins: number;
	lastWinDate?: Date;
	lastWonAmount?: number;
	seedAmount?: number;
	maxAmount?: number;
	contributionRate?: number;
	lastWonByUserId?: string;
}

export interface JackpotContribution {
	gameId: string;
	wagerAmount: number; // Amount in cents
	contributions: Record<JackpotType, number>;
	timestamp: Date;
}

export interface JackpotWin {
	type: JackpotType;
	gameId: string;
	userId: string;
	winAmount: number;
	timestamp: Date;
}

// Service method return types
export interface JackpotContributionResult {
	success: boolean;
	contributions: Record<JackpotType, number>;
	totalContribution: number;
	error?: string;
}

export interface JackpotWinResult {
	success: boolean;
	actualWinAmount: number;
	error?: string;
	remainingAmount?: number;
}

// Concurrency result types
export interface ConcurrencySafeResult<T> {
	data: T;
	retryCount?: number;
	lockAcquired?: boolean;
}

// ========================================
// CONCURRENCY CONTROL CONSTANTS
// ========================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;
const LOCK_TIMEOUT_MS = 5000;

function isConcurrencyError(error: any): boolean {
	const errorMessage = error?.message?.toLowerCase() || "";
	return (
		errorMessage.includes("concurrent") ||
		errorMessage.includes("lock") ||
		errorMessage.includes("deadlock") ||
		errorMessage.includes("timeout") ||
		errorMessage.includes("serialization") ||
		errorMessage.includes("version") ||
		error?.code === "40001" || // Serialization Failure
		error?.code === "40P01" || // Deadlock Detected
		error?.code === "23505" // Unique violation
	);
}

// ========================================
// VALIDATION HELPERS (REFACTORED)
// ========================================

export function validateJackpotContributionRequest(
	input: unknown,
	context: JackpotErrorContext,
): z.infer<typeof JackpotContributionRequestSchema> {
	try {
		const result = JackpotContributionRequestSchema.parse(input);
		return {
			...result,
			gameId: sanitizeString(result.gameId),
		};
	} catch (error) {
		throw createValidationError(
			"Validation failed for jackpot contribution",
			"VALIDATION_INVALID_AMOUNT",
			context,
			error instanceof z.ZodError ? error : undefined,
		);
	}
}

export function validateJackpotWinRequest(
	input: unknown,
	context: JackpotErrorContext,
): z.infer<typeof JackpotWinRequestSchema> {
	try {
		const result = JackpotWinRequestSchema.parse(input);
		return {
			...result,
			gameId: sanitizeString(result.gameId),
		};
	} catch (error) {
		throw createValidationError(
			"Validation failed for jackpot win",
			"VALIDATION_INVALID_AMOUNT",
			context,
			error instanceof z.ZodError ? error : undefined,
		);
	}
}

export function validateJackpotConfigUpdate(
	input: unknown,
	context: JackpotErrorContext,
): z.infer<typeof JackpotConfigUpdateSchema> {
	try {
		return JackpotConfigUpdateSchema.parse(input);
	} catch (error) {
		throw createValidationError(
			"Validation failed for jackpot config update",
			"VALIDATION_INVALID_CONFIG",
			context,
			error instanceof z.ZodError ? error : undefined,
		);
	}
}

function sanitizeString(input: string): string {
	return input.replace(/[\r\n\t\b\f\v\\"]/g, "").trim();
}

/**
 * Enhanced database operations with concurrency control (REFACTORED)
 */
class ConcurrencySafeDB {
	static async optimisticUpdate<T>(
		operation: string,
		type: JackpotType,
		updateFn: (pool: any, tx: any) => Promise<T>,
		context: JackpotErrorContext,
		maxRetries: number = MAX_RETRY_ATTEMPTS,
	): Promise<ConcurrencySafeResult<T>> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const result = await db.transaction(async (tx) => {
					const pools = await tx.select().from(jackpotTable).where(eq(jackpotTable.jackpotType, type)).limit(1);

					const pool = pools[0];
					if (!pool) {
						throw createSystemError(`Jackpot pool not found for type: ${type}`, "SYSTEM_UNEXPECTED_STATE", context);
					}

					const originalVersion = pool.version;

					const updateResult = await updateFn(pool, tx);

					const verificationQuery = await tx
						.select({ version: jackpotTable.version })
						.from(jackpotTable)
						.where(eq(jackpotTable.jackpotType, type))
						.limit(1);

					const currentVersion = verificationQuery[0]?.version || 0;

					if (currentVersion === originalVersion) {
						// No-op, fine
					} else if (currentVersion !== originalVersion + 1) {
						throw createConcurrencyError(
							`Version conflict on ${type}: expected ${originalVersion + 1}, found ${currentVersion}`,
							"CONCURRENCY_VERSION_CONFLICT",
							context,
						);
					}

					return updateResult;
				});

				return {
					data: result,
					retryCount: attempt - 1,
					lockAcquired: true,
				};
			} catch (error) {
				if (error instanceof JackpotError) {
					if (error.isRetryable() && attempt < maxRetries) {
						appLogger.warn(`Retrying operation ${operation} on ${type}`, context, { attempt });
						await new Promise((res) => setTimeout(res, RETRY_DELAY_MS * Math.pow(2, attempt)));
						continue;
					}
					throw error;
				}

				if (isConcurrencyError(error) && attempt < maxRetries) {
					appLogger.warn(`Retrying operation ${operation} on ${type} due to concurrency issue`, context, {
						attempt,
						error: (error as Error).message,
					});
					await new Promise((res) => setTimeout(res, RETRY_DELAY_MS * Math.pow(2, attempt)));
					continue;
				}

				throw createDatabaseError(
					`Operation ${operation} failed on ${type} after ${attempt} attempts`,
					"DATABASE_CONNECTION_FAILED",
					context,
					error as Error,
				);
			}
		}
		throw createSystemError("Max retries exceeded for optimistic update", "SYSTEM_UNEXPECTED_STATE", context);
	}

	static async pessimisticUpdate<T>(
		operation: string,
		type: JackpotType,
		updateFn: (pool: any, tx: any) => Promise<T>,
		context: JackpotErrorContext,
		timeoutMs: number = LOCK_TIMEOUT_MS,
	): Promise<ConcurrencySafeResult<T>> {
		try {
			const result = await db.transaction(async (tx) => {
				const pools = await tx.execute(sql`
		  SELECT * FROM ${jackpotTable}
		  WHERE ${jackpotTable.jackpotType} = ${type}
		  LIMIT 1
		  FOR UPDATE NOWAIT
		`);

				const pool = (pools as any).rows?.[0];

				if (!pool) {
					throw createSystemError(`Jackpot pool not found for type: ${type}`, "SYSTEM_UNEXPECTED_STATE", context);
				}

				return await updateFn(pool, tx);
			});

			return {
				data: result,
				retryCount: 0,
				lockAcquired: true,
			};
		} catch (error) {
			if (error instanceof JackpotError) throw error;

			const err = error as Error & { code?: string };

			if (isConcurrencyError(err) || err.code === "55P03") {
				throw createConcurrencyError(
					`Could not acquire lock for ${operation} on ${type}`,
					"CONCURRENCY_LOCK_TIMEOUT",
					context,
					err,
				);
			}

			throw createDatabaseError(
				`Pessimistic update failed for ${operation} on ${type}`,
				"DATABASE_CONNECTION_FAILED",
				context,
				err,
			);
		}
	}

	static async batchOptimisticUpdate<T>(
		operation: string,
		types: JackpotType[],
		updateFn: (pools: any[], tx: any) => Promise<T>,
		context: JackpotErrorContext,
		maxRetries: number = MAX_RETRY_ATTEMPTS,
	): Promise<ConcurrencySafeResult<T>> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const result = await db.transaction(async (tx) => {
					const pools = await tx.select().from(jackpotTable).where(sql`${jackpotTable.jackpotType} IN ${types}`);

					if (pools.length !== types.length) {
						throw createSystemError(
							`Some jackpot pools not found. Expected ${types.length}, found ${pools.length}`,
							"SYSTEM_UNEXPECTED_STATE",
							context,
						);
					}

					const originalVersions = new Map<string, number>();
					pools.forEach((pool) => originalVersions.set(pool.jackpotType, pool.version));

					const updateResult = await updateFn(pools, tx);

					const verificationPools = await tx
						.select({
							type: jackpotTable.jackpotType,
							version: jackpotTable.version,
						})
						.from(jackpotTable)
						.where(sql`${jackpotTable.jackpotType} IN ${types}`);

					for (const pool of verificationPools) {
						const originalVersion = originalVersions.get(pool.type) || 0;
						const currentVersion = pool.version;

						if (currentVersion === originalVersion) {
							continue; // No-op
						}

						if (currentVersion !== originalVersion + 1) {
							throw createConcurrencyError(
								`Version conflict during batch ${operation} on ${pool.type}: expected ${originalVersion + 1}, found ${currentVersion}`,
								"CONCURRENCY_VERSION_CONFLICT",
								context,
							);
						}
					}

					return updateResult;
				});

				return {
					data: result,
					retryCount: attempt - 1,
					lockAcquired: true,
				};
			} catch (error) {
				if (error instanceof JackpotError) {
					if (error.isRetryable() && attempt < maxRetries) {
						appLogger.warn(`Retrying batch operation ${operation}`, context, { attempt });
						await new Promise((res) => setTimeout(res, RETRY_DELAY_MS * Math.pow(2, attempt)));
						continue;
					}
					throw error;
				}

				if (isConcurrencyError(error) && attempt < maxRetries) {
					appLogger.warn(`Retrying batch operation ${operation} due to concurrency issue`, context, {
						attempt,
						error: (error as Error).message,
					});
					await new Promise((res) => setTimeout(res, RETRY_DELAY_MS * Math.pow(2, attempt)));
					continue;
				}

				throw createDatabaseError(
					`Batch operation ${operation} failed after ${attempt} attempts`,
					"DATABASE_CONNECTION_FAILED",
					context,
					error as Error,
				);
			}
		}
		throw createSystemError("Max retries exceeded for batch update", "SYSTEM_UNEXPECTED_STATE", context);
	}
}

/**
 * Database-backed jackpot manager (REFACTORED)
 */
class JackpotManager {
	private config: JackpotConfig;
	private initialized: boolean = false;

	constructor() {
		const settings = configurationManager.getConfiguration();
		this.config = settings.jackpotConfig as any;
	}

	/**
	 * Ensure jackpot pools are initialized in database
	 * @throws {SystemError}
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) {
			return;
		}
		const context = createOperationContext({ operation: "ensureInitialized", domain: "jackpot" });

		try {
			await db.transaction(async (tx) => {
				const existingPools = await tx
					.select()
					.from(jackpotTable)
					.where(sql`${jackpotTable.jackpotType} IN ('MINOR', 'MAJOR', 'GRAND')`);

				const existingTypes = new Set(existingPools.map((pool) => pool.jackpotType));

				// Use lowercase for iteration, map to uppercase for DB
				const configKeys = ["minor", "major", "mega"] as const;
				const defaultConfig = getDefaultJackpotConfig();

				for (const typeKey of configKeys) {
					// --- REFACTORED: Map lowercase key to uppercase enum ---
					const dbEnumTypeValue = typeKey === "mega" ? "GRAND" : (typeKey.toUpperCase() as "MINOR" | "MAJOR");

					if (existingTypes.has(dbEnumTypeValue)) {
						continue; // Already exists
					}

					const typeConfig = defaultConfig[typeKey];

					if (!typeConfig) {
						throw createSystemError(`Missing default config for type: ${typeKey}`, "CONFIG_MISSING_GROUP", context);
					}

					const { seedAmount, maxAmount, contributionRate } = typeConfig;

					await tx.insert(jackpotTable).values({
						jackpotType: dbEnumTypeValue,
						currentAmount: seedAmount,
						seedAmount: seedAmount,
						maxAmount: maxAmount || null,
						contributionRate: contributionRate,
						minBet: null,
						lastWonAmount: null,
						lastWonAt: null,
						lastWonByUserId: null,
						totalContributions: 0,
						totalWins: 0,
						createdAt: new Date(),
						updatedAt: new Date(),
					});
				}
			});

			this.initialized = true;
			appLogger.info("Jackpot pools initialized successfully", context);
		} catch (error) {
			throw categorizeError(error as Error, context, "SYSTEM");
		}
	}

	/**
	 * Get current jackpot configuration
	 */
	getConfig(): JackpotConfig {
		return { ...this.config };
	}

	/**
	 * Update jackpot configuration (admin function)
	 * @throws {ValidationError}
	 * @throws {DatabaseError}
	 * @throws {ConcurrencyError}
	 */
	async updateConfig(
		newConfig: Partial<JackpotConfig>,
		adminContext: Partial<JackpotErrorContext> = {},
	): Promise<void> {
		const context = createOperationContext({
			operation: "updateConfig",
			domain: "jackpot",
			...adminContext,
		});
		const validatedConfig = validateJackpotConfigUpdate(newConfig, context);

		this.config = { ...this.config, ...validatedConfig };

		// Config keys are lowercase, map to uppercase DB types
		const affectedConfigKeys = Object.keys(validatedConfig) as ("minor" | "major" | "mega")[];
		if (affectedConfigKeys.length === 0) return;

		// --- REFACTORED: Map to DB enum types ---
		const affectedDbTypes = affectedConfigKeys.map((key) =>
			key === "mega" ? "GRAND" : (key.toUpperCase() as "MINOR" | "MAJOR"),
		);

		await ConcurrencySafeDB.batchOptimisticUpdate(
			"updateConfig",
			affectedDbTypes,
			async (pools, tx) => {
				for (const pool of pools) {
					const type = pool.jackpotType as JackpotType;
					// --- REFACTORED: Map DB type back to lowercase config key ---
					const configKey = type === "GRAND" ? "mega" : (type.toLowerCase() as "minor" | "major");
					const poolConfig = validatedConfig[configKey];

					if (!poolConfig) continue;

					const updateData: any = {
						updatedAt: new Date(),
						version: sql`version + 1`,
					};

					if (poolConfig.seedAmount !== undefined) updateData.seedAmount = poolConfig.seedAmount;
					if (poolConfig.maxAmount !== undefined) updateData.maxAmount = poolConfig.maxAmount;
					if (poolConfig.rate !== undefined) updateData.contributionRate = poolConfig.rate;

					await tx.update(jackpotTable).set(updateData).where(eq(jackpotTable.jackpotType, type));
				}
			},
			context,
		);
		appLogger.config("Jackpot configuration updated", context, {
			affectedTypes: affectedDbTypes,
		});
	}

	/**
	 * Get current jackpot pool for a type
	 * @throws {DatabaseError}
	 */
	async getPool(type: JackpotType): Promise<JackpotPool> {
		await this.ensureInitialized();
		const context = createOperationContext({ operation: "getPool", domain: "jackpot", type });

		try {
			const pools = await db.select().from(jackpotTable).where(eq(jackpotTable.jackpotType, type));

			const pool = pools[0];
			if (!pool) {
				throw createSystemError(`Jackpot pool not found for type: ${type}`, "SYSTEM_UNEXPECTED_STATE", context);
			}
			// --- REFACTORED: Cast to JackpotPool, which now expects uppercase type ---
			return pool as unknown as JackpotPool;
		} catch (error) {
			throw categorizeError(error as Error, context, "DATABASE");
		}
	}

	/**
	 * Get all jackpot pools
	 * @throws {DatabaseError}
	 */
	async getAllPools(): Promise<Record<JackpotType, JackpotPool>> {
		await this.ensureInitialized();
		const context = createOperationContext({ operation: "getAllPools", domain: "jackpot" });

		try {
			const pools = await db
				.select()
				.from(jackpotTable)
				.where(sql`${jackpotTable.jackpotType} IN ('MINOR', 'MAJOR', 'GRAND')`);

			const result: Record<JackpotType, JackpotPool> = {} as any;
			for (const pool of pools) {
				// --- REFACTORED: Cast to JackpotPool, which now expects uppercase type ---
				result[pool.jackpotType] = pool as unknown as JackpotPool;
			}
			return result;
		} catch (error) {
			throw categorizeError(error as Error, context, "DATABASE");
		}
	}

	/**
	 * Process jackpot contribution from a bet
	 * @throws {ValidationError}
	 * @throws {DatabaseError}
	 * @throws {ConcurrencyError}
	 */
	async contribute(
		gameId: string,
		wagerAmount: number,
	): Promise<{
		contributions: Record<JackpotType, number>;
		totalContribution: number;
	}> {
		const context = createOperationContext({ operation: "contribute", domain: "jackpot", gameId });
		const { gameId: validatedGameId, wagerAmount: validatedWagerAmount } = validateJackpotContributionRequest(
			{ gameId, wagerAmount },
			context,
		);

		const gameJackpotTypes = this.getGameJackpotTypes(validatedGameId);
		if (gameJackpotTypes.length === 0) {
			return {
				contributions: { MINOR: 0, MAJOR: 0, GRAND: 0 },
				totalContribution: 0,
			};
		}

		const result = await ConcurrencySafeDB.batchOptimisticUpdate(
			"contribute",
			gameJackpotTypes,
			async (pools, tx) => {
				// --- REFACTORED: Use uppercase enum values ---
				const contributions: Record<JackpotType, number> = {
					MINOR: 0,
					MAJOR: 0,
					GRAND: 0,
				};
				let totalContribution = 0;

				for (const pool of pools) {
					const type = pool.jackpotType as JackpotType;
					// --- REFACTORED: Map uppercase DB type to lowercase config key ---
					const configKey = type === "GRAND" ? "mega" : (type.toLowerCase() as "minor" | "major");
					const rate = this.config[configKey].rate || 0;
					const contribution = Math.floor(validatedWagerAmount * rate);

					if (contribution > 0) {
						const maxAmount = this.config[configKey].maxAmount;
						let actualContribution = contribution;

						if (maxAmount && pool.currentAmount + contribution > maxAmount) {
							actualContribution = Math.max(0, maxAmount - pool.currentAmount);
						}

						if (actualContribution > 0) {
							contributions[type] = actualContribution;
							totalContribution += actualContribution;

							await tx
								.update(jackpotTable)
								.set({
									currentAmount: sql`current_amount + ${actualContribution}`,
									totalContributions: sql`total_contributions + ${actualContribution}`,
									version: sql`version + 1`,
									updatedAt: new Date(),
								})
								.where(eq(jackpotTable.jackpotType, type));

							const contributionRecord: Omit<JackpotContributionHistory, "id"> = {
								jackpotId: pool.id,
								jackpotType: type,
								wagerAmount: validatedWagerAmount,
								contributionAmount: actualContribution,
								winAmount: 0,
								betTransactionId: `bet_${context.operationId}`,
								gameId: validatedGameId,
								operatorId: "system",
								createdAt: new Date(),
							};
							await tx.insert(jackpotContributionHistoryTable).values(contributionRecord);
						}
					}
				}
				return { contributions, totalContribution };
			},
			context,
		);

		return result.data;
	}

	/**
	 * Process jackpot win
	 * @throws {ValidationError}
	 * @throws {InsufficientFundsError}
	 * @throws {DatabaseError}
	 * @throws {ConcurrencyError}
	 */
	async processWin(
		type: JackpotType,
		gameId: string,
		userId: string,
		winAmount?: number,
	): Promise<{ actualWinAmount: number; remainingAmount: number }> {
		const context = createOperationContext({
			operation: "processWin",
			domain: "jackpot",
			type,
			gameId,
			userId,
		});
		const {
			type: validatedType,
			gameId: validatedGameId,
			userId: validatedUserId,
			winAmount: validatedWinAmount,
		} = validateJackpotWinRequest({ type, gameId, userId, winAmount }, context);

		const result = await ConcurrencySafeDB.pessimisticUpdate(
			"processWin",
			validatedType,
			async (pool, tx) => {
				const actualWinAmount = validatedWinAmount || pool.currentAmount;

				if (actualWinAmount <= 0) {
					throw createValidationError("Invalid win amount", "VALIDATION_INVALID_AMOUNT", context);
				}

				if (actualWinAmount > pool.currentAmount) {
					throw createInsufficientFundsError(
						`Win amount ${actualWinAmount} exceeds available jackpot ${pool.currentAmount}`,
						"INSUFFICIENT_JACKPOT_FUNDS",
						context,
					);
				}

				const newAmount = pool.currentAmount - actualWinAmount;
				const resetAmount = newAmount < (pool.seedAmount || 0) ? pool.seedAmount || 0 : newAmount;

				await tx
					.update(jackpotTable)
					.set({
						currentAmount: resetAmount,
						totalWins: sql`total_wins + ${actualWinAmount}`,
						lastWonAmount: actualWinAmount,
						lastWonAt: new Date(),
						lastWonByUserId: validatedUserId,
						version: sql`version + 1`,
						updatedAt: new Date(),
					})
					.where(eq(jackpotTable.jackpotType, validatedType));

				const winRecord: Omit<JackpotWinHistory, "id" | "createdAt"> = {
					jackpotId: pool.id,
					jackpotType: validatedType,
					userId: validatedUserId,
					gameId: validatedGameId,
					amountWon: actualWinAmount,
					winningSpinTransactionId: `win_${context.operationId}`,
					timeStampOfWin: new Date(),
					numberOfJackpotWinsForUserBefore: 0, // TODO: Query user's win count
					numberOfJackpotWinsForUserAfter: 1, // TODO: Query user's win count + 1
					operatorId: "system",
					userCreateDate: null, // TODO: Query user's creation date
					videoClipLocation: "",
				};
				await tx.insert(jackpotWinHistoryTable).values(winRecord);

				appLogger.info(`Jackpot win processed: ${validatedType} - ${actualWinAmount} cents`, context);

				return {
					actualWinAmount,
					remainingAmount: resetAmount,
				};
			},
			context,
		);

		return result.data;
	}

	/**
	 * Get jackpot types for a specific game (admin-configurable)
	 */
	// --- REFACTORED: Returns uppercase enum values ---
	getGameJackpotTypes(_gameId: string): JackpotType[] {
		return ["MINOR"];
	}

	/**
	 * Get statistics for all jackpot types
	 * @throws {DatabaseError}
	 */
	async getStatistics(): Promise<{
		pools: Record<JackpotType, JackpotPool>;
		totalContributions: number;
		totalWins: number;
		totalGamesContributing: number;
	}> {
		const pools = await this.getAllPools();
		const totalContributions = Object.values(pools).reduce((sum, pool) => sum + (pool.totalContributions || 0), 0);
		const totalWins = Object.values(pools).reduce((sum, pool) => sum + (pool.totalWins || 0), 0);
		const totalGamesContributing = 1;

		return {
			pools,
			totalContributions,
			totalWins,
			totalGamesContributing,
		};
	}
}

// ========================================
// PUBLIC API (SINGLETON INSTANCE)
// ========================================

export const jackpotManager = new JackpotManager();

/**
 * Process jackpot contribution for a bet
 */
export async function processJackpotContribution(
	gameId: string,
	wagerAmount: number,
): Promise<JackpotContributionResult> {
	const context = createOperationContext({
		operation: "processJackpotContribution",
		domain: "jackpot",
		gameId,
	});
	try {
		const result = await jackpotManager.contribute(gameId, wagerAmount);
		return {
			success: true,
			...result,
		};
	} catch (error) {
		const jackpotError = categorizeError(error as Error, context);
		appLogger.error("Failed to process jackpot contribution", context, jackpotError);
		return {
			success: false,
			// --- REFACTORED: Use uppercase enum keys ---
			contributions: { MINOR: 0, MAJOR: 0, GRAND: 0 },
			totalContribution: 0,
			error: jackpotError.message,
		};
	}
}

/**
 * Process jackpot win
 */
export async function processJackpotWin(
	// --- REFACTORED: type is now uppercase enum ---
	type: JackpotType,
	gameId: string,
	userId: string,
	winAmount?: number,
): Promise<JackpotWinResult> {
	const context = createOperationContext({
		operation: "processJackpotWin",
		domain: "jackpot",
		type,
		gameId,
		userId,
	});
	try {
		const result = await jackpotManager.processWin(type, gameId, userId, winAmount);
		return {
			success: true,
			...result,
		};
	} catch (error) {
		const jackpotError = categorizeError(error as Error, context);
		appLogger.error("Failed to process jackpot win", context, jackpotError);
		return {
			success: false,
			actualWinAmount: 0,
			error: jackpotError.message,
		};
	}
}

/**
 * Get current jackpot pools
 */
export async function getJackpotPools(): Promise<Record<JackpotType, JackpotPool>> {
	try {
		return await jackpotManager.getAllPools();
	} catch (error) {
		appLogger.error("Failed to get all jackpot pools", createOperationContext({ domain: "jackpot" }), error);
		return {
			MINOR: {} as JackpotPool,
			MAJOR: {} as JackpotPool,
			GRAND: {} as JackpotPool,
		};
	}
}

/**
 * Get jackpot pool for specific type
 */
export async function getJackpotPool(type: JackpotType): Promise<JackpotPool> {
	try {
		return await jackpotManager.getPool(type);
	} catch (error) {
		appLogger.error(`Failed to get jackpot pool: ${type}`, createOperationContext({ domain: "jackpot", type }), error);
		throw error;
	}
}

/**
 * Update jackpot configuration (admin function)
 */
export async function updateJackpotConfig(
	config: Partial<JackpotConfig>,
): Promise<{ success: boolean; error?: string }> {
	const context = createOperationContext({ operation: "updateJackpotConfig", domain: "jackpot" });
	try {
		await jackpotManager.updateConfig(config, context);
		return { success: true };
	} catch (error) {
		const jackpotError = categorizeError(error as Error, context);
		appLogger.error("Failed to update jackpot config", context, jackpotError);
		return {
			success: false,
			error: jackpotError.message,
		};
	}
}

/**
 * Get jackpot statistics
 */
export async function getJackpotStatistics() {
	try {
		return await jackpotManager.getStatistics();
	} catch (error) {
		appLogger.error("Failed to get jackpot statistics", createOperationContext({ domain: "jackpot" }), error);
		return {
			pools: {},
			totalContributions: 0,
			totalWins: 0,
			totalGamesContributing: 0,
		};
	}
}

/**
 * Check if game contributes to any jackpot
 */
export function doesGameHaveJackpot(gameId: string): boolean {
	const types = jackpotManager.getGameJackpotTypes(gameId);
	return types.length > 0;
}

/**
 * Get contribution rate for a specific game and jackpot type
 */
export function getGameContributionRate(gameId: string, type: JackpotType): number {
	const types = jackpotManager.getGameJackpotTypes(gameId);
	// --- REFACTORED: Map uppercase DB type to lowercase config key ---
	const configKey = type === "GRAND" ? "mega" : (type.toLowerCase() as "minor" | "major");
	return types.includes(type) ? jackpotManager.getConfig()[configKey].rate || 0 : 0;
}

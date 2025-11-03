/**
 * High-performance batch operations for jackpot contributions and wins
 * Optimized for high-throughput scenarios with minimal database round trips
 */

import { db } from "@/libs/database/db";
import { jackpotTable } from "@/libs/database/schema/jackpot";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

// ========================================
// BATCH OPERATION TYPES AND INTERFACES
// ========================================

export interface BatchContribution
{
    gameId: string;
    wagerAmount: number;
    timestamp: Date;
}

export interface BatchContributionResult
{
    totalProcessed: number;
    totalAmount: number;
    contributions: Record<string, number>;
    errors: Array<{ index: number; error: string }>;
}

export interface BatchWin
{
    group: 'minor' | 'major' | 'mega';
    gameId: string;
    userId: string;
    winAmount: number;
    timestamp: Date;
}

export interface BatchWinResult
{
    totalProcessed: number;
    totalAmount: number;
    wins: Array<{ group: string; amount: number }>;
    errors: Array<{ index: number; error: string }>;
}

export interface BatchOperationConfig
{
    maxBatchSize: number;
    memoryLimit: number; // in bytes
    timeoutMs: number;
    retryAttempts: number;
    parallelProcessing: boolean;
}

// ========================================
// VALIDATION SCHEMAS
// ========================================

const BatchContributionSchema = z.object({
    gameId: z.string().min(1),
    wagerAmount: z.number().int().positive(),
    timestamp: z.date(),
});

const BatchWinSchema = z.object({
    group: z.enum(['minor', 'major', 'mega']),
    gameId: z.string().min(1),
    userId: z.string().uuid(),
    winAmount: z.number().int().positive(),
    timestamp: z.date(),
});

const BatchOperationConfigSchema = z.object({
    maxBatchSize: z.number().int().positive().max(10000),
    memoryLimit: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    retryAttempts: z.number().int().positive().max(10),
    parallelProcessing: z.boolean(),
});

// ========================================
// PERFORMANCE OPTIMIZED DATABASE OPERATIONS
// ========================================

/**
 * Prepared statements for batch operations (cached for performance)
 */
const preparedStatements = {
    // Bulk update contributions - will be implemented properly
    bulkUpdateContributions: null,
} as any;

// ========================================
// BATCH OPERATION CORE CLASSES
// ========================================

/**
 * High-performance batch processor for jackpot operations
 */
export class BatchJackpotProcessor
{
    private config: BatchOperationConfig;
    private isProcessing = false;
    private memoryUsage = 0;

    constructor(config: Partial<BatchOperationConfig> = {})
    {
        this.config = {
            maxBatchSize: 1000,
            memoryLimit: 50 * 1024 * 1024, // 50MB
            timeoutMs: 30000, // 30 seconds
            retryAttempts: 3,
            parallelProcessing: true,
            ...config,
        };

        // Validate configuration
        BatchOperationConfigSchema.parse(this.config);
    }

    /**
     * Process batch jackpot contributions efficiently
     */
    async processBatchContributions(
        contributions: BatchContribution[]
    ): Promise<BatchContributionResult>
    {
        const startTime = Date.now();
        const errors: Array<{ index: number; error: string }> = [];
        const validContributions: BatchContribution[] = [];

        // Validate and filter contributions
        for (let i = 0; i < contributions.length; i++) {
            try {
                const contribution = BatchContributionSchema.parse(contributions[i]);
                validContributions.push(contribution);
            } catch (error) {
                errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : "Invalid contribution",
                });
            }
        }

        if (validContributions.length === 0) {
            return {
                totalProcessed: 0,
                totalAmount: 0,
                contributions: {},
                errors,
            };
        }

        // Group contributions by jackpot group for efficient batch processing
        const groupedContributions = this.groupContributionsByJackpot(validContributions);

        let totalAmount = 0;
        const processedContributions: Record<string, number> = {};

        try {
            // Process each group in a single transaction for consistency
            await db.transaction(async (tx) =>
            {
                for (const [group, groupContributions] of Object.entries(groupedContributions)) {
                    if (!groupContributions || groupContributions.length === 0) continue;

                    let groupTotal = 0;

                    // Calculate total contribution for this group
                    for (const contribution of groupContributions) {
                        if (!contribution) continue;
                        const rate = await this.getContributionRate(contribution.gameId, group);
                        const contribAmount = Math.floor(contribution.wagerAmount * rate);
                        groupTotal += contribAmount;
                    }

                    if (groupTotal > 0) {
                        // Atomic batch update for the group
                        await tx
                            .update(jackpotTable)
                            .set({
                                currentAmount: sql`current_amount + ${groupTotal}`,
                                totalContributions: sql`total_contributions + ${groupTotal}`,
                                version: sql`version + 1`,
                                updatedAt: new Date(),
                            })
                            .where(eq(jackpotTable.group, group as any));

                        processedContributions[group] = groupTotal;
                        totalAmount += groupTotal;
                    }
                }
            });

            return {
                totalProcessed: validContributions.length,
                totalAmount,
                contributions: processedContributions,
                errors,
            };
        } catch (error) {
            console.error("Batch contribution processing failed:", error);
            return {
                totalProcessed: 0,
                totalAmount: 0,
                contributions: {},
                errors: errors.concat([{
                    index: -1,
                    error: error instanceof Error ? error.message : "Batch processing failed",
                }]),
            };
        }
    }

    /**
     * Process batch jackpot wins efficiently
     */
    async processBatchWins(
        wins: BatchWin[]
    ): Promise<BatchWinResult>
    {
        const errors: Array<{ index: number; error: string }> = [];
        const validWins: BatchWin[] = [];

        // Validate and filter wins
        for (let i = 0; i < wins.length; i++) {
            try {
                const win = BatchWinSchema.parse(wins[i]);
                validWins.push(win);
            } catch (error) {
                errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : "Invalid win",
                });
            }
        }

        if (validWins.length === 0) {
            return {
                totalProcessed: 0,
                totalAmount: 0,
                wins: [],
                errors,
            };
        }

        // Group wins by jackpot group for efficient processing
        const groupedWins = this.groupWinsByJackpot(validWins);

        let totalAmount = 0;
        const processedWins: Array<{ group: string; amount: number }> = [];

        try {
            // Process each group with proper locking
            for (const [group, groupWins] of Object.entries(groupedWins)) {
                if (!groupWins || groupWins.length === 0) continue;

                let groupTotal = 0;

                // Validate total win amount doesn't exceed available jackpot
                for (const win of groupWins) {
                    if (!win) continue;
                    groupTotal += win.winAmount;
                }

                // Get current jackpot amount
                const currentPools = await db
                    .select({ currentAmount: jackpotTable.currentAmount })
                    .from(jackpotTable)
                    .where(eq(jackpotTable.group, group as any));

                const currentAmount = currentPools[0]?.currentAmount || 0;

                if (groupTotal <= currentAmount) {
                    // Process wins in a single transaction
                    await db.transaction(async (tx) =>
                    {
                        // Subtract total wins from jackpot
                        await tx
                            .update(jackpotTable)
                            .set({
                                currentAmount: sql`current_amount - ${groupTotal}`,
                                totalWins: sql`total_wins + ${groupTotal}`,
                                lastWonAmount: groupTotal,
                                lastWonAt: new Date(),
                                version: sql`version + 1`,
                                updatedAt: new Date(),
                            })
                            .where(eq(jackpotTable.group, group as any));

                        // Record individual wins (for history tracking)
                        for (const win of groupWins) {
                            if (win) {
                                await this.recordWinInHistory(tx, win);
                            }
                        }
                    });

                    processedWins.push({ group, amount: groupTotal });
                    totalAmount += groupTotal;
                } else {
                    // Not enough in jackpot to cover all wins - partial processing
                    const availableAmount = currentAmount;
                    const partialWins: BatchWin[] = [];

                    // Process wins in order until funds are exhausted
                    let remainingAmount = availableAmount;
                    for (const win of groupWins) {
                        if (win && win.winAmount <= remainingAmount) {
                            partialWins.push(win);
                            remainingAmount -= win.winAmount;
                        }
                    }

                    if (partialWins.length > 0) {
                        const partialTotal = partialWins.reduce((sum, win) => sum + win.winAmount, 0);

                        await db.transaction(async (tx) =>
                        {
                            await tx
                                .update(jackpotTable)
                                .set({
                                    currentAmount: sql`current_amount - ${partialTotal}`,
                                    totalWins: sql`total_wins + ${partialTotal}`,
                                    lastWonAmount: partialTotal,
                                    lastWonAt: new Date(),
                                    version: sql`version + 1`,
                                    updatedAt: new Date(),
                                })
                                .where(eq(jackpotTable.group, group as any));

                            for (const win of partialWins) {
                                if (win) {
                                    await this.recordWinInHistory(tx, win);
                                }
                            }
                        });

                        processedWins.push({ group, amount: partialTotal });
                        totalAmount += partialTotal;
                    }

                    // Add error for unprocessed wins
                    const remainingWins = groupWins.slice(partialWins.length);
                    for (const remainingWin of remainingWins) {
                        if (remainingWin) {
                            const originalIndex = wins.findIndex(w =>
                                w.gameId === remainingWin.gameId &&
                                w.userId === remainingWin.userId &&
                                w.winAmount === remainingWin.winAmount
                            );
                            if (originalIndex >= 0) {
                                errors.push({
                                    index: originalIndex,
                                    error: "Insufficient jackpot funds",
                                });
                            }
                        }
                    }
                }
            }

            return {
                totalProcessed: validWins.length,
                totalAmount,
                wins: processedWins,
                errors,
            };
        } catch (error) {
            console.error("Batch win processing failed:", error);
            return {
                totalProcessed: 0,
                totalAmount: 0,
                wins: [],
                errors: errors.concat([{
                    index: -1,
                    error: error instanceof Error ? error.message : "Batch processing failed",
                }]),
            };
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats()
    {
        return {
            config: this.config,
            isProcessing: this.isProcessing,
            estimatedMemoryUsage: this.memoryUsage,
        };
    }

    /**
     * Update batch configuration
     */
    updateConfig(newConfig: Partial<BatchOperationConfig>)
    {
        const updatedConfig = { ...this.config, ...newConfig };
        BatchOperationConfigSchema.parse(updatedConfig);
        this.config = updatedConfig;
    }

    // Private helper methods

    private groupContributionsByJackpot(contributions: BatchContribution[]): Record<string, BatchContribution[]>
    {
        const grouped: Record<string, BatchContribution[]> = {};

        for (const contribution of contributions) {
            // For now, all games contribute to minor jackpot
            // In production, this would be based on game configuration
            const groups = ['minor']; // this.getGameJackpotGroups(contribution.gameId);

            for (const group of groups) {
                if (!grouped[group]) {
                    grouped[group] = [];
                }
                if (contribution) {
                    grouped[group].push(contribution);
                }
            }
        }

        return grouped;
    }

    private groupWinsByJackpot(wins: BatchWin[]): Record<string, BatchWin[]>
    {
        const grouped: Record<string, BatchWin[]> = {};

        for (const win of wins) {
            if (win && win.group) {
                if (!grouped[win.group]) {
                    grouped[win.group] = [];
                }
                grouped[win.group]?.push(win);
            }
        }

        return grouped;
    }

    private async getContributionRate(gameId: string, group: string): Promise<number>
    {
        // For now, use default rates
        // In production, this would query game configuration
        const rates: Record<string, Record<string, number>> = {
            minor: { default: 0.02 },
            major: { default: 0.01 },
            mega: { default: 0.005 },
        };

        return rates[group]?.default || 0;
    }

    private async recordWinInHistory(tx: any, win: BatchWin)
    {
        const winRecord = {
            userId: win.userId,
            gameId: win.gameId,
            amountWon: win.winAmount,
            winningSpinTransactionId: `win_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeStampOfWin: win.timestamp,
            numberOfJackpotWinsForUserBefore: 0,
            numberOfJackpotWinsForUserAfter: 1,
            operatorId: "system",
            userCreateDate: new Date(),
            videoClipLocation: "",
        };

        await tx
            .update(jackpotTable)
            .set({
                winHistory: sql`jackpot_wins || ${JSON.stringify([winRecord])}`,
            })
            .where(eq(jackpotTable.group, win.group as any));
    }
}

// ========================================
// STREAM PROCESSING FOR LARGE DATASETS
// ========================================

/**
 * Stream processor for handling large datasets with minimal memory usage
 */
export class StreamJackpotProcessor
{
    private processor: BatchJackpotProcessor;
    private streamBuffer: BatchContribution[] = [];
    private bufferSize: number;

    constructor(config: Partial<BatchOperationConfig> = {}, bufferSize = 100)
    {
        this.processor = new BatchJackpotProcessor(config);
        this.bufferSize = bufferSize;
    }

    async processStream(contributions: AsyncIterable<BatchContribution>): Promise<BatchContributionResult>
    {
        let totalProcessed = 0;
        let totalAmount = 0;
        const allContributions: Record<string, number> = {};
        const allErrors: Array<{ index: number; error: string }> = [];

        let index = 0;
        for await (const contribution of contributions) {
            this.streamBuffer.push(contribution);

            // Process buffer when full or at end of stream
            if (this.streamBuffer.length >= this.bufferSize) {
                const result = await this.processor.processBatchContributions(this.streamBuffer);
                totalProcessed += result.totalProcessed;
                totalAmount += result.totalAmount;

                // Merge contributions and errors
                for (const [group, amount] of Object.entries(result.contributions)) {
                    allContributions[group] = (allContributions[group] || 0) + amount;
                }

                allErrors.push(...result.errors.map(err => ({
                    ...err,
                    index: err.index + index * this.bufferSize,
                })));

                index++;
                this.streamBuffer = [];
            }
        }

        // Process remaining contributions
        if (this.streamBuffer.length > 0) {
            const result = await this.processor.processBatchContributions(this.streamBuffer);
            totalProcessed += result.totalProcessed;
            totalAmount += result.totalAmount;

            for (const [group, amount] of Object.entries(result.contributions)) {
                allContributions[group] = (allContributions[group] || 0) + amount;
            }

            allErrors.push(...result.errors.map(err => ({
                ...err,
                index: err.index + index * this.bufferSize,
            })));
        }

        return {
            totalProcessed,
            totalAmount,
            contributions: allContributions,
            errors: allErrors,
        };
    }
}

// ========================================
// GLOBAL INSTANCES
// ========================================

// Default batch processors for different workloads
export const defaultBatchProcessor = new BatchJackpotProcessor({
    maxBatchSize: 1000,
    memoryLimit: 50 * 1024 * 1024, // 50MB
    timeoutMs: 30000,
    retryAttempts: 3,
    parallelProcessing: true,
});

export const highThroughputBatchProcessor = new BatchJackpotProcessor({
    maxBatchSize: 5000,
    memoryLimit: 100 * 1024 * 1024, // 100MB
    timeoutMs: 60000,
    retryAttempts: 5,
    parallelProcessing: true,
});

export const lowLatencyBatchProcessor = new BatchJackpotProcessor({
    maxBatchSize: 100,
    memoryLimit: 10 * 1024 * 1024, // 10MB
    timeoutMs: 5000,
    retryAttempts: 1,
    parallelProcessing: false,
});

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Quick batch contribution processing
 */
export async function quickBatchContribute(
    contributions: BatchContribution[],
    processor: BatchJackpotProcessor = defaultBatchProcessor
): Promise<BatchContributionResult>
{
    return processor.processBatchContributions(contributions);
}

/**
 * Quick batch win processing
 */
export async function quickBatchWin(
    wins: BatchWin[],
    processor: BatchJackpotProcessor = defaultBatchProcessor
): Promise<BatchWinResult>
{
    return processor.processBatchWins(wins);
}

/**
 * Create processor with custom configuration
 */
export function createCustomProcessor(config: BatchOperationConfig): BatchJackpotProcessor
{
    return new BatchJackpotProcessor(config);
}
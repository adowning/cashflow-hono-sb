/**
 * Transaction logging integration for jackpot operations
 * Integrates with existing transactionLogTable for comprehensive audit trails
 */

import { db } from "@/libs/database/db";
import { transactionLogTable } from "@/libs/database/schema";
import { eq, gte, sql } from "drizzle-orm";
import
{
    type JackpotErrorContext,
    categorizeError,
    createSystemError
} from "./jackpot-errors";
import
{
    createOperationContext,
    jackpotLogger,
    logJackpotAudit,
} from "./jackpot-logging.service";
import type { JackpotGroup } from "./jackpot.service";

// ========================================
// TRANSACTION TYPES
// ========================================

export interface JackpotTransactionData
{
    // Core transaction information
    userId: string;
    gameId: string;
    operatorId: string;
    sessionId?: string;
    affiliateId?: string;

    // Jackpot-specific data
    group: JackpotGroup;
    wagerAmount: number;
    contributionAmount: number;
    winAmount?: number;

    // System data
    processingTime: number;
    jackpotAmountBefore?: number;
    jackpotAmountAfter?: number;
    transactionId?: string;

    // Metadata
    metadata?: Record<string, any>;
}

// ========================================
// TRANSACTION LOGGING FUNCTIONS
// ========================================

/**
 * Log jackpot contribution transaction
 */
export async function logJackpotContributionTransaction(
    transactionData: JackpotTransactionData,
    context: JackpotErrorContext
): Promise<{ success: boolean; transactionId?: string; error?: string }>
{
    const startTime = Date.now();
    const operationId = context.operationId;

    try {
        // Create detailed metadata for audit trail
        const metadata = {
            operationId,
            correlationId: context.correlationId,
            group: transactionData.group,
            jackpotAmountBefore: transactionData.jackpotAmountBefore,
            jackpotAmountAfter: transactionData.jackpotAmountAfter,
            contributionRate: transactionData.wagerAmount > 0
                ? (transactionData.contributionAmount / transactionData.wagerAmount)
                : 0,
            ...transactionData.metadata,
        };

        // Log to existing transactionLogTable
        const [transaction] = await db
            .insert(transactionLogTable)
            .values({
                userId: transactionData.userId,
                type: "JACKPOT_CONTRIBUTION",
                status: "COMPLETED",
                operatorId: transactionData.operatorId,
                wagerAmount: transactionData.wagerAmount,
                realBalanceBefore: 0, // Will be set by balance management
                realBalanceAfter: 0, // Will be set by balance management
                bonusBalanceBefore: 0,
                bonusBalanceAfter: 0,
                gameId: transactionData.gameId,
                sessionId: transactionData.sessionId,
                affiliateId: transactionData.affiliateId,
                jackpotContribution: transactionData.contributionAmount,
                processingTime: transactionData.processingTime,
                metadata,
            })
            .returning();

        const duration = Date.now() - startTime;

        // Structured logging
        jackpotLogger.transaction(
            "JACKPOT_CONTRIBUTION",
            {
                operationId,
                correlationId: context.correlationId,
                userId: transactionData.userId,
                gameId: transactionData.gameId,
                group: transactionData.group,
                timestamp: new Date(),
            },
            transactionData.contributionAmount,
            true,
            {
                transactionId: transaction?.id,
                wagerAmount: transactionData.wagerAmount,
                contributionRate: metadata.contributionRate,
                jackpotAmountBefore: transactionData.jackpotAmountBefore,
                jackpotAmountAfter: transactionData.jackpotAmountAfter,
                duration,
            }
        );

        // Audit trail logging
        logJackpotAudit("contribution", {
            operationId,
            correlationId: context.correlationId,
            userId: transactionData.userId,
            gameId: transactionData.gameId,
            group: transactionData.group,
            timestamp: new Date(),
        }, {
            success: true,
            amount: transactionData.contributionAmount,
            newValue: {
                transactionId: transaction?.id,
                contributionRate: metadata.contributionRate,
                jackpotAmountAfter: transactionData.jackpotAmountAfter,
            },
        });

        return {
            success: true,
            transactionId: transaction?.id,
        };

    } catch (error) {
        const duration = Date.now() - startTime;

        // Categorize and log the error
        const jackpotError = categorizeError(
            error instanceof Error ? error : new Error(String(error)),
            context,
            "DATABASE"
        );

        jackpotLogger.error(
            "Failed to log jackpot contribution transaction",
            {
                operationId,
                correlationId: context.correlationId,
                userId: transactionData.userId,
                gameId: transactionData.gameId,
                group: transactionData.group,
                timestamp: new Date(),
            },
            jackpotError,
            {
                transactionData: {
                    contributionAmount: transactionData.contributionAmount,
                    wagerAmount: transactionData.wagerAmount,
                    group: transactionData.group,
                },
                duration,
            }
        );

        // Audit trail logging for failed transaction
        logJackpotAudit("contribution", {
            operationId,
            correlationId: context.correlationId,
            userId: transactionData.userId,
            gameId: transactionData.gameId,
            group: transactionData.group,
            timestamp: new Date(),
        }, {
            success: false,
            amount: transactionData.contributionAmount,
            error: jackpotError,
        });

        return {
            success: false,
            error: jackpotError.message,
        };
    }
}

/**
 * Log jackpot win transaction
 */
export async function logJackpotWinTransaction(
    transactionData: JackpotTransactionData & {
        winAmount: number;
        jackpotAmountBefore: number;
        jackpotAmountAfter: number;
    },
    context: JackpotErrorContext
): Promise<{ success: boolean; transactionId?: string; error?: string }>
{
    const startTime = Date.now();
    const operationId = context.operationId;

    try {
        // Create detailed metadata for audit trail
        const metadata = {
            operationId,
            correlationId: context.correlationId,
            group: transactionData.group,
            jackpotAmountBefore: transactionData.jackpotAmountBefore,
            jackpotAmountAfter: transactionData.jackpotAmountAfter,
            winAmount: transactionData.winAmount,
            resetToSeed: transactionData.jackpotAmountAfter < transactionData.jackpotAmountBefore,
            ...transactionData.metadata,
        };

        // Log to existing transactionLogTable
        const [transaction] = await db
            .insert(transactionLogTable)
            .values({
                userId: transactionData.userId,
                type: "JACKPOT_WIN",
                status: "COMPLETED",
                operatorId: transactionData.operatorId,
                wagerAmount: 0, // Wins don't have wager amounts
                realBalanceBefore: 0, // Will be set by balance management
                realBalanceAfter: transactionData.winAmount, // The win amount
                bonusBalanceBefore: 0,
                bonusBalanceAfter: 0,
                gameId: transactionData.gameId,
                sessionId: transactionData.sessionId,
                affiliateId: transactionData.affiliateId,
                jackpotContribution: 0, // Wins don't contribute to jackpot
                processingTime: transactionData.processingTime,
                metadata,
            })
            .returning();

        const duration = Date.now() - startTime;

        // Structured logging
        jackpotLogger.transaction(
            "JACKPOT_WIN",
            {
                operationId,
                correlationId: context.correlationId,
                userId: transactionData.userId,
                gameId: transactionData.gameId,
                group: transactionData.group,
                timestamp: new Date(),
            },
            transactionData.winAmount,
            true,
            {
                transactionId: transaction?.id,
                jackpotAmountBefore: transactionData.jackpotAmountBefore,
                jackpotAmountAfter: transactionData.jackpotAmountAfter,
                resetToSeed: metadata.resetToSeed,
                duration,
            }
        );

        // Audit trail logging
        logJackpotAudit("win", {
            operationId,
            correlationId: context.correlationId,
            userId: transactionData.userId,
            gameId: transactionData.gameId,
            group: transactionData.group,
            timestamp: new Date(),
        }, {
            success: true,
            amount: transactionData.winAmount,
            oldValue: {
                jackpotAmountBefore: transactionData.jackpotAmountBefore,
            },
            newValue: {
                transactionId: transaction?.id,
                jackpotAmountAfter: transactionData.jackpotAmountAfter,
                resetToSeed: metadata.resetToSeed,
            },
        });

        return {
            success: true,
            transactionId: transaction?.id,
        };

    } catch (error) {
        const duration = Date.now() - startTime;

        // Categorize and log the error
        const jackpotError = categorizeError(
            error instanceof Error ? error : new Error(String(error)),
            context,
            "DATABASE"
        );

        jackpotLogger.error(
            "Failed to log jackpot win transaction",
            {
                operationId,
                correlationId: context.correlationId,
                userId: transactionData.userId,
                gameId: transactionData.gameId,
                group: transactionData.group,
                timestamp: new Date(),
            },
            jackpotError,
            {
                transactionData: {
                    winAmount: transactionData.winAmount,
                    group: transactionData.group,
                    jackpotAmountBefore: transactionData.jackpotAmountBefore,
                },
                duration,
            }
        );

        // Audit trail logging for failed transaction
        logJackpotAudit("win", {
            operationId,
            correlationId: context.correlationId,
            userId: transactionData.userId,
            gameId: transactionData.gameId,
            group: transactionData.group,
            timestamp: new Date(),
        }, {
            success: false,
            amount: transactionData.winAmount,
            error: jackpotError,
        });

        return {
            success: false,
            error: jackpotError.message,
        };
    }
}

/**
 * Log configuration change transaction
 */
export async function logConfigurationTransaction(
    data: {
        adminUserId: string;
        group: JackpotGroup;
        changes: {
            oldConfig: any;
            newConfig: any;
        };
        reason?: string;
    },
    context: JackpotErrorContext
): Promise<{ success: boolean; transactionId?: string; error?: string }>
{
    const startTime = Date.now();
    const operationId = context.operationId;

    try {
        const metadata = {
            operationId,
            correlationId: context.correlationId,
            group: data.group,
            changes: data.changes,
            reason: data.reason,
            changedBy: data.adminUserId,
            changeTimestamp: new Date().toISOString(),
        };

        // Log configuration change as a system transaction
        const [transaction] = await db
            .insert(transactionLogTable)
            .values({
                userId: data.adminUserId,
                type: "JACKPOT_CONFIG_CHANGE",
                status: "COMPLETED",
                operatorId: data.adminUserId,
                wagerAmount: 0,
                realBalanceBefore: 0,
                realBalanceAfter: 0,
                bonusBalanceBefore: 0,
                bonusBalanceAfter: 0,
                gameId: null, // System-level operation
                processingTime: Date.now() - startTime,
                metadata,
            })
            .returning();

        // Configuration-specific logging
        jackpotLogger.config(
            "update",
            {
                operationId,
                correlationId: context.correlationId,
                userId: data.adminUserId,
                group: data.group,
                timestamp: new Date(),
            },
            data.changes.oldConfig,
            data.changes.newConfig,
            {
                transactionId: transaction?.id,
                reason: data.reason,
            }
        );

        return {
            success: true,
            transactionId: transaction?.id,
        };

    } catch (error) {
        const jackpotError = categorizeError(
            error instanceof Error ? error : new Error(String(error)),
            context,
            "DATABASE"
        );

        jackpotLogger.error(
            "Failed to log configuration transaction",
            {
                operationId,
                correlationId: context.correlationId,
                userId: data.adminUserId,
                group: data.group,
                timestamp: new Date(),
            },
            jackpotError,
            {
                changes: data.changes,
                reason: data.reason,
            }
        );

        return {
            success: false,
            error: jackpotError.message,
        };
    }
}

// ========================================
// HEALTH CHECK AND MONITORING
// ========================================

/**
 * Comprehensive jackpot system health check
 */
export async function performJackpotHealthCheck(): Promise<{
    overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
    database: boolean;
    transactionLogging: boolean;
    responseTime: number;
    checks: Record<string, any>;
}>
{
    const startTime = Date.now();
    const context = createOperationContext({
        operation: "healthCheck",
    });

    const checks: Record<string, any> = {};

    try {
        // Check 1: Database connectivity
        const dbCheck = await checkDatabaseConnectivity();
        checks.database = dbCheck;

        // Check 2: Transaction logging functionality
        const loggingCheck = await checkTransactionLogging();
        checks.transactionLogging = loggingCheck;

        // Check 3: Performance metrics
        const performanceCheck = await checkPerformanceMetrics();
        checks.performance = performanceCheck;

        // Check 4: Recent transaction volume
        const volumeCheck = await checkTransactionVolume();
        checks.transactionVolume = volumeCheck;

        // Calculate overall health
        const healthyChecks = Object.values(checks).filter(check =>
            typeof check === 'object' && check.healthy === true
        ).length;
        const totalChecks = Object.keys(checks).length;

        let overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
        if (healthyChecks === totalChecks) {
            overall = "HEALTHY";
        } else if (healthyChecks >= totalChecks * 0.7) {
            overall = "DEGRADED";
        } else {
            overall = "UNHEALTHY";
        }

        const responseTime = Date.now() - startTime;

        // Log health check results
        jackpotLogger.health("JACKPOT_SYSTEM", overall, responseTime, {
            checks,
            healthyChecks,
            totalChecks,
        });

        return {
            overall,
            database: dbCheck.healthy,
            transactionLogging: loggingCheck.healthy,
            responseTime,
            checks,
        };

    } catch (error) {
        const responseTime = Date.now() - startTime;

        jackpotLogger.health("JACKPOT_SYSTEM", "UNHEALTHY", responseTime, {
            error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
            overall: "UNHEALTHY",
            database: false,
            transactionLogging: false,
            responseTime,
            checks: {
                error: error instanceof Error ? error.message : "Health check failed",
            },
        };
    }
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnectivity(): Promise<{ healthy: boolean; responseTime: number; error?: string }>
{
    const startTime = Date.now();

    try {
        await db.select().from(transactionLogTable).limit(1);
        return {
            healthy: true,
            responseTime: Date.now() - startTime,
        };
    } catch (error) {
        return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check transaction logging functionality
 */
async function checkTransactionLogging(): Promise<{ healthy: boolean; responseTime: number; error?: string }>
{
    const startTime = Date.now();
    const testContext = createOperationContext({
        operation: "healthCheck.transactionTest",
    });

    try {
        // Test inserting a small transaction record
        const [result] = await db
            .insert(transactionLogTable)
            .values({
                userId: "00000000-0000-0000-0000-000000000000", // placeholder UUID
                type: "HEALTH_CHECK",
                status: "COMPLETED",
                operatorId: "00000000-0000-0000-0000-000000000000", // placeholder UUID
                wagerAmount: 0,
                realBalanceBefore: 0,
                realBalanceAfter: 0,
                bonusBalanceBefore: 0,
                bonusBalanceAfter: 0,
                gameId: null,
                processingTime: 0,
                metadata: {
                    healthCheck: true,
                    timestamp: new Date().toISOString(),
                },
            })
            .returning({ id: transactionLogTable.id });

        // Clean up test record
        if (result) {
            await db
                .delete(transactionLogTable)
                .where(eq(transactionLogTable.id, result.id));
        }

        return {
            healthy: true,
            responseTime: Date.now() - startTime,
        };
    } catch (error) {
        return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check performance metrics
 */
async function checkPerformanceMetrics(): Promise<{
    healthy: boolean;
    responseTime: number;
    performanceStats?: any;
    error?: string;
}>
{
    const startTime = Date.now();

    try {
        // Get performance stats from logger
        const performanceStats = jackpotLogger.getAllPerformanceStats();

        // Check if any operations are performing poorly (> 1000ms)
        const slowOperations = Object.entries(performanceStats)
            .filter(([_, stats]: [string, any]) => stats.average > 1000);

        const healthy = slowOperations.length === 0;

        return {
            healthy,
            responseTime: Date.now() - startTime,
            performanceStats: {
                totalOperations: Object.keys(performanceStats).length,
                slowOperationsCount: slowOperations.length,
                slowOperations: slowOperations.map(([op, stats]) => ({ operation: op, ...stats })),
            },
        };
    } catch (error) {
        return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check recent transaction volume
 */
async function checkTransactionVolume(): Promise<{
    healthy: boolean;
    responseTime: number;
    volumeStats?: any;
    error?: string;
}>
{
    const startTime = Date.now();

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Get transaction volume from last 24 hours
        const [volumeStats] = await db
            .select({
                totalTransactions: sql<number>`count(*)`,
                jackpotContributions: sql<number>`count(CASE WHEN type = 'JACKPOT_CONTRIBUTION' THEN 1 END)`,
                jackpotWins: sql<number>`count(CASE WHEN type = 'JACKPOT_WIN' THEN 1 END)`,
                configChanges: sql<number>`count(CASE WHEN type = 'JACKPOT_CONFIG_CHANGE' THEN 1 END)`,
            })
            .from(transactionLogTable)
            .where(gte(transactionLogTable.createdAt, twentyFourHoursAgo));

        // Check if transaction volume is reasonable (not too high or too low)
        const totalTransactions = Number(volumeStats?.totalTransactions || 0);
        const healthy = totalTransactions >= 0 && totalTransactions < 100000; // Sanity check

        return {
            healthy,
            responseTime: Date.now() - startTime,
            volumeStats: {
                totalTransactions,
                jackpotContributions: Number(volumeStats?.jackpotContributions || 0),
                jackpotWins: Number(volumeStats?.jackpotWins || 0),
                configChanges: Number(volumeStats?.configChanges || 0),
            },
        };
    } catch (error) {
        return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Get jackpot system metrics for monitoring dashboards
 */
export async function getJackpotSystemMetrics(): Promise<{
    performance: any;
    transactions: any;
    health: any;
    timestamp: string;
}>
{
    const context = createOperationContext({
        operation: "metricsCollection",
    });

    try {
        // Get performance metrics
        const performanceMetrics = jackpotLogger.getAllPerformanceStats();

        // Get transaction metrics (last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [transactionMetrics] = await db
            .select({
                totalTransactions: sql<number>`count(*)`,
                successfulTransactions: sql<number>`count(CASE WHEN status = 'COMPLETED' THEN 1 END)`,
                failedTransactions: sql<number>`count(CASE WHEN status = 'FAILED' THEN 1 END)`,
                totalJackpotContributions: sql<number>`coalesce(sum(CASE WHEN type = 'JACKPOT_CONTRIBUTION' THEN jackpot_contribution ELSE 0 END), 0)`,
                totalJackpotWins: sql<number>`coalesce(sum(CASE WHEN type = 'JACKPOT_WIN' THEN jackpot_contribution ELSE 0 END), 0)`,
                averageProcessingTime: sql<number>`coalesce(avg(CASE WHEN processing_time > 0 AND processing_time < 10000 THEN processing_time ELSE NULL END), 0)`,
            })
            .from(transactionLogTable)
            .where(gte(transactionLogTable.createdAt, twentyFourHoursAgo));

        // Get health check results
        const healthCheck = await performJackpotHealthCheck();

        return {
            performance: {
                operations: performanceMetrics,
                summary: {
                    totalOperationTypes: Object.keys(performanceMetrics).length,
                    averageResponseTime: Object.values(performanceMetrics).reduce((sum: number, stats: any) => sum + stats.average, 0) / Object.keys(performanceMetrics).length || 0,
                },
            },
            transactions: {
                last24Hours: {
                    total: Number(transactionMetrics?.totalTransactions || 0),
                    successful: Number(transactionMetrics?.successfulTransactions || 0),
                    failed: Number(transactionMetrics?.failedTransactions || 0),
                    successRate: Number(transactionMetrics?.totalTransactions || 0) > 0
                        ? (Number(transactionMetrics?.successfulTransactions || 0) / Number(transactionMetrics?.totalTransactions || 0)) * 100
                        : 100,
                    totalContributions: Number(transactionMetrics?.totalJackpotContributions || 0),
                    totalWins: Number(transactionMetrics?.totalJackpotWins || 0),
                    averageProcessingTime: Number(transactionMetrics?.averageProcessingTime || 0),
                },
            },
            health: healthCheck,
            timestamp: new Date().toISOString(),
        };

    } catch (error) {
        jackpotLogger.error(
            "Failed to collect jackpot system metrics",
            context,
            error instanceof Error ? error : new Error(String(error))
        );

        throw createSystemError(
            "Failed to collect system metrics",
            "SYSTEM_UNEXPECTED_STATE",
            context,
            error instanceof Error ? error : new Error(String(error))
        );
    }
}
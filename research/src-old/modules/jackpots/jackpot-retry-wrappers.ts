/**
 * Operation-specific retry wrappers for jackpot database operations
 * Integrates retry strategies, circuit breaker protection, and comprehensive monitoring
 */

import { db } from "@/libs/database/db";
import { jackpotTable } from "@/libs/database/schema/jackpot";
import { eq, sql } from "drizzle-orm";

import type {
    JackpotErrorContext
} from "./jackpot-errors";
import
{
    createOperationContext,
    jackpotLogger
} from "./jackpot-logging.service";
import type { JackpotGroup } from "./jackpot.service";

import type {
    RetryPolicy
} from "./jackpot-retry-strategies";

import
{
    executeWithRetry,
    getRetryPolicy,
    RETRY_POLICIES
} from "./jackpot-retry-strategies";


import
{
    executeWithCircuitBreaker,
    performCircuitBreakerHealthCheck
} from "./jackpot-circuit-breaker";

export interface RetryWrapperConfig
{
    enableCircuitBreaker: boolean;
    enableRetryLogging: boolean;
    operationTimeout?: number;
    fallbackData?: any;
}

export interface OperationMetrics
{
    operation: string;
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    circuitBreakerActivations: number;
    averageRetryDelay: number;
    totalExecutionTime: number;
    errorTypes: Record<string, number>;
    lastExecution?: Date;
    lastSuccess?: Date;
    lastFailure?: Date;
}

/**
 * Enhanced operation wrapper that combines retry strategies and circuit breaker
 */
export class RetryOperationWrapper
{
    private metrics: OperationMetrics;
    private config: RetryWrapperConfig;

    constructor(
        private readonly operationName: string,
        config?: Partial<RetryWrapperConfig>
    )
    {
        this.config = {
            enableCircuitBreaker: true,
            enableRetryLogging: true,
            ...config
        };

        this.metrics = {
            operation: operationName,
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            circuitBreakerActivations: 0,
            averageRetryDelay: 0,
            totalExecutionTime: 0,
            errorTypes: {},
        };
    }

    /**
     * Execute operation with comprehensive retry and circuit breaker protection
     */
    async execute<T>(
        operationFn: () => Promise<T>,
        policy: RetryPolicy,
        context: JackpotErrorContext,
        operationType?: keyof typeof RETRY_POLICIES
    ): Promise<{ success: boolean; data?: T; error?: any; metrics: OperationMetrics }>
    {
        const startTime = Date.now();
        this.metrics.totalAttempts++;
        this.metrics.lastExecution = new Date();

        try {
            let result: T;

            if (this.config.enableCircuitBreaker && operationType) {
                // Execute with circuit breaker protection
                const circuitResult = await executeWithCircuitBreaker(
                    operationType,
                    async () =>
                    {
                        // Execute with retry protection
                        const retryResult = await executeWithRetry(
                            this.operationName,
                            operationFn,
                            policy,
                            {
                                operationId: context.operationId,
                                correlationId: context.correlationId,
                                operationType,
                            }
                        );

                        if (!retryResult.success) {
                            throw retryResult.error;
                        }

                        return retryResult.data!;
                    }
                );

                if (!circuitResult.success) {
                    throw circuitResult.error;
                }

                result = circuitResult.data!;

                // Track circuit breaker state
                if (circuitResult.circuitState === "OPEN") {
                    this.metrics.circuitBreakerActivations++;
                }
            } else {
                // Execute with retry protection only
                const retryResult = await executeWithRetry(
                    this.operationName,
                    operationFn,
                    policy,
                    {
                        operationId: context.operationId,
                        correlationId: context.correlationId,
                    }
                );

                if (!retryResult.success) {
                    throw retryResult.error;
                }

                result = retryResult.data!;
            }

            // Success path
            this.metrics.successfulAttempts++;
            this.metrics.lastSuccess = new Date();
            this.updateAverageRetryDelay(0); // No delay on success

            if (this.config.enableRetryLogging) {
                jackpotLogger.info(`Operation ${this.operationName} completed successfully`, {
                    operationId: context.operationId,
                    correlationId: context.correlationId,
                    operation: this.operationName,
                    timestamp: new Date(),
                });
            }

            return {
                success: true,
                data: result,
                metrics: this.getMetrics(),
            };

        } catch (error) {
            // Failure path
            this.metrics.failedAttempts++;
            this.metrics.lastFailure = new Date();

            // Track error types
            const errorObj = error as any;
            const errorCode = errorObj?.code || errorObj?.name || "UNKNOWN";
            this.metrics.errorTypes[errorCode] = (this.metrics.errorTypes[errorCode] || 0) + 1;

            if (this.config.enableRetryLogging) {
                jackpotLogger.error(`Operation ${this.operationName} failed`, {
                    operationId: context.operationId,
                    correlationId: context.correlationId,
                    operation: this.operationName,
                    error: errorObj?.message || String(error),
                    errorCode,
                    timestamp: new Date(),
                }, error);
            }

            return {
                success: false,
                error,
                metrics: this.getMetrics(),
            };
        } finally {
            this.metrics.totalExecutionTime += Date.now() - startTime;
        }
    }

    /**
     * Execute database transaction with retry and circuit breaker protection
     */
    async executeTransaction<T>(
        transactionFn: (tx: typeof db) => Promise<T>,
        policy: RetryPolicy,
        context: JackpotErrorContext,
        operationType?: keyof typeof RETRY_POLICIES
    ): Promise<{ success: boolean; data?: T; error?: any; metrics: OperationMetrics }>
    {
        return this.execute(
            () => db.transaction(transactionFn as any),
            policy,
            context,
            operationType
        );
    }

    /**
     * Update average retry delay tracking
     */
    private updateAverageRetryDelay(delay: number): void
    {
        // Simple moving average calculation
        if (this.metrics.averageRetryDelay === 0) {
            this.metrics.averageRetryDelay = delay;
        } else {
            this.metrics.averageRetryDelay =
                (this.metrics.averageRetryDelay + delay) / 2;
        }
    }

    /**
     * Get current metrics
     */
    getMetrics(): OperationMetrics
    {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void
    {
        this.metrics = {
            operation: this.operationName,
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            circuitBreakerActivations: 0,
            averageRetryDelay: 0,
            totalExecutionTime: 0,
            errorTypes: {},
        };
    }

    /**
     * Get success rate
     */
    getSuccessRate(): number
    {
        if (this.metrics.totalAttempts === 0) return 0;
        return (this.metrics.successfulAttempts / this.metrics.totalAttempts) * 100;
    }
}

/**
 * Pre-configured wrappers for different jackpot operations
 */
export class JackpotOperationWrappers
{
    private wrappers = new Map<string, RetryOperationWrapper>();

    /**
     * Get or create wrapper for specific operation
     */
    getWrapper(operationName: string, config?: Partial<RetryWrapperConfig>): RetryOperationWrapper
    {
        if (!this.wrappers.has(operationName)) {
            this.wrappers.set(operationName, new RetryOperationWrapper(operationName, config));
        }
        return this.wrappers.get(operationName)!;
    }

    /**
     * Get wrapper for jackpot contribution operations
     */
    getContributeWrapper(): RetryOperationWrapper
    {
        return this.getWrapper("jackpot_contribute", {
            enableCircuitBreaker: true,
            operationTimeout: 30000, // 30 seconds
        });
    }

    /**
     * Get wrapper for jackpot win operations
     */
    getWinWrapper(): RetryOperationWrapper
    {
        return this.getWrapper("jackpot_win", {
            enableCircuitBreaker: true,
            operationTimeout: 60000, // 60 seconds for money operations
        });
    }

    /**
     * Get wrapper for configuration operations
     */
    getConfigWrapper(): RetryOperationWrapper
    {
        return this.getWrapper("jackpot_config", {
            enableCircuitBreaker: true,
            operationTimeout: 10000, // 10 seconds
        });
    }

    /**
     * Get wrapper for pool query operations
     */
    getPoolWrapper(): RetryOperationWrapper
    {
        return this.getWrapper("jackpot_pool", {
            enableCircuitBreaker: true,
            operationTimeout: 5000, // 5 seconds
        });
    }

    /**
     * Get all wrapper metrics
     */
    getAllMetrics(): Record<string, OperationMetrics>
    {
        const metrics: Record<string, OperationMetrics> = {};
        for (const [name, wrapper] of this.wrappers) {
            metrics[name] = wrapper.getMetrics();
        }
        return metrics;
    }

    /**
     * Reset all wrapper metrics
     */
    resetAllMetrics(): void
    {
        for (const wrapper of this.wrappers.values()) {
            wrapper.resetMetrics();
        }
    }

    /**
     * Get overall system health based on wrapper metrics
     */
    getSystemHealth():
        {
            overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
            wrapperHealth: Record<string, "HEALTHY" | "DEGRADED" | "UNHEALTHY">;
            recommendations: string[];
            metrics: Record<string, OperationMetrics>;
        }
    {
        const wrapperHealth: Record<string, "HEALTHY" | "DEGRADED" | "UNHEALTHY"> = {};
        const recommendations: string[] = [];
        let unhealthyCount = 0;
        let degradedCount = 0;

        for (const [name, wrapper] of this.wrappers) {
            const metrics = wrapper.getMetrics();
            const successRate = wrapper.getSuccessRate();

            let health: "HEALTHY" | "DEGRADED" | "UNHEALTHY";

            if (successRate >= 95) {
                health = "HEALTHY";
            } else if (successRate >= 80) {
                health = "DEGRADED";
                degradedCount++;
                recommendations.push(`Operation ${name} has degraded performance (${successRate.toFixed(1)}% success rate)`);
            } else {
                health = "UNHEALTHY";
                unhealthyCount++;
                recommendations.push(`Operation ${name} has poor performance (${successRate.toFixed(1)}% success rate)`);
            }

            // Check for circuit breaker activations
            if (metrics.circuitBreakerActivations > 0) {
                health = "UNHEALTHY";
                unhealthyCount++;
                recommendations.push(`Operation ${name} has activated circuit breaker ${metrics.circuitBreakerActivations} times`);
            }

            wrapperHealth[name] = health;
        }

        let overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
        if (unhealthyCount > 0) {
            overall = "UNHEALTHY";
        } else if (degradedCount > 0) {
            overall = "DEGRADED";
        } else {
            overall = "HEALTHY";
        }

        return {
            overall,
            wrapperHealth,
            recommendations,
            metrics: this.getAllMetrics(),
        };
    }
}

// Global instance
export const jackpotOperationWrappers = new JackpotOperationWrappers();

// ========================================
// SPECIFIC OPERATION WRAPPER FUNCTIONS
// ========================================

/**
 * Execute jackpot contribution with comprehensive retry and monitoring
 */
export async function executeJackpotContributeWithRetry(
    group: JackpotGroup,
    wagerAmount: number,
    context?: Partial<JackpotErrorContext>
): Promise<{ success: boolean; data?: any; error?: any }>
{
    const operationContext: JackpotErrorContext = createOperationContext({
        operation: "contribute",
        group,
        timestamp: new Date(),
        ...context,
    });

    const wrapper = jackpotOperationWrappers.getContributeWrapper();

    return wrapper.executeTransaction(
        async (tx) =>
        {
            // Get current pool state
            const pools = await tx
                .select()
                .from(jackpotTable)
                .where(eq(jackpotTable.group, group))
                .limit(1);

            const pool = pools[0];
            if (!pool) {
                throw new Error(`Jackpot pool not found for group: ${group}`);
            }

            // Calculate contribution
            const rate = pool.contributionRate || 0;
            const contribution = Math.floor(wagerAmount * rate);

            if (contribution > 0) {
                // Update pool
                await tx
                    .update(jackpotTable)
                    .set({
                        currentAmount: sql`current_amount + ${contribution}`,
                        totalContributions: sql`total_contributions + ${contribution}`,
                        version: sql`version + 1`,
                        updatedAt: new Date(),
                    })
                    .where(eq(jackpotTable.group, group));
            }

            return { contribution, newAmount: pool.currentAmount + contribution };
        },
        getRetryPolicy("contribute"),
        operationContext,
        "contribute"
    );
}

/**
 * Execute jackpot win processing with comprehensive retry and monitoring
 */
export async function executeJackpotWinWithRetry(
    group: JackpotGroup,
    winAmount: number,
    userId: string,
    context?: Partial<JackpotErrorContext>
): Promise<{ success: boolean; data?: any; error?: any }>
{
    const operationContext: JackpotErrorContext = createOperationContext({
        operation: "processWin",
        group,
        userId,
        timestamp: new Date(),
        ...context,
    });

    const wrapper = jackpotOperationWrappers.getWinWrapper();

    return wrapper.executeTransaction(
        async (tx) =>
        {
            // Get current pool state
            const pools = await tx
                .select()
                .from(jackpotTable)
                .where(eq(jackpotTable.group, group))
                .limit(1);

            const pool = pools[0];
            if (!pool) {
                throw new Error(`Jackpot pool not found for group: ${group}`);
            }

            // Validate win amount
            if (winAmount > pool.currentAmount) {
                throw new Error(`Win amount ${winAmount} exceeds available amount ${pool.currentAmount}`);
            }

            // Update pool
            const newAmount = pool.currentAmount - winAmount;
            await tx
                .update(jackpotTable)
                .set({
                    currentAmount: newAmount,
                    totalWins: sql`total_wins + ${winAmount}`,
                    lastWonAmount: winAmount,
                    lastWonAt: new Date(),
                    lastWonByUserId: userId,
                    version: sql`version + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(jackpotTable.group, group));

            return { winAmount, remainingAmount: newAmount };
        },
        getRetryPolicy("processWin"),
        operationContext,
        "processWin"
    );
}

/**
 * Execute jackpot pool query with comprehensive retry and monitoring
 */
export async function executeJackpotGetPoolWithRetry(
    group: JackpotGroup,
    context?: Partial<JackpotErrorContext>
): Promise<{ success: boolean; data?: any; error?: any }>
{
    const operationContext: JackpotErrorContext = createOperationContext({
        operation: "getPool",
        group,
        timestamp: new Date(),
        ...context,
    });

    const wrapper = jackpotOperationWrappers.getPoolWrapper();

    return wrapper.execute(
        async () =>
        {
            const pools = await db
                .select()
                .from(jackpotTable)
                .where(eq(jackpotTable.group, group))
                .limit(1);

            const pool = pools[0];
            if (!pool) {
                throw new Error(`Jackpot pool not found for group: ${group}`);
            }

            return pool;
        },
        getRetryPolicy("getPool"),
        operationContext,
        "externalApi"
    );
}

/**
 * Execute jackpot configuration update with comprehensive retry and monitoring
 */
export async function executeJackpotUpdateConfigWithRetry(
    group: JackpotGroup,
    updates: Record<string, any>,
    context?: Partial<JackpotErrorContext>
): Promise<{ success: boolean; data?: any; error?: any }>
{
    const operationContext: JackpotErrorContext = createOperationContext({
        operation: "updateConfig",
        group,
        timestamp: new Date(),
        ...context,
    });

    const wrapper = jackpotOperationWrappers.getConfigWrapper();

    return wrapper.executeTransaction(
        async (tx) =>
        {
            // Apply updates to jackpot configuration
            const updateData: any = {
                updatedAt: new Date(),
                version: sql`version + 1`,
            };

            if (updates.rate !== undefined) {
                updateData.contributionRate = updates.rate;
            }
            if (updates.seedAmount !== undefined) {
                updateData.seedAmount = updates.seedAmount;
            }
            if (updates.maxAmount !== undefined) {
                updateData.maxAmount = updates.maxAmount;
            }

            await tx
                .update(jackpotTable)
                .set(updateData)
                .where(eq(jackpotTable.group, group));

            return { updated: true, group, updates };
        },
        getRetryPolicy("updateConfig"),
        operationContext,
        "updateConfig"
    );
}

/**
 * Get comprehensive retry and circuit breaker metrics
 */
export async function getRetrySystemMetrics(): Promise<{
    wrappers: ReturnType<JackpotOperationWrappers["getAllMetrics"]>;
    circuitBreakers: Awaited<ReturnType<typeof performCircuitBreakerHealthCheck>>;
    systemHealth: ReturnType<JackpotOperationWrappers["getSystemHealth"]>;
    timestamp: string;
}>
{
    const wrapperMetrics = jackpotOperationWrappers.getAllMetrics();
    const circuitBreakerMetrics = await performCircuitBreakerHealthCheck();
    const systemHealth = jackpotOperationWrappers.getSystemHealth();

    return {
        wrappers: wrapperMetrics,
        circuitBreakers: circuitBreakerMetrics,
        systemHealth,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Reset all retry system metrics and circuit breakers
 */
export function resetRetrySystem(): void
{
    jackpotOperationWrappers.resetAllMetrics();
    // Note: Circuit breaker registry reset is handled separately if needed
}
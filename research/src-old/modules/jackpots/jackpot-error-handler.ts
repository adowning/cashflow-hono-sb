/**
 * Enhanced database error handling for jackpot operations
 * Provides comprehensive error categorization, logging, and recovery strategies
 */

import { db } from "@/libs/database/db";
import { jackpotTable } from "@/libs/database/schema/jackpot";
import { eq, sql } from "drizzle-orm";

import type {
    JackpotErrorCode,
    JackpotErrorContext
} from "./jackpot-errors";
import
{
    createConcurrencyError,
    createDatabaseError,
    createInsufficientFundsError,
    createSystemError,
    JackpotError,
} from "./jackpot-errors";
import
{
    createOperationContext,
    jackpotLogger,
    logJackpotAudit
} from "./jackpot-logging.service";
import type { JackpotGroup } from "./jackpot.service";

// ========================================
// DATABASE ERROR CATEGORIZATION
// ========================================

/**
 * Categorize database errors based on error codes and messages
 */
function categorizeDatabaseError(error: any):
    {
        code: JackpotErrorCode;
        category: string;
        retryable: boolean;
    }
{
    // PostgreSQL error codes
    const errorCode = error?.code;
    const errorMessage = error?.message?.toLowerCase() || "";

    // Connection errors
    if (errorCode === "ECONNREFUSED" || errorMessage.includes("connection refused")) {
        return {
            code: "DATABASE_CONNECTION_FAILED",
            category: "CONNECTION",
            retryable: true,
        };
    }

    // Timeout errors
    if (
        errorCode === "ETIMEDOUT" ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("cancelled")
    ) {
        return {
            code: "DATABASE_TIMEOUT",
            category: "TIMEOUT",
            retryable: true,
        };
    }

    // Deadlock errors
    if (
        errorCode === "40P01" ||
        errorMessage.includes("deadlock") ||
        errorMessage.includes("deadlocked")
    ) {
        return {
            code: "DATABASE_DEADLOCK_DETECTED",
            category: "DEADLOCK",
            retryable: true,
        };
    }

    // Serialization failures
    if (
        errorCode === "40001" ||
        errorMessage.includes("serialization") ||
        errorMessage.includes("concurrent update")
    ) {
        return {
            code: "DATABASE_SERIALIZATION_FAILURE",
            category: "SERIALIZATION",
            retryable: true,
        };
    }

    // Foreign key violations
    if (
        errorCode === "23503" ||
        errorMessage.includes("foreign key") ||
        errorMessage.includes("violates foreign key")
    ) {
        return {
            code: "DATABASE_FOREIGN_KEY_VIOLATION",
            category: "CONSTRAINT",
            retryable: false,
        };
    }

    // Unique constraint violations
    if (
        errorCode === "23505" ||
        errorMessage.includes("unique") ||
        errorMessage.includes("duplicate")
    ) {
        return {
            code: "DATABASE_UNIQUE_VIOLATION",
            category: "CONSTRAINT",
            retryable: false,
        };
    }

    // Check constraint violations
    if (
        errorCode === "23514" ||
        errorMessage.includes("check constraint") ||
        errorMessage.includes("violates check constraint")
    ) {
        return {
            code: "DATABASE_CONSTRAINT_VIOLATION",
            category: "CONSTRAINT",
            retryable: false,
        };
    }

    // Default database error
    return {
        code: "DATABASE_CONNECTION_FAILED",
        category: "UNKNOWN",
        retryable: false,
    };
}

// ========================================
// ENHANCED DATABASE OPERATIONS
// ========================================

/**
 * Enhanced database query with comprehensive error handling and logging
 */
export async function executeWithErrorHandling<T>(
    operation: string,
    operationFn: () => Promise<T>,
    context: JackpotErrorContext
): Promise<T>
{
    const startTime = Date.now();
    const loggerContext = {
        operationId: context.operationId,
        correlationId: context.correlationId,
        userId: context.userId,
        gameId: context.gameId,
        group: context.group,
    };

    try {
        jackpotLogger.info(`Starting database operation: ${operation}`, { ...loggerContext, timestamp: new Date() });

        const result = await operationFn();
        const duration = Date.now() - startTime;

        jackpotLogger.performance(`db.${operation}`, { ...loggerContext, timestamp: new Date() }, duration);
        jackpotLogger.info(`Database operation completed: ${operation}`, { ...loggerContext, timestamp: new Date() }, {
            duration,
        });

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        // Categorize the error
        const errorInfo = categorizeDatabaseError(error);
        const jackpotError = createDatabaseError(
            `Database operation '${operation}' failed`,
            errorInfo.code,
            {
                ...context,
                duration,
                errorCode: errorInfo.code,
                errorCategory: errorInfo.category,
            },
            error instanceof Error ? error : new Error(String(error))
        );

        // Log the error with full context
        jackpotLogger.error(
            `Database operation failed: ${operation}`,
            { ...loggerContext, timestamp: new Date() },
            jackpotError,
            {
                duration,
                errorCode: errorInfo.code,
                errorCategory: errorInfo.category,
                retryable: errorInfo.retryable,
                originalError: error && typeof error === 'object' && 'message' in error ? (error as any).message : String(error),
            }
        );

        // Audit log the error
        logJackpotAudit(operation, { ...loggerContext, timestamp: new Date() }, {
            success: false,
            error: jackpotError,
            duration,
        } as any);

        throw jackpotError;
    }
}

/**
 * Safe database transaction with enhanced error handling and retry logic
 */
export async function executeTransactionWithRetry<T>(
    operation: string,
    transactionFn: (tx: typeof db) => Promise<T>,
    context: JackpotErrorContext,
    maxRetries: number = 3,
    baseDelay: number = 100
): Promise<T>
{
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await db.transaction(async (tx) =>
            {
                // Type assertion to handle the transaction type mismatch
                return await transactionFn(tx as unknown as typeof db);
            });

            // Log successful transaction
            jackpotLogger.transaction("DATABASE_TRANSACTION", {
                operationId: context.operationId,
                correlationId: context.correlationId,
                userId: context.userId,
                gameId: context.gameId,
                group: context.group,
                timestamp: new Date(),
                retryCount: attempt - 1,
            }, undefined, true, {
                operation,
                attempt,
            });

            return result;
        } catch (error) {
            lastError = error;
            const errorInfo = categorizeDatabaseError(error);

            // If not retryable or last attempt, throw
            if (!errorInfo.retryable || attempt === maxRetries) {
                const jackpotError = createDatabaseError(
                    `Transaction '${operation}' failed after ${attempt} attempts`,
                    errorInfo.code,
                    {
                        ...context,
                        retryCount: attempt - 1,
                        finalAttempt: true,
                    },
                    error instanceof Error ? error : new Error(String(error))
                );

                jackpotLogger.error(
                    `Transaction failed after ${attempt} attempts: ${operation}`,
                    {
                        operationId: context.operationId,
                        correlationId: context.correlationId,
                        userId: context.userId,
                        gameId: context.gameId,
                        group: context.group,
                        timestamp: new Date(),
                    },
                    jackpotError,
                    {
                        operation,
                        attempt,
                        maxRetries,
                        finalAttempt: true,
                    }
                );

                throw jackpotError;
            }

            // Log retry attempt
            jackpotLogger.warn(
                `Transaction retry attempt ${attempt}/${maxRetries} for: ${operation}`,
                {
                    operationId: context.operationId,
                    correlationId: context.correlationId,
                    userId: context.userId,
                    gameId: context.gameId,
                    group: context.group,
                    timestamp: new Date(),
                },
                {
                    operation,
                    attempt,
                    maxRetries,
                    errorCode: errorInfo.code,
                    errorCategory: errorInfo.category,
                }
            );

            // Exponential backoff delay
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but just in case
    throw lastError;
}

// ========================================
// JACKPOT-SPECIFIC DATABASE HELPERS
// ========================================

/**
 * Safely get jackpot pool with error handling
 */
export async function getJackpotPoolSafely(
    group: JackpotGroup,
    context: JackpotErrorContext
)
{
    return executeWithErrorHandling(
        `getPool.${group}`,
        async () =>
        {
            const pools = await db
                .select()
                .from(jackpotTable)
                .where(eq(jackpotTable.group, group));

            const pool = pools[0];
            if (!pool) {
                throw createSystemError(
                    `Jackpot pool not found for group: ${group}`,
                    "SYSTEM_UNEXPECTED_STATE",
                    context,
                    new Error(`Pool not found: ${group}`)
                );
            }

            return pool;
        },
        context
    );
}

/**
 * Safely update jackpot pool with error handling and validation
 */
export async function updateJackpotPoolSafely(
    group: JackpotGroup,
    updateFn: (pool: any) => { amount: number; reset?: boolean },
    context: JackpotErrorContext
)
{
    return executeTransactionWithRetry(
        `updatePool.${group}`,
        async (tx) =>
        {
            // Get current pool
            const pools = await tx
                .select()
                .from(jackpotTable)
                .where(eq(jackpotTable.group, group));

            const pool = pools[0];
            if (!pool) {
                throw createSystemError(
                    `Jackpot pool not found for group: ${group}`,
                    "SYSTEM_UNEXPECTED_STATE",
                    context,
                    new Error(`Pool not found: ${group}`)
                );
            }

            // Execute update logic
            const updateResult = updateFn(pool);

            // Validate update
            if (updateResult.amount < 0) {
                throw createInsufficientFundsError(
                    `Jackpot amount cannot be negative for group: ${group}`,
                    "INSUFFICIENT_JACKPOT_FUNDS",
                    context,
                    new Error(`Negative amount: ${updateResult.amount}`)
                );
            }

            // Check max amount constraint
            if (pool.maxAmount && updateResult.amount > pool.maxAmount) {
                throw createInsufficientFundsError(
                    `Jackpot amount exceeds maximum for group: ${group}`,
                    "JACKPOT_EXCEEDS_MAX_AMOUNT",
                    context,
                    new Error(`Amount ${updateResult.amount} exceeds max ${pool.maxAmount}`)
                );
            }

            // Perform update
            await tx
                .update(jackpotTable)
                .set({
                    currentAmount: updateResult.amount,
                    updatedAt: new Date(),
                })
                .where(eq(jackpotTable.group, group));

            return {
                poolId: pool.id,
                oldAmount: pool.currentAmount,
                newAmount: updateResult.amount,
                reset: updateResult.reset || false,
            };
        },
        context
    );
}

/**
 * Safely insert contribution record with error handling
 */
export async function recordContributionSafely(
    contributionData: {
        wagerAmount: number;
        contributionAmount: number;
        betTransactionId: string;
        jackpotId: string;
        operatorId: string;
    },
    context: JackpotErrorContext
)
{
    return executeWithErrorHandling(
        "recordContribution",
        async () =>
        {
            const contributionRecord = {
                ...contributionData,
                winAmount: 0,
                createdAt: new Date(),
            };

            // Note: In a real implementation, you would have a separate contributions table
            // For now, we update the contribution history in the jackpot table
            await db
                .update(jackpotTable)
                .set({
                    contributionHistory: sql`contribution_history || ${JSON.stringify([contributionRecord])}`,
                    updatedAt: new Date(),
                })
                .where(eq(jackpotTable.id, contributionData.jackpotId));

            return contributionRecord;
        },
        context
    );
}

/**
 * Safely record win with error handling and audit trail
 */
export async function recordWinSafely(
    winData: {
        userId: string;
        gameId: string;
        amountWon: number;
        winningSpinTransactionId: string;
        operatorId: string;
        userCreateDate: Date;
        videoClipLocation?: string;
    },
    context: JackpotErrorContext
)
{
    return executeWithErrorHandling(
        "recordWin",
        async () =>
        {
            const winRecord = {
                ...winData,
                timeStampOfWin: new Date(),
                numberOfJackpotWinsForUserBefore: 0, // Would need to query user history
                numberOfJackpotWinsForUserAfter: 1, // Would need to query user history
            };

            // Note: In a real implementation, you would have a separate wins table
            // For now, we update the win history in the jackpot table
            await db
                .update(jackpotTable)
                .set({
                    winHistory: sql`jackpot_wins || ${JSON.stringify([winRecord])}`,
                    updatedAt: new Date(),
                })
                .where(eq(jackpotTable.group, context.group!));

            return winRecord;
        },
        context
    );
}

// ========================================
// CONCURRENCY ERROR HANDLING
// ========================================

/**
 * Handle optimistic locking version conflicts
 */
export function handleVersionConflict(
    currentVersion: number,
    expectedVersion: number,
    operation: string,
    group: JackpotGroup,
    context: JackpotErrorContext
): never
{
    const jackpotError = createConcurrencyError(
        `Version conflict during ${operation} on ${group}`,
        "CONCURRENCY_VERSION_CONFLICT",
        {
            ...context,
            group,
            currentVersion,
            expectedVersion,
            operation,
        },
        new Error(
            `Expected version ${expectedVersion}, but found version ${currentVersion}`
        )
    );

    jackpotLogger.concurrency(
        operation,
        {
            operationId: context.operationId,
            correlationId: context.correlationId,
            userId: context.userId,
            gameId: context.gameId,
            group,
            timestamp: new Date(),
        },
        "OPTIMISTIC",
        false,
        0,
        {
            currentVersion,
            expectedVersion,
        }
    );

    throw jackpotError;
}

/**
 * Handle lock timeout errors
 */
export function handleLockTimeout(
    operation: string,
    group: JackpotGroup,
    timeoutMs: number,
    context: JackpotErrorContext
): never
{
    const jackpotError = createConcurrencyError(
        `Lock timeout during ${operation} on ${group}`,
        "CONCURRENCY_LOCK_TIMEOUT",
        {
            ...context,
            group,
            operation,
            timeoutMs,
        },
        new Error(`Lock timeout after ${timeoutMs}ms`)
    );

    jackpotLogger.concurrency(
        operation,
        {
            operationId: context.operationId,
            correlationId: context.correlationId,
            userId: context.userId,
            gameId: context.gameId,
            group,
            timestamp: new Date(),
        },
        "PESSIMISTIC",
        false,
        0,
        {
            timeoutMs,
        }
    );

    throw jackpotError;
}

// ========================================
// AUDIT TRAIL INTEGRATION
// ========================================

/**
 * Enhanced audit logging for database operations
 */
export function logDatabaseOperation(
    operation: string,
    context: JackpotErrorContext,
    details: {
        table?: string;
        recordId?: string;
        changes?: Record<string, any>;
        success: boolean;
        error?: JackpotError;
        duration?: number;
    }
): void
{
    logJackpotAudit(`database.${operation}`, {
        operationId: context.operationId,
        correlationId: context.correlationId,
        userId: context.userId,
        gameId: context.gameId,
        group: context.group,
        timestamp: new Date(),
    }, {
        success: details.success,
        error: details.error,
        amount: details.changes?.amount,
        oldValue: details.changes?.before,
        newValue: details.changes?.after,
        duration: details.duration,
    } as any);

    // Additional database-specific logging
    if (details.table) {
        jackpotLogger.transaction(
            `DB_${operation}`,
            {
                operationId: context.operationId,
                correlationId: context.correlationId,
                userId: context.userId,
                gameId: context.gameId,
                group: context.group,
                timestamp: new Date(),
            },
            details.changes?.amount,
            details.success,
            {
                table: details.table,
                recordId: details.recordId,
                changes: details.changes,
                duration: details.duration,
            }
        );
    }
}

// ========================================
// HEALTH MONITORING INTEGRATION
// ========================================

/**
 * Database health check with detailed error reporting
 */
export async function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
}>
{
    const startTime = Date.now();
    const context = createOperationContext({
        operation: "healthCheck",
    });

    try {
        await executeWithErrorHandling(
            "healthCheck",
            async () =>
            {
                const result = await db.execute(sql`SELECT 1 as health_check`);
                return result;
            },
            context
        );

        const responseTime = Date.now() - startTime;

        jackpotLogger.health("DATABASE", "HEALTHY", responseTime);

        return {
            healthy: true,
            responseTime,
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        jackpotLogger.health("DATABASE", "UNHEALTHY", responseTime, {
            error: errorMessage,
        });

        return {
            healthy: false,
            responseTime,
            error: errorMessage,
        };
    }
}

/**
 * Jackpot table specific health check
 */
export async function checkJackpotTableHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    poolsFound: number;
    error?: string;
}>
{
    const startTime = Date.now();
    const context = createOperationContext({
        operation: "jackpotHealthCheck",
    });

    try {
        const result = await executeWithErrorHandling(
            "jackpotHealthCheck",
            async () =>
            {
                const pools = await db
                    .select()
                    .from(jackpotTable);
                return pools;
            },
            context
        );

        const responseTime = Date.now() - startTime;

        jackpotLogger.health("JACKPOT_TABLE", "HEALTHY", responseTime, {
            poolsFound: Array.isArray(result) ? result.length : 0,
        });

        return {
            healthy: true,
            responseTime,
            poolsFound: Array.isArray(result) ? result.length : 0,
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        jackpotLogger.health("JACKPOT_TABLE", "UNHEALTHY", responseTime, {
            error: errorMessage,
        });

        return {
            healthy: false,
            responseTime,
            poolsFound: 0,
            error: errorMessage,
        };
    }
}
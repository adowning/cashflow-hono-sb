/**
 * Advanced retry strategies for jackpot database operations
 * Implements linear, exponential, and jitter-based backoff strategies
 */

import type { JackpotErrorCategory, JackpotErrorCode } from "./jackpot-errors";

export type BackoffStrategy = "linear" | "exponential" | "exponential_with_jitter" | "custom";

export interface RetryPolicy
{
    maxAttempts: number;
    baseDelay: number; // Base delay in milliseconds
    maxDelay: number; // Maximum delay cap
    backoffStrategy: BackoffStrategy;
    jitterFactor?: number; // For jitter-based strategies
    customDelayFn?: (attempt: number, baseDelay: number, maxDelay: number) => number;
}

export interface RetryAttempt
{
    attempt: number;
    delay: number;
    timestamp: Date;
    error?: any;
}

export interface RetryResult<T>
{
    success: boolean;
    data?: T;
    error?: any;
    attempts: RetryAttempt[];
    totalDuration: number;
    finalDelay: number;
}

/**
 * Calculate delay for linear backoff strategy
 * Formula: baseDelay * attempt
 */
export function calculateLinearDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number
): number
{
    const delay = baseDelay * attempt;
    return Math.min(delay, maxDelay);
}

/**
 * Calculate delay for exponential backoff strategy
 * Formula: baseDelay * (2 ^ (attempt - 1))
 */
export function calculateExponentialDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number
): number
{
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
}

/**
 * Calculate delay for exponential backoff with jitter
 * Formula: baseDelay * (2 ^ (attempt - 1)) * random_factor
 */
export function calculateExponentialWithJitterDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    jitterFactor: number = 0.1
): number
{
    const exponentialDelay = calculateExponentialDelay(attempt, baseDelay, maxDelay);
    const jitterRange = exponentialDelay * jitterFactor;
    const randomJitter = (Math.random() - 0.5) * 2 * jitterRange;
    const delay = exponentialDelay + randomJitter;
    return Math.max(baseDelay * 0.5, Math.min(delay, maxDelay)); // Ensure reasonable bounds
}

/**
 * Calculate delay for custom strategy using provided function
 */
export function calculateCustomDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    customDelayFn: (attempt: number, baseDelay: number, maxDelay: number) => number
): number
{
    const delay = customDelayFn(attempt, baseDelay, maxDelay);
    return Math.max(baseDelay * 0.1, Math.min(delay, maxDelay * 10)); // Reasonable bounds
}

/**
 * Main delay calculation function that delegates to specific strategy
 */
export function calculateDelay(
    attempt: number,
    policy: RetryPolicy
): number
{
    const { baseDelay, maxDelay, backoffStrategy, jitterFactor, customDelayFn } = policy;

    switch (backoffStrategy) {
        case "linear":
            return calculateLinearDelay(attempt, baseDelay, maxDelay);

        case "exponential":
            return calculateExponentialDelay(attempt, baseDelay, maxDelay);

        case "exponential_with_jitter":
            return calculateExponentialWithJitterDelay(attempt, baseDelay, maxDelay, jitterFactor);

        case "custom":
            if (!customDelayFn) {
                throw new Error("Custom delay function is required for custom strategy");
            }
            return calculateCustomDelay(attempt, baseDelay, maxDelay, customDelayFn);

        default:
            throw new Error(`Unknown backoff strategy: ${backoffStrategy}`);
    }
}

/**
 * Sleep utility with proper error handling
 */
export function sleep(ms: number): Promise<void>
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error should trigger a retry based on retryable error codes
 */
export function isRetryableError(error: any, category?: JackpotErrorCategory): boolean
{
    // If it's already a categorized jackpot error
    if (error?.code && typeof error.isRetryable === "function") {
        return error.isRetryable();
    }

    // Check if it's a known retryable error from our error system
    const retryableErrorCodes: JackpotErrorCode[] = [
        "DATABASE_TIMEOUT",
        "DATABASE_DEADLOCK_DETECTED",
        "DATABASE_SERIALIZATION_FAILURE",
        "CONCURRENCY_VERSION_CONFLICT",
        "CONCURRENCY_LOCK_TIMEOUT",
        "NETWORK_TIMEOUT",
        "NETWORK_CONNECTION_LOST",
    ];

    if (error?.code && retryableErrorCodes.includes(error.code)) {
        return true;
    }

    // Check error message patterns for retryable database errors
    const errorMessage = error?.message?.toLowerCase() || "";
    const retryablePatterns = [
        "timeout",
        "deadlock",
        "deadlocked",
        "serialization",
        "concurrent",
        "connection",
        "temporary",
        "retry",
        "network",
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED"
    ];

    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Get recommended delay for specific error types
 */
export function getErrorSpecificDelay(error: any, baseDelay: number): number
{
    const errorMessage = error?.message?.toLowerCase() || "";
    const errorCode = error?.code;

    // Database-specific delays
    if (errorCode === "DATABASE_DEADLOCK_DETECTED" || errorMessage.includes("deadlock")) {
        return Math.max(baseDelay * 5, 2000); // Longer delay for deadlocks
    }

    if (errorCode === "CONCURRENCY_LOCK_TIMEOUT" || errorMessage.includes("timeout")) {
        return Math.max(baseDelay * 2, 500); // Medium delay for timeouts
    }

    if (errorCode === "CONCURRENCY_VERSION_CONFLICT") {
        return Math.max(baseDelay, 100); // Short delay for version conflicts
    }

    if (errorMessage.includes("connection")) {
        return Math.max(baseDelay * 3, 1000); // Connection issues need longer delays
    }

    // Default retry delay
    return baseDelay;
}

/**
 * Execute operation with retry logic
 */
export async function executeWithRetry<T>(
    operation: string,
    operationFn: () => Promise<T>,
    policy: RetryPolicy,
    context?: Record<string, any>
): Promise<RetryResult<T>>
{
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
        const attemptStartTime = Date.now();

        try {
            // Execute the operation
            const result = await operationFn();

            const attemptDuration = Date.now() - attemptStartTime;
            attempts.push({
                attempt,
                delay: 0, // No delay needed for successful attempt
                timestamp: new Date(),
            });

            return {
                success: true,
                data: result,
                attempts,
                totalDuration: Date.now() - startTime,
                finalDelay: 0,
            };

        } catch (error) {
            const attemptDuration = Date.now() - attemptStartTime;

            attempts.push({
                attempt,
                delay: 0, // No delay yet, will be calculated after error
                timestamp: new Date(),
                error,
            });

            // Check if error is retryable
            if (!isRetryableError(error)) {
                return {
                    success: false,
                    error,
                    attempts,
                    totalDuration: Date.now() - startTime,
                    finalDelay: 0,
                };
            }

            // If this was the last attempt, return failure
            if (attempt === policy.maxAttempts) {
                return {
                    success: false,
                    error,
                    attempts,
                    totalDuration: Date.now() - startTime,
                    finalDelay: 0,
                };
            }

            // Calculate delay for next attempt
            let delay = calculateDelay(attempt + 1, policy);

            // Apply error-specific adjustments
            delay = Math.max(delay, getErrorSpecificDelay(error, policy.baseDelay));

            // Update the last attempt with the actual delay
            const lastAttempt = attempts[attempts.length - 1];
            if (lastAttempt) {
                lastAttempt.delay = delay;
            }

            // Wait before retry
            await sleep(delay);

            // Log retry attempt
            if (context) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.warn(`Retry attempt ${attempt + 1}/${policy.maxAttempts} for ${operation} after ${delay}ms delay`, {
                    operation,
                    attempt: attempt + 1,
                    maxAttempts: policy.maxAttempts,
                    delay,
                    error: errorMessage,
                    context,
                });
            }
        }
    }

    // This should never be reached, but just in case
    return {
        success: false,
        error: new Error("Max attempts exceeded"),
        attempts,
        totalDuration: Date.now() - startTime,
        finalDelay: 0,
    };
}

/**
 * Built-in retry policies for different jackpot operations
 */
export const RETRY_POLICIES = {
    // Conservative policy for money movement operations
    processWin: {
        maxAttempts: 2, // More conservative for financial operations
        baseDelay: 200,
        maxDelay: 2000,
        backoffStrategy: "exponential" as BackoffStrategy,
    } as RetryPolicy,

    // Standard policy for contribution operations
    contribute: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffStrategy: "exponential_with_jitter" as BackoffStrategy,
        jitterFactor: 0.1,
    } as RetryPolicy,

    // Lightweight policy for read operations
    getPool: {
        maxAttempts: 3,
        baseDelay: 50,
        maxDelay: 500,
        backoffStrategy: "linear" as BackoffStrategy,
    } as RetryPolicy,

    // Strict policy for configuration changes
    updateConfig: {
        maxAttempts: 1, // No retries for configuration changes
        baseDelay: 0,
        maxDelay: 0,
        backoffStrategy: "linear" as BackoffStrategy,
    } as RetryPolicy,

    // Network-sensitive policy for external operations
    externalApi: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffStrategy: "exponential_with_jitter" as BackoffStrategy,
        jitterFactor: 0.2,
    } as RetryPolicy,
} as const;

/**
 * Get retry policy for specific operation
 */
export function getRetryPolicy(operation: keyof typeof RETRY_POLICIES): RetryPolicy
{
    return RETRY_POLICIES[operation];
}

/**
 * Create custom retry policy
 */
export function createCustomRetryPolicy(
    maxAttempts: number,
    baseDelay: number,
    maxDelay: number,
    strategy: BackoffStrategy,
    options?: {
        jitterFactor?: number;
        customDelayFn?: (attempt: number, baseDelay: number, maxDelay: number) => number;
    }
): RetryPolicy
{
    return {
        maxAttempts,
        baseDelay,
        maxDelay,
        backoffStrategy: strategy,
        jitterFactor: options?.jitterFactor,
        customDelayFn: options?.customDelayFn,
    };
}

/**
 * Exponential backoff with decorrelated jitter (advanced strategy)
 * Prevents thundering herd more effectively than standard exponential with jitter
 */
export function calculateDecorrelatedJitterDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    previousDelay?: number
): number
{
    const exponentialDelay = calculateExponentialDelay(attempt, baseDelay, maxDelay);

    if (!previousDelay) {
        return exponentialDelay;
    }

    // Decorrelated jitter: add random factor to previous delay instead of current delay
    const decorrelatedJitter = previousDelay * 3 * Math.random();
    const delay = Math.min(exponentialDelay + decorrelatedJitter, maxDelay);

    return Math.max(baseDelay, delay);
}
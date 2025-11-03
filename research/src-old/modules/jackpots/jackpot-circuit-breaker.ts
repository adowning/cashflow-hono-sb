/**
 * Circuit breaker implementation for jackpot database operations
 * Prevents cascading failures and provides resilience patterns
 */

import { jackpotLogger } from "./jackpot-logging.service";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig
{
    failureThreshold: number; // Number of failures to open circuit
    recoveryTimeout: number; // Time in ms before attempting recovery
    expectedError?: (error: any) => boolean; // Function to identify expected errors
    onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
    monitoringWindow?: number; // Time window for failure tracking
    resetTimeout?: number; // Additional timeout for graceful degradation
}

export interface CircuitBreakerMetrics
{
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    totalRequests: number;
    failureRate: number; // Percentage
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    nextRetryTime?: Date;
    averageResponseTime: number;
}

export interface CircuitBreakerOperationResult<T>
{
    success: boolean;
    data?: T;
    error?: any;
    fromCache: boolean;
    circuitState: CircuitBreakerState;
    executionTime: number;
}

/**
 * Circuit breaker class that implements the circuit breaker pattern
 */
export class CircuitBreaker
{
    private state: CircuitBreakerState = "CLOSED";
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime?: Date;
    private lastSuccessTime?: Date;
    private nextRetryTime?: Date;
    private responseTimes: number[] = [];
    private failureTimestamps: Date[] = [];

    constructor(
        private readonly name: string,
        private readonly config: CircuitBreakerConfig
    )
    {
        this.config = {
            monitoringWindow: 60000, // 1 minute default window
            resetTimeout: 30000, // 30 seconds additional timeout
            ...config,
        };
    }

    /**
     * Execute operation with circuit breaker protection
     */
    async execute<T>(
        operation: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<CircuitBreakerOperationResult<T>>
    {
        const startTime = Date.now();

        // Check circuit state before execution
        if (this.state === "OPEN") {
            if (this.shouldAttemptReset()) {
                this.state = "HALF_OPEN";
                this.logStateChange("OPEN", "HALF_OPEN");
            } else {
                return this.handleOpenCircuit(startTime);
            }
        }

        try {
            // Execute the operation
            const result = await operation();
            const executionTime = Date.now() - startTime;

            this.recordSuccess(executionTime);

            return {
                success: true,
                data: result,
                fromCache: false,
                circuitState: this.state,
                executionTime,
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Check if this is an expected error (doesn't count against circuit breaker)
            if (this.config.expectedError && this.config.expectedError(error)) {
                this.logExpectedError(error);
                return {
                    success: false,
                    error,
                    fromCache: false,
                    circuitState: this.state,
                    executionTime,
                };
            }

            this.recordFailure();

            return {
                success: false,
                error,
                fromCache: false,
                circuitState: this.state,
                executionTime,
            };
        }
    }

    /**
     * Handle requests when circuit is open - attempt fallback or graceful degradation
     */
    private async handleOpenCircuit<T>(startTime: number): Promise<CircuitBreakerOperationResult<T>>
    {
        const executionTime = Date.now() - startTime;

        // Log the circuit breaker activation
        jackpotLogger.warn(`Circuit breaker is OPEN for operation: ${this.name}`, {
            operationId: `cb_${this.name}`,
            timestamp: new Date(),
            state: this.state,
            failureCount: this.failureCount,
            nextRetryTime: this.nextRetryTime,
        });

        // In a real implementation, you might:
        // 1. Return cached data
        // 2. Execute a fallback operation
        // 3. Return default/fallback data
        // 4. Queue for later processing

        return {
            success: false,
            error: new Error(`Circuit breaker is OPEN for operation: ${this.name}`),
            fromCache: false,
            circuitState: this.state,
            executionTime,
        };
    }

    /**
     * Record successful operation
     */
    private recordSuccess(executionTime: number): void
    {
        this.successCount++;
        this.lastSuccessTime = new Date();
        this.responseTimes.push(executionTime);

        // Keep only recent response times (last 100)
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }

        // If we were in HALF_OPEN state, close the circuit
        if (this.state === "HALF_OPEN") {
            this.state = "CLOSED";
            this.failureCount = 0; // Reset failure count
            this.logStateChange("HALF_OPEN", "CLOSED");
        }

        // Clean up old failure timestamps
        this.cleanupOldTimestamps();
    }

    /**
     * Record failed operation
     */
    private recordFailure(): void
    {
        this.failureCount++;
        this.lastFailureTime = new Date();
        this.failureTimestamps.push(new Date());

        // If failure threshold is reached, open the circuit
        if (this.failureCount >= this.config.failureThreshold) {
            this.openCircuit();
        }

        // Clean up old failure timestamps
        this.cleanupOldTimestamps();
    }

    /**
     * Open the circuit breaker
     */
    private openCircuit(): void
    {
        const previousState = this.state;
        this.state = "OPEN";
        this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);

        this.logStateChange(previousState, "OPEN");
    }

    /**
     * Check if we should attempt to reset the circuit
     */
    private shouldAttemptReset(): boolean
    {
        if (!this.nextRetryTime) {
            return false;
        }

        return Date.now() >= this.nextRetryTime.getTime();
    }

    /**
     * Clean up old timestamps outside the monitoring window
     */
    private cleanupOldTimestamps(): void
    {
        const cutoffTime = Date.now() - (this.config.monitoringWindow || 60000);

        // Clean failure timestamps
        this.failureTimestamps = this.failureTimestamps.filter(
            timestamp => timestamp.getTime() > cutoffTime
        );

        // Update failure count based on current window
        this.failureCount = this.failureTimestamps.length;
    }

    /**
     * Log state changes
     */
    private logStateChange(from: CircuitBreakerState, to: CircuitBreakerState): void
    {
        jackpotLogger.info(`Circuit breaker state change: ${from} -> ${to}`, {
            operationId: `cb_${this.name}`,
            timestamp: new Date(),
            circuitBreaker: this.name,
            fromState: from,
            toState: to,
            failureCount: this.failureCount,
            successCount: this.successCount,
        });

        // Call custom state change handler if provided
        if (this.config.onStateChange) {
            this.config.onStateChange(from, to);
        }
    }

    /**
     * Log expected errors (don't count against circuit breaker)
     */
    private logExpectedError(error: any): void
    {
        jackpotLogger.info(`Expected error in circuit breaker ${this.name}`, {
            operationId: `cb_${this.name}`,
            timestamp: new Date(),
            circuitBreaker: this.name,
            error: error?.message || error,
        });
    }

    /**
     * Get current metrics
     */
    getMetrics(): CircuitBreakerMetrics
    {
        const totalRequests = this.failureCount + this.successCount;
        const failureRate = totalRequests > 0 ? (this.failureCount / totalRequests) * 100 : 0;
        const averageResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
            : 0;

        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalRequests,
            failureRate: Math.round(failureRate * 100) / 100,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            nextRetryTime: this.nextRetryTime,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        };
    }

    /**
     * Reset circuit breaker to initial state
     */
    reset(): void
    {
        const previousState = this.state;
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.nextRetryTime = undefined;
        this.responseTimes = [];
        this.failureTimestamps = [];

        this.logStateChange(previousState, "CLOSED");
    }

    /**
     * Get current state
     */
    getState(): CircuitBreakerState
    {
        return this.state;
    }

    /**
     * Force circuit to specific state (for testing or manual intervention)
     */
    forceState(state: CircuitBreakerState): void
    {
        const previousState = this.state;
        this.state = state;
        this.logStateChange(previousState, state);
    }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry
{
    private breakers = new Map<string, CircuitBreaker>();

    /**
     * Get or create circuit breaker by name
     */
    getOrCreate(name: string, config: CircuitBreakerConfig): CircuitBreaker
    {
        if (!this.breakers.has(name)) {
            this.breakers.set(name, new CircuitBreaker(name, config));
        }
        return this.breakers.get(name)!;
    }

    /**
     * Get circuit breaker by name
     */
    get(name: string): CircuitBreaker | undefined
    {
        return this.breakers.get(name);
    }

    /**
     * Remove circuit breaker
     */
    remove(name: string): boolean
    {
        return this.breakers.delete(name);
    }

    /**
     * Get all circuit breaker metrics
     */
    getAllMetrics(): Record<string, CircuitBreakerMetrics>
    {
        const metrics: Record<string, CircuitBreakerMetrics> = {};

        for (const [name, breaker] of this.breakers) {
            metrics[name] = breaker.getMetrics();
        }

        return metrics;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll(): void
    {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }

    /**
     * Get registry statistics
     */
    getRegistryStats():
        {
            totalBreakers: number;
            closedBreakers: number;
            openBreakers: number;
            halfOpenBreakers: number;
            totalFailures: number;
            totalSuccesses: number;
        }
    {
        let closed = 0;
        let open = 0;
        let halfOpen = 0;
        let totalFailures = 0;
        let totalSuccesses = 0;

        for (const breaker of this.breakers.values()) {
            const metrics = breaker.getMetrics();

            switch (metrics.state) {
                case "CLOSED":
                    closed++;
                    break;
                case "OPEN":
                    open++;
                    break;
                case "HALF_OPEN":
                    halfOpen++;
                    break;
            }

            totalFailures += metrics.failureCount;
            totalSuccesses += metrics.successCount;
        }

        return {
            totalBreakers: this.breakers.size,
            closedBreakers: closed,
            openBreakers: open,
            halfOpenBreakers: halfOpen,
            totalFailures,
            totalSuccesses,
        };
    }
}

// Global circuit breaker registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Default circuit breaker configurations for different operation types
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
    // Database operations - sensitive to connection issues
    database: {
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
        monitoringWindow: 120000, // 2 minutes
        resetTimeout: 60000, // 1 minute
        expectedError: (error: any) =>
        {
            // Don't count validation errors against circuit breaker
            return error?.code?.startsWith("VALIDATION_") ||
                error?.category === "VALIDATION";
        },
    },

    // Jackpot contribution operations
    jackpotContribute: {
        failureThreshold: 3,
        recoveryTimeout: 45000, // 45 seconds
        monitoringWindow: 180000, // 3 minutes
        resetTimeout: 90000, // 1.5 minutes
        expectedError: (error: any) =>
        {
            return error?.code === "VALIDATION_INVALID_AMOUNT" ||
                error?.category === "VALIDATION";
        },
    },

    // Jackpot win operations - very conservative
    jackpotWin: {
        failureThreshold: 2,
        recoveryTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
        resetTimeout: 120000, // 2 minutes
        expectedError: (error: any) =>
        {
            return error?.code === "INSUFFICIENT_JACKPOT_FUNDS" ||
                error?.category === "VALIDATION" ||
                error?.category === "INSUFFICIENT_FUNDS";
        },
    },

    // Configuration operations - should be very reliable
    jackpotConfig: {
        failureThreshold: 1,
        recoveryTimeout: 120000, // 2 minutes
        monitoringWindow: 600000, // 10 minutes
        resetTimeout: 300000, // 5 minutes
    },

    // External API calls - more tolerant of failures
    externalApi: {
        failureThreshold: 10,
        recoveryTimeout: 15000, // 15 seconds
        monitoringWindow: 60000, // 1 minute
        resetTimeout: 30000, // 30 seconds
    },
};

/**
 * Get circuit breaker for specific operation
 */
export function getCircuitBreaker(operationType: keyof typeof DEFAULT_CIRCUIT_BREAKER_CONFIGS): CircuitBreaker
{
    const config = DEFAULT_CIRCUIT_BREAKER_CONFIGS[operationType];
    if (!config) {
        throw new Error(`No circuit breaker configuration found for operation type: ${operationType}`);
    }
    return circuitBreakerRegistry.getOrCreate(operationType, config);
}

/**
 * Execute operation with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
    operationType: keyof typeof DEFAULT_CIRCUIT_BREAKER_CONFIGS,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
): Promise<CircuitBreakerOperationResult<T>>
{
    const circuitBreaker = getCircuitBreaker(operationType);
    return circuitBreaker.execute(operation, fallback);
}

/**
 * Health check for circuit breakers
 */
export async function performCircuitBreakerHealthCheck(): Promise<{
    overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
    metrics: ReturnType<CircuitBreakerRegistry["getRegistryStats"]>;
    details: ReturnType<CircuitBreakerRegistry["getAllMetrics"]>;
    recommendations: string[];
}>
{
    const registryStats = circuitBreakerRegistry.getRegistryStats();
    const allMetrics = circuitBreakerRegistry.getAllMetrics();
    const recommendations: string[] = [];

    // Determine overall health
    let overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";

    if (registryStats.openBreakers === 0 && registryStats.halfOpenBreakers === 0) {
        overall = "HEALTHY";
    } else if (registryStats.openBreakers <= registryStats.totalBreakers * 0.2) {
        overall = "DEGRADED";
        recommendations.push("Some circuit breakers are open - check underlying service health");
    } else {
        overall = "UNHEALTHY";
        recommendations.push("Multiple circuit breakers are open - investigate system-wide issues");
    }

    // Check for high failure rates
    for (const [name, metrics] of Object.entries(allMetrics)) {
        if (metrics.failureRate > 80 && metrics.totalRequests > 10) {
            recommendations.push(`Circuit breaker ${name} has ${metrics.failureRate}% failure rate`);
        }
    }

    // Check for stale circuit breakers
    const now = Date.now();
    for (const [name, metrics] of Object.entries(allMetrics)) {
        if (metrics.state === "OPEN" && metrics.lastFailureTime) {
            const timeSinceFailure = now - metrics.lastFailureTime.getTime();
            if (timeSinceFailure > 300000) { // 5 minutes
                recommendations.push(`Circuit breaker ${name} has been open for ${Math.round(timeSinceFailure / 60000)} minutes`);
            }
        }
    }

    return {
        overall,
        metrics: registryStats,
        details: allMetrics,
        recommendations,
    };
}
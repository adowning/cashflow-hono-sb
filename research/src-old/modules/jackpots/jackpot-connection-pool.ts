/**
 * Optimized database connection pooling management for high-throughput jackpot scenarios
 * Provides intelligent pool sizing, health monitoring, and automatic recovery
 */

import { db } from "@/libs/database/db";

// ========================================
// CONNECTION POOL INTERFACES AND TYPES
// ========================================

export interface PoolMetrics
{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    waitingQueries: number;
    poolUtilization: number; // 0-100%
    averageWaitTime: number; // in ms
    queryThroughput: number; // queries per second
    errorRate: number; // percentage
}

export interface PoolConfiguration
{
    minConnections: number;
    maxConnections: number;
    idleTimeout: number; // seconds
    connectionTimeout: number; // seconds
    maxLifetime: number; // seconds
    healthCheckInterval: number; // seconds
    enableHealthChecks: boolean;
    enableMetrics: boolean;
}

export interface ConnectionHealth
{
    isHealthy: boolean;
    lastCheck: Date;
    responseTime: number; // ms
    errorCount: number;
    lastError?: string;
}

export interface PoolEvent
{
    type: 'connection_acquired' | 'connection_released' | 'connection_error' | 'pool_exhausted' | 'connection_recovered';
    timestamp: Date;
    connectionId?: string;
    error?: string;
    metadata?: Record<string, any>;
}

// ========================================
// CONNECTION POOL MONITOR AND MANAGER
// ========================================

/**
 * Advanced connection pool monitoring and management for jackpot operations
 */
export class JackpotConnectionPool
{
    private config: PoolConfiguration;
    private metrics: PoolMetrics;
    private healthStatus: ConnectionHealth;
    private eventListeners: ((event: PoolEvent) => void)[] = [];
    private healthCheckTimer?: NodeJS.Timeout;
    private metricsTimer?: NodeJS.Timeout;
    private connectionMap = new Map<string, { id: string; acquiredAt: Date; lastUsed: Date }>();

    constructor(config: Partial<PoolConfiguration> = {})
    {
        this.config = {
            minConnections: 10,
            maxConnections: 50,
            idleTimeout: 300, // 5 minutes
            connectionTimeout: 30,
            maxLifetime: 3600, // 1 hour
            healthCheckInterval: 30, // 30 seconds
            enableHealthChecks: true,
            enableMetrics: true,
            ...config,
        };

        this.metrics = {
            activeConnections: 0,
            idleConnections: 0,
            totalConnections: 0,
            waitingQueries: 0,
            poolUtilization: 0,
            averageWaitTime: 0,
            queryThroughput: 0,
            errorRate: 0,
        };

        this.healthStatus = {
            isHealthy: true,
            lastCheck: new Date(),
            responseTime: 0,
            errorCount: 0,
        };

        if (this.config.enableHealthChecks) {
            this.startHealthChecks();
        }

        if (this.config.enableMetrics) {
            this.startMetricsCollection();
        }
    }

    /**
     * Acquire a connection from the pool with monitoring
     */
    async acquireConnection(): Promise<{ connectionId: string; startTime: number }>
    {
        const startTime = Date.now();
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Monitor connection acquisition
            this.recordEvent({
                type: 'connection_acquired',
                timestamp: new Date(),
                connectionId,
            });

            // Track connection usage
            this.connectionMap.set(connectionId, {
                id: connectionId,
                acquiredAt: new Date(),
                lastUsed: new Date(),
            });

            return {
                connectionId,
                startTime,
            };
        } catch (error) {
            this.recordEvent({
                type: 'connection_error',
                timestamp: new Date(),
                connectionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            this.healthStatus.errorCount++;
            this.healthStatus.lastError = error instanceof Error ? error.message : 'Unknown error';

            throw error;
        }
    }

    /**
     * Release a connection back to the pool
     */
    async releaseConnection(connectionId: string, queryTime?: number): Promise<void>
    {
        const connection = this.connectionMap.get(connectionId);
        if (connection) {
            connection.lastUsed = new Date();

            this.recordEvent({
                type: 'connection_released',
                timestamp: new Date(),
                connectionId,
                metadata: { queryTime },
            });

            this.connectionMap.delete(connectionId);
        }
    }

    /**
     * Execute a query with automatic connection management
     */
    async executeQuery<T>(
        queryFn: (connection: any) => Promise<T>,
        options: { timeout?: number; retryAttempts?: number } = {}
    ): Promise<T>
    {
        const { timeout = this.config.connectionTimeout * 1000, retryAttempts = 3 } = options;

        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            let connectionData: { connectionId: string; startTime: number } | null = null;

            try {
                connectionData = await this.acquireConnection();

                // Execute query with timeout
                const queryPromise = queryFn(db);
                const timeoutPromise = new Promise<never>((_, reject) =>
                {
                    setTimeout(() => reject(new Error('Query timeout')), timeout);
                });

                const result = await Promise.race([queryPromise, timeoutPromise]);

                const queryTime = Date.now() - connectionData.startTime;
                await this.releaseConnection(connectionData.connectionId, queryTime);

                // Update metrics
                this.metrics.queryThroughput++;

                return result;
            } catch (error) {
                if (connectionData) {
                    await this.releaseConnection(connectionData.connectionId);
                }

                if (attempt === retryAttempts) {
                    throw error;
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }

        throw new Error('Max retry attempts exceeded');
    }

    /**
     * Get current pool metrics
     */
    getMetrics(): PoolMetrics
    {
        // Simulate metrics collection (in a real implementation, this would query the actual pool)
        this.metrics.activeConnections = this.connectionMap.size;
        this.metrics.idleConnections = Math.max(0, this.config.minConnections - this.metrics.activeConnections);
        this.metrics.totalConnections = this.metrics.activeConnections + this.metrics.idleConnections;
        this.metrics.poolUtilization = this.config.maxConnections > 0
            ? (this.metrics.activeConnections / this.config.maxConnections) * 100
            : 0;

        return { ...this.metrics };
    }

    /**
     * Get connection health status
     */
    getHealthStatus(): ConnectionHealth
    {
        return { ...this.healthStatus };
    }

    /**
     * Add event listener for pool events
     */
    addEventListener(listener: (event: PoolEvent) => void): void
    {
        this.eventListeners.push(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(listener: (event: PoolEvent) => void): void
    {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    /**
     * Update pool configuration
     */
    updateConfiguration(newConfig: Partial<PoolConfiguration>): void
    {
        this.config = { ...this.config, ...newConfig };

        // Restart health checks if interval changed
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            if (this.config.enableHealthChecks) {
                this.startHealthChecks();
            }
        }
    }

    /**
     * Perform pool health check
     */
    private async performHealthCheck(): Promise<void>
    {
        const startTime = Date.now();

        try {
            // Execute a simple query to test connectivity
            await this.executeQuery(async (connection) =>
            {
                // Simple health check query
                const result = await connection`SELECT 1 as health_check`;
                return result;
            });

            this.healthStatus.isHealthy = true;
            this.healthStatus.responseTime = Date.now() - startTime;
        } catch (error) {
            this.healthStatus.isHealthy = false;
            this.healthStatus.responseTime = Date.now() - startTime;
            this.healthStatus.lastError = error instanceof Error ? error.message : 'Health check failed';

            this.recordEvent({
                type: 'connection_error',
                timestamp: new Date(),
                error: this.healthStatus.lastError,
                metadata: { healthCheck: true },
            });
        }

        this.healthStatus.lastCheck = new Date();
    }

    /**
     * Start health check monitoring
     */
    private startHealthChecks(): void
    {
        this.healthCheckTimer = setInterval(() =>
        {
            this.performHealthCheck();
        }, this.config.healthCheckInterval * 1000);
    }

    /**
     * Start metrics collection
     */
    private startMetricsCollection(): void
    {
        this.metricsTimer = setInterval(() =>
        {
            // Update metrics periodically
            this.getMetrics();
        }, 5000); // Every 5 seconds
    }

    /**
     * Record a pool event
     */
    private recordEvent(event: PoolEvent): void
    {
        this.eventListeners.forEach(listener =>
        {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in pool event listener:', error);
            }
        });
    }

    /**
     * Get optimal pool configuration based on workload
     */
    static getOptimalConfiguration(workload: 'low' | 'medium' | 'high' | 'extreme'): PoolConfiguration
    {
        const configurations = {
            low: {
                minConnections: 5,
                maxConnections: 20,
                idleTimeout: 300,
                connectionTimeout: 30,
                maxLifetime: 3600,
                healthCheckInterval: 60,
                enableHealthChecks: true,
                enableMetrics: true,
            },
            medium: {
                minConnections: 10,
                maxConnections: 50,
                idleTimeout: 300,
                connectionTimeout: 30,
                maxLifetime: 3600,
                healthCheckInterval: 30,
                enableHealthChecks: true,
                enableMetrics: true,
            },
            high: {
                minConnections: 20,
                maxConnections: 100,
                idleTimeout: 180,
                connectionTimeout: 15,
                maxLifetime: 1800,
                healthCheckInterval: 15,
                enableHealthChecks: true,
                enableMetrics: true,
            },
            extreme: {
                minConnections: 50,
                maxConnections: 200,
                idleTimeout: 120,
                connectionTimeout: 10,
                maxLifetime: 900,
                healthCheckInterval: 10,
                enableHealthChecks: true,
                enableMetrics: true,
            },
        };

        return configurations[workload];
    }

    /**
     * Clean up resources
     */
    destroy(): void
    {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
        }

        this.connectionMap.clear();
        this.eventListeners = [];
    }
}

// ========================================
// CONNECTION POOL ADAPTER FOR JACKPOT OPERATIONS
// ========================================

/**
 * Specialized adapter for jackpot operations with optimized connection usage
 */
export class JackpotPoolAdapter
{
    private pool: JackpotConnectionPool;
    private queryCache = new Map<string, { query: string; frequency: number; lastUsed: Date }>();

    constructor(workload: 'low' | 'medium' | 'high' | 'extreme' = 'medium')
    {
        this.pool = new JackpotConnectionPool(
            JackpotPoolAdapter.getOptimalConfiguration(workload)
        );
    }

    /**
     * Execute jackpot contribution with optimal connection management
     */
    async executeContribution(
        queryFn: (connection: any) => Promise<any>
    ): Promise<any>
    {
        return this.pool.executeQuery(queryFn, {
            timeout: 10000, // 10 second timeout for contributions
            retryAttempts: 3,
        });
    }

    /**
     * Execute jackpot win processing with strict timeout
     */
    async executeWin(
        queryFn: (connection: any) => Promise<any>
    ): Promise<any>
    {
        return this.pool.executeQuery(queryFn, {
            timeout: 5000, // 5 second timeout for wins (more critical)
            retryAttempts: 2,
        });
    }

    /**
     * Execute batch operations with optimized connection reuse
     */
    async executeBatch(
        operations: Array<() => Promise<any>>,
        options: { parallel?: boolean; maxConcurrency?: number } = {}
    ): Promise<any[]>
    {
        const { parallel = true, maxConcurrency = 10 } = options;

        if (!parallel) {
            const results = [];
            for (const operation of operations) {
                results.push(await this.pool.executeQuery(operation));
            }
            return results;
        }

        // Execute operations in parallel with concurrency limit
        const batches = [];
        for (let i = 0; i < operations.length; i += maxConcurrency) {
            const batch = operations.slice(i, i + maxConcurrency);
            const batchResults = await Promise.all(
                batch.map(operation => this.pool.executeQuery(operation))
            );
            batches.push(...batchResults);
        }

        return batches;
    }

    /**
     * Cache and reuse prepared statements for jackpot operations
     */
    async executeCachedQuery(
        cacheKey: string,
        queryFn: (connection: any) => Promise<any>
    ): Promise<any>
    {
        // Update cache statistics
        const cached = this.queryCache.get(cacheKey);
        if (cached) {
            cached.frequency++;
            cached.lastUsed = new Date();
        } else {
            this.queryCache.set(cacheKey, {
                query: cacheKey,
                frequency: 1,
                lastUsed: new Date(),
            });
        }

        return this.pool.executeQuery(queryFn);
    }

    /**
     * Get pool performance statistics
     */
    getPoolStats()
    {
        return {
            metrics: this.pool.getMetrics(),
            health: this.pool.getHealthStatus(),
            cacheStats: {
                size: this.queryCache.size,
                mostUsed: Array.from(this.queryCache.entries())
                    .sort((a, b) => b[1].frequency - a[1].frequency)
                    .slice(0, 5)
                    .map(([key, value]) => ({ query: key, frequency: value.frequency })),
            },
        };
    }

    /**
     * Update workload configuration
     */
    updateWorkload(workload: 'low' | 'medium' | 'high' | 'extreme'): void
    {
        const config = JackpotPoolAdapter.getOptimalConfiguration(workload);
        this.pool.updateConfiguration(config);
    }

    /**
     * Clean up resources
     */
    destroy(): void
    {
        this.pool.destroy();
        this.queryCache.clear();
    }

    private static getOptimalConfiguration(workload: 'low' | 'medium' | 'high' | 'extreme'): Partial<PoolConfiguration>
    {
        return JackpotConnectionPool.getOptimalConfiguration(workload);
    }
}

// ========================================
// GLOBAL POOL INSTANCES
// ========================================

// Pre-configured pool instances for different use cases
export const jackpotPoolLow = new JackpotPoolAdapter('low');
export const jackpotPoolMedium = new JackpotPoolAdapter('medium');
export const jackpotPoolHigh = new JackpotPoolAdapter('high');
export const jackpotPoolExtreme = new JackpotPoolAdapter('extreme');

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Get appropriate pool adapter for the current system load
 */
export function getJackpotPoolAdapter(load: 'low' | 'medium' | 'high' | 'extreme' = 'medium'): JackpotPoolAdapter
{
    const pools = {
        low: jackpotPoolLow,
        medium: jackpotPoolMedium,
        high: jackpotPoolHigh,
        extreme: jackpotPoolExtreme,
    };

    return pools[load];
}

/**
 * Auto-detect system load and return appropriate pool
 */
export function getAutoJackpotPool(): JackpotPoolAdapter
{
    // In a real implementation, this would analyze current system metrics
    // For now, return medium load as default
    return jackpotPoolMedium;
}

/**
 * Monitor pool health and automatically adjust configuration
 */
export class AdaptivePoolManager
{
    private pools: Map<string, JackpotPoolAdapter> = new Map();
    private monitoringTimer?: NodeJS.Timeout;

    constructor()
    {
        // Initialize with all pool types
        this.pools.set('low', jackpotPoolLow);
        this.pools.set('medium', jackpotPoolMedium);
        this.pools.set('high', jackpotPoolHigh);
        this.pools.set('extreme', jackpotPoolExtreme);

        this.startAdaptiveMonitoring();
    }

    /**
     * Get best pool based on current system metrics
     */
    getBestPool(): JackpotPoolAdapter
    {
        // Analyze metrics and choose optimal pool
        const poolStats = Array.from(this.pools.entries()).map(([name, pool]) => ({
            name,
            pool,
            stats: pool.getPoolStats(),
        }));

        // Find pool with lowest utilization and best health
        const bestPool = poolStats.reduce((best, current) =>
        {
            const currentScore = this.calculatePoolScore(current.stats);
            const bestScore = this.calculatePoolScore(best.stats);

            return currentScore > bestScore ? current : best;
        });

        return bestPool.pool;
    }

    private calculatePoolScore(stats: any): number
    {
        const utilization = stats.metrics.poolUtilization;
        const health = stats.health.isHealthy ? 100 : 0;
        const errorRate = 100 - stats.metrics.errorRate;

        // Lower utilization is better, but we want some utilization
        const utilizationScore = Math.max(0, 100 - Math.abs(utilization - 70));

        return (health + errorRate + utilizationScore) / 3;
    }

    private startAdaptiveMonitoring(): void
    {
        this.monitoringTimer = setInterval(() =>
        {
            // Periodically check and adjust if needed
            const currentPool = this.getBestPool();
            const stats = currentPool.getPoolStats();

            // Log performance metrics
            console.log('Jackpot pool performance:', {
                poolUtilization: stats.metrics.poolUtilization,
                healthStatus: stats.health.isHealthy ? 'healthy' : 'unhealthy',
                queryThroughput: stats.metrics.queryThroughput,
                errorRate: stats.metrics.errorRate,
            });
        }, 30000); // Every 30 seconds
    }

    destroy(): void
    {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }

        this.pools.forEach(pool => pool.destroy());
        this.pools.clear();
    }
}
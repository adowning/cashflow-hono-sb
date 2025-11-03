/**
 * Memory management and monitoring for high-throughput jackpot scenarios
 * Provides garbage collection friendly patterns, stream processing, and memory alerting
 */

import { performance } from "perf_hooks";

// ========================================
// MEMORY MANAGEMENT INTERFACES
// ========================================

export interface MemoryStats
{
    used: number; // bytes
    total: number; // bytes
    percentage: number; // 0-100
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
}

export interface MemoryAlert
{
    level: 'warning' | 'critical' | 'fatal';
    message: string;
    currentUsage: number;
    threshold: number;
    timestamp: Date;
    component: string;
}

export interface StreamProcessorConfig
{
    batchSize: number;
    bufferSize: number;
    maxMemoryUsage: number; // bytes
    garbageCollectionThreshold: number; // percentage
    enableProfiling: boolean;
}

export interface ProcessingMetrics
{
    itemsProcessed: number;
    memoryPeaks: number[];
    averageMemoryUsage: number;
    gcFrequency: number;
    processingTime: number;
    errorRate: number;
}

// ========================================
// MEMORY MONITOR
// ========================================

/**
 * Real-time memory monitoring and alerting system
 */
export class JackpotMemoryMonitor
{
    private alerts: MemoryAlert[] = [];
    private thresholds = {
        warning: 70, // 70% memory usage
        critical: 85, // 85% memory usage
        fatal: 95, // 95% memory usage
    };
    private monitoringInterval?: NodeJS.Timeout;
    private listeners: Array<(alert: MemoryAlert) => void> = [];
    private maxAlerts = 100;

    constructor(options?: {
        warningThreshold?: number;
        criticalThreshold?: number;
        fatalThreshold?: number;
    })
    {
        if (options) {
            this.thresholds = {
                warning: options.warningThreshold || 70,
                critical: options.criticalThreshold || 85,
                fatal: options.fatalThreshold || 95,
            };
        }
    }

    /**
     * Get current memory statistics
     */
    getMemoryStats(): MemoryStats
    {
        const memUsage = process.memoryUsage();
        const total = memUsage.heapTotal + memUsage.external + memUsage.arrayBuffers;
        const used = memUsage.heapUsed + memUsage.external + memUsage.arrayBuffers;

        return {
            used,
            total,
            percentage: (used / total) * 100,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers || 0,
        };
    }

    /**
     * Check memory thresholds and trigger alerts if needed
     */
    checkMemoryThresholds(): MemoryAlert | null
    {
        const stats = this.getMemoryStats();
        const { percentage } = stats;

        let level: 'warning' | 'critical' | 'fatal' | null = null;

        if (percentage >= this.thresholds.fatal) {
            level = 'fatal';
        } else if (percentage >= this.thresholds.critical) {
            level = 'critical';
        } else if (percentage >= this.thresholds.warning) {
            level = 'warning';
        }

        if (level) {
            const alert: MemoryAlert = {
                level,
                message: `Memory usage ${percentage.toFixed(1)}% exceeds ${level} threshold`,
                currentUsage: percentage,
                threshold: this.thresholds[level],
                timestamp: new Date(),
                component: 'jackpot_system',
            };

            this.addAlert(alert);
            this.notifyListeners(alert);

            return alert;
        }

        return null;
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring(intervalMs: number = 5000): void
    {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(() =>
        {
            this.checkMemoryThresholds();
        }, intervalMs);

        console.log('Jackpot memory monitoring started');
    }

    /**
     * Stop continuous monitoring
     */
    stopMonitoring(): void
    {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
            console.log('Jackpot memory monitoring stopped');
        }
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection(): boolean
    {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }

    /**
     * Get memory usage trend over time
     */
    getMemoryTrend(): { timestamp: Date; usage: number }[]
    {
        // In a real implementation, this would track memory usage over time
        return [];
    }

    /**
     * Get all active alerts
     */
    getAlerts(): MemoryAlert[]
    {
        return [...this.alerts];
    }

    /**
     * Clear old alerts
     */
    clearOldAlerts(maxAge: number = 3600000): void
    { // 1 hour default
        const cutoff = Date.now() - maxAge;
        this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
    }

    /**
     * Add alert listener
     */
    addAlertListener(listener: (alert: MemoryAlert) => void): void
    {
        this.listeners.push(listener);
    }

    /**
     * Remove alert listener
     */
    removeAlertListener(listener: (alert: MemoryAlert) => void): void
    {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Update memory thresholds
     */
    updateThresholds(thresholds: Partial<typeof this.thresholds>): void
    {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    private addAlert(alert: MemoryAlert): void
    {
        this.alerts.unshift(alert);

        // Keep only recent alerts
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(0, this.maxAlerts);
        }
    }

    private notifyListeners(alert: MemoryAlert): void
    {
        this.listeners.forEach(listener =>
        {
            try {
                listener(alert);
            } catch (error) {
                console.error('Error in memory alert listener:', error);
            }
        });
    }
}

// ========================================
// STREAM PROCESSOR FOR LARGE DATASETS
// ========================================

/**
 * Memory-efficient stream processor for large jackpot datasets
 */
export class StreamJackpotProcessor
{
    private config: StreamProcessorConfig;
    private monitor: JackpotMemoryMonitor;
    private metrics: ProcessingMetrics;

    constructor(config: Partial<StreamProcessorConfig> = {})
    {
        this.config = {
            batchSize: 1000,
            bufferSize: 100,
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            garbageCollectionThreshold: 80,
            enableProfiling: false,
            ...config,
        };

        this.monitor = new JackpotMemoryMonitor();
        this.metrics = {
            itemsProcessed: 0,
            memoryPeaks: [],
            averageMemoryUsage: 0,
            gcFrequency: 0,
            processingTime: 0,
            errorRate: 0,
        };

        this.setupMemoryMonitoring();
    }

    /**
     * Process large dataset using stream processing to minimize memory usage
     */
    async processStream<T, R>(
        dataStream: AsyncIterable<T>,
        processor: (batch: T[]) => Promise<R[]>,
        options: {
            batchSize?: number;
            onProgress?: (progress: { processed: number; total: number }) => void;
        } = {}
    ): Promise<R[]>
    {
        const batchSize = options.batchSize || this.config.batchSize;
        const batches: T[][] = [];
        const results: R[] = [];
        let processed = 0;
        let batchCount = 0;

        const startTime = performance.now();

        try {
            // Build batches from stream
            let currentBatch: T[] = [];

            for await (const item of dataStream) {
                currentBatch.push(item);

                if (currentBatch.length >= batchSize) {
                    batches.push(currentBatch);
                    currentBatch = [];
                    batchCount++;

                    // Check memory usage and potentially trigger GC
                    await this.checkAndOptimizeMemory();

                    // Update progress if callback provided
                    if (options.onProgress) {
                        processed += batchSize;
                        options.onProgress({ processed, total: -1 }); // Total unknown for streams
                    }
                }
            }

            // Add remaining items
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }

            // Process batches
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];

                try {
                    if (batch) {
                        const batchResults = await processor(batch);
                        results.push(...batchResults);

                        // Update progress
                        if (options.onProgress) {
                            processed += batch.length;
                            options.onProgress({ processed, total: processed });
                        }
                    }

                    // Clear processed batch to free memory
                    batches[i] = [];

                    // Periodic garbage collection
                    if (i % 10 === 0) {
                        await this.periodicCleanup();
                    }
                } catch (error) {
                    console.error(`Error processing batch ${i}:`, error);
                    // Continue with next batch
                }
            }

            const processingTime = performance.now() - startTime;
            this.metrics.processingTime = processingTime;

            return results;
        } finally {
            // Final cleanup
            await this.finalCleanup();
        }
    }

    /**
     * Process jackpot contributions stream efficiently
     */
    async processContributionsStream(
        contributions: AsyncIterable<{
            gameId: string;
            wagerAmount: number;
            timestamp: Date;
        }>,
        onProgress?: (progress: { processed: number; memoryUsage: number }) => void
    ): Promise<{ totalProcessed: number; totalAmount: number }>
    {
        let totalProcessed = 0;
        let totalAmount = 0;

        await this.processStream(
            contributions,
            async (batch) =>
            {
                // Process batch of contributions
                let batchTotal = 0;
                for (const contrib of batch) {
                    batchTotal += contrib.wagerAmount * 0.02; // Assume 2% contribution rate
                }

                return [{ totalAmount: batchTotal }];
            },
            {
                batchSize: this.config.batchSize,
                onProgress: (progress) =>
                {
                    totalProcessed = progress.processed;
                    const memoryUsage = this.monitor.getMemoryStats().percentage;

                    if (onProgress) {
                        onProgress({ processed: totalProcessed, memoryUsage });
                    }
                },
            }
        );

        return { totalProcessed, totalAmount };
    }

    /**
     * Memory-efficient jackpot stats aggregation
     */
    async aggregateStatsStream(
        statsStream: AsyncIterable<{
            group: string;
            amount: number;
            type: 'contribution' | 'win';
        }>,
        onProgress?: (progress: { processed: number; memoryUsage: number }) => void
    ): Promise<Record<string, { contributions: number; wins: number }>>
    {
        const aggregatedStats: Record<string, { contributions: number; wins: number }> = {};

        await this.processStream(
            statsStream,
            async (batch) =>
            {
                const batchStats: Record<string, { contributions: number; wins: number }> = {};

                for (const stat of batch) {
                    if (!batchStats[stat.group]) {
                        batchStats[stat.group] = { contributions: 0, wins: 0 };
                    }

                    if (stat.type === 'contribution') {
                        const groupStats = batchStats[stat.group];
                        if (groupStats) {
                            groupStats.contributions += stat.amount;
                        }
                    } else {
                        const groupStats = batchStats[stat.group];
                        if (groupStats) {
                            groupStats.wins += stat.amount;
                        }
                    }
                }

                // Merge batch stats into aggregated stats
                for (const [group, stats] of Object.entries(batchStats)) {
                    if (!aggregatedStats[group]) {
                        aggregatedStats[group] = { contributions: 0, wins: 0 };
                    }
                    aggregatedStats[group].contributions += stats.contributions;
                    aggregatedStats[group].wins += stats.wins;
                }

                return [aggregatedStats];
            },
            {
                batchSize: this.config.batchSize,
                onProgress: (progress) =>
                {
                    const memoryUsage = this.monitor.getMemoryStats().percentage;

                    if (onProgress) {
                        onProgress({ processed: progress.processed, memoryUsage });
                    }
                },
            }
        );

        return aggregatedStats;
    }

    /**
     * Get processing metrics
     */
    getMetrics(): ProcessingMetrics
    {
        const memStats = this.monitor.getMemoryStats();
        this.metrics.averageMemoryUsage = memStats.percentage;
        this.metrics.memoryPeaks.push(memStats.percentage);

        // Keep only recent memory peaks
        if (this.metrics.memoryPeaks.length > 100) {
            this.metrics.memoryPeaks = this.metrics.memoryPeaks.slice(-100);
        }

        return { ...this.metrics };
    }

    /**
     * Update processing configuration
     */
    updateConfig(newConfig: Partial<StreamProcessorConfig>): void
    {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void>
    {
        this.monitor.stopMonitoring();
        await this.finalCleanup();
    }

    private setupMemoryMonitoring(): void
    {
        this.monitor.addAlertListener((alert) =>
        {
            console.warn(`Memory Alert [${alert.level.toUpperCase()}]: ${alert.message}`);

            if (alert.level === 'critical' || alert.level === 'fatal') {
                // Trigger emergency cleanup
                this.emergencyCleanup();
            }
        });

        this.monitor.startMonitoring(2000); // Check every 2 seconds
    }

    private async checkAndOptimizeMemory(): Promise<void>
    {
        const memStats = this.monitor.getMemoryStats();

        if (memStats.percentage >= this.config.garbageCollectionThreshold) {
            this.monitor.forceGarbageCollection();
            this.metrics.gcFrequency++;
        }

        if (memStats.percentage >= 90) {
            // Emergency cleanup for very high memory usage
            await this.emergencyCleanup();
        }
    }

    private async periodicCleanup(): Promise<void>
    {
        // Force garbage collection
        this.monitor.forceGarbageCollection();

        // Clear any temporary data structures
        // In a real implementation, you would clear specific caches or buffers
    }

    private async emergencyCleanup(): Promise<void>
    {
        console.warn('Performing emergency memory cleanup');

        // Force multiple garbage collection cycles
        for (let i = 0; i < 3; i++) {
            this.monitor.forceGarbageCollection();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Reduce batch size for future processing
        this.config.batchSize = Math.max(100, Math.floor(this.config.batchSize * 0.8));

        console.log(`Emergency cleanup complete. New batch size: ${this.config.batchSize}`);
    }

    private async finalCleanup(): Promise<void>
    {
        // Final cleanup before returning
        this.monitor.forceGarbageCollection();
    }
}

// ========================================
// GARBAGE COLLECTION OPTIMIZER
// ========================================

/**
 * Optimizes garbage collection patterns for jackpot operations
 */
export class GCOptimizer
{
    private gcStats = {
        totalCollections: 0,
        totalTime: 0,
        averageTime: 0,
        lastCollection: 0,
    };

    constructor()
    {
        this.setupGCMonitoring();
    }

    /**
     * Optimize memory allocation patterns
     */
    optimizeAllocation<T>(factory: () => T, cleanup?: () => void): T
    {
        const startTime = performance.now();

        try {
            const result = factory();
            return result;
        } finally {
            const allocationTime = performance.now() - startTime;

            // Trigger GC if allocation took too long
            if (allocationTime > 10) { // 10ms threshold
                this.triggerOptimizedGC();
            }
        }
    }

    /**
     * Create object pool to reduce GC pressure
     */
    createObjectPool<T>(factory: () => T, reset: (obj: T) => void, initialSize = 10): ObjectPool<T>
    {
        return new ObjectPool(factory, reset, initialSize);
    }

    /**
     * Get GC statistics
     */
    getGCStats()
    {
        return { ...this.gcStats };
    }

    /**
     * Force optimized garbage collection
     */
    triggerOptimizedGC(): void
    {
        if (global.gc) {
            const startTime = performance.now();
            global.gc();
            const gcTime = performance.now() - startTime;

            this.gcStats.totalCollections++;
            this.gcStats.totalTime += gcTime;
            this.gcStats.averageTime = this.gcStats.totalTime / this.gcStats.totalCollections;
            this.gcStats.lastCollection = Date.now();
        }
    }

    private setupGCMonitoring(): void
    {
        // Monitor GC events if available
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            setInterval(() =>
            {
                const memUsage = (performance as any).memory;
                if (memUsage.usedJSHeapSize / memUsage.jsHeapSizeLimit > 0.8) {
                    this.triggerOptimizedGC();
                }
            }, 5000);
        }
    }
}

/**
 * Object pool to reduce garbage collection pressure
 */
export class ObjectPool<T>
{
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;

    constructor(factory: () => T, reset: (obj: T) => void, initialSize = 10)
    {
        this.factory = factory;
        this.reset = reset;

        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    /**
     * Get object from pool
     */
    acquire(): T
    {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    /**
     * Return object to pool
     */
    release(obj: T): void
    {
        this.reset(obj);

        // Limit pool size to prevent memory bloat
        if (this.pool.length < 50) {
            this.pool.push(obj);
        }
    }

    /**
     * Clear pool
     */
    clear(): void
    {
        this.pool = [];
    }

    /**
     * Get pool size
     */
    size(): number
    {
        return this.pool.length;
    }
}

// ========================================
// GLOBAL INSTANCES
// ========================================

export const memoryMonitor = new JackpotMemoryMonitor();
export const gcOptimizer = new GCOptimizer();

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Get current memory statistics
 */
export function getMemoryStats(): MemoryStats
{
    return memoryMonitor.getMemoryStats();
}

/**
 * Check memory health
 */
export function checkMemoryHealth(): { healthy: boolean; alerts: MemoryAlert[] }
{
    const alerts: MemoryAlert[] = [];

    // Check for critical alerts
    const criticalAlert = memoryMonitor.checkMemoryThresholds();
    if (criticalAlert && (criticalAlert.level === 'critical' || criticalAlert.level === 'fatal')) {
        alerts.push(criticalAlert);
    }

    return {
        healthy: alerts.length === 0,
        alerts,
    };
}

/**
 * Create stream processor with optimal settings
 */
export function createStreamProcessor(config?: Partial<StreamProcessorConfig>): StreamJackpotProcessor
{
    return new StreamJackpotProcessor(config);
}

/**
 * Force garbage collection
 */
export function forceGC(): void
{
    gcOptimizer.triggerOptimizedGC();
}

/**
 * Get memory monitoring dashboard data
 */
export function getMemoryDashboard()
{
    return {
        current: getMemoryStats(),
        health: checkMemoryHealth(),
        gcStats: gcOptimizer.getGCStats(),
        alerts: memoryMonitor.getAlerts(),
    };
}
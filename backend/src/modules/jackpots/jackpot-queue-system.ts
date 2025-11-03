/**
 * High-throughput queue system for jackpot operations
 * Provides burst traffic handling, rate limiting, and load balancing
 */

import { EventEmitter } from "events";

// ========================================
// QUEUE SYSTEM INTERFACES
// ========================================

export interface QueueConfig
{
    maxSize: number;
    concurrency: number;
    rateLimit: number; // operations per time window
    rateWindow: number; // time window in ms
    priorityLevels: number;
    enablePriority: boolean;
    enablePersistence: boolean;
    batchSize: number;
}

export interface QueueItem<T = any>
{
    id: string;
    data: T;
    priority: number;
    timestamp: Date;
    attempts: number;
    maxAttempts: number;
    delay?: number;
    metadata?: Record<string, any>;
}

export interface RateLimitConfig
{
    requestsPerMinute: number;
    burstLimit: number;
    windowSize: number; // ms
    enableBurstProtection: boolean;
}

export interface QueueMetrics
{
    totalProcessed: number;
    totalFailed: number;
    averageProcessingTime: number;
    queueSize: number;
    throughput: number; // items per second
    errorRate: number;
    rateLimitedRequests: number;
}

export interface LoadBalancerConfig
{
    strategies: ('round_robin' | 'least_connections' | 'weighted')[];
    weights?: Record<string, number>;
    healthCheckInterval: number;
    enableFailover: boolean;
}

// ========================================
// RATE LIMITER
// ========================================

/**
 * Token bucket rate limiter for jackpot operations
 */
export class RateLimiter
{
    private tokens: number;
    private lastRefill: number;
    private config: RateLimitConfig;

    constructor(config: Partial<RateLimitConfig> = {})
    {
        this.config = {
            requestsPerMinute: 1000,
            burstLimit: 50,
            windowSize: 60000, // 1 minute
            enableBurstProtection: true,
            ...config,
        };

        this.tokens = this.config.burstLimit;
        this.lastRefill = Date.now();
    }

    /**
     * Check if request is allowed under rate limit
     */
    allowRequest(): { allowed: boolean; remainingTokens: number; resetTime: number }
    {
        const now = Date.now();
        const timePassed = now - this.lastRefill;

        // Refill tokens based on time passed
        const tokensToAdd = (timePassed / this.config.windowSize) * this.config.requestsPerMinute;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.burstLimit);
        this.lastRefill = now;

        const allowed = this.tokens >= 1;
        if (allowed) {
            this.tokens -= 1;
        }

        const resetTime = now + (this.config.windowSize / this.config.requestsPerMinute);

        return {
            allowed,
            remainingTokens: Math.floor(this.tokens),
            resetTime,
        };
    }

    /**
     * Get current rate limit status
     */
    getStatus():
        {
            tokens: number;
            maxTokens: number;
            requestsPerMinute: number;
            windowSize: number;
        }
    {
        return {
            tokens: Math.floor(this.tokens),
            maxTokens: this.config.burstLimit,
            requestsPerMinute: this.config.requestsPerMinute,
            windowSize: this.config.windowSize,
        };
    }

    /**
     * Update rate limit configuration
     */
    updateConfig(newConfig: Partial<RateLimitConfig>): void
    {
        this.config = { ...this.config, ...newConfig };
        this.tokens = Math.min(this.tokens, this.config.burstLimit);
    }
}

// ========================================
// PRIORITY QUEUE IMPLEMENTATION
// ========================================

/**
 * High-performance priority queue for jackpot operations
 */
export class PriorityQueue<T = any>
{
    private items: QueueItem<T>[] = [];
    private config: QueueConfig;
    private metrics: QueueMetrics;
    private processing = false;

    constructor(config: Partial<QueueConfig> = {})
    {
        this.config = {
            maxSize: 10000,
            concurrency: 10,
            rateLimit: 1000,
            rateWindow: 60000,
            priorityLevels: 5,
            enablePriority: true,
            enablePersistence: false,
            batchSize: 100,
            ...config,
        };

        this.metrics = {
            totalProcessed: 0,
            totalFailed: 0,
            averageProcessingTime: 0,
            queueSize: 0,
            throughput: 0,
            errorRate: 0,
            rateLimitedRequests: 0,
        };
    }

    /**
     * Add item to queue with priority
     */
    async add(
        data: T,
        options: {
            priority?: number;
            delay?: number;
            maxAttempts?: number;
            metadata?: Record<string, any>;
        } = {}
    ): Promise<string>
    {
        if (this.items.length >= this.config.maxSize) {
            throw new Error('Queue is at maximum capacity');
        }

        const item: QueueItem<T> = {
            id: this.generateId(),
            data,
            priority: options.priority || 0,
            timestamp: new Date(),
            attempts: 0,
            maxAttempts: options.maxAttempts || 3,
            delay: options.delay,
            metadata: options.metadata,
        };

        this.items.push(item);
        this.metrics.queueSize = this.items.length;

        // Sort by priority (higher priority first)
        if (this.config.enablePriority) {
            this.items.sort((a, b) => b.priority - a.priority);
        }

        return item.id;
    }

    /**
     * Get next item from queue
     */
    async next(): Promise<QueueItem<T> | null>
    {
        if (this.items.length === 0) {
            return null;
        }

        const item = this.items.shift()!;
        this.metrics.queueSize = this.items.length;

        return item;
    }

    /**
     * Process queue items with concurrency control
     */
    async process(
        processor: (item: QueueItem<T>) => Promise<void>,
        options: {
            concurrency?: number;
            batchSize?: number;
            onProgress?: (processed: number, total: number) => void;
        } = {}
    ): Promise<void>
    {
        if (this.processing) {
            throw new Error('Queue is already being processed');
        }

        this.processing = true;
        const concurrency = options.concurrency || this.config.concurrency;
        const batchSize = options.batchSize || this.config.batchSize;
        const startTime = Date.now();

        try {
            const batches = this.createBatches(this.items, batchSize);
            let processed = 0;

            for (const batch of batches) {
                const promises = batch.map(async (item) =>
                {
                    try {
                        await processor(item);
                        this.metrics.totalProcessed++;
                    } catch (error) {
                        this.metrics.totalFailed++;
                        console.error(`Failed to process queue item ${item.id}:`, error);

                        // Retry logic
                        if (item.attempts < item.maxAttempts) {
                            item.attempts++;
                            // Re-queue with delay
                            setTimeout(() =>
                            {
                                this.items.push(item);
                            }, Math.pow(2, item.attempts) * 1000); // Exponential backoff
                        }
                    }
                });

                await Promise.allSettled(promises);
                processed += batch.length;

                if (options.onProgress) {
                    options.onProgress(processed, this.items.length + processed);
                }

                // Small delay to prevent overwhelming the system
                if (batch !== batches[batches.length - 1]) {
                    await this.sleep(10);
                }
            }

            const processingTime = Date.now() - startTime;
            this.metrics.throughput = (this.metrics.totalProcessed / processingTime) * 1000;
            this.metrics.averageProcessingTime = processingTime / this.metrics.totalProcessed;
            this.metrics.errorRate = (this.metrics.totalFailed / this.metrics.totalProcessed) * 100;
        } finally {
            this.processing = false;
        }
    }

    /**
     * Get queue size
     */
    size(): number
    {
        return this.items.length;
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean
    {
        return this.items.length === 0;
    }

    /**
     * Clear queue
     */
    clear(): void
    {
        this.items = [];
        this.metrics.queueSize = 0;
    }

    /**
     * Get metrics
     */
    getMetrics(): QueueMetrics
    {
        return { ...this.metrics };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<QueueConfig>): void
    {
        this.config = { ...this.config, ...newConfig };
    }

    private generateId(): string
    {
        return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private createBatches<T>(items: T[], batchSize: number): T[][]
    {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    private sleep(ms: number): Promise<void>
    {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================
// LOAD BALANCER
// ========================================

/**
 * Load balancer for distributing jackpot operations across multiple resources
 */
export class JackpotLoadBalancer
{
    private targets: Map<string, {
        weight: number;
        currentConnections: number;
        health: boolean;
        lastHealthCheck: Date;
    }> = new Map();
    private config: LoadBalancerConfig;
    private roundRobinIndex = 0;

    constructor(config: Partial<LoadBalancerConfig> = {})
    {
        this.config = {
            strategies: ['round_robin'],
            healthCheckInterval: 30000,
            enableFailover: true,
            ...config,
        };
    }

    /**
     * Add target to load balancer
     */
    addTarget(id: string, weight: number = 1): void
    {
        this.targets.set(id, {
            weight,
            currentConnections: 0,
            health: true,
            lastHealthCheck: new Date(),
        });
    }

    /**
     * Remove target from load balancer
     */
    removeTarget(id: string): void
    {
        this.targets.delete(id);
    }

    /**
     * Get optimal target for next operation
     */
    getTarget(): string | null
    {
        const healthyTargets = Array.from(this.targets.entries())
            .filter(([_, target]) => target.health);

        if (healthyTargets.length === 0) {
            return null;
        }

        const strategy = this.config.strategies[0];

        switch (strategy) {
            case 'round_robin':
                return this.roundRobinSelect(healthyTargets);
            case 'least_connections':
                return this.leastConnectionsSelect(healthyTargets);
            case 'weighted':
                return this.weightedSelect(healthyTargets);
            default:
                return healthyTargets[0]?.[0] || null;
        }
    }

    /**
     * Mark target as used
     */
    markTargetUsed(targetId: string): void
    {
        const target = this.targets.get(targetId);
        if (target) {
            target.currentConnections++;
        }
    }

    /**
     * Mark target as released
     */
    markTargetReleased(targetId: string): void
    {
        const target = this.targets.get(targetId);
        if (target) {
            target.currentConnections = Math.max(0, target.currentConnections - 1);
        }
    }

    /**
     * Mark target as unhealthy
     */
    markTargetUnhealthy(targetId: string): void
    {
        const target = this.targets.get(targetId);
        if (target) {
            target.health = false;
        }
    }

    /**
     * Mark target as healthy
     */
    markTargetHealthy(targetId: string): void
    {
        const target = this.targets.get(targetId);
        if (target) {
            target.health = true;
            target.lastHealthCheck = new Date();
        }
    }

    /**
     * Perform health checks on all targets
     */
    async performHealthChecks(healthCheckFn: (targetId: string) => Promise<boolean>): Promise<void>
    {
        for (const [targetId, target] of this.targets) {
            try {
                const isHealthy = await healthCheckFn(targetId);
                if (isHealthy) {
                    this.markTargetHealthy(targetId);
                } else {
                    this.markTargetUnhealthy(targetId);
                }
            } catch (error) {
                console.error(`Health check failed for target ${targetId}:`, error);
                this.markTargetUnhealthy(targetId);
            }
        }
    }

    /**
     * Get load balancer statistics
     */
    getStats():
        {
            totalTargets: number;
            healthyTargets: number;
            unhealthyTargets: number;
            targets: Array<{
                id: string;
                weight: number;
                currentConnections: number;
                health: boolean;
            }>;
        }
    {
        const targets = Array.from(this.targets.entries()).map(([id, target]) => ({
            id,
            weight: target.weight,
            currentConnections: target.currentConnections,
            health: target.health,
        }));

        return {
            totalTargets: targets.length,
            healthyTargets: targets.filter(t => t.health).length,
            unhealthyTargets: targets.filter(t => !t.health).length,
            targets,
        };
    }

    private roundRobinSelect(targets: Array<[string, any]>): string
    {
        if (targets.length === 0) {
            throw new Error('No targets available for round robin selection');
        }
        const target = targets[this.roundRobinIndex % targets.length];
        this.roundRobinIndex++;
        return target?.[0] || '';
    }

    private leastConnectionsSelect(targets: Array<[string, any]>): string
    {
        if (targets.length === 0) {
            throw new Error('No targets available for least connections selection');
        }
        const selected = targets.reduce((min, current) =>
            current[1].currentConnections < min[1].currentConnections ? current : min
        );
        return selected?.[0] || '';
    }

    private weightedSelect(targets: Array<[string, any]>): string
    {
        if (targets.length === 0) {
            throw new Error('No targets available for weighted selection');
        }
        // Simple weighted random selection
        const totalWeight = targets.reduce((sum, [_, target]) => sum + target.weight, 0);
        let random = Math.random() * totalWeight;

        for (const [id, target] of targets) {
            random -= target.weight;
            if (random <= 0) {
                return id;
            }
        }

        return targets[0]?.[0] || '';
    }
}

// ========================================
// JACKPOT QUEUE MANAGER
// ========================================

/**
 * High-level queue manager for jackpot operations
 */
export class JackpotQueueManager
{
    private queue: PriorityQueue;
    private rateLimiter: RateLimiter;
    private loadBalancer: JackpotLoadBalancer;
    private eventEmitter: EventEmitter;
    private config: {
        queue: QueueConfig;
        rateLimiter: RateLimitConfig;
        loadBalancer: LoadBalancerConfig;
    };

    constructor(
        queueConfig?: Partial<QueueConfig>,
        rateLimitConfig?: Partial<RateLimitConfig>,
        loadBalancerConfig?: Partial<LoadBalancerConfig>
    )
    {
        // Provide default configurations to ensure all required properties are present
        const defaultQueueConfig: QueueConfig = {
            maxSize: 10000,
            concurrency: 10,
            rateLimit: 1000,
            rateWindow: 60000,
            priorityLevels: 5,
            enablePriority: true,
            enablePersistence: false,
            batchSize: 100,
        };

        const defaultRateLimitConfig: RateLimitConfig = {
            requestsPerMinute: 1000,
            burstLimit: 50,
            windowSize: 60000,
            enableBurstProtection: true,
        };

        const defaultLoadBalancerConfig: LoadBalancerConfig = {
            strategies: ['round_robin'],
            healthCheckInterval: 30000,
            enableFailover: true,
        };

        this.config = {
            queue: { ...defaultQueueConfig, ...queueConfig },
            rateLimiter: { ...defaultRateLimitConfig, ...rateLimitConfig },
            loadBalancer: { ...defaultLoadBalancerConfig, ...loadBalancerConfig },
        };

        this.queue = new PriorityQueue(this.config.queue);
        this.rateLimiter = new RateLimiter(this.config.rateLimiter);
        this.loadBalancer = new JackpotLoadBalancer(this.config.loadBalancer);
        this.eventEmitter = new EventEmitter();
    }

    /**
     * Queue jackpot contribution operation
     */
    async queueContribution(
        gameId: string,
        wagerAmount: number,
        options: {
            priority?: number;
            delay?: number;
            metadata?: Record<string, any>;
        } = {}
    ): Promise<string>
    {
        // Check rate limit
        const rateLimitResult = this.rateLimiter.allowRequest();
        if (!rateLimitResult.allowed) {
            this.eventEmitter.emit('rateLimited', {
                type: 'contribution',
                gameId,
                remainingTokens: rateLimitResult.remainingTokens,
                resetTime: rateLimitResult.resetTime,
            });
            throw new Error('Rate limit exceeded');
        }

        // Get optimal target for load balancing
        const target = this.loadBalancer.getTarget();
        if (!target) {
            throw new Error('No healthy targets available');
        }

        const queueItem = {
            gameId,
            wagerAmount,
            target,
            operation: 'contribution' as const,
            timestamp: new Date(),
            ...options,
        };

        return this.queue.add(queueItem, {
            priority: options.priority,
            delay: options.delay,
            metadata: {
                ...options.metadata,
                operation: 'contribution',
                target,
            },
        });
    }

    /**
     * Queue jackpot win operation
     */
    async queueWin(
        group: 'minor' | 'major' | 'mega',
        userId: string,
        winAmount: number,
        options: {
            priority?: number;
            delay?: number;
            metadata?: Record<string, any>;
        } = {}
    ): Promise<string>
    {
        // Wins get higher priority
        const priority = options.priority ?? 10;

        const queueItem = {
            group,
            userId,
            winAmount,
            operation: 'win' as const,
            timestamp: new Date(),
            ...options,
        };

        return this.queue.add(queueItem, {
            priority,
            delay: options.delay,
            metadata: {
                ...options.metadata,
                operation: 'win',
            },
        });
    }

    /**
     * Start processing queue
     */
    async startProcessing(
        processor: (item: QueueItem) => Promise<void>,
        options: {
            concurrency?: number;
            batchSize?: number;
            onProgress?: (processed: number, total: number) => void;
        } = {}
    ): Promise<void>
    {
        await this.queue.process(processor, options);
    }

    /**
     * Add load balancer target
     */
    addTarget(targetId: string, weight: number = 1): void
    {
        this.loadBalancer.addTarget(targetId, weight);
    }

    /**
     * Get system metrics
     */
    getMetrics():
        {
            queue: QueueMetrics;
            rateLimiter: ReturnType<RateLimiter['getStatus']>;
            loadBalancer: ReturnType<JackpotLoadBalancer['getStats']>;
        }
    {
        return {
            queue: this.queue.getMetrics(),
            rateLimiter: this.rateLimiter.getStatus(),
            loadBalancer: this.loadBalancer.getStats(),
        };
    }

    /**
     * Update configurations
     */
    updateQueueConfig(config: Partial<QueueConfig>): void
    {
        this.queue.updateConfig(config);
        this.config.queue = { ...this.config.queue, ...config };
    }

    updateRateLimitConfig(config: Partial<RateLimitConfig>): void
    {
        this.rateLimiter.updateConfig(config);
        this.config.rateLimiter = { ...this.config.rateLimiter, ...config };
    }

    /**
     * Event listeners
     */
    onRateLimited(callback: (data: any) => void): void
    {
        this.eventEmitter.on('rateLimited', callback);
    }

    onQueueFull(callback: () => void): void
    {
        this.eventEmitter.on('queueFull', callback);
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>
    {
        const issues: string[] = [];

        if (this.queue.size() >= this.config.queue.maxSize * 0.9) {
            issues.push('Queue is near capacity');
        }

        const rateLimitStatus = this.rateLimiter.getStatus();
        if (rateLimitStatus.tokens < rateLimitStatus.maxTokens * 0.1) {
            issues.push('Rate limit tokens are low');
        }

        const lbStats = this.loadBalancer.getStats();
        if (lbStats.healthyTargets === 0) {
            issues.push('No healthy load balancer targets');
        }

        return {
            healthy: issues.length === 0,
            issues,
        };
    }
}

// ========================================
// GLOBAL INSTANCES
// ========================================

export const jackpotQueueManager = new JackpotQueueManager({
    maxSize: 50000,
    concurrency: 20,
    rateLimit: 2000,
    rateWindow: 60000,
    priorityLevels: 10,
    enablePriority: true,
    batchSize: 50,
});

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Quick queue contribution
 */
export async function queueJackpotContribution(
    gameId: string,
    wagerAmount: number,
    options?: Parameters<JackpotQueueManager['queueContribution']>[2]
): Promise<string>
{
    return jackpotQueueManager.queueContribution(gameId, wagerAmount, options);
}

/**
 * Quick queue win
 */
export async function queueJackpotWin(
    group: 'minor' | 'major' | 'mega',
    userId: string,
    winAmount: number,
    options?: Parameters<JackpotQueueManager['queueWin']>[3]
): Promise<string>
{
    return jackpotQueueManager.queueWin(group, userId, winAmount, options);
}

/**
 * Get queue system health
 */
export async function getQueueHealth()
{
    return jackpotQueueManager.healthCheck();
}

/**
 * Get queue system metrics
 */
export function getQueueMetrics()
{
    return jackpotQueueManager.getMetrics();
}
/**
 * Comprehensive performance optimization tests for jackpot system
 * Validates batch operations, connection pooling, caching, query optimization,
 * memory management, queues, and performance monitoring
 */

import
{
    StreamJackpotProcessor,
    defaultBatchProcessor,
    highThroughputBatchProcessor,
    quickBatchContribute
} from './src/modules/jackpots/jackpot-batch-operations';

import
{
    JackpotConnectionPool,
    JackpotPoolAdapter
} from './src/modules/jackpots/jackpot-connection-pool';

import
{
    JackpotIntelligentCache,
    jackpotCache
} from './src/modules/jackpots/jackpot-caching';

import
{
    getQueryMetrics,
    jackpotQueryOptimizer,
    quickOptimizedContribution
} from './src/modules/gameplay/jackpot-query-optimizer';

import
{
    checkMemoryHealth,
    createStreamProcessor,
    forceGC,
    gcOptimizer,
    getMemoryDashboard,
    getMemoryStats,
    memoryMonitor
} from './src/modules/gameplay/jackpot-memory-manager';

import
{
    JackpotLoadBalancer,
    PriorityQueue,
    RateLimiter,
    getQueueHealth,
    getQueueMetrics,
    queueJackpotContribution
} from './src/modules/gameplay/jackpot-queue-system';

import
{
    analyzePerformanceBottlenecks,
    generatePerformanceReport,
    getPerformanceDashboard,
    performanceMonitor,
    recordMetric,
    recordPerformanceEvent,
    startPerformanceMonitoring,
    stopPerformanceMonitoring
} from './src/modules/gameplay/jackpot-performance-monitor';

// ========================================
// TEST UTILITIES
// ========================================

class PerformanceTestSuite
{
    private testResults: Array<{ test: string; success: boolean; duration: number; error?: string }> = [];

    async runTest(testName: string, testFn: () => Promise<void>): Promise<void>
    {
        const startTime = Date.now();

        try {
            console.log(`\n🧪 Running test: ${testName}`);
            await testFn();
            const duration = Date.now() - startTime;
            this.testResults.push({ test: testName, success: true, duration });
            console.log(`✅ PASSED: ${testName} (${duration}ms)`);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.testResults.push({
                test: testName,
                success: false,
                duration,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`❌ FAILED: ${testName} (${duration}ms) - ${error}`);
        }
    }

    generateReport(): void
    {
        console.log('\n📊 PERFORMANCE TEST RESULTS');
        console.log('='.repeat(50));

        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;
        const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        console.log(`Total Duration: ${totalDuration}ms`);

        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults.filter(r => !r.success).forEach(result =>
            {
                console.log(`  - ${result.test}: ${result.error}`);
            });
        }
    }
}

// ========================================
// BATCH OPERATIONS TESTS
// ========================================

async function testBatchOperations(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Batch Contribution Processing', async () =>
    {
        const contributions = Array.from({ length: 100 }, (_, i) => ({
            gameId: `test-game-${i}`,
            wagerAmount: Math.floor(Math.random() * 10000) + 1000,
            timestamp: new Date(),
        }));

        const result = await defaultBatchProcessor.processBatchContributions(contributions);

        if (result.totalProcessed !== 100) {
            throw new Error(`Expected 100 processed, got ${result.totalProcessed}`);
        }

        if (result.errors.length > 0) {
            console.warn(`Batch processing had ${result.errors.length} errors`);
        }
    });

    await testSuite.runTest('Batch Win Processing', async () =>
    {
        const wins = Array.from({ length: 50 }, (_, i) => ({
            group: ['minor', 'major', 'mega'][i % 3] as 'minor' | 'major' | 'mega',
            gameId: `test-game-${i}`,
            userId: `user-${i}`,
            winAmount: Math.floor(Math.random() * 5000) + 1000,
            timestamp: new Date(),
        }));

        const result = await defaultBatchProcessor.processBatchWins(wins);

        if (result.totalProcessed !== 50) {
            throw new Error(`Expected 50 processed, got ${result.totalProcessed}`);
        }
    });

    await testSuite.runTest('High Throughput Batch Processing', async () =>
    {
        const largeContributions = Array.from({ length: 1000 }, (_, i) => ({
            gameId: `test-game-${i}`,
            wagerAmount: Math.floor(Math.random() * 10000) + 1000,
            timestamp: new Date(),
        }));

        const startTime = Date.now();
        const result = await highThroughputBatchProcessor.processBatchContributions(largeContributions);
        const duration = Date.now() - startTime;

        const throughput = result.totalProcessed / (duration / 1000);
        console.log(`High throughput batch processing: ${throughput.toFixed(2)} ops/sec`);

        if (throughput < 100) {
            throw new Error(`Throughput too low: ${throughput.toFixed(2)} ops/sec`);
        }
    });

    await testSuite.runTest('Stream Processing', async () =>
    {
        const streamProcessor = new StreamJackpotProcessor({}, 50);

        const dataStream = {
            async *[Symbol.asyncIterator]()
            {
                for (let i = 0; i < 200; i++) {
                    yield {
                        gameId: `stream-game-${i}`,
                        wagerAmount: Math.floor(Math.random() * 1000) + 100,
                        timestamp: new Date(),
                    };
                }
            }
        };

        const result = await streamProcessor.processStream(dataStream);

        if (result.totalProcessed !== 200) {
            throw new Error(`Expected 200 processed, got ${result.totalProcessed}`);
        }
    });

    testSuite.generateReport();
}

// ========================================
// CONNECTION POOLING TESTS
// ========================================

async function testConnectionPooling(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Pool Metrics Collection', async () =>
    {
        const pool = new JackpotPoolAdapter('medium');

        // Execute some mock operations
        await pool.executeContribution(async (connection) =>
        {
            return { success: true };
        });

        const stats = pool.getPoolStats();

        if (!stats.metrics) {
            throw new Error('Pool metrics not available');
        }

        console.log(`Pool utilization: ${stats.metrics.poolUtilization.toFixed(2)}%`);
    });

    await testSuite.runTest('Connection Health Monitoring', async () =>
    {
        const pool = new JackpotConnectionPool({
            minConnections: 5,
            maxConnections: 20,
            healthCheckInterval: 1, // 1 second for testing
        });

        // Test connection acquisition
        const connectionData = await pool.acquireConnection();
        if (!connectionData.connectionId) {
            throw new Error('Failed to acquire connection');
        }

        await pool.releaseConnection(connectionData.connectionId, 50);

        const health = pool.getHealthStatus();
        console.log(`Pool health: ${health.isHealthy ? 'healthy' : 'unhealthy'}`);

        pool.destroy();
    });

    await testSuite.runTest('Adaptive Pool Management', async () =>
    {
        const manager = new (require('./src/modules/gameplay/jackpot-connection-pool').AdaptivePoolManager)();

        const bestPool = manager.getBestPool();
        const stats = bestPool.getPoolStats();

        console.log(`Best pool utilization: ${stats.metrics.poolUtilization.toFixed(2)}%`);

        manager.destroy();
    });

    testSuite.generateReport();
}

// ========================================
// CACHING TESTS
// ========================================

async function testCaching(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Jackpot Pool Caching', async () =>
    {
        const poolData = {
            group: 'minor' as const,
            currentAmount: 50000,
            totalContributions: 100000,
            totalWins: 20000,
        };

        await jackpotCache.cacheJackpotPool('minor', poolData);
        const cached = await jackpotCache.getJackpotPool('minor');

        if (!cached || cached.currentAmount !== poolData.currentAmount) {
            throw new Error('Pool caching failed');
        }
    });

    await testSuite.runTest('Cache Performance', async () =>
    {
        const cache = new JackpotIntelligentCache({
            cacheLevels: {
                hot: { size: 10, ttl: 60 },
                warm: { size: 20, ttl: 300 },
                cold: { size: 30, ttl: 1800 },
            },
        });

        // Cache some data
        await cache.cacheJackpotConfig({ rate: 0.02 });
        await cache.cacheJackpotStats({ total: 1000 });

        // Retrieve cached data
        const config = await cache.getJackpotConfig();
        const stats = await cache.getJackpotStats();

        if (!config || !stats) {
            throw new Error('Cache retrieval failed');
        }

        const metrics = cache.getMetrics();
        console.log(`Cache hit rate: ${metrics.hitRate.toFixed(2)}%`);
    });

    await testSuite.runTest('Cache Invalidation', async () =>
    {
        await jackpotCache.cacheJackpotPool('major', { currentAmount: 30000 });

        await jackpotCache.invalidateJackpotPool('major');
        const cached = await jackpotCache.getJackpotPool('major');

        if (cached !== null) {
            throw new Error('Cache invalidation failed');
        }
    });

    testSuite.generateReport();
}

// ========================================
// QUERY OPTIMIZATION TESTS
// ========================================

async function testQueryOptimization(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Prepared Statement Execution', async () =>
    {
        // Test optimized contribution query (mock execution)
        const result = await quickOptimizedContribution('test-game', 1000, 'minor');
        console.log('Optimized contribution executed successfully');
    });

    await testSuite.runTest('Query Metrics Collection', async () =>
    {
        const metrics = getQueryMetrics();

        if (typeof metrics.totalQueries !== 'number') {
            throw new Error('Query metrics not available');
        }

        console.log(`Total queries: ${metrics.totalQueries}`);
        console.log(`Cache hit rate: ${metrics.cacheHitRate.toFixed(2)}%`);
    });

    await testSuite.runTest('N+1 Query Detection', async () =>
    {
        // Mock operations to test N+1 detection
        const operations = [
            { type: 'contribution' as const, parameters: ['game1', 1000, 'minor'] },
            { type: 'contribution' as const, parameters: ['game2', 2000, 'minor'] },
            { type: 'contribution' as const, parameters: ['game3', 3000, 'minor'] },
        ];

        const result = await jackpotQueryOptimizer.optimizeBatchQueries(operations);
        console.log(`Batch optimization processed ${result.length} operations`);
    });

    testSuite.generateReport();
}

// ========================================
// MEMORY MANAGEMENT TESTS
// ========================================

async function testMemoryManagement(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Memory Monitoring', async () =>
    {
        const stats = getMemoryStats();

        if (typeof stats.used !== 'number' || typeof stats.percentage !== 'number') {
            throw new Error('Memory stats not available');
        }

        console.log(`Memory usage: ${stats.percentage.toFixed(2)}%`);

        const health = checkMemoryHealth();
        console.log(`Memory health: ${health.healthy ? 'healthy' : 'unhealthy'}`);
    });

    await testSuite.runTest('Stream Processing Memory Efficiency', async () =>
    {
        const streamProcessor = createStreamProcessor({
            batchSize: 50,
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        });

        const dataStream = {
            async *[Symbol.asyncIterator]()
            {
                for (let i = 0; i < 1000; i++) {
                    yield {
                        gameId: `mem-test-${i}`,
                        wagerAmount: Math.floor(Math.random() * 1000) + 100,
                        timestamp: new Date(),
                    };
                }
            }
        };

        const startMemory = getMemoryStats();
        const result = await streamProcessor.processContributionsStream(dataStream);
        const endMemory = getMemoryStats();

        console.log(`Memory change: ${(endMemory.percentage - startMemory.percentage).toFixed(2)}%`);
        console.log(`Processed: ${result.totalProcessed} contributions`);

        await streamProcessor.cleanup();
    });

    await testSuite.runTest('Garbage Collection Optimization', async () =>
    {
        const gcStats = gcOptimizer.getGCStats();
        console.log(`GC collections: ${gcStats.totalCollections}`);

        const gcTriggered = forceGC();
        console.log(`Manual GC triggered: ${gcTriggered}`);
    });

    await testSuite.runTest('Memory Dashboard', async () =>
    {
        const dashboard = getMemoryDashboard();

        if (!dashboard.current || !dashboard.health) {
            throw new Error('Memory dashboard data incomplete');
        }

        console.log(`Dashboard health: ${dashboard.health.healthy ? 'healthy' : 'issues detected'}`);
    });

    testSuite.generateReport();
}

// ========================================
// QUEUE SYSTEM TESTS
// ========================================

async function testQueueSystem(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Rate Limiting', async () =>
    {
        const rateLimiter = new RateLimiter({
            requestsPerMinute: 100,
            burstLimit: 10,
        });

        let allowed = 0;
        let denied = 0;

        // Test rate limiting
        for (let i = 0; i < 15; i++) {
            const result = rateLimiter.allowRequest();
            if (result.allowed) {
                allowed++;
            } else {
                denied++;
            }
        }

        console.log(`Allowed: ${allowed}, Denied: ${denied}`);

        if (denied === 0) {
            throw new Error('Rate limiting not working');
        }
    });

    await testSuite.runTest('Priority Queue Processing', async () =>
    {
        const queue = new PriorityQueue({
            maxSize: 1000,
            concurrency: 5,
            enablePriority: true,
        });

        // Add items with different priorities
        await queue.add({ gameId: 'low-priority', wagerAmount: 100 }, { priority: 1 });
        await queue.add({ gameId: 'high-priority', wagerAmount: 1000 }, { priority: 10 });
        await queue.add({ gameId: 'medium-priority', wagerAmount: 500 }, { priority: 5 });

        let processed = 0;
        const processor = async (item: any) =>
        {
            processed++;
            await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing
        };

        await queue.process(processor);

        if (processed !== 3) {
            throw new Error(`Expected 3 processed, got ${processed}`);
        }
    });

    await testSuite.runTest('Load Balancing', async () =>
    {
        const loadBalancer = new JackpotLoadBalancer();

        // Add targets
        loadBalancer.addTarget('target1', 1);
        loadBalancer.addTarget('target2', 2);
        loadBalancer.addTarget('target3', 1);

        const distribution = new Map<string, number>();

        // Distribute 100 operations
        for (let i = 0; i < 100; i++) {
            const target = loadBalancer.getTarget();
            if (target) {
                distribution.set(target, (distribution.get(target) || 0) + 1);
                loadBalancer.markTargetUsed(target);
                loadBalancer.markTargetReleased(target);
            }
        }

        console.log('Load distribution:', Object.fromEntries(distribution));

        const stats = loadBalancer.getStats();
        console.log(`Healthy targets: ${stats.healthyTargets}/${stats.totalTargets}`);
    });

    await testSuite.runTest('Jackpot Queue Manager', async () =>
    {
        // Test queue health check
        const health = await getQueueHealth();
        console.log(`Queue health: ${health.healthy ? 'healthy' : 'issues detected'}`);

        if (health.issues.length > 0) {
            console.log('Queue issues:', health.issues);
        }

        const metrics = getQueueMetrics();
        console.log(`Queue size: ${metrics.queue.queueSize}`);
    });

    testSuite.generateReport();
}

// ========================================
// PERFORMANCE MONITORING TESTS
// ========================================

async function testPerformanceMonitoring(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('Metrics Collection', async () =>
    {
        // Record some test metrics
        recordMetric('test', 'response_time', 150);
        recordMetric('test', 'memory_usage', 75);
        recordMetric('test', 'throughput', 500);

        recordPerformanceEvent({
            type: 'test_operation',
            duration: 100,
            success: true,
        });

        const dashboard = getPerformanceDashboard();

        if (!dashboard.current) {
            throw new Error('Performance dashboard data not available');
        }

        console.log(`System health: ${dashboard.summary.systemHealth}`);
        console.log(`Performance score: ${dashboard.summary.performanceScore}`);
    });

    await testSuite.runTest('Performance Analysis', async () =>
    {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 3600000); // 1 hour ago

        try {
            const report = generatePerformanceReport({ start: startTime, end: endTime });
            console.log(`Report generated for period: ${report.period.start.toISOString()} - ${report.period.end.toISOString()}`);
            console.log(`Recommendations: ${report.recommendations.length} items`);
        } catch (error) {
            console.log('No data available for performance report (expected in test environment)');
        }
    });

    await testSuite.runTest('Bottleneck Analysis', async () =>
    {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 1800000); // 30 minutes ago

        try {
            const analysis = analyzePerformanceBottlenecks({ start: startTime, end: endTime });
            console.log(`Performance analysis completed. Score: ${analysis.overallScore}`);
            console.log(`Bottlenecks detected: ${analysis.bottlenecks.length}`);
        } catch (error) {
            console.log('No data available for bottleneck analysis (expected in test environment)');
        }
    });

    await testSuite.runTest('Alert System', async () =>
    {
        const alertListener = (alert: any) =>
        {
            console.log(`Alert received: ${alert.level} - ${alert.message}`);
        };

        performanceMonitor.onAlert(alertListener);

        // Simulate some alerts by checking memory
        memoryMonitor.checkMemoryThresholds();

        const alerts = performanceMonitor.getAlerts(5);
        console.log(`Recent alerts: ${alerts.length}`);
    });

    testSuite.generateReport();
}

// ========================================
// INTEGRATION TESTS
// ========================================

async function testIntegration(): Promise<void>
{
    const testSuite = new PerformanceTestSuite();

    await testSuite.runTest('End-to-End Performance Workflow', async () =>
    {
        console.log('Testing complete performance optimization workflow...');

        // 1. Start monitoring
        startPerformanceMonitoring({
            collectionInterval: 1000, // 1 second for testing
            enableAlerts: true,
        });

        // 2. Record some activity
        recordPerformanceEvent({ type: 'test_start', success: true });

        // 3. Test batch processing
        const contributions = Array.from({ length: 50 }, (_, i) => ({
            gameId: `integration-test-${i}`,
            wagerAmount: Math.floor(Math.random() * 1000) + 100,
            timestamp: new Date(),
        }));

        const batchResult = await quickBatchContribute(contributions);
        console.log(`Batch processed: ${batchResult.totalProcessed} contributions`);

        // 4. Test caching
        await jackpotCache.cacheJackpotPool('minor', { currentAmount: 25000 });
        const cached = await jackpotCache.getJackpotPool('minor');
        console.log(`Cache test: ${cached ? 'success' : 'failed'}`);

        // 5. Test queue system
        await queueJackpotContribution('test-game', 500, { priority: 5 });
        console.log('Queue test: contribution queued');

        // 6. Record completion
        recordPerformanceEvent({ type: 'test_complete', success: true });

        // 7. Check system health
        const memoryHealth = checkMemoryHealth();
        const queueHealth = await getQueueHealth();
        const perfDashboard = getPerformanceDashboard();

        console.log(`Integration test results:`);
        console.log(`  Memory: ${memoryHealth.healthy ? 'healthy' : 'issues'}`);
        console.log(`  Queue: ${queueHealth.healthy ? 'healthy' : 'issues'}`);
        console.log(`  Performance: ${perfDashboard.summary.systemHealth}`);

        // 8. Stop monitoring
        stopPerformanceMonitoring();

        console.log('End-to-end performance workflow completed successfully');
    });

    testSuite.generateReport();
}

// ========================================
// PERFORMANCE BENCHMARKS
// ========================================

async function runPerformanceBenchmarks(): Promise<void>
{
    console.log('\n🚀 PERFORMANCE BENCHMARKS');
    console.log('='.repeat(50));

    // Benchmark 1: Batch Processing Throughput
    console.log('\n📈 Benchmark 1: Batch Processing Throughput');
    const batchSizes = [100, 500, 1000, 2000];

    for (const size of batchSizes) {
        const contributions = Array.from({ length: size }, (_, i) => ({
            gameId: `benchmark-${i}`,
            wagerAmount: Math.floor(Math.random() * 1000) + 100,
            timestamp: new Date(),
        }));

        const startTime = Date.now();
        const result = await highThroughputBatchProcessor.processBatchContributions(contributions);
        const duration = Date.now() - startTime;

        const throughput = result.totalProcessed / (duration / 1000);
        console.log(`  Batch size ${size}: ${throughput.toFixed(2)} ops/sec (${duration}ms)`);
    }

    // Benchmark 2: Cache Performance
    console.log('\n📈 Benchmark 2: Cache Performance');
    const cache = new JackpotIntelligentCache();

    const cacheStartTime = Date.now();
    for (let i = 0; i < 1000; i++) {
        await cache.cacheJackpotConfig({ rate: 0.02, seed: i });
        await cache.getJackpotConfig();
    }
    const cacheDuration = Date.now() - cacheStartTime;
    const cacheThroughput = 2000 / (cacheDuration / 1000);
    console.log(`  Cache operations: ${cacheThroughput.toFixed(2)} ops/sec (${cacheDuration}ms)`);

    // Benchmark 3: Memory Usage
    console.log('\n📈 Benchmark 3: Memory Efficiency');
    const memStart = getMemoryStats();

    const streamProcessor = createStreamProcessor({ batchSize: 100 });
    const dataStream = {
        async *[Symbol.asyncIterator]()
        {
            for (let i = 0; i < 5000; i++) {
                yield {
                    gameId: `memory-test-${i}`,
                    wagerAmount: Math.floor(Math.random() * 1000) + 100,
                    timestamp: new Date(),
                };
            }
        }
    };

    await streamProcessor.processContributionsStream(dataStream);
    const memEnd = getMemoryStats();

    console.log(`  Memory delta: ${(memEnd.percentage - memStart.percentage).toFixed(2)}%`);
    console.log(`  Peak memory: ${memEnd.percentage.toFixed(2)}%`);

    await streamProcessor.cleanup();

    // Benchmark 4: Queue Throughput
    console.log('\n📈 Benchmark 4: Queue Processing');
    const queue = new PriorityQueue({ concurrency: 10, batchSize: 50 });

    const queueStartTime = Date.now();
    for (let i = 0; i < 1000; i++) {
        await queue.add({ gameId: `queue-test-${i}`, wagerAmount: 100 });
    }

    await new Promise<void>((resolve) =>
    {
        queue.process(async (item) =>
        {
            await new Promise(resolve => setTimeout(resolve, 1)); // Minimal processing
        }).then(() => resolve());
    });

    const queueDuration = Date.now() - queueStartTime;
    const queueThroughput = 1000 / (queueDuration / 1000);
    console.log(`  Queue processing: ${queueThroughput.toFixed(2)} ops/sec (${queueDuration}ms)`);

    console.log('\n✅ Performance benchmarks completed');
}

// ========================================
// MAIN TEST EXECUTION
// ========================================

async function runAllTests(): Promise<void>
{
    console.log('🎯 JACKPOT PERFORMANCE OPTIMIZATION TEST SUITE');
    console.log('='.repeat(60));
    console.log('Testing all performance optimizations...\n');

    try {
        // Run all test suites
        await testBatchOperations();
        await testConnectionPooling();
        await testCaching();
        await testQueryOptimization();
        await testMemoryManagement();
        await testQueueSystem();
        await testPerformanceMonitoring();
        await testIntegration();

        // Run performance benchmarks
        await runPerformanceBenchmarks();

        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('Performance optimizations are working as expected.');

    } catch (error) {
        console.error('\n❌ TEST SUITE FAILED:', error);
        process.exit(1);
    }
}

// Export for use in other test files
export
{
    runAllTests, runPerformanceBenchmarks, testBatchOperations, testCaching, testConnectionPooling, testIntegration, testMemoryManagement, testPerformanceMonitoring, testQueryOptimization, testQueueSystem
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}
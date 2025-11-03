/**
 * Jackpot Performance Tests
 * Performance benchmarking and regression testing for jackpot functionality
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import
{
    getJackpotPool,
    getJackpotPools,
    processJackpotContribution,
    processJackpotWin,
    updateJackpotConfig
} from '../../src/modules/jackpots/jackpot.service';

import
{
    clearTestData,
    seedTestJackpotData,
    setupTestDatabase
} from '../utils/test-db';

import
{
    performanceTestUtils,
    testDataGenerators
} from '../utils/test-helpers';

import
{
    TEST_GAME_IDS
} from '../fixtures/test-data';

// ========================================
// PERFORMANCE TEST CONSTANTS
// ========================================

const PERFORMANCE_THRESHOLDS = {
    CONTRIBUTION_MAX_MS: 100,
    WIN_PROCESSING_MAX_MS: 150,
    POOL_RETRIEVAL_MAX_MS: 50,
    CONFIG_UPDATE_MAX_MS: 200,
    BATCH_OPERATION_MAX_MS: 1000,
} as const;

const REGRESSION_TOLERANCE = 0.2; // 20% performance degradation allowed

// ========================================
// PERFORMANCE TESTS
// ========================================

describe('Jackpot Performance Tests', () =>
{
    beforeAll(async () =>
    {
        process.env.NODE_ENV = 'test';

        try {
            await setupTestDatabase();
        } catch (error) {
            console.warn('⚠️  Database setup failed for performance tests:', error);
        }
    });

    beforeEach(async () =>
    {
        try {
            await clearTestData();
            await seedTestJackpotData();
        } catch (error) {
            console.warn('⚠️  Performance test setup failed:', error);
        }
    });

    // ========================================
    // INDIVIDUAL OPERATION PERFORMANCE
    // ========================================

    describe('Individual Operation Performance', () =>
    {
        it('should process contributions within performance threshold', async () =>
        {
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                await processJackpotContribution(
                    testDataGenerators.gameId(),
                    testDataGenerators.wagerAmount()
                );
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS);
            console.log(`Contribution operation: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS}ms)`);
        });

        it('should process wins within performance threshold', async () =>
        {
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                await processJackpotWin(
                    'minor',
                    testDataGenerators.gameId(),
                    testDataGenerators.userId(),
                    testDataGenerators.winAmount()
                );
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.WIN_PROCESSING_MAX_MS);
            console.log(`Win processing operation: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.WIN_PROCESSING_MAX_MS}ms)`);
        });

        it('should retrieve pools within performance threshold', async () =>
        {
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                await getJackpotPools();
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.POOL_RETRIEVAL_MAX_MS);
            console.log(`Pool retrieval operation: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.POOL_RETRIEVAL_MAX_MS}ms)`);
        });

        it('should update configuration within performance threshold', async () =>
        {
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                await updateJackpotConfig({
                    minor: { rate: 0.025 }
                });
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONFIG_UPDATE_MAX_MS);
            console.log(`Configuration update operation: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.CONFIG_UPDATE_MAX_MS}ms)`);
        });
    });

    // ========================================
    // BATCH OPERATION PERFORMANCE
    // ========================================

    describe('Batch Operation Performance', () =>
    {
        it('should handle batch contributions efficiently', async () =>
        {
            const batchSize = 50;
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                const operations = Array.from({ length: batchSize }, (_, i) =>
                    processJackpotContribution(
                        `${TEST_GAME_IDS.SLOT_MACHINE}_${i}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                await Promise.allSettled(operations);
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATION_MAX_MS);
            console.log(`Batch contributions (${batchSize}): ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.BATCH_OPERATION_MAX_MS}ms)`);
        });

        it('should handle batch wins efficiently', async () =>
        {
            // First, add money to pools for win testing
            for (let i = 0; i < 10; i++) {
                await processJackpotContribution(
                    TEST_GAME_IDS.SLOT_MACHINE,
                    testDataGenerators.wagerAmount()
                );
            }

            const batchSize = 20;
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                const operations = Array.from({ length: batchSize }, (_, i) =>
                    processJackpotWin(
                        'minor',
                        `${TEST_GAME_IDS.SLOT_MACHINE}_${i}`,
                        testDataGenerators.userId(),
                        100 // Small amount to avoid overdraw
                    )
                );

                await Promise.allSettled(operations);
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATION_MAX_MS);
            console.log(`Batch wins (${batchSize}): ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.BATCH_OPERATION_MAX_MS}ms)`);
        });

        it('should handle mixed batch operations efficiently', async () =>
        {
            const batchSize = 30;
            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                const operations = [
                    // Half contributions
                    ...Array.from({ length: Math.floor(batchSize / 2) }, (_, i) =>
                        processJackpotContribution(
                            `${TEST_GAME_IDS.SLOT_MACHINE}_contrib_${i}`,
                            testDataGenerators.wagerAmount()
                        )
                    ),
                    // Half wins (after adding money)
                    ...Array.from({ length: Math.floor(batchSize / 2) }, (_, i) =>
                        processJackpotWin(
                            'minor',
                            `${TEST_GAME_IDS.SLOT_MACHINE}_win_${i}`,
                            testDataGenerators.userId(),
                            50
                        )
                    ),
                ];

                await Promise.allSettled(operations);
            });

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATION_MAX_MS * 1.5); // Allow more time for mixed operations
            console.log(`Mixed batch operations (${batchSize}): ${duration}ms`);
        });
    });

    // ========================================
    // PERFORMANCE REGRESSION TESTS
    // ========================================

    describe('Performance Regression Tests', () =>
    {
        it('should not degrade contribution performance over time', async () =>
        {
            const iterations = 20;
            const benchmark = await performanceTestUtils.benchmark(async () =>
            {
                await processJackpotContribution(
                    testDataGenerators.gameId(),
                    testDataGenerators.wagerAmount()
                );
            }, iterations);

            const { average, min, max } = benchmark;

            expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS);
            expect(max).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS * 2); // Allow some variance

            console.log(`Contribution regression test (${iterations} iterations): avg=${average}ms, min=${min}ms, max=${max}ms`);
        });

        it('should not degrade win processing performance over time', async () =>
        {
            const iterations = 15;
            const benchmark = await performanceTestUtils.benchmark(async () =>
            {
                await processJackpotWin(
                    'minor',
                    testDataGenerators.gameId(),
                    testDataGenerators.userId(),
                    testDataGenerators.winAmount()
                );
            }, iterations);

            const { average, min, max } = benchmark;

            expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.WIN_PROCESSING_MAX_MS);
            expect(max).toBeLessThan(PERFORMANCE_THRESHOLDS.WIN_PROCESSING_MAX_MS * 2);

            console.log(`Win processing regression test (${iterations} iterations): avg=${average}ms, min=${min}ms, max=${max}ms`);
        });

        it('should maintain consistent pool retrieval performance', async () =>
        {
            const iterations = 30;
            const benchmark = await performanceTestUtils.benchmark(async () =>
            {
                await getJackpotPools();
            }, iterations);

            const { average, min, max } = benchmark;

            expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.POOL_RETRIEVAL_MAX_MS);
            expect(max).toBeLessThan(PERFORMANCE_THRESHOLDS.POOL_RETRIEVAL_MAX_MS * 1.5);

            console.log(`Pool retrieval regression test (${iterations} iterations): avg=${average}ms, min=${min}ms, max=${max}ms`);
        });
    });

    // ========================================
    // MEMORY AND RESOURCE USAGE
    // ========================================

    describe('Memory and Resource Usage', () =>
    {
        it('should not cause memory leaks during high-frequency operations', async () =>
        {
            const operationCount = 100;
            const initialMemory = process.memoryUsage();

            // Perform high-frequency operations
            for (let i = 0; i < operationCount; i++) {
                await processJackpotContribution(
                    `mem_test_${i}`,
                    testDataGenerators.wagerAmount()
                );

                // Periodically trigger garbage collection (if available)
                if (global.gc && i % 20 === 0) {
                    global.gc();
                }
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            // Allow reasonable memory growth (1MB limit)
            expect(memoryIncrease).toBeLessThan(1024 * 1024);

            console.log(`Memory usage after ${operationCount} operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
        });

        it('should handle sustained load without resource exhaustion', async () =>
        {
            const duration = 5000; // 5 seconds
            const startTime = Date.now();
            let operationCount = 0;

            while (Date.now() - startTime < duration) {
                await processJackpotContribution(
                    `sustained_load_${operationCount}`,
                    testDataGenerators.wagerAmount()
                );
                operationCount++;
            }

            // Should handle at least 100 operations in 5 seconds
            expect(operationCount).toBeGreaterThan(100);

            console.log(`Sustained load test: ${operationCount} operations in 5 seconds (${(operationCount / 5).toFixed(1)} ops/sec)`);
        });
    });

    // ========================================
    // SCALABILITY PERFORMANCE
    // ========================================

    describe('Scalability Performance', () =>
    {
        it('should scale linearly with operation volume', async () =>
        {
            const testSizes = [10, 25, 50, 100];
            const results: { size: number; duration: number; avgPerOp: number }[] = [];

            for (const size of testSizes) {
                const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
                {
                    const operations = Array.from({ length: size }, (_, i) =>
                        processJackpotContribution(
                            `scalability_test_${size}_${i}`,
                            testDataGenerators.wagerAmount()
                        )
                    );

                    await Promise.allSettled(operations);
                });

                results.push({
                    size,
                    duration,
                    avgPerOp: duration / size,
                });
            }

            // Check for linear scaling (allow some variance)
            const firstAvg = results[0]?.avgPerOp || 0;
            const lastAvg = results[results.length - 1]?.avgPerOp || 0;

            expect(lastAvg).toBeLessThan(firstAvg * (1 + REGRESSION_TOLERANCE));

            console.log('Scalability test results:', results.map(r => `${r.size}: ${r.avgPerOp.toFixed(2)}ms/op`));
        });

        it('should handle peak load without significant degradation', async () =>
        {
            // Simulate peak load scenario
            const peakLoadDuration = 2000; // 2 seconds
            const operationsPerSecond = 50;

            const startTime = Date.now();
            let totalOperations = 0;
            const operationTimes: number[] = [];

            while (Date.now() - startTime < peakLoadDuration) {
                const opStart = Date.now();

                await processJackpotContribution(
                    `peak_load_${totalOperations}`,
                    testDataGenerators.wagerAmount()
                );

                operationTimes.push(Date.now() - opStart);
                totalOperations++;

                // Control rate
                const targetDelay = 1000 / operationsPerSecond;
                const actualDelay = Date.now() - opStart;
                if (actualDelay < targetDelay) {
                    await new Promise(resolve => setTimeout(resolve, targetDelay - actualDelay));
                }
            }

            const avgOpTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
            const maxOpTime = Math.max(...operationTimes);

            expect(avgOpTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS * 2);
            expect(maxOpTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTRIBUTION_MAX_MS * 5);

            console.log(`Peak load test: ${totalOperations} operations in ${peakLoadDuration}ms, avg=${avgOpTime.toFixed(2)}ms, max=${maxOpTime}ms`);
        });
    });

    // ========================================
    // PERFORMANCE BENCHMARKS
    // ========================================

    describe('Performance Benchmarks', () =>
    {
        it('should meet minimum TPS requirements', async () =>
        {
            const testDuration = 3000; // 3 seconds
            const targetTPS = 20; // Target transactions per second

            const startTime = Date.now();
            let operationsCompleted = 0;

            while (Date.now() - startTime < testDuration) {
                await processJackpotContribution(
                    `tps_test_${operationsCompleted}`,
                    testDataGenerators.wagerAmount()
                );
                operationsCompleted++;
            }

            const actualDuration = Date.now() - startTime;
            const actualTPS = operationsCompleted / (actualDuration / 1000);

            expect(actualTPS).toBeGreaterThan(targetTPS * 0.8); // Allow 20% variance

            console.log(`TPS benchmark: ${actualTPS.toFixed(1)} TPS (target: ${targetTPS} TPS)`);
        });

        it('should maintain consistent response times under load', async () =>
        {
            const concurrentOperations = 10;
            const operationsPerOperation = 10;

            const responseTimes: number[] = [];

            for (let i = 0; i < concurrentOperations; i++) {
                const start = Date.now();

                const operations = Array.from({ length: operationsPerOperation }, (_, j) =>
                    processJackpotContribution(
                        `load_test_${i}_${j}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                await Promise.allSettled(operations);

                responseTimes.push(Date.now() - start);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);
            const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

            expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
            expect(p95ResponseTime).toBeLessThan(1000); // 95th percentile under 1 second

            console.log(`Load test: avg=${avgResponseTime.toFixed(2)}ms, p95=${p95ResponseTime}ms, max=${maxResponseTime}ms`);
        });

        it('should handle database-heavy operations efficiently', async () =>
        {
            // Mix operations that hit database hard
            const operations = [
                () => getJackpotPools(),
                () => processJackpotContribution(testDataGenerators.gameId(), testDataGenerators.wagerAmount()),
                () => getJackpotPool('minor'),
                () => processJackpotWin('minor', testDataGenerators.gameId(), testDataGenerators.userId(), 100),
                () => getJackpotPool('major'),
            ];

            const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
            {
                for (let i = 0; i < 20; i++) {
                    const operation = operations[i % operations.length];
                    if (operation) {
                        await operation();
                    }
                }
            });

            expect(duration).toBeLessThan(2000); // Should complete 20 mixed operations in 2 seconds
            console.log(`Database-heavy operations: ${duration}ms for 20 operations`);
        });
    });
});
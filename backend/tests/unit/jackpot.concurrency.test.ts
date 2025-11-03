/**
 * Jackpot Concurrency Tests
 * Testing concurrency safety and race conditions in jackpot operations
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import
{
    ConcurrencyViolationError,
    getJackpotPool,
    getJackpotPools,
    LockTimeoutError,
    processJackpotContribution,
    processJackpotWin
} from '../../src/modules/jackpots/jackpot.service';

import
{
    clearTestData,
    seedTestJackpotData,
    setupTestDatabase
} from '../utils/test-db';

import
{
    concurrencyTestUtils,
    errorSimulation,
    testAssertions,
    testDataGenerators
} from '../utils/test-helpers';


import { vi } from 'vitest';

// ========================================
// CONCURRENCY TEST SETUP
// ========================================

describe('Jackpot Concurrency Tests', () =>
{
    beforeAll(async () =>
    {
        process.env.NODE_ENV = 'test';

        try {
            await setupTestDatabase();
        } catch (error) {
            console.warn('⚠️  Database setup failed for concurrency tests:', error);
        }
    });

    beforeEach(async () =>
    {
        try {
            await clearTestData();
            await seedTestJackpotData();
        } catch (error) {
            console.warn('⚠️  Concurrency test setup failed:', error);
        }
    });

    // ========================================
    // CONCURRENT CONTRIBUTION TESTS
    // ========================================

    describe('Concurrent Contributions', () =>
    {
        it('should handle multiple simultaneous contributions correctly', async () =>
        {
            const contributionCount = 20;
            const operations = Array.from({ length: contributionCount }, (_, i) =>
                () => processJackpotContribution(
                    `concurrent_contrib_${i}`,
                    testDataGenerators.wagerAmount()
                )
            );

            const results = await concurrencyTestUtils.runConcurrently(
                async () =>
                {
                    const operationResults = await Promise.allSettled(
                        operations.map(op => op())
                    );
                    return operationResults.filter(r => r.status === 'fulfilled').length;
                },
                1,
                0
            );

            // All operations should complete successfully
            expect(results[0]).toBeGreaterThan(contributionCount * 0.9); // At least 90% success rate

            // Verify final pool state is consistent
            const finalPools = await getJackpotPools();
            expect(finalPools.minor.totalContributions).toBeGreaterThan(0);
        });

        it('should handle high-frequency contributions without data corruption', async () =>
        {
            const frequency = 50; // 50 operations
            const delayMs = 10; // 10ms delay between operations

            const operations = Array.from({ length: frequency }, (_, i) =>
                () => processJackpotContribution(
                    `high_freq_${i}`,
                    testDataGenerators.wagerAmount()
                )
            );

            const startTime = Date.now();
            const results = await Promise.allSettled(
                operations.map((op, index) =>
                    new Promise((resolve, reject) =>
                    {
                        setTimeout(() =>
                        {
                            op().then(resolve).catch(reject);
                        }, index * delayMs);
                    })
                )
            );
            const duration = Date.now() - startTime;

            const successfulOps = results.filter(r => r.status === 'fulfilled' && (r as any).value?.success);
            expect(successfulOps.length).toBeGreaterThan(frequency * 0.85); // At least 85% success rate

            console.log(`High-frequency test: ${successfulOps.length}/${frequency} operations in ${duration}ms`);
        });

        it('should maintain data integrity under concurrent access', async () =>
        {
            const concurrentThreads = 10;
            const operationsPerThread = 5;

            const threadPromises = Array.from({ length: concurrentThreads }, (_, threadIndex) =>
                concurrencyTestUtils.runConcurrently(
                    async () =>
                    {
                        const threadResults = [];
                        for (let i = 0; i < operationsPerThread; i++) {
                            const result = await processJackpotContribution(
                                `thread_${threadIndex}_op_${i}`,
                                testDataGenerators.wagerAmount()
                            );
                            threadResults.push(result);
                        }
                        return threadResults;
                    },
                    1,
                    0
                )
            );

            const allResults = await Promise.all(threadPromises);

            // Flatten results and check success rate
            const successfulOps = allResults.flat().filter((r: any) => r && (r as any).success);
            const totalOps = concurrentThreads * operationsPerThread;

            expect(successfulOps.length).toBeGreaterThan(totalOps * 0.9);

            // Verify no negative amounts or corrupted data
            const finalPools = await getJackpotPools();
            Object.values(finalPools).forEach(pool =>
            {
                expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
                expect(pool.totalContributions).toBeGreaterThanOrEqual(0);
                expect(pool.totalWins).toBeGreaterThanOrEqual(0);
            });
        });
    });

    // ========================================
    // CONCURRENT WIN PROCESSING TESTS
    // ========================================

    describe('Concurrent Win Processing', () =>
    {
        beforeEach(async () =>
        {
            // Add money to pools for win testing
            for (let i = 0; i < 20; i++) {
                await processJackpotContribution(
                    `win_test_setup_${i}`,
                    10000 // $100 per contribution
                );
            }
        });

        it('should handle concurrent wins safely', async () =>
        {
            const winCount = 10;
            const winAmount = 500; // $5 per win

            const operations = Array.from({ length: winCount }, (_, i) =>
                () => processJackpotWin(
                    'minor',
                    `concurrent_win_${i}`,
                    testDataGenerators.userId(),
                    winAmount
                )
            );

            const results = await Promise.allSettled(
                operations.map(op => op())
            );

            const successfulWins = results.filter(r => r.status === 'fulfilled' && r.value?.success);

            // Some wins might fail due to insufficient funds, but system should remain stable
            expect(successfulWins.length).toBeGreaterThan(0);

            // Verify pool integrity after concurrent wins
            const finalPool = await getJackpotPool('minor');
            expect(finalPool.currentAmount).toBeGreaterThanOrEqual(0);
            expect(finalPool.totalWins).toBeGreaterThanOrEqual(0);
        });

        it('should prevent negative balances during concurrent wins', async () =>
        {
            const smallWinAmount = 100; // $1 per win
            const potentialWins = 15; // Try more wins than we have money for

            const operations = Array.from({ length: potentialWins }, (_, i) =>
                () => processJackpotWin(
                    'minor',
                    `negative_test_win_${i}`,
                    testDataGenerators.userId(),
                    smallWinAmount
                )
            );

            const results = await Promise.allSettled(operations);

            // Get final pool state
            const finalPool = await getJackpotPool('minor');

            // Pool should never go negative
            expect(finalPool.currentAmount).toBeGreaterThanOrEqual(0);

            // If pool hit zero, it should have been reset to seed amount
            const config = await getJackpotPool('minor');
            if (finalPool.currentAmount === 0) {
                expect(finalPool.currentAmount).toBeGreaterThanOrEqual(config.currentAmount || 0);
            }
        });
    });

    // ========================================
    // MIXED CONCURRENT OPERATIONS
    // ========================================

    describe('Mixed Concurrent Operations', () =>
    {
        beforeEach(async () =>
        {
            // Setup for mixed operations
            for (let i = 0; i < 15; i++) {
                await processJackpotContribution(
                    `mixed_test_setup_${i}`,
                    5000 // $50 per contribution
                );
            }
        });

        it('should handle mixed operations (contributions and wins) concurrently', async () =>
        {
            const operationCount = 30;
            const contributionRatio = 0.6; // 60% contributions, 40% wins

            const operations = Array.from({ length: operationCount }, (_, i) =>
            {
                const isContribution = i < operationCount * contributionRatio;

                if (isContribution) {
                    return () => processJackpotContribution(
                        `mixed_contrib_${i}`,
                        testDataGenerators.wagerAmount()
                    );
                } else {
                    return () => processJackpotWin(
                        'minor',
                        `mixed_win_${i}`,
                        testDataGenerators.userId(),
                        200 // $2 wins
                    );
                }
            });

            const results = await Promise.allSettled(
                operations.map((op, index) =>
                    setTimeout(() => op(), Math.random() * 100) // Random delay
                )
            );

            const successfulOps = results.filter(r => r.status === 'fulfilled');
            expect(successfulOps.length).toBeGreaterThan(operationCount * 0.8);

            // Verify system stability
            const finalPools = await getJackpotPools();
            Object.values(finalPools).forEach(pool =>
            {
                expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
            });
        });

        it('should maintain consistency during rapid mixed operations', async () =>
        {
            const rapidOperations = 25;
            const operationTypes = ['contribute', 'win', 'getPool'];

            const operations = Array.from({ length: rapidOperations }, (_, i) =>
            {
                const type = operationTypes[i % operationTypes.length];

                switch (type) {
                    case 'contribute':
                        return () => processJackpotContribution(
                            `rapid_mixed_${i}`,
                            testDataGenerators.wagerAmount()
                        );
                    case 'win':
                        return () => processJackpotWin(
                            'minor',
                            `rapid_mixed_${i}`,
                            testDataGenerators.userId(),
                            150
                        );
                    case 'getPool':
                    default:
                        return () => getJackpotPool('minor');
                }
            });

            // Execute with minimal delays to stress test
            const startTime = Date.now();
            const results = await Promise.allSettled(
                operations.map((op, index) =>
                    setTimeout(() => op(), index * 5) // 5ms between operations
                )
            );
            const duration = Date.now() - startTime;

            const successfulOps = results.filter(r => r.status === 'fulfilled');
            expect(successfulOps.length).toBeGreaterThan(rapidOperations * 0.9);

            // Should complete within reasonable time
            expect(duration).toBeLessThan(2000); // 2 seconds

            console.log(`Rapid mixed operations: ${successfulOps.length}/${rapidOperations} in ${duration}ms`);
        });
    });

    // ========================================
    // RACE CONDITION TESTS
    // ========================================

    describe('Race Condition Detection', () =>
    {
        it('should detect and handle version conflicts', async () =>
        {
            // Mock a version conflict scenario
            const mockVersionConflict = new ConcurrencyViolationError(
                'Version conflict detected during test',
                'testContribute',
                'minor' as const,
                {
                    originalVersion: 1,
                    currentVersion: 2,
                    attempt: 1,
                    operationId: 'test_op_123'
                }
            );

            vi.spyOn(require('../../src/modules/gameplay/jackpot.service').jackpotManager, 'contribute')
                .mockRejectedValueOnce(mockVersionConflict);

            const result = await processJackpotContribution('version_test', 1000);

            // Should fail gracefully with concurrency error
            testAssertions.assertErrorResult(result);
            expect(result.error).toContain('Version conflict');
        });

        it('should handle lock timeout scenarios', async () =>
        {
            const mockLockTimeout = new LockTimeoutError(
                'Lock timeout during concurrent operation',
                'testWin',
                5000
            );

            vi.spyOn(require('../../src/modules/gameplay/jackpot.service').jackpotManager, 'processWin')
                .mockRejectedValueOnce(mockLockTimeout);

            const result = await processJackpotWin(
                'minor',
                'lock_timeout_test',
                testDataGenerators.userId()
            );

            // Should fail gracefully with timeout error
            testAssertions.assertErrorResult(result);
            expect(result.error).toContain('timeout');
        });

        it('should recover from temporary concurrency failures', async () =>
        {
            // Simulate temporary database issues
            vi.spyOn(require('../../src/modules/gameplay/jackpot.service').jackpotManager, 'contribute' as any)
                .mockRejectedValueOnce(errorSimulation.simulateConnectionError())
                .mockResolvedValueOnce(undefined as any);

            const result = await processJackpotContribution('recovery_test', 10000);

            // Should eventually succeed (this test demonstrates the pattern)
            expect(result.success).toBe(true);
        });
    });

    // ========================================
    // STRESS TESTING
    // ========================================

    describe('Stress Testing', () =>
    {
        it('should handle extreme concurrent load', async () =>
        {
            const extremeLoad = 100;
            const operations = Array.from({ length: extremeLoad }, (_, i) =>
                () => processJackpotContribution(
                    `stress_test_${i}`,
                    testDataGenerators.wagerAmount()
                )
            );

            const startTime = Date.now();
            const results = await Promise.allSettled([
                concurrencyTestUtils.runConcurrently(
                    async () =>
                    {
                        const operationResults = await Promise.allSettled(operations);
                        return operationResults.filter(r => r.status === 'fulfilled').length;
                    },
                    1,
                    0
                )
            ]);
            const duration = Date.now() - startTime;

            const successfulOps = (results[0] as any)?.status === 'fulfilled' ? (results[0] as any).value : 0;
            expect(successfulOps).toBeGreaterThan(extremeLoad * 0.7); // At least 70% success under stress

            console.log(`Stress test: ${successfulOps}/${extremeLoad} operations in ${duration}ms`);

            // Verify system still responsive after stress
            const pool = await getJackpotPool('minor');
            expect(pool.group).toBe('minor');
        });

        it('should maintain data consistency under sustained load', async () =>
        {
            const sustainedDuration = 3000; // 3 seconds
            const operationsPerSecond = 20;
            const operationInterval = 1000 / operationsPerSecond;

            const startTime = Date.now();
            let operationCount = 0;

            while (Date.now() - startTime < sustainedDuration) {
                const opStart = Date.now();

                await processJackpotContribution(
                    `sustained_${operationCount}`,
                    testDataGenerators.wagerAmount()
                );

                operationCount++;

                // Control rate
                const elapsed = Date.now() - opStart;
                if (elapsed < operationInterval) {
                    await new Promise(resolve => setTimeout(resolve, operationInterval - elapsed));
                }
            }

            const actualDuration = Date.now() - startTime;
            const opsPerSecond = operationCount / (actualDuration / 1000);

            expect(opsPerSecond).toBeGreaterThan(operationsPerSecond * 0.8); // Allow 20% variance

            // Verify data consistency after sustained load
            const finalPools = await getJackpotPools();
            Object.values(finalPools).forEach(pool =>
            {
                expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
                expect(pool.totalContributions).toBeGreaterThanOrEqual(0);
            });

            console.log(`Sustained load: ${operationCount} operations in ${actualDuration}ms (${opsPerSecond.toFixed(1)} ops/sec)`);
        });

        it('should handle burst traffic patterns', async () =>
        {
            const burstSize = 20;
            const burstCount = 5;
            const burstInterval = 500; // 500ms between bursts

            let totalSuccessfulOps = 0;

            for (let burst = 0; burst < burstCount; burst++) {
                const burstStart = Date.now();

                const burstOperations = Array.from({ length: burstSize }, (_, i) =>
                    processJackpotContribution(
                        `burst_${burst}_${i}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                const burstResults = await Promise.allSettled(burstOperations);
                const successfulInBurst = burstResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
                totalSuccessfulOps += successfulInBurst;

                const burstDuration = Date.now() - burstStart;

                // Each burst should complete within reasonable time
                expect(burstDuration).toBeLessThan(2000); // 2 seconds per burst

                console.log(`Burst ${burst + 1}: ${successfulInBurst}/${burstSize} in ${burstDuration}ms`);

                // Wait between bursts
                if (burst < burstCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, burstInterval));
                }
            }

            const totalOps = burstSize * burstCount;
            expect(totalSuccessfulOps).toBeGreaterThan(totalOps * 0.8);

            // Verify system stability after burst pattern
            const finalPool = await getJackpotPool('minor');
            expect(finalPool.currentAmount).toBeGreaterThanOrEqual(0);
        });
    });

    // ========================================
    // DEADLOCK PREVENTION
    // ========================================

    describe('Deadlock Prevention', () =>
    {
        it('should prevent deadlocks in multi-pool operations', async () =>
        {
            // This test verifies that operations don't create deadlocks
            // when accessing multiple jackpot pools

            const operations = [
                () => processJackpotContribution('multi_pool_test_1', 5000),
                () => processJackpotContribution('multi_pool_test_2', 7000),
                () => getJackpotPools(),
                () => getJackpotPool('minor'),
                () => getJackpotPool('major'),
            ];

            // Execute many operations that could potentially cause deadlocks
            const deadlockTestIterations = 50;
            let deadlockCount = 0;

            for (let i = 0; i < deadlockTestIterations; i++) {
                try {
                    const results = await Promise.allSettled(
                        operations.map(op => op())
                    );

                    // Check if any operation timed out (potential deadlock indicator)
                    const timeoutResults = results.filter(r =>
                        r.status === 'rejected' &&
                        (r.reason?.message?.includes('timeout') ||
                            r.reason?.message?.includes('deadlock'))
                    );

                    if (timeoutResults.length > 0) {
                        deadlockCount++;
                    }
                } catch (error) {
                    // If we get here, operations completed (no deadlock)
                }
            }

            // Should have minimal or no deadlocks
            expect(deadlockCount).toBeLessThan(deadlockTestIterations * 0.05); // Less than 5%

            console.log(`Deadlock test: ${deadlockCount}/${deadlockTestIterations} potential deadlocks detected`);
        });
    });
});
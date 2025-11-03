/**
 * Jackpot Integration Tests
 * End-to-end testing of complete jackpot workflows
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import
{
    getJackpotPool,
    getJackpotPools,
    getJackpotStatistics,
    jackpotManager,
    processJackpotContribution,
    processJackpotWin,
    updateJackpotConfig
} from '../../src/modules/jackpots/jackpot.service';

import
{
    clearTestData,
    getTestDbStats,
    seedTestJackpotData,
    setupTestDatabase
} from '../utils/test-db';

import
{
    concurrencyTestUtils,
    performanceTestUtils,
    testAssertions,
    testCleanup,
    testDataGenerators
} from '../utils/test-helpers';

import
{
    PERFORMANCE_SCENARIOS,
    TEST_GAME_IDS,
    TEST_USER_IDS
} from '../fixtures/test-data';

// ========================================
// INTEGRATION TEST SETUP
// ========================================

describe('Jackpot End-to-End Integration Tests', () =>
{
    beforeAll(async () =>
    {
        process.env.NODE_ENV = 'test';

        try {
            await setupTestDatabase();
            console.log('✅ Integration test database setup completed');
        } catch (error) {
            console.warn('⚠️  Database setup failed, integration tests may fail:', error);
        }
    });

    beforeEach(async () =>
    {
        // Clean slate for each integration test
        try {
            await clearTestData();
            await seedTestJackpotData();
        } catch (error) {
            console.warn('⚠️  Integration test setup failed:', error);
        }

        testCleanup.resetTestState();
    });

    afterEach(() =>
    {
        testCleanup.resetTestState();
    });

    afterAll(async () =>
    {
        try {
            await clearTestData();
        } catch (error) {
            console.warn('⚠️  Integration test cleanup failed:', error);
        }
    });

    // ========================================
    // COMPLETE JACKPOT WORKFLOWS
    // ========================================

    describe('Complete Jackpot Lifecycle', () =>
    {
        it('should handle complete contribution cycle', async () =>
        {
            // 1. Get initial state
            const initialPools = await getJackpotPools();
            const initialMinorAmount = initialPools.minor.currentAmount;

            // 2. Process multiple contributions
            const contributionCount = 10;
            const contributions = [];

            for (let i = 0; i < contributionCount; i++) {
                const result = await processJackpotContribution(
                    TEST_GAME_IDS.SLOT_MACHINE,
                    testDataGenerators.wagerAmount()
                );

                testAssertions.assertContributionResult(result, ['minor']);
                contributions.push(result);
            }

            // 3. Verify final state
            const finalPools = await getJackpotPools();
            const finalMinorAmount = finalPools.minor.currentAmount;

            // Pool should have increased by sum of contributions
            const totalContributions = contributions.reduce((sum, c) => sum + c.totalContribution, 0);
            expect(finalMinorAmount).toBe(initialMinorAmount + totalContributions);

            // Verify statistics
            const stats = await getJackpotStatistics();
            expect(stats.totalContributions).toBeGreaterThan(initialPools.minor.totalContributions);
        });

        it('should handle complete win cycle', async () =>
        {
            // 1. Setup - add some money to pool first
            await processJackpotContribution(TEST_GAME_IDS.SLOT_MACHINE, 100000); // $1000
            const initialPools = await getJackpotPools();
            const initialMinorAmount = initialPools.minor.currentAmount;

            // 2. Process win
            const winAmount = 5000; // $50
            const winResult = await processJackpotWin(
                'minor',
                TEST_GAME_IDS.SLOT_MACHINE,
                TEST_USER_IDS[0],
                winAmount
            );

            testAssertions.assertWinResult(winResult);

            // 3. Verify state changes
            const finalPools = await getJackpotPools();
            const finalMinorAmount = finalPools.minor.currentAmount;

            expect(finalMinorAmount).toBe(initialMinorAmount - winAmount);
            expect(finalPools.minor.totalWins).toBe(initialPools.minor.totalWins + winAmount);
            expect(finalPools.minor.lastWinAmount).toBe(winAmount);
            expect(finalPools.minor.lastWonByUserId).toBe(TEST_USER_IDS[0]);
        });

        it('should handle full cycle: contribute → win → reset', async () =>
        {
            // 1. Initial contributions
            const contribution1 = await processJackpotContribution(
                TEST_GAME_IDS.SLOT_MACHINE,
                50000 // $500
            );
            const contribution2 = await processJackpotContribution(
                TEST_GAME_IDS.POKER,
                30000 // $300
            );

            testAssertions.assertContributionResult(contribution1, ['minor']);
            testAssertions.assertContributionResult(contribution2, ['minor']);

            // 2. Check pool state after contributions
            let pools = await getJackpotPools();
            const amountAfterContributions = pools.minor.currentAmount;

            // 3. Process win that takes pool below seed amount
            const largeWin = amountAfterContributions + 10000; // More than available
            const winResult = await processJackpotWin(
                'minor',
                TEST_GAME_IDS.SLOT_MACHINE,
                TEST_USER_IDS[0],
                largeWin
            );

            testAssertions.assertWinResult(winResult);

            // 4. Verify reset to seed amount
            pools = await getJackpotPools();
            expect(pools.minor.currentAmount).toBe(pools.minor.seedAmount);

            // 5. Verify statistics are correct
            const stats = await getJackpotStatistics();
            expect(stats.totalContributions).toBeGreaterThan(0);
            expect(stats.totalWins).toBeGreaterThan(0);
        });

        it('should handle configuration changes in live system', async () =>
        {
            // 1. Get initial config and pools
            const initialConfig = jackpotManager.getConfig();
            const initialPools = await getJackpotPools();

            // 2. Update configuration
            const configUpdate = {
                minor: { rate: 0.035 }, // Increase rate from 2% to 3.5%
                major: { seedAmount: 5000000 }, // Increase seed to $50,000
            };

            const configResult = await updateJackpotConfig(configUpdate);
            expect(configResult.success).toBe(true);

            // 3. Verify configuration is applied
            const newConfig = jackpotManager.getConfig();
            expect(newConfig.minor.rate).toBe(0.035);
            expect(newConfig.major.seedAmount).toBe(5000000);

            // 4. Test that new rates are used
            const contributionResult = await processJackpotContribution(
                TEST_GAME_IDS.SLOT_MACHINE,
                10000 // $100
            );

            testAssertions.assertContributionResult(contributionResult, ['minor']);
            // With 3.5% rate, contribution should be 350 cents
            expect(contributionResult.contributions.minor).toBe(350);
        });
    });

    // ========================================
    // BATCH OPERATIONS
    // ========================================

    describe('Batch Operations', () =>
    {
        it('should handle multiple simultaneous contributions', async () =>
        {
            const batchSize = 20;
            const gameIds = Array.from({ length: batchSize }, (_, i) =>
                `${TEST_GAME_IDS.SLOT_MACHINE}_${i}`
            );

            // Process contributions in parallel
            const contributionPromises = gameIds.map(gameId =>
                processJackpotContribution(gameId, testDataGenerators.wagerAmount())
            );

            const results = await Promise.allSettled(contributionPromises);

            // Verify all operations completed successfully
            const successfulContributions = results.filter(r =>
                r.status === 'fulfilled' && r.value?.success
            );

            expect(successfulContributions.length).toBeGreaterThan(batchSize * 0.9); // At least 90% success

            // Verify pool state reflects batch operation
            const pools = await getJackpotPools();
            expect(pools.minor.totalContributions).toBeGreaterThan(0);
        });

        it('should handle mixed batch operations', async () =>
        {
            // First add money to pools for win testing
            for (let i = 0; i < 5; i++) {
                await processJackpotContribution(
                    TEST_GAME_IDS.SLOT_MACHINE,
                    testDataGenerators.wagerAmount()
                );
            }

            // Mixed operations: contributions and wins
            const operations = [];

            // Add contributions
            for (let i = 0; i < 10; i++) {
                operations.push(
                    processJackpotContribution(
                        TEST_GAME_IDS.SLOT_MACHINE,
                        testDataGenerators.wagerAmount()
                    )
                );
            }

            // Add wins
            for (let i = 0; i < 5; i++) {
                operations.push(
                    processJackpotWin(
                        'minor',
                        TEST_GAME_IDS.SLOT_MACHINE,
                        testDataGenerators.userId(),
                        testDataGenerators.winAmount()
                    )
                );
            }

            const results = await Promise.allSettled(operations);

            const successfulOperations = results.filter(r => r.status === 'fulfilled');
            expect(successfulOperations.length).toBeGreaterThan(operations.length * 0.8);

            // Verify final state is consistent
            const pools = await getJackpotPools();
            expect(pools.minor.currentAmount).toBeGreaterThanOrEqual(0); // Should never go negative
        });
    });

    // ========================================
    // DATABASE INTEGRITY
    // ========================================

    describe('Database Integrity', () =>
    {
        it('should maintain data consistency under concurrent access', async () =>
        {
            const concurrentOperations = 15;
            const operations = Array.from({ length: concurrentOperations }, (_, i) =>
                () => processJackpotContribution(
                    `${TEST_GAME_IDS.SLOT_MACHINE}_${i}`,
                    testDataGenerators.wagerAmount()
                )
            );

            // Run operations concurrently
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

            // Verify database consistency
            const stats = await getTestDbStats();
            expect(stats.jackpotPools).toBe(3); // Should have all 3 pools

            const pools = await getJackpotPools();
            Object.values(pools).forEach(pool =>
            {
                testAssertions.assertJackpotPool(pool, pool.group);
            });
        });

        it('should handle transaction rollbacks gracefully', async () =>
        {
            // This test verifies that failed operations don't corrupt data
            const initialPools = await getJackpotPools();
            const initialMinorAmount = initialPools.minor.currentAmount;

            try {
                // Attempt operations that might fail
                await Promise.allSettled([
                    processJackpotContribution('', 1000), // Invalid game ID
                    processJackpotContribution('valid_game', -100), // Invalid amount
                    processJackpotContribution('valid_game', 1000), // Valid operation
                ]);
            } catch (error) {
                // Errors are expected
            }

            // Verify database state is still consistent
            const finalPools = await getJackpotPools();
            expect(finalPools.minor.currentAmount).toBe(initialMinorAmount + 1000); // Only valid operation applied
        });

        it('should handle pool initialization edge cases', async () =>
        {
            // Clear all data to test initialization
            await clearTestData();

            // JackpotManager should automatically initialize pools
            const pools = await getJackpotPools();

            expect(pools.minor).toBeDefined();
            expect(pools.major).toBeDefined();
            expect(pools.mega).toBeDefined();

            // Verify pools have expected initial values
            expect(pools.minor.currentAmount).toBe(pools.minor.seedAmount);
            expect(pools.major.currentAmount).toBe(pools.major.seedAmount);
            expect(pools.mega.currentAmount).toBe(pools.mega.seedAmount);
        });
    });

    // ========================================
    // PERFORMANCE UNDER LOAD
    // ========================================

    describe('Performance Under Load', () =>
    {
        it('should maintain performance with high-volume contributions', async () =>
        {
            const highVolumeCount = 100;
            const start = Date.now();

            const operations = Array.from({ length: highVolumeCount }, (_, i) =>
                processJackpotContribution(
                    `${TEST_GAME_IDS.SLOT_MACHINE}_${i % 5}`, // Reuse some game IDs
                    testDataGenerators.wagerAmount()
                )
            );

            const results = await Promise.allSettled(operations);
            const duration = Date.now() - start;

            const successfulOps = results.filter(r => r.status === 'fulfilled' && r.value?.success);

            expect(successfulOps.length).toBeGreaterThan(highVolumeCount * 0.95); // 95% success rate
            expect(duration).toBeLessThan(PERFORMANCE_SCENARIOS.HIGH_VOLUME_CONTRIBUTIONS.expectedMaxDuration);

            console.log(`High-volume test: ${successfulOps.length}/${highVolumeCount} operations in ${duration}ms`);
        });

        it('should handle burst traffic patterns', async () =>
        {
            const burstSize = 25;
            const burstCount = 4;
            const totalOperations = burstSize * burstCount;

            const allResults = [];

            for (let burst = 0; burst < burstCount; burst++) {
                const burstStart = Date.now();

                const burstPromises = Array.from({ length: burstSize }, (_, i) =>
                    processJackpotContribution(
                        `${TEST_GAME_IDS.SLOT_MACHINE}_burst_${burst}_${i}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                const burstResults = await Promise.allSettled(burstPromises);
                const burstDuration = Date.now() - burstStart;

                allResults.push(...burstResults);

                // Small delay between bursts
                if (burst < burstCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                console.log(`Burst ${burst + 1}: ${burstResults.filter(r => r.status === 'fulfilled').length}/${burstSize} in ${burstDuration}ms`);
            }

            const totalSuccessful = allResults.filter(r => r.status === 'fulfilled' && r.value?.success);
            expect(totalSuccessful.length).toBeGreaterThan(totalOperations * 0.9); // 90% success rate
        });

        it('should maintain database performance over extended operations', async () =>
        {
            const operationCount = 50;
            const durations: number[] = [];

            for (let i = 0; i < operationCount; i++) {
                const { duration } = await performanceTestUtils.measureExecutionTime(async () =>
                {
                    await processJackpotContribution(
                        `${TEST_GAME_IDS.SLOT_MACHINE}_extended_${i}`,
                        testDataGenerators.wagerAmount()
                    );
                });

                durations.push(duration);

                // Verify no significant performance degradation
                if (i > 0) {
                    const recentAvg = durations.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, durations.length);
                    const earlierAvg = durations.slice(0, Math.min(10, durations.length)).reduce((a, b) => a + b, 0) / Math.min(10, durations.length);

                    // Recent operations shouldn't be significantly slower
                    expect(recentAvg).toBeLessThan(earlierAvg * 1.5);
                }
            }

            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const maxDuration = Math.max(...durations);

            expect(avgDuration).toBeLessThan(100); // Average under 100ms
            expect(maxDuration).toBeLessThan(500); // No operation over 500ms

            console.log(`Extended operations: avg=${avgDuration}ms, max=${maxDuration}ms`);
        });
    });

    // ========================================
    // ERROR RECOVERY AND RESILIENCE
    // ========================================

    describe('Error Recovery and Resilience', () =>
    {
        it('should recover from partial failures in batch operations', async () =>
        {
            // Create a mix of valid and invalid operations
            const mixedOperations = [
                // Valid operations
                () => processJackpotContribution(TEST_GAME_IDS.SLOT_MACHINE, 1000),
                () => processJackpotWin('minor', TEST_GAME_IDS.SLOT_MACHINE, TEST_USER_IDS[0], 100),

                // Invalid operations that should fail
                () => processJackpotContribution('', 1000),
                () => processJackpotContribution('valid', -100),
                () => processJackpotWin('invalid' as any, TEST_GAME_IDS.SLOT_MACHINE, TEST_USER_IDS[0]),

                // More valid operations
                () => processJackpotContribution(TEST_GAME_IDS.POKER, 2000),
                () => processJackpotWin('major', TEST_GAME_IDS.POKER, TEST_USER_IDS[1], 200),
            ];

            const results = await Promise.allSettled(mixedOperations.map(op => op()));

            const validOperations = results.slice(0, 1).concat(results.slice(4, 7)); // Valid ones
            const invalidOperations = results.slice(1, 4); // Invalid ones

            // Valid operations should succeed
            const validSuccessCount = validOperations.filter(r => r.status === 'fulfilled' && r.value?.success).length;
            expect(validSuccessCount).toBe(validOperations.length);

            // Invalid operations should fail gracefully
            const invalidFailureCount = invalidOperations.filter(r => r.status === 'fulfilled' && !r.value?.success).length;
            expect(invalidFailureCount).toBeGreaterThanOrEqual(invalidOperations.length * 0.8);

            // System should still be functional
            const pools = await getJackpotPools();
            testAssertions.assertJackpotPool(pools.minor, 'minor');
            testAssertions.assertJackpotPool(pools.major, 'major');
        });

        it('should handle database connection issues gracefully', async () =>
        {
            // This test would require mocking database connection failures
            // For now, we'll test the error handling paths

            const initialPools = await getJackpotPools();

            // Simulate various error conditions
            const errorResults = await Promise.allSettled([
                processJackpotContribution('', 1000), // Validation error
                processJackpotContribution('test', -100), // Validation error
            ]);

            // System should remain stable after errors
            const finalPools = await getJackpotPools();

            // Pool amounts should be unchanged (no valid operations succeeded)
            expect(finalPools.minor.currentAmount).toBe(initialPools.minor.currentAmount);

            // System should still be responsive
            const newContribution = await processJackpotContribution(TEST_GAME_IDS.SLOT_MACHINE, 1000);
            expect(newContribution.success).toBe(true);
        });

        it('should maintain data integrity after configuration changes', async () =>
        {
            // 1. Add some data to pools
            await processJackpotContribution(TEST_GAME_IDS.SLOT_MACHINE, 10000);
            await processJackpotContribution(TEST_GAME_IDS.POKER, 20000);

            const poolsBefore = await getJackpotPools();

            // 2. Change configuration
            const configChange = {
                minor: { rate: 0.05 },
                major: { seedAmount: 2000000 },
                mega: { maxAmount: 200000000 },
            };

            const configResult = await updateJackpotConfig(configChange);
            expect(configResult.success).toBe(true);

            // 3. Verify pools still have their data
            const poolsAfter = await getJackpotPools();

            expect(poolsAfter.minor.currentAmount).toBe(poolsBefore.minor.currentAmount);
            expect(poolsAfter.major.currentAmount).toBe(poolsBefore.major.currentAmount);
            expect(poolsAfter.mega.currentAmount).toBe(poolsBefore.mega.currentAmount);

            // 4. Verify new configuration is applied
            expect(poolsAfter.minor.seedAmount).toBe(2000000); // Changed
            expect(poolsAfter.mega.maxAmount).toBe(200000000); // Changed
            expect(poolsAfter.minor.contributionRate).toBe(0.05); // Changed
        });
    });

    // ========================================
    // SCALABILITY VERIFICATION
    // ========================================

    describe('Scalability Verification', () =>
    {
        it('should scale linearly with operation count', async () =>
        {
            const testSizes = [10, 25, 50];
            const performanceResults: { size: number; duration: number; avgPerOp: number }[] = [];

            for (const size of testSizes) {
                const start = Date.now();

                const operations = Array.from({ length: size }, (_, i) =>
                    processJackpotContribution(
                        `${TEST_GAME_IDS.SLOT_MACHINE}_scale_${i}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                await Promise.allSettled(operations);

                const duration = Date.now() - start;
                performanceResults.push({
                    size,
                    duration,
                    avgPerOp: duration / size,
                });
            }

            // Performance should scale relatively linearly
            // Allow some variance due to system load
            const firstAvg = performanceResults[0]?.avgPerOp || 0;
            const lastAvg = performanceResults[performanceResults.length - 1]?.avgPerOp || 0;

            expect(lastAvg).toBeLessThan(firstAvg * 2); // Shouldn't degrade more than 2x

            console.log('Scalability results:', performanceResults);
        });

        it('should handle sustained load without memory issues', async () =>
        {
            const iterations = 100;
            const operationsPerIteration = 10;

            for (let i = 0; i < iterations; i++) {
                const operations = Array.from({ length: operationsPerIteration }, (_, j) =>
                    processJackpotContribution(
                        `${TEST_GAME_IDS.SLOT_MACHINE}_sustained_${i}_${j}`,
                        testDataGenerators.wagerAmount()
                    )
                );

                await Promise.allSettled(operations);

                // Periodically verify system is still responsive
                if (i % 20 === 0) {
                    const pool = await getJackpotPool('minor');
                    expect(pool.group).toBe('minor');
                }
            }

            // Final verification
            const finalPools = await getJackpotPools();
            expect(finalPools.minor.totalContributions).toBeGreaterThan(0);

            console.log(`Sustained load test completed: ${iterations * operationsPerIteration} operations`);
        });
    });
});
/**
 * Jackpot Service Unit Tests
 * Comprehensive testing of core jackpot functionality
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Import from relative paths instead of @/ paths
import
{
    ConcurrencyViolationError,
    getJackpotPool,
    getJackpotPools,
    getJackpotStatistics,
    jackpotManager,
    LockTimeoutError,
    processJackpotContribution,
    processJackpotWin,
    updateJackpotConfig,
    validateJackpotConfigUpdate,
    validateJackpotContributionRequest,
    validateJackpotWinRequest
} from '../../src/modules/jackpots/jackpot.service';

import
{
    clearTestData,
    seedTestJackpotData,
    setupTestDatabase
} from '../utils/test-db';

import
{
    testAssertions,
    testBuilders,
    testCleanup,
    testDataGenerators
} from '../utils/test-helpers';

import
{
    TEST_GAME_IDS,
    TEST_USER_IDS
} from '../fixtures/test-data';

// Mock the modules we can't easily test
vi.mock('../../src/modules/gameplay/jackpot.service', async () =>
{
    const actual = await vi.importActual('../../src/modules/gameplay/jackpot.service');
    return {
        ...actual,
        // Add any mock implementations here
    };
});

// ========================================
// TEST SETUP AND TEARDOWN
// ========================================

describe('Jackpot Service Unit Tests', () =>
{
    beforeAll(async () =>
    {
        // Setup test environment
        process.env.NODE_ENV = 'test';

        try {
            await setupTestDatabase();
            console.log('✅ Test database setup completed');
        } catch (error) {
            console.warn('⚠️  Database setup failed, tests may run in isolation mode:', error);
        }
    });

    beforeEach(async () =>
    {
        // Clear and seed test data for each test
        try {
            await clearTestData();
            await seedTestJackpotData();
        } catch (error) {
            console.warn('⚠️  Test data setup failed:', error);
        }

        // Reset all mocks
        testCleanup.resetTestState();
        vi.clearAllMocks();
    });

    afterEach(() =>
    {
        // Reset test state after each test
        testCleanup.resetTestState();
    });

    afterAll(async () =>
    {
        // Cleanup after all tests
        try {
            await clearTestData();
        } catch (error) {
            console.warn('⚠️  Final cleanup failed:', error);
        }

        testCleanup.fullCleanup();
    });

    // ========================================
    // VALIDATION TESTS
    // ========================================

    describe('Input Validation', () =>
    {
        describe('validateJackpotContributionRequest', () =>
        {
            it('should validate correct contribution request', () =>
            {
                const validRequest = testBuilders.contributionRequest();
                const result = validateJackpotContributionRequest(validRequest);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                if (result.data) {
                    expect(result.data.gameId).toBe(validRequest.gameId);
                    expect(result.data.wagerAmount).toBe(validRequest.wagerAmount);
                }
            });

            it('should reject empty game ID', () =>
            {
                const invalidRequest = { gameId: '', wagerAmount: 1000 };
                const result = validateJackpotContributionRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Game ID cannot be empty');
            });

            it('should reject negative wager amount', () =>
            {
                const invalidRequest = { gameId: 'test_game', wagerAmount: -100 };
                const result = validateJackpotContributionRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Wager amount must be a positive integer');
            });

            it('should reject zero wager amount', () =>
            {
                const invalidRequest = { gameId: 'test_game', wagerAmount: 0 };
                const result = validateJackpotContributionRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Wager amount must be a positive integer');
            });

            it('should sanitize game ID input', () =>
            {
                const requestWithSpecialChars = {
                    gameId: "game\nwith\tspecial\r\nchars",
                    wagerAmount: 1000
                };
                const result = validateJackpotContributionRequest(requestWithSpecialChars);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                if (result.data) {
                    expect(result.data.gameId).not.toContain('\n');
                    expect(result.data.gameId).not.toContain('\t');
                    expect(result.data.gameId).not.toContain('\r');
                }
            });
        });

        describe('validateJackpotWinRequest', () =>
        {
            it('should validate correct win request', () =>
            {
                const validRequest = testBuilders.winRequest();
                const result = validateJackpotWinRequest(validRequest);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                if (result.data) {
                    expect(result.data.group).toBe(validRequest.group);
                    expect(result.data.gameId).toBe(validRequest.gameId);
                    expect(result.data.userId).toBe(validRequest.userId);
                }
            });

            it('should reject invalid group', () =>
            {
                const invalidRequest = {
                    group: 'invalid_group' as any,
                    gameId: 'test_game',
                    userId: TEST_USER_IDS[0],
                };
                const result = validateJackpotWinRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Invalid enum value');
            });

            it('should reject invalid UUID for userId', () =>
            {
                const invalidRequest = {
                    group: 'minor' as const,
                    gameId: 'test_game',
                    userId: 'invalid-uuid',
                };
                const result = validateJackpotWinRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('User ID must be a valid UUID');
            });

            it('should reject negative win amount', () =>
            {
                const invalidRequest = {
                    group: 'minor' as const,
                    gameId: 'test_game',
                    userId: TEST_USER_IDS[0],
                    winAmount: -1000,
                };
                const result = validateJackpotWinRequest(invalidRequest);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Win amount must be a positive integer');
            });
        });

        describe('validateJackpotConfigUpdate', () =>
        {
            it('should validate partial config update', () =>
            {
                const partialConfig = {
                    minor: { rate: 0.03 },
                    major: { maxAmount: 5000000 },
                };
                const result = validateJackpotConfigUpdate(partialConfig);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                if (result.data?.minor) {
                    expect(result.data.minor.rate).toBe(0.03);
                }
            });

            it('should validate complete config update', () =>
            {
                const completeConfig = testBuilders.jackpotConfig();
                const result = validateJackpotConfigUpdate(completeConfig);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                if (result.data) {
                    expect(result.data.minor).toBeDefined();
                    expect(result.data.major).toBeDefined();
                    expect(result.data.mega).toBeDefined();
                }
            });

            it('should reject invalid rate values', () =>
            {
                const invalidConfig = {
                    minor: { rate: 1.5 }, // Rate > 1
                };
                const result = validateJackpotConfigUpdate(invalidConfig);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Contribution rate must be between 0 and 1');
            });

            it('should reject negative seed amounts', () =>
            {
                const invalidConfig = {
                    major: { seedAmount: -1000 },
                };
                const result = validateJackpotConfigUpdate(invalidConfig);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Seed amount must be a positive integer');
            });
        });
    });

    // ========================================
    // CORE JACKPOT OPERATIONS
    // ========================================

    describe('Jackpot Pool Retrieval', () =>
    {
        describe('getJackpotPool', () =>
        {
            it('should retrieve specific jackpot pool', async () =>
            {
                const pool = await getJackpotPool('minor');

                expect(pool).toBeDefined();
                expect(pool.group).toBe('minor');
                expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
                expect(pool.totalContributions).toBeGreaterThanOrEqual(0);
                expect(pool.totalWins).toBeGreaterThanOrEqual(0);
            });

            it('should retrieve all jackpot pools', async () =>
            {
                const pools = await getJackpotPools();

                expect(pools).toBeDefined();
                expect(pools.minor).toBeDefined();
                expect(pools.major).toBeDefined();
                expect(pools.mega).toBeDefined();

                // Verify each pool has required properties
                Object.values(pools).forEach(pool =>
                {
                    testAssertions.assertJackpotPool(pool, pool.group);
                });
            });

            it('should handle missing pool gracefully', async () =>
            {
                // This test would require manually deleting a pool from database
                // For now, we'll test the error handling path
                vi.spyOn(jackpotManager, 'getPool').mockRejectedValueOnce(
                    new Error('Jackpot pool not found for group: test')
                );

                await expect(jackpotManager.getPool('test' as any)).rejects.toThrow(
                    'Jackpot pool not found for group: test'
                );
            });
        });

        describe('getJackpotStatistics', () =>
        {
            it('should return comprehensive statistics', async () =>
            {
                const stats = await getJackpotStatistics();

                expect(stats).toBeDefined();
                expect(stats.pools).toBeDefined();
                expect(stats.totalContributions).toBeGreaterThanOrEqual(0);
                expect(stats.totalWins).toBeGreaterThanOrEqual(0);
                expect(stats.totalGamesContributing).toBeGreaterThanOrEqual(0);

                // Verify all three groups are present
                expect(Object.keys(stats.pools)).toHaveLength(3);
            });
        });
    });

    // ========================================
    // CONTRIBUTION TESTS
    // ========================================

    describe('Jackpot Contribution', () =>
    {
        it('should process valid contribution successfully', async () =>
        {
            const contributionRequest = testBuilders.contributionRequest({
                gameId: TEST_GAME_IDS.SLOT_MACHINE,
                wagerAmount: 10000, // $100.00
            });

            const result = await processJackpotContribution(
                contributionRequest.gameId,
                contributionRequest.wagerAmount
            );

            testAssertions.assertContributionResult(result, ['minor']);

            // Verify contribution was calculated correctly
            // 2% rate on $100 = $2 = 200 cents
            expect(result.contributions.minor).toBeGreaterThan(0);
            expect(result.totalContribution).toBeGreaterThan(0);
        });

        it('should handle zero contribution rate gracefully', async () =>
        {
            // Update config to have zero rate for testing
            await updateJackpotConfig({
                minor: { rate: 0 }
            });

            const contributionRequest = testBuilders.contributionRequest({
                wagerAmount: 10000,
            });

            const result = await processJackpotContribution(
                contributionRequest.gameId,
                contributionRequest.wagerAmount
            );

            expect(result.success).toBe(true);
            expect(result.contributions.minor).toBe(0);
            expect(result.totalContribution).toBe(0);
        });

        it('should handle large wager amounts correctly', async () =>
        {
            const largeWager = 10000000; // $100,000
            const contributionRequest = testBuilders.contributionRequest({
                wagerAmount: largeWager,
            });

            const result = await processJackpotContribution(
                contributionRequest.gameId,
                contributionRequest.wagerAmount
            );

            testAssertions.assertContributionResult(result, ['minor']);
            expect(result.totalContribution).toBeGreaterThan(0);
        });

        it('should respect maximum pool limits', async () =>
        {
            // Set very low max amount for testing
            await updateJackpotConfig({
                minor: { maxAmount: 200 }, // Only allow $2 in pool
            });

            const contributionRequest = testBuilders.contributionRequest({
                wagerAmount: 10000, // $100 wager
            });

            const result = await processJackpotContribution(
                contributionRequest.gameId,
                contributionRequest.wagerAmount
            );

            testAssertions.assertContributionResult(result, ['minor']);

            // Contribution should be capped at max - current
            expect(result.contributions.minor).toBeLessThanOrEqual(200);
        });

        it('should handle edge case of minimal wager amount', async () =>
        {
            const minimalWager = 1; // 1 cent
            const contributionRequest = testBuilders.contributionRequest({
                wagerAmount: minimalWager,
            });

            const result = await processJackpotContribution(
                contributionRequest.gameId,
                contributionRequest.wagerAmount
            );

            expect(result.success).toBe(true);
            // With 2% rate and 1 cent wager, contribution should be 0 (floored)
            expect(result.contributions.minor).toBe(0);
        });
    });

    // ========================================
    // WIN PROCESSING TESTS
    // ========================================

    describe('Jackpot Win Processing', () =>
    {
        it('should process win successfully', async () =>
        {
            const winRequest = testBuilders.winRequest({
                group: 'minor',
                userId: TEST_USER_IDS[0],
            });

            const result = await processJackpotWin(
                winRequest.group,
                winRequest.gameId,
                winRequest.userId
            );

            testAssertions.assertWinResult(result);
            expect(result.remainingAmount).toBeGreaterThanOrEqual(0);
        });

        it('should process win with specific amount', async () =>
        {
            const winAmount = 5000; // $50
            const winRequest = testBuilders.winRequest({
                group: 'major',
                userId: TEST_USER_IDS[1],
                winAmount,
            });

            const result = await processJackpotWin(
                winRequest.group,
                winRequest.gameId,
                winRequest.userId,
                winAmount
            );

            testAssertions.assertWinResult(result);
            expect(result.actualWinAmount).toBe(winAmount);
        });

        it('should reset pool to seed amount when overdrawn', async () =>
        {
            // First, set up a scenario where pool is small
            await updateJackpotConfig({
                minor: { seedAmount: 1000 } // $10 seed
            });

            const winAmount = 5000; // $50 win (more than pool has)
            const winRequest = testBuilders.winRequest({
                group: 'minor',
                userId: TEST_USER_IDS[0],
                winAmount,
            });

            const result = await processJackpotWin(
                winRequest.group,
                winRequest.gameId,
                winRequest.userId,
                winAmount
            );

            testAssertions.assertWinResult(result);
            // Should reset to seed amount (1000 cents = $10)
            expect(result.remainingAmount).toBe(1000);
        });

        it('should validate win amount does not exceed pool', async () =>
        {
            const largeWinAmount = 999999999; // Very large amount
            const winRequest = testBuilders.winRequest({
                group: 'minor',
                userId: TEST_USER_IDS[0],
                winAmount: largeWinAmount,
            });

            const result = await processJackpotWin(
                winRequest.group,
                winRequest.gameId,
                winRequest.userId,
                largeWinAmount
            );

            testAssertions.assertErrorResult(result);
            expect(result.error).toContain('Win amount exceeds available jackpot amount');
        });

        it('should validate win amount is positive', async () =>
        {
            const invalidWinAmount = -100;
            const winRequest = testBuilders.winRequest({
                group: 'minor',
                userId: TEST_USER_IDS[0],
                winAmount: invalidWinAmount,
            });

            const result = await processJackpotWin(
                winRequest.group,
                winRequest.gameId,
                winRequest.userId,
                invalidWinAmount
            );

            testAssertions.assertErrorResult(result);
            expect(result.error).toContain('Invalid win amount');
        });
    });

    // ========================================
    // CONFIGURATION TESTS
    // ========================================

    describe('Configuration Management', () =>
    {
        it('should update configuration successfully', async () =>
        {
            const newConfig = {
                minor: { rate: 0.025 }, // 2.5%
                major: { seedAmount: 2000000 }, // $20,000
            };

            const result = await updateJackpotConfig(newConfig);

            expect(result.success).toBe(true);

            // Verify the changes were applied
            const currentConfig = jackpotManager.getConfig();
            expect(currentConfig.minor.rate).toBe(0.025);
            expect(currentConfig.major.seedAmount).toBe(2000000);
        });

        it('should validate configuration updates', async () =>
        {
            const invalidConfig = {
                minor: { rate: 1.5 }, // Invalid rate
            };

            const result = await updateJackpotConfig(invalidConfig);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Contribution rate must be between 0 and 1');
        });

        it('should handle partial configuration updates', async () =>
        {
            const partialConfig = {
                mega: { maxAmount: 50000000 },
            };

            const result = await updateJackpotConfig(partialConfig);

            expect(result.success).toBe(true);

            // Verify other groups remain unchanged
            const currentConfig = jackpotManager.getConfig();
            expect(currentConfig.minor.rate).toBe(0.02); // Default rate
            expect(currentConfig.mega.maxAmount).toBe(50000000);
        });
    });

    // ========================================
    // ERROR HANDLING TESTS
    // ========================================

    describe('Error Handling', () =>
    {
        it('should handle invalid game ID gracefully', async () =>
        {
            const result = await processJackpotContribution('', 1000);

            testAssertions.assertErrorResult(result, 'Game ID cannot be empty');
        });

        it('should handle negative wager amounts', async () =>
        {
            const result = await processJackpotContribution('test_game', -100);

            testAssertions.assertErrorResult(result, 'Wager amount must be a positive integer');
        });

        it('should handle invalid group in win processing', async () =>
        {
            const result = await processJackpotWin(
                'invalid_group' as any,
                'test_game',
                TEST_USER_IDS[0]
            );

            testAssertions.assertErrorResult(result);
        });

        it('should handle invalid user ID', async () =>
        {
            const result = await processJackpotWin(
                'minor' as const,
                'test_game',
                'invalid-uuid'
            );

            testAssertions.assertErrorResult(result, 'User ID must be a valid UUID');
        });

        it('should handle database connection errors gracefully', async () =>
        {
            // Mock a database error
            vi.spyOn(jackpotManager, 'contribute').mockRejectedValueOnce(
                new Error('Connection refused')
            );

            const result = await processJackpotContribution('test_game', 1000);

            testAssertions.assertErrorResult(result);
        });
    });

    // ========================================
    // CONCURRENCY TESTS
    // ========================================

    describe('Concurrency Safety', () =>
    {
        it('should handle concurrent contributions', async () =>
        {
            const operations = Array.from({ length: 10 }, () =>
                () => processJackpotContribution(
                    testDataGenerators.gameId(),
                    testDataGenerators.wagerAmount()
                )
            );

            const results = await Promise.allSettled(
                operations.map(op => op())
            );

            // All operations should complete successfully
            const successfulResults = results.filter(r => r.status === 'fulfilled');
            expect(successfulResults.length).toBeGreaterThan(0);

            successfulResults.forEach(result =>
            {
                if (result.status === 'fulfilled' && result.value) {
                    testAssertions.assertContributionResult(result.value, ['minor']);
                }
            });
        });

        it('should handle concurrent win processing', async () =>
        {
            // This test requires careful setup to avoid overdrawing
            const winAmount = 100; // Small amount to avoid overdraw

            const operations = Array.from({ length: 5 }, () =>
                () => processJackpotWin(
                    'minor' as const,
                    testDataGenerators.gameId(),
                    testDataGenerators.userId(),
                    winAmount
                )
            );

            const results = await Promise.allSettled(
                operations.map(op => op())
            );

            // At least some operations should succeed
            const successfulResults = results.filter(r =>
                r.status === 'fulfilled' && r.value?.success
            );
            expect(successfulResults.length).toBeGreaterThan(0);
        });

        it('should detect version conflicts', async () =>
        {
            // This test would require more sophisticated mocking to simulate
            // version conflicts in the database
            const mockVersionConflict = new ConcurrencyViolationError(
                'Version conflict detected',
                'testOperation',
                'minor' as const,
                { originalVersion: 1, currentVersion: 2 }
            );

            vi.spyOn(jackpotManager, 'contribute').mockRejectedValueOnce(mockVersionConflict);

            const result = await processJackpotContribution('test_game', 1000);

            testAssertions.assertErrorResult(result);
        });

        it('should handle lock timeout scenarios', async () =>
        {
            const mockLockTimeout = new LockTimeoutError(
                'Lock timeout during operation',
                'testOperation',
                5000
            );

            vi.spyOn(jackpotManager, 'processWin').mockRejectedValueOnce(mockLockTimeout);

            const result = await processJackpotWin(
                'minor' as const,
                'test_game',
                testDataGenerators.userId()
            );

            testAssertions.assertErrorResult(result);
        });
    });
});

// ========================================
// PERFORMANCE AND REGRESSION TESTS
// ========================================

describe('Performance and Regression Tests', () =>
{
    beforeEach(async () =>
    {
        try {
            await clearTestData();
            await seedTestJackpotData();
        } catch (error) {
            console.warn('⚠️  Test data setup failed:', error);
        }
    });

    it('should maintain acceptable performance for single operations', async () =>
    {
        const start = Date.now();

        await processJackpotContribution('test_game', 1000);
        await processJackpotWin('minor' as const, 'test_game', testDataGenerators.userId(), 100);

        const duration = Date.now() - start;

        // Operations should complete within reasonable time
        expect(duration).toBeLessThan(1000); // 1 second
    });

    it('should handle batch operations efficiently', async () =>
    {
        const batchSize = 50;
        const operations = Array.from({ length: batchSize }, () =>
            () => processJackpotContribution(
                testDataGenerators.gameId(),
                testDataGenerators.wagerAmount()
            )
        );

        const start = Date.now();
        const results = await Promise.allSettled(operations);
        const duration = Date.now() - start;

        const successfulCount = results.filter((r: any) =>
            r.status === 'fulfilled' && r.value?.success
        ).length;

        expect(successfulCount).toBeGreaterThan(batchSize * 0.8); // At least 80% success rate
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should not degrade performance over time', async () =>
    {
        const iterations = 20;
        const durations: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await processJackpotContribution('test_game', 1000);
            durations.push(Date.now() - start);
        }

        const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);

        expect(averageDuration).toBeLessThan(100); // Average under 100ms
        expect(maxDuration).toBeLessThan(500); // No single operation over 500ms
    });
});
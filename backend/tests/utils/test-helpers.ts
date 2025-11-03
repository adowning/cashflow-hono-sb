/**
 * Test Helpers and Utilities
 * Shared utilities for jackpot testing
 */

import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, expect, vi } from 'vitest';

// Mock console methods for testing
export const mockConsole = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
};

// Setup mock console
beforeEach(() =>
{
    vi.spyOn(console, 'log').mockImplementation(mockConsole.log);
    vi.spyOn(console, 'warn').mockImplementation(mockConsole.warn);
    vi.spyOn(console, 'error').mockImplementation(mockConsole.error);
    vi.spyOn(console, 'info').mockImplementation(mockConsole.info);
});

afterEach(() =>
{
    vi.restoreAllMocks();
});

/**
 * Generate random test data
 */
export const testDataGenerators = {
    /**
     * Generate random game ID
     */
    gameId: (): string => `game_${faker.string.alphanumeric(8)}`,

    /**
     * Generate random user ID (UUID format)
     */
    userId: (): string => uuidv4(),

    /**
     * Generate random wager amount (in cents)
     */
    wagerAmount: (min: number = 100, max: number = 100000): number =>
        faker.number.int({ min, max }),

    /**
     * Generate random jackpot group
     */
    jackpotGroup: (): 'minor' | 'major' | 'mega' =>
        faker.helpers.arrayElement(['minor', 'major', 'mega']),

    /**
     * Generate random transaction ID
     */
    transactionId: (): string => `tx_${Date.now()}_${faker.string.alphanumeric(8)}`,

    /**
     * Generate random operator ID
     */
    operatorId: (): string => `op_${faker.string.alphanumeric(6)}`,

    /**
     * Generate random win amount
     */
    winAmount: (max: number = 1000000): number =>
        faker.number.int({ min: 100, max }),
};

/**
 * Test assertion helpers
 */
export const testAssertions = {
    /**
     * Assert jackpot contribution result
     */
    assertContributionResult: (result: any, expectedGroups: string[]) =>
    {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.contributions).toBeDefined();
        expect(result.totalContribution).toBeGreaterThanOrEqual(0);

        expectedGroups.forEach(group =>
        {
            expect(result.contributions[group]).toBeGreaterThanOrEqual(0);
        });
    },

    /**
     * Assert jackpot win result
     */
    assertWinResult: (result: any) =>
    {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.actualWinAmount).toBeGreaterThan(0);
    },

    /**
     * Assert jackpot pool data
     */
    assertJackpotPool: (pool: any, group: string) =>
    {
        expect(pool).toBeDefined();
        expect(pool.group).toBe(group);
        expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
        expect(pool.totalContributions).toBeGreaterThanOrEqual(0);
        expect(pool.totalWins).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(pool.winHistory)).toBe(true);
        expect(Array.isArray(pool.contributionHistory)).toBe(true);
    },

    /**
     * Assert error result
     */
    assertErrorResult: (result: any, expectedError?: string) =>
    {
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        if (expectedError) {
            expect(result.error).toContain(expectedError);
        }
    },
};

/**
 * Test data builders
 */
export const testBuilders = {
    /**
     * Build jackpot contribution request
     */
    contributionRequest: (overrides: Partial<{
        gameId: string;
        wagerAmount: number;
    }> = {}) => ({
        gameId: overrides.gameId || testDataGenerators.gameId(),
        wagerAmount: overrides.wagerAmount || testDataGenerators.wagerAmount(),
    }),

    /**
     * Build jackpot win request
     */
    winRequest: (overrides: Partial<{
        group: 'minor' | 'major' | 'mega';
        gameId: string;
        userId: string;
        winAmount?: number;
    }> = {}) => ({
        group: overrides.group || testDataGenerators.jackpotGroup(),
        gameId: overrides.gameId || testDataGenerators.gameId(),
        userId: overrides.userId || testDataGenerators.userId(),
        winAmount: overrides.winAmount,
    }),

    /**
     * Build jackpot configuration
     */
    jackpotConfig: (overrides: Partial<{
        minor: { rate?: number; seedAmount?: number; maxAmount?: number };
        major: { rate?: number; seedAmount?: number; maxAmount?: number };
        mega: { rate?: number; seedAmount?: number; maxAmount?: number };
    }> = {}) => ({
        minor: {
            rate: 0.02,
            seedAmount: 100000,
            maxAmount: 1000000,
            ...overrides.minor,
        },
        major: {
            rate: 0.01,
            seedAmount: 1000000,
            maxAmount: 10000000,
            ...overrides.major,
        },
        mega: {
            rate: 0.005,
            seedAmount: 10000000,
            maxAmount: 100000000,
            ...overrides.mega,
        },
    }),
};

/**
 * Test environment setup helpers
 */
export const testEnvironment = {
    /**
     * Setup test environment variables
     */
    setupEnv: () =>
    {
        process.env.NODE_ENV = 'test';
        process.env.TEST_DB_HOST = 'localhost';
        process.env.TEST_DB_PORT = '5433';
        process.env.TEST_DB_NAME = 'jackpot_test_db';
        process.env.TEST_DB_USER = 'postgres';
        process.env.TEST_DB_PASSWORD = 'postgres';
    },

    /**
     * Cleanup test environment variables
     */
    cleanupEnv: () =>
    {
        delete process.env.TEST_DB_HOST;
        delete process.env.TEST_DB_PORT;
        delete process.env.TEST_DB_NAME;
        delete process.env.TEST_DB_USER;
        delete process.env.TEST_DB_PASSWORD;
    },
};

/**
 * Concurrency test utilities
 */
export const concurrencyTestUtils = {
    /**
     * Run operations concurrently and collect results
     */
    runConcurrently: async <T>(
        operation: () => Promise<T>,
        count: number,
        delayMs: number = 0
    ): Promise<(T | Error)[]> =>
    {
        const promises = Array.from({ length: count }, (_, i) =>
            new Promise<T | Error>((resolve) =>
            {
                setTimeout(() =>
                {
                    operation()
                        .then(resolve)
                        .catch((error: Error) => resolve(error));
                }, i * delayMs);
            })
        );

        return Promise.all(promises);
    },

    /**
     * Create a slow operation for concurrency testing
     */
    createSlowOperation: <T>(
        operation: () => Promise<T>,
        delayMs: number = 100
    ): (() => Promise<T>) =>
    {
        return async () =>
        {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return operation();
        };
    },
};

/**
 * Performance test utilities
 */
export const performanceTestUtils = {
    /**
     * Measure operation execution time
     */
    measureExecutionTime: async <T>(
        operation: () => Promise<T>
    ): Promise<{ result: T; duration: number }> =>
    {
        const start = Date.now();
        const result = await operation();
        const duration = Date.now() - start;
        return { result, duration };
    },

    /**
     * Benchmark operation multiple times
     */
    benchmark: async <T>(
        operation: () => Promise<T>,
        iterations: number = 10
    ): Promise<{
        results: number[];
        average: number;
        min: number;
        max: number;
    }> =>
    {
        const results: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const { duration } = await performanceTestUtils.measureExecutionTime(operation);
            results.push(duration);
        }

        return {
            results,
            average: results.reduce((sum, time) => sum + time, 0) / results.length,
            min: Math.min(...results),
            max: Math.max(...results),
        };
    },
};

/**
 * Error simulation helpers
 */
export const errorSimulation = {
    /**
     * Simulate database connection error
     */
    simulateConnectionError: () =>
    {
        const error = new Error('Connection refused');
        (error as any).code = 'ECONNREFUSED';
        return error;
    },

    /**
     * Simulate timeout error
     */
    simulateTimeoutError: () =>
    {
        const error = new Error('Operation timeout');
        (error as any).code = 'ETIMEDOUT';
        return error;
    },

    /**
     * Simulate constraint violation error
     */
    simulateConstraintViolation: () =>
    {
        const error = new Error('Constraint violation');
        (error as any).code = '23505';
        return error;
    },
};

/**
 * Cleanup utilities
 */
export const testCleanup = {
    /**
     * Clear all test data and mocks
     */
    fullCleanup: () =>
    {
        vi.clearAllMocks();
        testEnvironment.cleanupEnv();
    },

    /**
     * Reset test state
     */
    resetTestState: () =>
    {
        mockConsole.log.mockClear();
        mockConsole.warn.mockClear();
        mockConsole.error.mockClear();
        mockConsole.info.mockClear();
    },
};

export default {
    mockConsole,
    testDataGenerators,
    testAssertions,
    testBuilders,
    testEnvironment,
    concurrencyTestUtils,
    performanceTestUtils,
    errorSimulation,
    testCleanup,
};
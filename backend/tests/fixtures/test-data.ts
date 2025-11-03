/**
 * Test Data Fixtures
 * Predefined test data for jackpot testing
 */

import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

// ========================================
// BASE TEST DATA
// ========================================

/**
 * Default test jackpot configuration
 */
export const DEFAULT_JACKPOT_CONFIG = {
    minor: {
        rate: 0.02,
        seedAmount: 100000,
        maxAmount: 1000000,
    },
    major: {
        rate: 0.01,
        seedAmount: 1000000,
        maxAmount: 10000000,
    },
    mega: {
        rate: 0.005,
        seedAmount: 10000000,
        maxAmount: 100000000,
    },
} as const;

/**
 * Predefined test game IDs
 */
export const TEST_GAME_IDS = {
    SLOT_MACHINE: 'game_slot_machine_001',
    POKER: 'game_poker_001',
    BLACKJACK: 'game_blackjack_001',
    ROULETTE: 'game_roulette_001',
    BACCARAT: 'game_baccarat_001',
} as const;

/**
 * Predefined test user IDs
 */
export const TEST_USER_IDS = [
    uuidv4(),
    uuidv4(),
    uuidv4(),
    uuidv4(),
    uuidv4(),
] as const;

/**
 * Test jackpot pool data
 */
export const TEST_JACKPOT_POOLS = {
    minor: {
        id: uuidv4(),
        group: 'minor' as const,
        currentAmount: 100000,
        seedAmount: 100000,
        maxAmount: 1000000,
        contributionRate: 0.02,
        totalContributions: 50000,
        totalWins: 25000,
        lastWonAmount: 15000,
        lastWonAt: new Date('2024-01-15T10:30:00Z'),
        lastWonByUserId: TEST_USER_IDS[0],
        winHistory: [],
        contributionHistory: [],
        version: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
    },
    major: {
        id: uuidv4(),
        group: 'major' as const,
        currentAmount: 1000000,
        seedAmount: 1000000,
        maxAmount: 10000000,
        contributionRate: 0.01,
        totalContributions: 500000,
        totalWins: 250000,
        lastWonAmount: 150000,
        lastWonAt: new Date('2024-01-10T14:20:00Z'),
        lastWonByUserId: TEST_USER_IDS[1],
        winHistory: [],
        contributionHistory: [],
        version: 2,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-10T14:20:00Z'),
    },
    mega: {
        id: uuidv4(),
        group: 'mega' as const,
        currentAmount: 10000000,
        seedAmount: 10000000,
        maxAmount: 100000000,
        contributionRate: 0.005,
        totalContributions: 5000000,
        totalWins: 2500000,
        lastWonAmount: 1500000,
        lastWonAt: new Date('2024-01-05T08:15:00Z'),
        lastWonByUserId: TEST_USER_IDS[2],
        winHistory: [],
        contributionHistory: [],
        version: 3,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-05T08:15:00Z'),
    },
} as const;

// ========================================
// DYNAMIC TEST DATA GENERATORS
// ========================================

/**
 * Generate dynamic test jackpot pools with realistic data
 */
export function generateTestJackpotPool(
    group: 'minor' | 'major' | 'mega',
    overrides: Partial<typeof TEST_JACKPOT_POOLS.minor> = {}
)
{
    const basePool = TEST_JACKPOT_POOLS[group];

    return {
        ...basePool,
        ...overrides,
        id: overrides.id || uuidv4(),
        currentAmount: overrides.currentAmount ?? faker.number.int({ min: basePool.seedAmount, max: basePool.maxAmount }),
        lastWonAt: overrides.lastWonAt || faker.date.recent({ days: 30 }),
        lastWonByUserId: overrides.lastWonByUserId || faker.helpers.arrayElement(TEST_USER_IDS),
        version: overrides.version || faker.number.int({ min: 1, max: 10 }),
    };
}

/**
 * Generate test contribution records
 */
export function generateTestContribution(
    overrides: Partial<{
        wagerAmount: number;
        contributionAmount: number;
        betTransactionId: string;
        jackpotId: string;
        operatorId: string;
    }> = {}
)
{
    return {
        wagerAmount: overrides.wagerAmount || faker.number.int({ min: 100, max: 10000 }),
        contributionAmount: overrides.contributionAmount || faker.number.int({ min: 1, max: 200 }),
        winAmount: 0,
        betTransactionId: overrides.betTransactionId || `bet_${faker.string.alphanumeric(12)}`,
        jackpotId: overrides.jackpotId || uuidv4(),
        createdAt: faker.date.recent({ days: 7 }),
        operatorId: overrides.operatorId || 'system',
    };
}

/**
 * Generate test win records
 */
export function generateTestWinRecord(
    overrides: Partial<{
        userId: string;
        gameId: string;
        amountWon: number;
        winningSpinTransactionId: string;
        operatorId: string;
    }> = {}
)
{
    return {
        userId: overrides.userId || faker.helpers.arrayElement(TEST_USER_IDS),
        gameId: overrides.gameId || faker.helpers.arrayElement(Object.values(TEST_GAME_IDS)),
        amountWon: overrides.amountWon || faker.number.int({ min: 1000, max: 100000 }),
        winningSpinTransactionId: overrides.winningSpinTransactionId || `win_${faker.string.alphanumeric(12)}`,
        timeStampOfWin: faker.date.recent({ days: 7 }),
        numberOfJackpotWinsForUserBefore: faker.number.int({ min: 0, max: 5 }),
        numberOfJackpotWinsForUserAfter: faker.number.int({ min: 1, max: 10 }),
        operatorId: overrides.operatorId || 'system',
        userCreateDate: faker.date.past({ years: 2 }),
        videoClipLocation: faker.string.alphanumeric(20),
    };
}

/**
 * Generate test contribution history for a pool
 */
export function generateTestContributionHistory(
    count: number = 5,
    jackpotId?: string
): any[]
{
    return Array.from({ length: count }, () =>
        generateTestContribution({ jackpotId })
    );
}

/**
 * Generate test win history for a pool
 */
export function generateTestWinHistory(
    count: number = 3,
    jackpotId?: string
): any[]
{
    return Array.from({ length: count }, () =>
        generateTestWinRecord({})
    );
}

// ========================================
// EDGE CASE TEST DATA
// ========================================

/**
 * Edge case test scenarios
 */
export const EDGE_CASES = {
    // Zero and boundary values
    ZERO_CONTRIBUTION: {
        wagerAmount: 100,
        rate: 0,
        expectedContribution: 0,
    },

    MAX_CONTRIBUTION: {
        wagerAmount: 1000000,
        rate: 0.1,
        expectedContribution: 100000,
    },

    // Very small amounts
    MINIMAL_WAGER: {
        wagerAmount: 1,
        rate: 0.01,
        expectedContribution: 0, // Should floor to 0
    },

    // Maximum pool scenarios
    FULL_POOL: {
        currentAmount: 1000000,
        maxAmount: 1000000,
        contribution: 50000,
        expectedActualContribution: 0, // Pool at max, no contribution
    },

    // Empty pool scenarios
    EMPTY_POOL: {
        currentAmount: 0,
        seedAmount: 100000,
        contribution: 50000,
        expectedNewAmount: 150000, // seed + contribution
    },

    // Win amount exceeding pool
    OVERDRAW_WIN: {
        currentAmount: 10000,
        winAmount: 50000,
        expectedResetToSeed: true,
    },
} as const;

// ========================================
// CONCURRENCY TEST DATA
// ========================================

/**
 * Data for concurrency testing scenarios
 */
export const CONCURRENCY_SCENARIOS = {
    SIMULTANEOUS_CONTRIBUTIONS: {
        operation: 'contribute',
        concurrency: 10,
        delayMs: 10,
        description: 'Multiple contributions to same pool simultaneously',
    },

    CONCURRENT_WINS: {
        operation: 'processWin',
        concurrency: 5,
        delayMs: 50,
        description: 'Multiple wins processed concurrently',
    },

    MIXED_OPERATIONS: {
        operations: ['contribute', 'processWin', 'getPool'],
        concurrency: 15,
        delayMs: 5,
        description: 'Mixed operations with different patterns',
    },
} as const;

// ========================================
// PERFORMANCE TEST DATA
// ========================================

/**
 * Data for performance testing scenarios
 */
export const PERFORMANCE_SCENARIOS = {
    HIGH_VOLUME_CONTRIBUTIONS: {
        operations: 1000,
        delayMs: 1,
        expectedMaxDuration: 5000, // 5 seconds
    },

    BATCH_CONFIGURATION_UPDATES: {
        operations: 100,
        delayMs: 10,
        expectedMaxDuration: 2000, // 2 seconds
    },

    RAPID_WIN_PROCESSING: {
        operations: 500,
        delayMs: 5,
        expectedMaxDuration: 10000, // 10 seconds
    },
} as const;

// ========================================
// ERROR SCENARIO TEST DATA
// ========================================

/**
 * Error scenarios for testing
 */
export const ERROR_SCENARIOS = {
    INVALID_GAME_ID: {
        gameId: '',
        wagerAmount: 1000,
        expectedError: 'Game ID cannot be empty',
    },

    NEGATIVE_WAGER: {
        gameId: 'test_game',
        wagerAmount: -100,
        expectedError: 'Wager amount must be a positive integer',
    },

    INVALID_GROUP: {
        group: 'invalid' as any,
        gameId: 'test_game',
        userId: TEST_USER_IDS[0],
        expectedError: 'Invalid jackpot group',
    },

    INVALID_USER_ID: {
        group: 'minor' as const,
        gameId: 'test_game',
        userId: 'invalid-uuid',
        expectedError: 'User ID must be a valid UUID',
    },
} as const;

// ========================================
// EXPORT ALL TEST DATA
// ========================================

export const testDataFixtures = {
    // Base data
    DEFAULT_JACKPOT_CONFIG,
    TEST_GAME_IDS,
    TEST_USER_IDS,
    TEST_JACKPOT_POOLS,

    // Generators
    generateTestJackpotPool,
    generateTestContribution,
    generateTestWinRecord,
    generateTestContributionHistory,
    generateTestWinHistory,

    // Test scenarios
    EDGE_CASES,
    CONCURRENCY_SCENARIOS,
    PERFORMANCE_SCENARIOS,
    ERROR_SCENARIOS,
} as const;

export default testDataFixtures;
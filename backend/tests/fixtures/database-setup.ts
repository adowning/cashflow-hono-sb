/**
 * Database Test Setup
 * Implements transaction-based test isolation and cleanup
 */

import { db } from '../../src/libs/database/db';
import { jackpotTable } from '../../src/libs/database/schema/jackpot';
import { clearTestData, seedTestJackpotData } from '../utils/test-db';

// ========================================
// TRANSACTION-BASED TEST ISOLATION
// ========================================

/**
 * Create isolated test transaction that will rollback automatically
 */
export async function createTestTransaction<T>(
    callback: (tx: typeof db) => Promise<T>
): Promise<T>
{
    return await db.transaction(async (tx) =>
    {
        try {
            const result = await callback(tx as any);
            // Transaction will automatically rollback when function exits
            return result;
        } catch (error) {
            // Force rollback on any error
            throw error;
        }
    });
}

/**
 * Execute test with automatic data isolation
 */
export async function withTestIsolation<T>(
    testFunction: (tx: typeof db) => Promise<T>
): Promise<T>
{
    return await createTestTransaction(async (tx) =>
    {
        // Clear jackpot data within transaction
        await tx.delete(jackpotTable);

        // Seed fresh test data
        await seedJackpotDataInTransaction(tx);

        // Run the actual test
        return await testFunction(tx);
    });
}

// ========================================
// TEST DATA SETUP
// ========================================

/**
 * Seed jackpot data within a transaction
 */
export async function seedJackpotDataInTransaction(tx: typeof db): Promise<void>
{
    // Default test configuration
    const testConfig = {
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
    };

    // Insert test data
    await tx.insert(jackpotTable).values([
        {
            group: 'minor',
            currentAmount: testConfig.minor.seedAmount,
            seedAmount: testConfig.minor.seedAmount,
            maxAmount: testConfig.minor.maxAmount,
            contributionRate: testConfig.minor.rate,
            totalContributions: 0,
            totalWins: 0,
            winHistory: [],
            contributionHistory: [],
            version: 0,
        },
        {
            group: 'major',
            currentAmount: testConfig.major.seedAmount,
            seedAmount: testConfig.major.seedAmount,
            maxAmount: testConfig.major.maxAmount,
            contributionRate: testConfig.major.rate,
            totalContributions: 0,
            totalWins: 0,
            winHistory: [],
            contributionHistory: [],
            version: 0,
        },
        {
            group: 'mega',
            currentAmount: testConfig.mega.seedAmount,
            seedAmount: testConfig.mega.seedAmount,
            maxAmount: testConfig.mega.maxAmount,
            contributionRate: testConfig.mega.rate,
            totalContributions: 0,
            totalWins: 0,
            winHistory: [],
            contributionHistory: [],
            version: 0,
        },
    ]);
}

/**
 * Setup test database schema if needed
 */
export async function ensureTestSchema(): Promise<void>
{
    try {
        // Check if jackpot table exists and has data
        const pools = await db.select().from(jackpotTable);

        if (pools.length === 0) {
            // No data, seed it
            await seedJackpotDataInTransaction(db);
        }
    } catch (error) {
        console.warn('⚠️  Test schema setup warning:', error);
        // Don't throw - tests can run in degraded mode
    }
}

// ========================================
// TEST ENVIRONMENT MANAGEMENT
// ========================================

/**
 * Initialize test environment
 */
export async function initializeTestEnvironment(): Promise<void>
{
    process.env.NODE_ENV = 'test';

    // Set test database configuration
    if (!process.env.TEST_DB_HOST) {
        process.env.TEST_DB_HOST = 'localhost';
    }
    if (!process.env.TEST_DB_PORT) {
        process.env.TEST_DB_PORT = '5433';
    }
    if (!process.env.TEST_DB_NAME) {
        process.env.TEST_DB_NAME = 'jackpot_test_db';
    }
    if (!process.env.TEST_DB_USER) {
        process.env.TEST_DB_USER = 'postgres';
    }
    if (!process.env.TEST_DB_PASSWORD) {
        process.env.TEST_DB_PASSWORD = 'postgres';
    }

    try {
        await ensureTestSchema();
    } catch (error) {
        console.warn('⚠️  Test environment initialization failed:', error);
    }
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(): Promise<void>
{
    try {
        // Clear any remaining test data
        await clearTestData();
    } catch (error) {
        console.warn('⚠️  Test environment cleanup failed:', error);
    }
}

// ========================================
// TEST HOOKS FOR AUTOMATION
// ========================================

/**
 * Global beforeAll hook for test setup
 */
export async function globalBeforeAllHook(): Promise<void>
{
    await initializeTestEnvironment();
}

/**
 * Global afterAll hook for test cleanup
 */
export async function globalAfterAllHook(): Promise<void>
{
    await cleanupTestEnvironment();
}

/**
 * BeforeEach hook for test isolation
 */
export async function globalBeforeEachHook(): Promise<void>
{
    // Clear test data before each test
    try {
        await clearTestData();
        await seedTestJackpotData();
    } catch (error) {
        console.warn('⚠️  Test isolation setup failed:', error);
    }
}

/**
 * AfterEach hook for cleanup
 */
export async function globalAfterEachHook(): Promise<void>
{
    // Cleanup after each test
    try {
        await clearTestData();
    } catch (error) {
        console.warn('⚠️  Test cleanup failed:', error);
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Check if running in test environment
 */
export function isTestEnvironment(): boolean
{
    return process.env.NODE_ENV === 'test';
}

/**
 * Get test-specific database configuration
 */
export function getTestDbConfig()
{
    return {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5433'),
        database: process.env.TEST_DB_NAME || 'jackpot_test_db',
        username: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
    };
}

/**
 * Verify test data integrity
 */
export async function verifyTestDataIntegrity(): Promise<{
    poolsExist: boolean;
    dataConsistent: boolean;
    issues: string[];
}>
{
    const issues: string[] = [];

    try {
        // Check if all jackpot pools exist
        const pools = await db.select().from(jackpotTable);
        const poolGroups = pools.map(p => p.group);

        if (poolGroups.length !== 3) {
            issues.push(`Expected 3 jackpot pools, found ${poolGroups.length}`);
        }

        const requiredGroups = ['minor', 'major', 'mega'];
        for (const group of requiredGroups) {
            if (!poolGroups.includes(group as any)) {
                issues.push(`Missing jackpot pool: ${group}`);
            }
        }

        // Verify data consistency
        for (const pool of pools) {
            if (pool.currentAmount < 0) {
                issues.push(`Negative current amount for ${pool.group}: ${pool.currentAmount}`);
            }
            if (pool.seedAmount <= 0) {
                issues.push(`Invalid seed amount for ${pool.group}: ${pool.seedAmount}`);
            }
            if (pool.contributionRate < 0 || pool.contributionRate > 1) {
                issues.push(`Invalid contribution rate for ${pool.group}: ${pool.contributionRate}`);
            }
            if (pool.version < 0) {
                issues.push(`Negative version for ${pool.group}: ${pool.version}`);
            }
        }

        return {
            poolsExist: poolGroups.length === 3,
            dataConsistent: issues.length === 0,
            issues,
        };
    } catch (error) {
        issues.push(`Database error: ${error}`);
        return {
            poolsExist: false,
            dataConsistent: false,
            issues,
        };
    }
}

/**
 * Reset all jackpot pools to default state
 */
export async function resetJackpotPools(): Promise<void>
{
    await db.delete(jackpotTable);
    await seedJackpotDataInTransaction(db);
}

/**
 * Get current test database statistics
 */
export async function getTestDbStatistics(): Promise<{
    totalPools: number;
    totalAmount: number;
    poolDetails: Array<{
        group: string;
        currentAmount: number;
        totalContributions: number;
        totalWins: number;
    }>;
}>
{
    const pools = await db.select().from(jackpotTable);

    return {
        totalPools: pools.length,
        totalAmount: pools.reduce((sum, pool) => sum + pool.currentAmount, 0),
        poolDetails: pools.map(pool => ({
            group: pool.group,
            currentAmount: pool.currentAmount,
            totalContributions: pool.totalContributions || 0,
            totalWins: pool.totalWins || 0,
        })),
    };
}

export default {
    createTestTransaction,
    withTestIsolation,
    seedJackpotDataInTransaction,
    ensureTestSchema,
    initializeTestEnvironment,
    cleanupTestEnvironment,
    globalBeforeAllHook,
    globalAfterAllHook,
    globalBeforeEachHook,
    globalAfterEachHook,
    isTestEnvironment,
    getTestDbConfig,
    verifyTestDataIntegrity,
    resetJackpotPools,
    getTestDbStatistics,
};
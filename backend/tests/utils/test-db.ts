/**
 * Test Database Utilities
 * Provides isolated test database setup and cleanup for jackpot testing
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Test database configuration
export const TEST_DB_CONFIG = {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    database: process.env.TEST_DB_NAME || 'jackpot_test_db',
    username: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
};

// Connection string for test database
export const TEST_DATABASE_URL = `postgresql://${TEST_DB_CONFIG.username}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_CONFIG.database}`;

export interface TestDatabase
{
    client: ReturnType<typeof postgres>;
    db: ReturnType<typeof drizzle>;
}

/**
 * Create isolated test database connection
 */
export function createTestDatabase(): TestDatabase
{
    const client = postgres(TEST_DATABASE_URL, {
        max: 1, // Single connection for test isolation
        ssl: false,
    });

    const db = drizzle(client, { logger: false });

    return { client, db };
}

/**
 * Setup test database with migrations and initial data
 */
export async function setupTestDatabase(): Promise<void>
{
    const { client, db } = createTestDatabase();

    try {
        // Apply migrations
        await migrate(db, { migrationsFolder: './drizzle' });

        // Clear existing data
        await clearTestData();

        console.log('✅ Test database setup completed');
    } catch (error) {
        console.error('❌ Test database setup failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

/**
 * Clean all test data from database
 */
export async function clearTestData(): Promise<void>
{
    const { client } = createTestDatabase();

    try {
        // Clear all jackpot tables in reverse dependency order
        await client`DELETE FROM jackpots`;

        console.log('✅ Test data cleared');
    } catch (error) {
        console.error('❌ Test data cleanup failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

/**
 * Transaction helper for test isolation
 */
export async function withTestTransaction<T>(
    operation: (tx: any) => Promise<T>
): Promise<T>
{
    const { client, db } = createTestDatabase();

    try {
        return await db.transaction(async (tx) =>
        {
            const result = await operation(tx);
            // Transaction will rollback automatically
            return result;
        });
    } finally {
        await client.end();
    }
}

/**
 * Seed test data for jackpot pools
 */
export async function seedTestJackpotData(): Promise<void>
{
    const { client } = createTestDatabase();

    try {
        await client`
      INSERT INTO jackpots (
        id, group, current_amount, seed_amount, max_amount, 
        contribution_rate, total_contributions, total_wins, 
        win_history, contribution_history, version
      ) VALUES 
      (
        gen_random_uuid(), 'minor', 100000, 100000, 1000000, 
        0.02, 0, 0, 
        '[]'::jsonb, '[]'::jsonb, 0
      ),
      (
        gen_random_uuid(), 'major', 1000000, 1000000, 10000000, 
        0.01, 0, 0, 
        '[]'::jsonb, '[]'::jsonb, 0
      ),
      (
        gen_random_uuid(), 'mega', 10000000, 10000000, 100000000, 
        0.005, 0, 0, 
        '[]'::jsonb, '[]'::jsonb, 0
      )
      ON CONFLICT (group) DO UPDATE SET
        current_amount = EXCLUDED.current_amount,
        seed_amount = EXCLUDED.seed_amount,
        max_amount = EXCLUDED.max_amount,
        contribution_rate = EXCLUDED.contribution_rate,
        total_contributions = 0,
        total_wins = 0,
        win_history = '[]'::jsonb,
        contribution_history = '[]'::jsonb,
        version = 0
    `;

        console.log('✅ Test jackpot data seeded');
    } catch (error) {
        console.error('❌ Test data seeding failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

/**
 * Check if database is accessible
 */
export async function isDatabaseAccessible(): Promise<boolean>
{
    const { client } = createTestDatabase();

    try {
        await client`SELECT 1`;
        return true;
    } catch (error) {
        console.warn('⚠️  Test database not accessible:', error);
        return false;
    } finally {
        await client.end();
    }
}

/**
 * Get test database statistics
 */
export async function getTestDbStats(): Promise<{
    jackpotPools: number;
    totalAmount: number;
}>
{
    const { client } = createTestDatabase();

    try {
        const result = await client`
      SELECT 
        COUNT(*) as pool_count,
        SUM(current_amount) as total_amount
      FROM jackpots
    `;

        return {
            jackpotPools: Number(result[0]?.pool_count || 0),
            totalAmount: Number(result[0]?.total_amount || 0),
        };
    } finally {
        await client.end();
    }
}

/**
 * Test data verification helpers
 */
export const testDataValidators = {
    /**
     * Verify jackpot pool data integrity
     */
    validateJackpotPool: (pool: any) =>
    {
        expect(pool).toBeDefined();
        expect(['minor', 'major', 'mega']).toContain(pool.group);
        expect(pool.currentAmount).toBeGreaterThanOrEqual(0);
        expect(pool.seedAmount).toBeGreaterThan(0);
        expect(pool.contributionRate).toBeGreaterThanOrEqual(0);
        expect(pool.version).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(pool.winHistory)).toBe(true);
        expect(Array.isArray(pool.contributionHistory)).toBe(true);
    },

    /**
     * Verify contribution record structure
     */
    validateContributionRecord: (record: any) =>
    {
        expect(record).toBeDefined();
        expect(record.wagerAmount).toBeGreaterThan(0);
        expect(record.contributionAmount).toBeGreaterThanOrEqual(0);
        expect(record.betTransactionId).toBeDefined();
        expect(record.jackpotId).toBeDefined();
        expect(record.createdAt).toBeInstanceOf(Date);
        expect(record.operatorId).toBeDefined();
    },

    /**
     * Verify win record structure
     */
    validateWinRecord: (record: any) =>
    {
        expect(record).toBeDefined();
        expect(record.userId).toBeDefined();
        expect(record.gameId).toBeDefined();
        expect(record.amountWon).toBeGreaterThan(0);
        expect(record.winningSpinTransactionId).toBeDefined();
        expect(record.timeStampOfWin).toBeInstanceOf(Date);
        expect(record.operatorId).toBeDefined();
    },
};

// Cleanup function for process teardown
export async function cleanupTestDatabase(): Promise<void>
{
    try {
        await clearTestData();
        console.log('✅ Test database cleanup completed');
    } catch (error) {
        console.error('❌ Test database cleanup failed:', error);
        // Don't throw - cleanup failures shouldn't fail tests
    }
}
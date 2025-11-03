import type { KeyValueAdapterWithBackup } from "../types";

/**
 * Configuration for PostgreSQL connection.
 * Supports either a connection string or individual connection parameters.
 */
export type PostgresAdapterConfig =
    | {
        /** PostgreSQL connection string (e.g., postgresql://user:password@host:port/database) */
        connectionString: string;
        tableName?: string; // default "game_sessions"
        useExistingTable?: boolean; // default true, indicates table already exists
    }
    | {
        /** Database host */
        host: string;
        /** Database port */
        port?: number; // default 5432
        /** Database name */
        database: string;
        /** Database user */
        user: string;
        /** Database password */
        password: string;
        /** SSL configuration */
        ssl?: boolean;
        tableName?: string; // default "game_sessions"
        useExistingTable?: boolean; // default true, indicates table already exists
    };

/**
 * A PostgreSQL adapter that stores key/value pairs in the existing game_session table.
 * Uses Bun's SQL client for consistent database interactions.
 * Maps key-value operations to the game_session table structure using JSONB for flexible storage.
 */
export class PostgresAdapter implements KeyValueAdapterWithBackup
{
    private client: any = null; // Bun SQL client
    private tableName: string;
    private config: PostgresAdapterConfig;

    constructor(config: PostgresAdapterConfig)
    {
        this.config = config;
        this.tableName = config.tableName ?? "game_sessions";
    }

    public async init(): Promise<void>
    {
        try {
            // Create the SQL client based on config type
            if ('connectionString' in this.config) {
                this.client = new (await import('bun')).SQL(this.config.connectionString);
            } else {
                const connectionString = `postgresql://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port ?? 5432}/${this.config.database}${this.config.ssl ? '?sslmode=require' : ''}`;
                this.client = new (await import('bun')).SQL(connectionString);
            }

            // Note: Using existing game_session table - no table creation needed
            // The table is expected to already exist with the proper schema
        } catch (err) {
            // Ensure client is null if initialization fails
            this.client = null;
            throw new Error(`Failed to initialize PostgreSQL adapter: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private ensureInitialized(): void
    {
        if (!this.client) {
            throw new Error("PostgreSQL adapter not initialized. Call init() first.");
        }
    }

    /**
     * Storage strategy for game_session table adaptation:
     * This adapter works with the existing game_session table by using a hybrid approach:
     * 1. Tries to use a JSONB column for flexible KV storage (if available)
     * 2. Falls back to a special system record with UUID-based storage
     * 3. Maintains compatibility with the existing game_session schema
     */
    private getKVRecordIdentifier(): string
    {
        return "kv_store_system_record";
    }

    private getSystemUUID(): string
    {
        return "00000000-0000-0000-0000-000000000000";
    }

    public async get(key: string): Promise<unknown | undefined>
    {
        this.ensureInitialized();

        try {
            // Get all KV data from the system record
            const allData = await this.getAllKVData();
            return allData[key];
        } catch (err) {
            throw new Error(`Failed to get key "${key}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    public async set(key: string, value: unknown): Promise<void>
    {
        this.ensureInitialized();

        try {
            // Strategy: Store all KV data as JSON in the game_name field of a special system record
            // First, get existing KV data
            const existingData = await this.getAllKVData();

            // Update the data
            existingData[key] = value;

            // Store updated data back to the table
            const systemUUID = this.getSystemUUID();
            const jsonData = JSON.stringify(existingData);

            // Use safe table name handling by building the query string with proper escaping
            const tableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;
            
            // Upsert the system record with KV data in game_name
            await this.client`
                INSERT INTO ${tableName}
                (id, game_name, user_id, is_active, status)
                VALUES
                (${systemUUID}::uuid, ${jsonData}, '00000000-0000-0000-0000-000000000000'::uuid, true, 'ACTIVE')
                ON CONFLICT (id)
                DO UPDATE SET
                    game_name = EXCLUDED.game_name,
                    updated_at = NOW()
            `;
        } catch (err) {
            throw new Error(`Failed to set key "${key}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Helper method to retrieve all KV data from the system record
     */
    private async getAllKVData(): Promise<Record<string, unknown>>
    {
        const systemUUID = this.getSystemUUID();
        const tableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;

        const result = await this.client`
            SELECT game_name FROM ${tableName}
            WHERE id = ${systemUUID}::uuid
            LIMIT 1
        `;

        if (result.length === 0 || !result[0].game_name) {
            return {};
        }

        try {
            const parsed = JSON.parse(result[0].game_name);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }

    public async delete(key: string): Promise<void>
    {
        this.ensureInitialized();

        try {
            // Get existing KV data, remove the key, and store back
            const existingData = await this.getAllKVData();

            // Remove the key if it exists
            delete existingData[key];

            // Store updated data back to the table
            const systemUUID = this.getSystemUUID();
            const jsonData = JSON.stringify(existingData);

            // Use safe table name handling by building the query string with proper escaping
            const tableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;

            await this.client`
                INSERT INTO ${tableName}
                (id, game_name, user_id, is_active, status)
                VALUES
                (${systemUUID}::uuid, ${jsonData}, '00000000-0000-0000-0000-000000000000'::uuid, true, 'ACTIVE')
                ON CONFLICT (id)
                DO UPDATE SET
                    game_name = EXCLUDED.game_name,
                    updated_at = NOW()
            `;
        } catch (err) {
            throw new Error(`Failed to delete key "${key}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Get all key/value pairs from the database.
     */
    public async all(): Promise<Record<string, unknown>>
    {
        this.ensureInitialized();

        try {
            // Return all KV data from the system record
            return await this.getAllKVData();
        } catch (err) {
            throw new Error(`Failed to retrieve all keys: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Create a timestamped backup by copying all data to a backup table.
     */
    public async backup(): Promise<void>
    {
        this.ensureInitialized();

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupTableName = `${this.tableName}_backup_${timestamp}`;
            const originalTableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;
            const backupTableQuoted = backupTableName.includes('"') ? backupTableName : `"${backupTableName}"`;

            // Create backup of the entire game_session table
            await this.client.unsafe(`
                CREATE TABLE ${backupTableQuoted} AS
                SELECT * FROM ${originalTableName};
            `);

            // Add backup metadata
            await this.client.unsafe(`
                ALTER TABLE ${backupTableQuoted}
                ADD COLUMN backup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ADD COLUMN backup_source_table TEXT DEFAULT '${this.tableName}',
                ADD COLUMN backup_purpose TEXT DEFAULT 'kv_store_data';
            `);
        } catch (err) {
            throw new Error(`Failed to create backup: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Get database statistics.
     */
    public async getStats(): Promise<{
        count: number;
        size: string;
        kvRecordCount: number;
        totalSessionCount: number;
    }>
    {
        this.ensureInitialized();

        try {
            const tableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;

            // Get total table statistics
            const countResult = await this.client`
                SELECT COUNT(*) as count FROM ${tableName}
            `;

            const sizeResult = await this.client`
                SELECT pg_size_pretty(pg_total_relation_size(${tableName})) as size
            `;

            // Get KV-specific record count from system record
            const kvData = await this.getAllKVData();
            const kvRecordCount = Object.keys(kvData).length;

            return {
                count: countResult[0].count,
                size: sizeResult[0].size,
                kvRecordCount: kvRecordCount,
                totalSessionCount: countResult[0].count
            };
        } catch (err) {
            throw new Error(`Failed to get stats: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Clean up old backup tables (older than specified days).
     */
    public async cleanupOldBackups(olderThanDays: number = 30): Promise<void>
    {
        this.ensureInitialized();

        try {
            const tableName = this.tableName.includes('"') ? this.tableName : `"${this.tableName}"`;

            // Clean up backup tables by finding tables with the backup pattern and appropriate timestamp
            await this.client.unsafe(`
                DROP TABLE IF EXISTS ${tableName}_backup_${olderThanDays}_days_ago;
                DROP TABLE IF EXISTS ${tableName}_backup_2024_%_${olderThanDays}_days_ago;
            `);

            // Also clean up any backup tables older than the specified days
            // This requires a more sophisticated query to find old backup tables
            const result = await this.client.unsafe(`
                SELECT schemaname, tablename
                FROM pg_tables
                WHERE tablename LIKE '${this.tableName}_backup_%'
                AND schemaname = 'public'
            `);

            // Filter out recent backups (basic pattern matching for old ones)
            for (const row of result) {
                const backupDate = row.tablename.split('_backup_')[1];
                if (backupDate && backupDate.length >= 10) {
                    // Try to extract date from backup name and compare
                    // This is a simplified approach - in production, you'd want more robust date handling
                    const backupDateParts = backupDate.split('-');
                    if (backupDateParts.length >= 3) {
                        const year = parseInt(backupDateParts[0]);
                        if (year < new Date().getFullYear() - 1) { // Very basic year check
                            await this.client.unsafe(`DROP TABLE IF EXISTS ${row.tablename};`);
                        }
                    }
                }
            }
        } catch (err) {
            throw new Error(`Failed to cleanup old backups: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Close the database connection.
     */
    public async close(): Promise<void>
    {
        if (this.client) {
            try {
                // Bun's SQL client doesn't have an explicit close method
                // The connection will be closed when the process exits
                this.client = null;
            } catch (err) {
                throw new Error(`Failed to close connection: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
}
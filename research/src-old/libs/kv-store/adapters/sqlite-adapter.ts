import { Database } from "bun:sqlite";
import type { KeyValueAdapterWithBackup } from "../types";

export type SqliteAdapterConfig = {
    path: string;
    tableName?: string; // default "key_value_store"
};

/**
 * A simple SQLite adapter that will store key/value pairs in a table.
 * The "backup" method can be customized to create a separate table or
 * dump the DB file, etc.
 */
export class SqliteAdapter implements KeyValueAdapterWithBackup
{
    private db: Database | null = null;
    private tableName: string;

    constructor(private config: SqliteAdapterConfig)
    {
        this.tableName = config.tableName ?? "key_value_store";
        // DO NOT open the DB here to allow proper error handling in init()
    }

    public async init(): Promise<void>
    {
        try {
            // Open the DB in init():
            this.db = new Database(this.config.path);

            // Create table if not exists
            const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `;
            this.db.run(createTableQuery);
        } catch (err) {
            // Ensure db is null if initialization fails
            this.db = null;
            throw err;
        }
    }

    private ensureInitialized(): void
    {
        if (!this.db) {
            throw new Error("SQLite adapter not initialized. Call init() first.");
        }
    }

    public async get(key: string): Promise<unknown | undefined>
    {
        this.ensureInitialized();
        const row = this.db!.query(
            `SELECT value FROM ${this.tableName} WHERE key = ?`
        ).get(key) as { value: string } | null;

        if (!row) return undefined;
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    public async set(key: string, value: unknown): Promise<void>
    {
        this.ensureInitialized();
        const jsonValue = JSON.stringify(value);
        this.db!.run(
            `INSERT INTO ${this.tableName} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
            [key, jsonValue]
        );
    }

    public async delete(key: string): Promise<void>
    {
        this.ensureInitialized();
        this.db!.run(`DELETE FROM ${this.tableName} WHERE key = ?;`, [key]);
    }

    /**
     * Get all key/value pairs from the database.
     */
    public async all(): Promise<Record<string, unknown>>
    {
        this.ensureInitialized();
        const rows = this.db!.query(`SELECT key, value FROM ${this.tableName}`).all() as { key: string; value: string }[];
        const data: Record<string, unknown> = {};

        for (const row of rows) {
            try {
                data[row.key] = JSON.parse(row.value);
            } catch {
                data[row.key] = row.value;
            }
        }
        return data;
    }

    /**
     * Example backup implementation.
     * For a real backup, you might dump the entire DB or copy the file.
     */
    public async backup(): Promise<void>
    {
        this.ensureInitialized();
        // A naive approach: copy the database file with a timestamp
        const timestamp = Date.now();
        const backupFile = `${this.config.path}.${timestamp}.backup`;
        // This uses Bun's file copy:
        await Bun.write(backupFile, await Bun.file(this.config.path).arrayBuffer());
    }
} 
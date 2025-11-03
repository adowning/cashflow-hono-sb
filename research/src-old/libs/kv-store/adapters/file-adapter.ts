import type { KeyValueAdapterWithBackup } from "../types";

export type FileAdapterConfig = {
    filePath: string;
};

/**
 * A minimal file adapter that stores key/value pairs in a JSON file.
 * For better performance, consider using streaming or chunk-based approaches.
 */
export class FileAdapter implements KeyValueAdapterWithBackup
{
    private filePath: string;
    private cache: Record<string, unknown> = {};

    constructor(config: FileAdapterConfig)
    {
        this.filePath = config.filePath;
    }

    public async init(): Promise<void>
    {
        // Load or create file
        try {
            const fileData = await Bun.file(this.filePath).text();
            this.cache = JSON.parse(fileData);
            if (typeof this.cache !== "object" || this.cache === null) {
                this.cache = {};
            }
        } catch {
            // If file doesn't exist or is invalid, create a new file
            this.cache = {};
            await this.writeFile();
        }
    }

    public async get(key: string): Promise<unknown | undefined>
    {
        return this.cache[key];
    }

    public async set(key: string, value: unknown): Promise<void>
    {
        this.cache[key] = value;
        await this.writeFile();
    }

    public async delete(key: string): Promise<void>
    {
        delete this.cache[key];
        await this.writeFile();
    }

    /**
     * Get all key/value pairs from the file.
     */
    public async all(): Promise<Record<string, unknown>>
    {
        return { ...this.cache };
    }

    /**
     * Backup by copying the file to a new file with a timestamp suffix.
     */
    public async backup(): Promise<void>
    {
        await this.writeFile(); // ensure latest is saved
        const timestamp = Date.now();
        const backupFile = `${this.filePath}.${timestamp}.backup`;
        // Simply copy the JSON file
        await Bun.write(backupFile, await Bun.file(this.filePath).arrayBuffer());
    }

    private async writeFile(): Promise<void>
    {
        await Bun.write(this.filePath, JSON.stringify(this.cache, null, 2));
    }
} 
import type {
    KeyValueAdapterWithBackup,
    KeyValueStoreConfig,
    KeyValueStoreHooks,
    ValueValidator
} from "./types";

export class KeyValueStore
{
    private memoryMap: Map<string, unknown> = new Map();
    private adapter?: KeyValueAdapterWithBackup;
    private hooks: KeyValueStoreHooks;
    private version: number;
    private syncInterval?: ReturnType<typeof setInterval>; // used to keep track of setInterval ID

    constructor(config: KeyValueStoreConfig)
    {
        this.adapter = config.adapter;
        this.hooks = config.hooks ?? {};
        this.version = config.enableVersioning ? 0 : -1;

        // If a sync interval is provided, set up a periodic sync
        if (config.syncIntervalMs && this.adapter) {
            this.syncInterval = setInterval(() =>
            {
                void this.sync();
            }, config.syncIntervalMs);
        }
    }

    /**
     * Ensure that the adapter is initialized and load data from it.
     */
    public async init(): Promise<void>
    {
        if (this.adapter) {
            await this.adapter.init();

            // Load data from adapter if it supports the all() method
            if ("all" in this.adapter && typeof this.adapter.all === "function") {
                const loadedData = await this.adapter.all();
                for (const [k, v] of Object.entries(loadedData)) {
                    this.memoryMap.set(k, v);
                }

                // Load version if it exists
                const maybeVersion = loadedData["__version__"];
                if (typeof maybeVersion === "number" && this.version >= 0) {
                    this.version = maybeVersion;
                }
            }
        }
    }

    /**
     * Get a value from in-memory store, optionally validating it with a supplied validator.
     * The validator can be from Zod, ArkType, or any custom function.
     */
    public get<T = unknown>(
        key: string,
        options?: { validator?: ValueValidator<T> }
    ): T | undefined
    {
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }

        const val = this.memoryMap.get(key);

        if (val === undefined) return undefined;
        if (!options?.validator) return val as T;

        // If a validator is provided, run it.
        return options.validator(val);
    }

    /**
     * Set a value in the in-memory store. The value is validated prior to insertion if a validator is provided.
     */
    public set<T = unknown>(
        key: string,
        value: T,
        options?: { validator?: ValueValidator<T> }
    ): T
    {
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }

        // Validate that value can be serialized
        try {
            JSON.stringify(value);
        } catch (err) {
            throw new Error("Value must be JSON serializable");
        }

        let validatedValue: T;

        if (options?.validator) {
            validatedValue = options.validator(value);
        } else {
            validatedValue = value;
        }

        this.memoryMap.set(key, validatedValue);

        // Increment store version if versioning is enabled
        if (this.version >= 0) {
            this.version++;
        }

        // Trigger hook (wrapped in try/catch to prevent errors from bubbling up)
        try {
            void this.hooks.onUpdate?.(key, validatedValue);
        } catch (err) {
            console.error("onUpdate hook failed:", err);
        }

        return validatedValue;
    }

    /**
     * Delete a key from the store in-memory.
     */
    public delete(key: string): void
    {
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }

        if (this.memoryMap.has(key)) {
            this.memoryMap.delete(key);

            // Increment store version if versioning is enabled
            if (this.version >= 0) {
                this.version++;
            }

            // Trigger hook (wrapped in try/catch to prevent errors from bubbling up)
            try {
                void this.hooks.onDelete?.(key);
            } catch (err) {
                console.error("onDelete hook failed:", err);
            }
        }
    }

    /**
     * Force a sync of the in-memory data to the adapter (if present).
     * By default, this tries to write all key/value pairs to the adapter.
     * For better performance with large datasets, you could track "dirty" keys only.
     */
    public async sync(): Promise<void>
    {
        if (!this.adapter) return;

        // Store version if enabled
        if (this.version >= 0) {
            await this.adapter.set("__version__", this.version);
        }

        Array.from(this.memoryMap.entries()).forEach(async ([key, value]) =>
        {
            if (!this.adapter) return;

            if (key !== "__version__") { // Skip internal version key
                await this.adapter.set(key, value);
            }
        });
    }

    /**
     * Create a timestamped backup (if the adapter supports it).
     */
    public async createBackup(): Promise<void>
    {
        if (!this.adapter?.backup) {
            return;
        }

        // If versioning is disabled, version will be -1. For backups, you might still want a stable reference.
        const backupVersion = this.version >= 0 ? this.version : 0;

        await this.adapter.backup();

        try {
            const timestamp = Date.now();
            void this.hooks.onBackup?.(timestamp, backupVersion);
        } catch (err) {
            console.error("onBackup hook failed:", err);
        }
    }

    /**
     * Return the current version of the store. If versioning is disabled, returns -1.
     */
    public getVersion(): number
    {
        return this.version;
    }

    /**
     * Clear the sync interval if it's set. Clean up resources on shutdown.
     */
    public dispose(): void
    {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
} 
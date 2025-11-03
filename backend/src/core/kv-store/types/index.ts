/**
 * A generic validator function type.
 * It accepts an unknown input and returns a strongly typed T.
 * Could be a custom function or something like a Zod parser.
 */
export type ValueValidator<T> = (input: unknown) => T;

/**
 * Configuration for hooks that can be triggered on store operations.
 */
export type KeyValueStoreHooks = {
    /**
     * Called when an entry is updated or created in the store (in memory).
     */
    onUpdate?: <T>(key: string, newValue: T) => void | Promise<void>;

    /**
     * Called when an entry is deleted from the store (in memory).
     */
    onDelete?: (key: string) => void | Promise<void>;

    /**
     * Called whenever a backup is created.
     */
    onBackup?: (timestamp: number, version: number) => void | Promise<void>;
};

/**
 * Represents an optional backup strategy. If an adapter supports backups,
 * this method can be implemented to do timestamped backups.
 */
export type SupportsBackup = {
    backup(): Promise<void>;
};

/**
 * The base adapter interface. Adapters are responsible for syncing
 * data to some external medium (DB, file, etc.).
 */
export type KeyValueAdapter = {
    init(): Promise<void>;
    /**
     * Retrieve a value by key. If it doesn't exist, return undefined.
     */
    get(key: string): Promise<unknown | undefined>;
    /**
     * Store a value under the specified key.
     */
    set(key: string, value: unknown): Promise<void>;
    /**
     * Delete a value associated with the specified key.
     */
    delete(key: string): Promise<void>;
};

/**
 * Combine the base adapter interface and an optional backup capability.
 */
export type KeyValueAdapterWithBackup = KeyValueAdapter & Partial<SupportsBackup>;

/**
 * Configuration for the KeyValueStore class.
 */
export type KeyValueStoreConfig = {
    adapter?: KeyValueAdapterWithBackup;
    hooks?: KeyValueStoreHooks;
    /**
     * If provided, the store will periodically call `sync()` to push
     * all in-memory changes to the adapter.
     */
    syncIntervalMs?: number;
    /**
     * You can choose to keep a version counter for the entire store.
     * Each operation that modifies the store increments the version.
     */
    enableVersioning?: boolean;
}; 
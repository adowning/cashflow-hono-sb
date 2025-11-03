# PostgreSQL Adapter for KeyValueStore

This document describes the PostgreSQL adapter implementation for the KeyValueStore system.

## Overview

The `PostgresAdapter` provides PostgreSQL-based storage for key-value pairs using Bun's SQL client. It stores data in JSONB format for efficient querying and storage.

## Features

- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ JSONB storage for flexible data types
- ✅ Automatic table creation with timestamps
- ✅ Backup functionality with timestamped tables
- ✅ Connection string and individual parameter support
- ✅ Proper error handling for SQL operations
- ✅ Database statistics and maintenance methods

## Installation

The adapter uses existing dependencies already in your project:
- `bun` - for SQL client
- `drizzle-orm` - for type-safe database operations
- PostgreSQL database

## Configuration

The adapter supports two configuration formats:

### Connection String Configuration

```typescript
import { PostgresAdapter } from "@/libs/kv-store";

const adapter = new PostgresAdapter({
  connectionString: "postgresql://username:password@localhost:5432/database_name",
  tableName: "custom_kv_table" // optional, defaults to "kv_store"
});
```

### Individual Parameter Configuration

```typescript
const adapter = new PostgresAdapter({
  host: "localhost",
  port: 5432,
  database: "myapp",
  user: "postgres",
  password: "your_password",
  ssl: false, // optional, defaults to false
  tableName: "custom_kv_table" // optional
});
```

## Basic Usage

### Initialize the Adapter

```typescript
import { KeyValueStore, PostgresAdapter } from "@/libs/kv-store";

// Create PostgreSQL adapter
const adapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL!,
  tableName: "app_kv_store"
});

// Initialize adapter
await adapter.init();

// Create store with adapter
const kvStore = new KeyValueStore({
  adapter: adapter,
  enableVersioning: true
});
```

### Store and Retrieve Data

```typescript
// Store various data types
await kvStore.set("user:123", { name: "John", age: 30 });
await kvStore.set("config:theme", "dark");
await kvStore.set("counters", { visits: 100, likes: 25 });

// Retrieve data
const user = await kvStore.get("user:123");
const theme = await kvStore.get("config:theme");
const counters = await kvStore.get("counters");

console.log(user); // { name: "John", age: 30 }
console.log(theme); // "dark"
console.log(counters); // { visits: 100, likes: 25 }
```

### Delete Data

```typescript
await kvStore.delete("temp:data");
```

### Create Backups

```typescript
// Create a timestamped backup
if ('backup' in adapter) {
  await adapter.backup();
}
```

## Advanced Usage

### Database Statistics

```typescript
const stats = await adapter.getStats();
console.log(`Records: ${stats.count}, Size: ${stats.size}`);
// Output: Records: 150, Size: 2.3 MB
```

### Custom Table Management

```typescript
// Access the underlying adapter directly
const adapter = kvStore.getAdapter() as PostgresAdapter;

// Get all data
const allData = await adapter.all();

// Cleanup old backups (older than 30 days)
await adapter.cleanupOldBackups(30);
```

## Database Schema

The adapter uses the existing `game_session` table with the following structure adaptation:

```sql
-- Existing game_session table structure (from database schema)
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    user_id UUID REFERENCES "user"(id) NOT NULL,
    game_id UUID REFERENCES game(id),
    game_name TEXT,
    status session_status_enum DEFAULT 'ACTIVE' NOT NULL,
    total_wagered INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    starting_balance INTEGER,
    ending_balance INTEGER,
    duration INTEGER DEFAULT 0,
    expired_at expires_at_timestamp
);

-- KV storage strategy:
-- The adapter uses a special system record (UUID: 00000000-0000-0000-0000-000000000000)
-- to store all key-value data as JSON in the game_name column.
-- This maintains compatibility with the existing game_session schema.
```

### Backup Table Structure

Backup tables are created with the same structure plus metadata:

```sql
CREATE TABLE kv_store_backup_2025-11-01T16-35-00Z (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    backup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    backup_source_table TEXT DEFAULT 'kv_store'
);
```

## Error Handling

The adapter provides detailed error messages for common scenarios:

```typescript
try {
  await adapter.set("test", { data: "value" });
} catch (error) {
  console.error(error.message);
  // "Failed to set key "test": relation "kv_store" does not exist"
}
```

### Connection Management

```typescript
try {
  await adapter.init();
  
  // Your operations...
  
} catch (error) {
  if (error.message.includes("connection")) {
    console.error("Database connection failed");
  }
} finally {
  // Clean up if needed
  await adapter.close();
}
```

## Integration Examples

### With Hono Routes

```typescript
import { KeyValueStore, PostgresAdapter } from "@/libs/kv-store";

const adapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL!
});

const kvStore = new KeyValueStore({ adapter: adapter });

// In your route
app.post("/cache/:key", async (c) => {
  const key = c.req.param("key");
  const data = await c.req.json();
  
  await kvStore.set(key, data);
  
  return c.json({ success: true });
});

app.get("/cache/:key", async (c) => {
  const key = c.req.param("key");
  const data = await kvStore.get(key);
  
  return c.json({ data });
});
```

### With Existing Drizzle Database

```typescript
import { db } from "@/libs/database/db";
import { KeyValueStore, PostgresAdapter } from "@/libs/kv-store";

// Use the same connection as your existing database
const adapter = new PostgresAdapter({
  connectionString: "postgresql://user:password@host:port/database",
  tableName: "app_cache" // Use a different table to avoid conflicts
});

const kvStore = new KeyValueStore({ adapter });
```

## Best Practices

1. **Connection Pooling**: For high-traffic applications, configure connection pooling in your PostgreSQL instance.

2. **Backup Strategy**: Regularly create backups and implement automated cleanup:
   ```typescript
   // Automated daily backup
   setInterval(() => {
     adapter.backup().catch(console.error);
   }, 24 * 60 * 60 * 1000);
   ```

3. **Data Size Limits**: PostgreSQL JSONB handles large objects well, but consider size limits for your use case.

4. **Indexing**: The adapter creates an index on `updated_at` for efficient queries on recent data.

5. **Monitoring**: Use `getStats()` to monitor table size and record count.

## Performance Considerations

- JSONB storage is efficient for structured data
- Automatic indexing on timestamps for time-based queries
- Connection pooling recommended for concurrent access
- Consider partitioning for very large datasets

## Migration from Other Adapters

```typescript
// Example migration from FileAdapter to PostgresAdapter
const oldStore = new KeyValueStore({ 
  adapter: new FileAdapter({ filePath: "./cache.json" })
});

const newAdapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL!
});

const newStore = new KeyValueStore({ adapter: newAdapter });

// Migrate existing data
const existingData = await oldStore.getAll();
for (const [key, value] of Object.entries(existingData)) {
  await newStore.set(key, value);
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure PostgreSQL is running and accessible
2. **Table Creation Failed**: Check database permissions
3. **JSONB Errors**: Ensure you're storing valid JSON-serializable data
4. **Backup Failures**: Verify backup table creation permissions

### Debug Mode

Enable detailed logging by setting up proper error handling:

```typescript
try {
  await adapter.init();
} catch (error) {
  console.error("PostgreSQL adapter initialization failed:", error);
  throw error;
}
```

## API Reference

### PostgresAdapterConfig

```typescript
type PostgresAdapterConfig = 
  | {
      connectionString: string;
      tableName?: string;
    }
  | {
      host: string;
      port?: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
      tableName?: string;
    };
```

### Methods

- `init(): Promise<void>` - Initialize database connection and create tables
- `get(key: string): Promise<unknown | undefined>` - Retrieve value by key
- `set(key: string, value: unknown): Promise<void>` - Store key-value pair
- `delete(key: string): Promise<void>` - Remove key-value pair
- `all(): Promise<Record<string, unknown>>` - Get all key-value pairs
- `backup(): Promise<void>` - Create timestamped backup
- `getStats(): Promise<{count: number, size: string}>` - Get database statistics
- `cleanupOldBackups(days?: number): Promise<void>` - Remove old backup tables
- `close(): Promise<void>` - Close database connection
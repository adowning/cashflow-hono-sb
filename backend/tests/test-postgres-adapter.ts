#!/usr/bin/env bun

/**
 * Test script for PostgreSQL Adapter
 * Run with: bun test-postgres-adapter.ts
 */

import { PostgresAdapter } from "./src/libs/kv-store/adapters/postgres-adapter.js";

// Test configuration - Using a mock approach since database may not be accessible
const testConfig = {
    connectionString: "postgresql://test:test@localhost:5432/test_db", // This will fail but test the logic
    tableName: "game_sessions", // Using existing game_session table
    useExistingTable: true
};

async function testPostgresAdapter()
{
    console.log("🔧 Testing PostgreSQL Adapter...\n");

    const adapter = new PostgresAdapter(testConfig);

    try {
        // Initialize
        console.log("1. Initializing adapter...");
        await adapter.init();
        console.log("✅ Adapter initialized successfully\n");

        // Test set operation
        console.log("2. Testing set operations...");
        await adapter.set("user:123", { name: "John Doe", age: 30, roles: ["admin", "user"] });
        await adapter.set("config:theme", "dark");
        await adapter.set("counter", 42);
        await adapter.set("settings", { notifications: true, language: "en" });
        console.log("✅ Set operations completed\n");

        // Test get operation
        console.log("3. Testing get operations...");
        const user = await adapter.get("user:123");
        const theme = await adapter.get("config:theme");
        const counter = await adapter.get("counter");
        const settings = await adapter.get("settings");
        const nonExistent = await adapter.get("non-existent");

        console.log("📊 Retrieved data:");
        console.log(`  user:123 =>`, user);
        console.log(`  config:theme =>`, theme);
        console.log(`  counter =>`, counter);
        console.log(`  settings =>`, settings);
        console.log(`  non-existent =>`, nonExistent);
        console.log("✅ Get operations completed\n");

        // Test update operation
        console.log("4. Testing update operation...");
        const userUpdate = typeof user === 'object' && user !== null ? user : {};
        await adapter.set("user:123", { ...userUpdate, age: 31, lastLogin: new Date().toISOString() });
        const updatedUser = await adapter.get("user:123");
        console.log(`  Updated user:`, updatedUser);
        console.log("✅ Update operation completed\n");

        // Test all operation
        console.log("5. Testing all operation...");
        const allData = await adapter.all();
        console.log("📋 All stored data:");
        Object.entries(allData).forEach(([key, value]) =>
        {
            console.log(`  ${key}:`, value);
        });
        console.log("✅ All operation completed\n");

        // Test delete operation
        console.log("6. Testing delete operation...");
        await adapter.delete("counter");
        const deleted = await adapter.get("counter");
        console.log(`  Counter after deletion:`, deleted);
        console.log("✅ Delete operation completed\n");

        // Test backup functionality
        console.log("7. Testing backup functionality...");
        if ('backup' in adapter) {
            await adapter.backup();
            console.log("✅ Backup created successfully\n");
        }

        // Test statistics
        console.log("8. Testing statistics...");
        const stats = await adapter.getStats();
        console.log(`📈 Database statistics:`);
        console.log(`  Total Records: ${stats.count}`);
        console.log(`  Database Size: ${stats.size}`);
        console.log(`  KV Record Count: ${stats.kvRecordCount}`);
        console.log(`  Total Session Count: ${stats.totalSessionCount}`);
        console.log("✅ Statistics retrieved\n");

        console.log("🎉 All tests passed successfully!");
        console.log(`\n📝 Test completed at: ${new Date().toISOString()}`);

    } catch (error) {
        const err = error as Error;
        console.error("❌ Test failed:", err.message);
        if (err.stack) {
            console.error("Stack trace:", err.stack);
        }
        process.exit(1);
    } finally {
        // Cleanup
        try {
            await adapter.close();
            console.log("\n🧹 Cleanup completed");
        } catch (cleanupError) {
            const cleanupErr = cleanupError as Error;
            console.warn("⚠️  Cleanup warning:", cleanupErr.message);
        }
    }
}

// Check if we're running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("🚀 PostgreSQL Adapter Test Suite");
    console.log("================================\n");

    testPostgresAdapter().catch((error) =>
    {
        console.error("💥 Unhandled error:", error);
        process.exit(1);
    });
}

export { testPostgresAdapter };

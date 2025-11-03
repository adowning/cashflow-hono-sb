# Database Migration Analysis: Custom Native Functions to Drizzle ORM

## Executive Summary

This analysis identifies **7 custom "Native functions"** in `src/core/database/db.ts` that bypass Drizzle's standardized query interface and need to be migrated. These functions are scattered across **7 different files** throughout the codebase and represent inconsistent database access patterns that should be standardized.

## Custom Native Functions Identified

### 1. `findFirstUserNative(userId: string)`
- **Location:** `src/core/database/db.ts` lines 42-56
- **Current Implementation:** Direct SQL client calls with template strings
- **Current Usage:** `src/modules/gameplay/core/core-bet.service.ts`
- **Table:** `user` (userTable)
- **Issues:** 
  - Bypasses Drizzle's type safety
  - Manual snake_case to camelCase conversion
  - No transaction context support

### 2. `selectUserBalanceNative(userId: string)`
- **Location:** `src/core/database/db.ts` lines 58-72
- **Current Implementation:** Direct SQL client calls with template strings
- **Current Usage:** `src/modules/gameplay/core/core-bet.service.ts`
- **Table:** `user_balances` (userBalanceTable)
- **Issues:**
  - Bypasses Drizzle's type safety
  - Manual snake_case to camelCase conversion
  - No transaction context support

### 3. `findFirstGameNative(gameId: string)`
- **Location:** `src/core/database/db.ts` lines 74-88
- **Current Implementation:** Direct SQL client calls with template strings
- **Current Usage:** 
  - `src/modules/gameplay/core/core-bet.service.ts`
  - `src/modules/gameplay/listeners/bet-stats.updater.ts`
- **Table:** `games` (gameTable)
- **Issues:**
  - Bypasses Drizzle's type safety
  - Manual snake_case to camelCase conversion
  - No transaction context support

### 4. `findFirstActiveGameSessionNative(userId: string, gameId: string)`
- **Location:** `src/core/database/db.ts` lines 90-106
- **Current Implementation:** Direct SQL client calls with template strings
- **Current Usage:** `src/modules/gameplay/core/core-bet.service.ts`
- **Table:** `game_sessions` (gameSessionTable)
- **Issues:**
  - Bypasses Drizzle's type safety
  - Manual snake_case to camelCase conversion
  - No transaction context support

### 5. `updateGameNative(gameId: string, updates: Record<string, any>)`
- **Location:** `src/core/database/db.ts` lines 108-205
- **Current Implementation:** Mixed approach (native check + Drizzle update)
- **Current Usage:** `src/modules/gameplay/listeners/bet-stats.updater.ts`
- **Table:** `games` (gameTable)
- **Issues:**
  - Inconsistent approach (native validation + Drizzle update)
  - Complex validation logic outside Drizzle's schema validation
  - Manual snake_case to camelCase conversion
  - No transaction context support

### 6. `getUserWithBalance(id: string)`
- **Location:** `src/core/database/db.ts` lines 250-265
- **Current Implementation:** Uses prepared statement with Drizzle query builder
- **Current Usage:** `src/api/middlewares/auth.middleware.ts`
- **Table:** `user` with `userBalances` relation
- **Issues:**
  - Actually uses Drizzle properly, but hardcoded snake_case to camelCase conversion
  - Uses prepared statement but still manually converts keys

### 7. `updateWithAllGameSessionsToCompleted()`
- **Location:** `src/core/database/db.ts` lines 267-282
- **Current Implementation:** Direct SQL client calls with template strings
- **Current Usage:** `src/server.ts`
- **Table:** `game_sessions` (gameSessionTable)
- **Issues:**
  - Bypasses Drizzle's type safety
  - No WHERE clause (updates all records)
  - No transaction context support

## Database Schema Structure

### Core Tables Identified:
1. **`userTable`** - User accounts with roles, status, and authentication
2. **`userBalanceTable`** - User financial balances (real, bonus, free spins, etc.)
3. **`gameTable`** - Game definitions with RTP, betting limits, and statistics
4. **`gameSessionTable`** - Active game sessions tracking player gameplay
5. **`sessionTable`** - Authentication sessions
6. **`transactionLogTable`** - Financial transaction audit trail
7. **`depositTable`** - Deposit transactions
8. **`withdrawalTable`** - Withdrawal transactions
9. **`jackpotTable`** - Jackpot pool management
10. **`jackpotWinHistoryTable`** - Individual jackpot win records
11. **`jackpotContributionHistoryTable`** - Individual jackpot contribution records

### Schema Relations:
- Well-defined Drizzle relations in `src/core/database/schema/relations.ts`
- Foreign key constraints properly established
- Enums defined for type safety
- Zod schemas for validation

## Current Database Access Patterns

### Mixed Approaches Found:
1. **Custom Native Functions:** Direct SQL with manual key conversion
2. **Drizzle Query Builder:** `db.query.table.findMany()` with `where` clauses
3. **Drizzle Transaction:** `db.transaction(async (tx) => {...})`
4. **Drizzle SQL:** `tx.execute(sql\`...\`)` in jackpot service
5. **Prepared Statements:** Hardcoded in `getUserWithBalance`

## Migration Mapping: Custom Functions to Drizzle ORM

### Function 1: `findFirstUserNative`
**Current:**
```typescript
export async function findFirstUserNative(userId: string) {
  const result = await client`SELECT * FROM "user" WHERE "id" = ${userId} LIMIT 1`;
  return snakeToCamelCaseObject(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function findFirstUser(userId: string) {
  const result = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
  });
  return result; // Drizzle handles camelCase automatically
}
```

### Function 2: `selectUserBalanceNative`
**Current:**
```typescript
export async function selectUserBalanceNative(userId: string) {
  const result = await client`SELECT * FROM "user_balances" WHERE "user_id" = ${userId} LIMIT 1`;
  return snakeToCamelCaseObject(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function selectUserBalance(userId: string) {
  const result = await db.query.userBalanceTable.findFirst({
    where: eq(userBalanceTable.userId, userId),
  });
  return result;
}
```

### Function 3: `findFirstGameNative`
**Current:**
```typescript
export async function findFirstGameNative(gameId: string) {
  const result = await client`SELECT * FROM "games" WHERE "id" = ${gameId} LIMIT 1`;
  return snakeToCamelCaseObject(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function findFirstGame(gameId: string) {
  const result = await db.query.gameTable.findFirst({
    where: eq(gameTable.id, gameId),
  });
  return result;
}
```

### Function 4: `findFirstActiveGameSessionNative`
**Current:**
```typescript
export async function findFirstActiveGameSessionNative(userId: string, gameId: string) {
  const result = await client`SELECT * FROM "game_sessions" WHERE "user_id" = ${userId} AND "status" = 'ACTIVE' AND "game_id" = ${gameId} LIMIT 1`;
  return snakeToCamelCaseObject(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function findFirstActiveGameSession(userId: string, gameId: string) {
  const result = await db.query.gameSessionTable.findFirst({
    where: and(
      eq(gameSessionTable.userId, userId),
      eq(gameSessionTable.status, "ACTIVE"),
      eq(gameSessionTable.gameId, gameId)
    ),
  });
  return result;
}
```

### Function 5: `updateGameNative`
**Current:**
```typescript
export async function updateGameNative(gameId: string, updates: Record<string, any>) {
  // Native validation check
  const existingGame = await client`SELECT * FROM "games" WHERE "id" = ${gameId} LIMIT 1`;
  // Drizzle update
  const result = await db.update(gameTable).set(updates).where(sql`id = ${gameId}`).returning();
  return snakeToCamelCaseObject(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function updateGame(gameId: string, updates: Partial<Game>) {
  const result = await db.update(gameTable)
    .set(updates)
    .where(eq(gameTable.id, gameId))
    .returning();
  return result[0];
}
```

### Function 6: `getUserWithBalance`
**Current:**
```typescript
const prepared = db.query.userTable.findMany({
  where: (userTable, { eq }) => eq(userTable.id, sql.placeholder("id")),
  with: { userBalances: true },
}).prepare("query_name");

export async function getUserWithBalance(id: string) {
  const result = await prepared.execute({ id });
  return removeNullValues(result[0]);
}
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function getUserWithBalance(userId: string) {
  const result = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    with: {
      userBalances: true,
    },
  });
  return result;
}
```

### Function 7: `updateWithAllGameSessionsToCompleted`
**Current:**
```typescript
export const updateWithAllGameSessionsToCompleted = async () => {
  const result = await client`UPDATE "game_sessions" SET "status" = ${"COMPLETED" as const}, "is_active" = ${false as const}, "updated_at" = NOW()`;
  return result;
};
```

**Recommended Drizzle ORM Equivalent:**
```typescript
export async function updateAllGameSessionsToCompleted() {
  const result = await db.update(gameSessionTable)
    .set({ 
      status: "COMPLETED",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(gameSessionTable.status, "ACTIVE"))
    .returning();
  return result;
}
```

## Files Requiring Updates

### Import Statements to Update:
1. `src/api/middlewares/auth.middleware.ts`
2. `src/server.ts`
3. `src/modules/gameplay/core/core-bet.service.ts`
4. `src/modules/gameplay/listeners/bet-stats.updater.ts`

### Function Calls to Update:
1. `getUserWithBalance(data.user.id)` → `getUserWithBalance(userId)`
2. `updateWithAllGameSessionsToCompleted()` → `updateAllGameSessionsToCompleted()`
3. `findFirstUserNative(userId)` → `findFirstUser(userId)`
4. `selectUserBalanceNative(userId)` → `selectUserBalance(userId)`
5. `findFirstGameNative(gameId)` → `findFirstGame(gameId)`
6. `findFirstActiveGameSessionNative(userId, gameId)` → `findFirstActiveGameSession(userId, gameId)`
7. `updateGameNative(gameId, updates)` → `updateGame(gameId, updates)`

## Benefits of Migration

1. **Type Safety:** Drizzle ORM provides compile-time type checking
2. **Consistency:** All database access goes through the same interface
3. **Transaction Support:** All functions can participate in transactions
4. **Schema Validation:** Leverage Drizzle's schema-based validation
5. **Performance:** Built-in query optimization and prepared statements
6. **Maintainability:** Easier to debug and modify database operations
7. **Key Conversion:** Automatic snake_case to camelCase conversion
8. **Query Builder:** Powerful query building capabilities

## Migration Priority

### High Priority (Core Functions):
1. `findFirstUserNative` - Used in betting flow
2. `selectUserBalanceNative` - Used in betting flow  
3. `findFirstActiveGameSessionNative` - Used in betting flow
4. `updateGameNative` - Used in game statistics

### Medium Priority:
5. `getUserWithBalance` - Used in authentication
6. `findFirstGameNative` - Used in game statistics

### Low Priority:
7. `updateWithAllGameSessionsToCompleted` - Used in server initialization

## Next Steps

1. Create new standardized functions using Drizzle ORM
2. Update import statements in affected files
3. Update function call sites
4. Test all database operations
5. Remove custom Native functions
6. Update documentation

## Implementation Notes

- All current functions have error handling that should be preserved
- The `snakeToCamelCaseObject` and `removeNullValues` utilities can be removed as Drizzle handles this automatically
- Transaction support will require updating function signatures to accept optional transaction contexts
- Consider implementing a service layer for complex database operations
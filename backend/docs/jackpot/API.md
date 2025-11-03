# Jackpot Service API Reference

## Overview

The Jackpot Service provides a comprehensive API for managing multi-tier jackpot systems with full backward compatibility. All methods maintain the same signatures as the original implementation while adding enhanced database persistence, concurrency control, and monitoring capabilities.

## Core Interfaces

### JackpotService

```typescript
interface JackpotService {
  // Core Operations
  processJackpotContribution(gameId: string, wagerAmount: number): Promise<JackpotContributionResult>;
  processJackpotWin(group: JackpotGroup, gameId: string, userId: string, winAmount?: number): Promise<JackpotWinResult>;
  
  // Data Retrieval
  getJackpotPools(): Promise<Record<JackpotGroup, JackpotPool>>;
  getJackpotPool(group: JackpotGroup): Promise<JackpotPool>;
  getJackpotStatistics(): Promise<JackpotStatistics>;
  
  // Configuration
  updateJackpotConfig(config: Partial<JackpotConfig>): Promise<{ success: boolean; error?: string }>;
  
  // Utility
  doesGameHaveJackpot(gameId: string): Promise<boolean>;
  getGameContributionRate(gameId: string, group: JackpotGroup): Promise<number>;
}
```

### Data Types

```typescript
// Jackpot groups supported
type JackpotGroup = 'minor' | 'major' | 'mega';

// Jackpot pool information
interface JackpotPool {
  group: JackpotGroup;
  currentAmount: number; // Current pool amount in cents
  totalContributions: number; // Total contributions in cents
  totalWins: number; // Total wins in cents
  lastWinDate?: Date; // Timestamp of last win
  lastWinAmount?: number; // Amount of last win in cents
}

// Jackpot contribution result
interface JackpotContributionResult {
  success: boolean;
  contributions: Record<JackpotGroup, number>; // Individual contributions per group
  totalContribution: number; // Total contribution amount
  error?: string; // Error message if unsuccessful
}

// Jackpot win result
interface JackpotWinResult {
  success: boolean;
  actualWinAmount: number; // Actual amount won in cents
  remainingAmount?: number; // Remaining amount after win
  error?: string; // Error message if unsuccessful
}

// Jackpot configuration
interface JackpotConfig {
  minor: JackpotGroupConfig;
  major: JackpotGroupConfig;
  mega: JackpotGroupConfig;
}

interface JackpotGroupConfig {
  rate: number; // Contribution rate (0.02 = 2%)
  seedAmount: number; // Reset amount when won
  maxAmount?: number; // Optional maximum cap
}

// Comprehensive statistics
interface JackpotStatistics {
  pools: Record<JackpotGroup, JackpotPool>;
  totalContributions: number; // Sum across all pools
  totalWins: number; // Sum across all pools
  totalGamesContributing: number; // Number of games contributing
}
```

## API Methods

### processJackpotContribution

Processes a jackpot contribution from a bet with database persistence and concurrency control.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameId` | `string` | Yes | Unique game identifier |
| `wagerAmount` | `number` | Yes | Wager amount in cents (positive integer) |

#### Returns

`Promise<JackpotContributionResult>`

#### Example

```typescript
import { processJackpotContribution } from '@/modules/gameplay/jackpot.service';

try {
  const result = await processJackpotContribution('game_123', 1000); // $10.00 wager
  
  if (result.success) {
    console.log(`Contributed ${result.totalContribution} cents total`);
    console.log(`Minor: ${result.contributions.minor} cents`);
    console.log(`Major: ${result.contributions.major} cents`);
    console.log(`Mega: ${result.contributions.mega} cents`);
  } else {
    console.error(`Contribution failed: ${result.error}`);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

#### Behavior

- **Game Group Assignment**: Automatically determines which jackpot groups the game contributes to
- **Rate Calculation**: Applies configured contribution rate (e.g., 2% for minor, 1% for major)
- **Maximum Cap**: Respects configured maximum amounts per pool
- **Atomic Updates**: Uses database transactions for data consistency
- **Concurrency Control**: Handles concurrent contributions safely with optimistic locking
- **Error Handling**: Graceful degradation if jackpot operations fail

#### Error Cases

- Invalid game ID or wager amount
- Database connectivity issues
- Concurrent modification conflicts
- Configuration errors

### processJackpotWin

Processes a jackpot win with automatic pool reset and comprehensive logging.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `group` | `JackpotGroup` | Yes | Jackpot group to process win for |
| `gameId` | `string` | Yes | Unique game identifier |
| `userId` | `string` | Yes | User ID of the winner (UUID) |
| `winAmount` | `number` | No | Specific win amount (defaults to current pool) |

#### Returns

`Promise<JackpotWinResult>`

#### Example

```typescript
import { processJackpotWin } from '@/modules/gameplay/jackpot.service';

try {
  const result = await processJackpotWin('minor', 'game_123', 'user_456', 50000); // $500.00 win
  
  if (result.success) {
    console.log(`User won ${result.actualWinAmount} cents`);
    console.log(`Remaining pool: ${result.remainingAmount} cents`);
  } else {
    console.error(`Win processing failed: ${result.error}`);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

#### Behavior

- **Win Calculation**: Uses provided amount or current pool amount
- **Pool Reset**: Automatically resets to seed amount if win would go negative
- **History Logging**: Records win details for audit trail
- **Atomic Operation**: Ensures win processing and reset are atomic
- **Pessimistic Locking**: Uses stronger locking for win operations

#### Error Cases

- Invalid group, game ID, or user ID
- Win amount exceeds available pool
- Database errors during transaction
- Concurrent modification conflicts

### getJackpotPools

Retrieves current state of all jackpot pools with database queries.

#### Returns

`Promise<Record<JackpotGroup, JackpotPool>>`

#### Example

```typescript
import { getJackpotPools } from '@/modules/gameplay/jackpot.service';

const pools = await getJackpotPools();

console.log('Current Jackpot Pools:');
console.log(`Minor: ${pools.minor.currentAmount} cents`);
console.log(`Major: ${pools.major.currentAmount} cents`);
console.log(`Mega: ${pools.mega.currentAmount} cents`);
```

### getJackpotPool

Retrieves current state of a specific jackpot pool.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `group` | `JackpotGroup` | Yes | Jackpot group to retrieve |

#### Returns

`Promise<JackpotPool>`

#### Example

```typescript
import { getJackpotPool } from '@/modules/gameplay/jackpot.service';

const minorPool = await getJackpotPool('minor');
console.log(`Minor jackpot: ${minorPool.currentAmount} cents`);
console.log(`Total contributions: ${minorPool.totalContributions} cents`);
console.log(`Total wins: ${minorPool.totalWins} cents`);
```

### getJackpotStatistics

Retrieves comprehensive statistics across all jackpot pools.

#### Returns

`Promise<JackpotStatistics>`

#### Example

```typescript
import { getJackpotStatistics } from '@/modules/gameplay/jackpot.service';

const stats = await getJackpotStatistics();

console.log('Jackpot Statistics:');
console.log(`Total contributions across all pools: ${stats.totalContributions} cents`);
console.log(`Total wins across all pools: ${stats.totalWins} cents`);
console.log(`Games contributing: ${stats.totalGamesContributing}`);

// Individual pool details
Object.entries(stats.pools).forEach(([group, pool]) => {
  console.log(`${group}: ${pool.currentAmount} cents`);
});
```

### updateJackpotConfig

Updates jackpot configuration with atomic database operations.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `Partial<JackpotConfig>` | Yes | Configuration updates |

#### Returns

`Promise<{ success: boolean; error?: string }>`

#### Example

```typescript
import { updateJackpotConfig } from '@/modules/gameplay/jackpot.service';

const result = await updateJackpotConfig({
  minor: {
    rate: 0.025, // Increase to 2.5%
    maxAmount: 1500000, // Increase max to $15,000
  },
  major: {
    seedAmount: 1500000, // Increase seed to $15,000
  },
});

if (result.success) {
  console.log('Configuration updated successfully');
} else {
  console.error(`Update failed: ${result.error}`);
}
```

#### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `rate` | `number` | Contribution rate (0.0 - 1.0) |
| `seedAmount` | `number` | Reset amount when won (in cents) |
| `maxAmount` | `number` | Optional maximum cap (in cents) |

#### Validation Rules

- Contribution rate must be between 0 and 1 (0-100%)
- Seed amount must be positive
- Max amount must be greater than seed amount (if specified)
- All updates are validated before database changes

### doesGameHaveJackpot

Checks if a game contributes to any jackpot pools.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameId` | `string` | Yes | Game identifier to check |

#### Returns

`Promise<boolean>` - True if game contributes to any jackpot

#### Example

```typescript
import { doesGameHaveJackpot } from '@/modules/gameplay/jackpot.service';

const hasJackpot = await doesGameHaveJackpot('game_123');
if (hasJackpot) {
  console.log('Game contributes to jackpot');
} else {
  console.log('Game does not contribute to jackpot');
}
```

### getGameContributionRate

Gets the contribution rate for a specific game and jackpot group.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameId` | `string` | Yes | Game identifier |
| `group` | `JackpotGroup` | Yes | Jackpot group |

#### Returns

`Promise<number>` - Contribution rate (0.0 - 1.0)

#### Example

```typescript
import { getGameContributionRate } from '@/modules/gameplay/jackpot.service';

const minorRate = await getGameContributionRate('game_123', 'minor');
console.log(`Minor jackpot rate for game_123: ${minorRate * 100}%`);
```

## Usage Patterns

### Basic Game Integration

```typescript
import { 
  processJackpotContribution,
  doesGameHaveJackpot,
  getJackpotPool 
} from '@/modules/gameplay/jackpot.service';

async function handleBet(gameId: string, wagerAmount: number) {
  try {
    // Check if game contributes to jackpot
    const hasJackpot = await doesGameHaveJackpot(gameId);
    if (!hasJackpot) {
      return { jackpotContribution: 0 };
    }

    // Process jackpot contribution
    const contributionResult = await processJackpotContribution(gameId, wagerAmount);
    
    if (contributionResult.success) {
      return {
        jackpotContribution: contributionResult.totalContribution,
        contributions: contributionResult.contributions,
      };
    } else {
      console.warn('Jackpot contribution failed:', contributionResult.error);
      return { jackpotContribution: 0 };
    }
  } catch (error) {
    console.error('Error processing jackpot:', error);
    return { jackpotContribution: 0 };
  }
}
```

### Win Processing

```typescript
import { processJackpotWin, getJackpotPool } from '@/modules/gameplay/jackpot.service';

async function handleJackpotWin(group: JackpotGroup, gameId: string, userId: string) {
  try {
    // Get current pool amount to determine win amount
    const pool = await getJackpotPool(group);
    
    // Process the win (defaults to full pool amount)
    const winResult = await processJackpotWin(group, gameId, userId);
    
    if (winResult.success) {
      console.log(`Jackpot ${group} won: ${winResult.actualWinAmount} cents`);
      console.log(`Remaining pool: ${winResult.remainingAmount} cents`);
      
      return {
        winAmount: winResult.actualWinAmount,
        remainingAmount: winResult.remainingAmount,
      };
    } else {
      throw new Error(`Win processing failed: ${winResult.error}`);
    }
  } catch (error) {
    console.error('Error processing jackpot win:', error);
    throw error;
  }
}
```

### Administrative Operations

```typescript
import { 
  getJackpotStatistics,
  updateJackpotConfig,
  getJackpotPools 
} from '@/modules/gameplay/jackpot.service';

async function getAdminDashboard() {
  try {
    // Get comprehensive statistics
    const statistics = await getJackpotStatistics();
    
    // Get current pool states
    const pools = await getJackpotPools();
    
    return {
      statistics,
      pools,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching admin data:', error);
    throw error;
  }
}

async function updateJackpotSettings(changes: Partial<JackpotConfig>) {
  const result = await updateJackpotConfig(changes);
  
  if (result.success) {
    console.log('Jackpot settings updated successfully');
    return { success: true };
  } else {
    console.error(`Settings update failed: ${result.error}`);
    return { success: false, error: result.error };
  }
}
```

## Error Handling

### Common Error Scenarios

1. **Database Connectivity Issues**
   ```typescript
   try {
     const result = await processJackpotContribution('game_123', 1000);
     if (!result.success) {
       // Handle gracefully - jackpot is not critical for game flow
       console.warn('Jackpot contribution failed:', result.error);
     }
   } catch (error) {
     // Log but don't crash the game
     console.error('Unexpected jackpot error:', error);
   }
   ```

2. **Concurrent Modification Conflicts**
   ```typescript
   // The service handles these automatically with retries
   // No special handling required by consumers
   ```

3. **Configuration Errors**
   ```typescript
   const configUpdate = await updateJackpotConfig({
     minor: { rate: 1.5 } // Invalid rate > 1.0
   });
   
   if (!configUpdate.success) {
     console.error('Invalid configuration:', configUpdate.error);
     // Revert to previous known good configuration
   }
   ```

### Best Practices

1. **Always check success flags** before using returned data
2. **Handle jackpot failures gracefully** - they should not block game flow
3. **Use appropriate error logging** for debugging and monitoring
4. **Validate inputs** before calling service methods
5. **Monitor performance** in production environments

## Performance Considerations

### Optimization Features

- **Database Connection Pooling**: Efficient connection management
- **Batch Operations**: Multiple contributions processed efficiently
- **Intelligent Caching**: Frequently accessed data cached
- **Query Optimization**: Optimized database queries
- **Concurrency Control**: Safe handling of concurrent operations

### Expected Performance

- **Contribution Processing**: < 100ms typically
- **Pool Retrieval**: < 50ms typically
- **Win Processing**: < 150ms typically
- **Configuration Updates**: < 200ms typically

### Monitoring

```typescript
import { jackpotPerformanceMonitor } from '@/modules/gameplay/jackpot-performance-monitor';

async function monitorJackpotHealth() {
  const health = await jackpotPerformanceMonitor.getHealthStatus();
  const metrics = await jackpotPerformanceMonitor.getCurrentMetrics();
  
  console.log('Jackpot Health:', health);
  console.log('Performance Metrics:', metrics);
}
```

## Version Compatibility

### v2.0.0 (Current)

- **Full backward compatibility** with v1.0.0 API
- **Enhanced functionality** with database persistence
- **Improved concurrency** with optimistic locking
- **Better monitoring** and error handling

### Migration from v1.0.0

No code changes required - all existing calls work unchanged:

```typescript
// These work exactly as before
const result = await processJackpotContribution('game123', 1000);
const pools = await getJackpotPools();
const winResult = await processJackpotWin('minor', 'game123', 'user456', 500);
```

## Rate Limiting and Throttling

The service implements automatic rate limiting and throttling for:

- **High-frequency contributions**: Batched processing
- **Configuration updates**: Admin-only with audit trail
- **Win processing**: Sequential processing with locks
- **Health checks**: Cached responses

## Security Considerations

1. **Input Validation**: All inputs are validated with Zod schemas
2. **SQL Injection Protection**: Parameterized queries via Drizzle ORM
3. **Authorization**: Admin functions require proper authorization
4. **Audit Logging**: All operations logged for compliance
5. **Concurrency Safety**: Optimistic locking prevents race conditions

---

*This API documentation is maintained alongside the codebase and reflects the current implementation.*
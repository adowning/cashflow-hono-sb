# Jackpot Error Handling and Audit Logging Implementation

## Overview

This document describes the comprehensive error handling and audit logging system implemented for jackpot database operations. The system provides structured error categorization, detailed audit trails, performance monitoring, and operational health checks.

## Implemented Components

### 1. Custom Error Classes (`jackpot-errors.ts`)

**Comprehensive Error Hierarchy:**
- `JackpotError` - Base class for all jackpot-specific errors
- `ValidationError` - Input validation failures
- `DatabaseError` - Database operation failures
- `ConcurrencyError` - Concurrent operation conflicts
- `ConfigurationError` - Configuration management issues
- `InsufficientFundsError` - Balance/fund validation failures
- `SystemError` - System-level failures
- `NetworkError` - Network connectivity issues

**Error Categorization:**
- 7 main categories with detailed sub-codes
- 50+ specific error codes for precise error identification
- Automatic error categorization from generic errors
- Retry logic with exponential backoff
- User-friendly error messages
- Developer-friendly technical details

**Key Features:**
```typescript
// Example error creation
const error = createDatabaseError(
  "Connection timeout",
  "DATABASE_TIMEOUT",
  {
    operationId: "op_1234567890",
    correlationId: "corr_1234567890", 
    userId: "user-123",
    gameId: "game-456",
    group: "minor",
    timestamp: new Date(),
  }
);

// Error features
error.isRetryable()        // true for retryable errors
error.getRetryDelay()      // 1000ms for timeouts
error.getUserMessage()     // "Database operation failed"
error.getErrorSeverity()   // "HIGH" for database errors
error.toLogEntry()         // Structured log format
```

### 2. Structured Logging Service (`jackpot-logging.service.ts`)

**Logging Categories:**
- `AUDIT` - Operation audit trails
- `ERROR` - Error and warning logs
- `PERFORMANCE` - Performance metrics and monitoring
- `TRANSACTION` - Financial transaction logging
- `CONFIG` - Configuration change tracking
- `HEALTH` - System health check results

**Key Features:**
```typescript
// Audit logging
jackpotLogger.audit("Jackpot contribution", context, { amount: 500, userId: "user-123" });

// Error logging with full context
jackpotLogger.error("Operation failed", context, error, { retryCount: 3 });

// Performance monitoring
jackpotLogger.performance("contribution", context, 250); // 250ms duration

// Health checks
jackpotLogger.health("DATABASE", "HEALTHY", 45); // 45ms response time

// Transaction logging
jackpotLogger.transaction("JACKPOT_CONTRIBUTION", context, 500, true, { 
  contributionRate: 0.02,
  poolAmount: 100250 
});
```

**Correlation and Tracing:**
- Unique correlation IDs for request tracking
- Operation IDs for granular tracing
- Parent-child relationship preservation for nested operations
- JSON structured logging for analytics
- Console formatting for development

**Performance Monitoring:**
- Automatic duration tracking
- 300ms threshold alerting (configurable)
- P95 latency calculations
- Performance statistics aggregation
- Memory-conscious metric storage (last 100 measurements)

### 3. Enhanced Database Error Handling (`jackpot-error-handler.ts`)

**Database Error Categorization:**
- Connection failures
- Timeout detection
- Deadlock identification
- Constraint violation handling
- Foreign key violation detection
- Serialization failure management

**Retry Logic:**
- Exponential backoff with configurable delays
- Maximum retry attempts (default: 3)
- Automatic retry for transient errors
- Smart categorization of retryable vs non-retryable errors

**Safe Database Operations:**
```typescript
// Safe query execution with error handling
const pool = await executeWithErrorHandling(
  "getPool.minor",
  () => db.select().from(jackpotTable).where(eq(jackpotTable.group, "minor")),
  context
);

// Safe transaction with retry logic
const result = await executeTransactionWithRetry(
  "updatePool.minor",
  (tx) => performUpdate(tx),
  context,
  3, // maxRetries
  100 // baseDelay
);

// Version conflict handling
handleVersionConflict(currentVersion, expectedVersion, "optimisticUpdate", "minor", context);
```

**Health Monitoring:**
- Database connectivity checks
- Jackpot table availability verification
- Response time monitoring
- Error rate tracking

### 4. Transaction Logging Integration (`jackpot-transaction-logger.ts`)

**Integration with `transactionLogTable`:**
- Seamless integration with existing audit infrastructure
- Jackpot-specific transaction types:
  - `JACKPOT_CONTRIBUTION` - Bet contributions
  - `JACKPOT_WIN` - Win distributions
  - `JACKPOT_CONFIG_CHANGE` - Admin configuration updates

**Comprehensive Audit Trail:**
```typescript
// Contribution transaction logging
await logJackpotContributionTransaction({
  userId: "user-123",
  gameId: "game-456",
  operatorId: "op-789",
  group: "minor",
  wagerAmount: 5000,
  contributionAmount: 100,
  jackpotAmountBefore: 100000,
  jackpotAmountAfter: 100100,
  processingTime: 250,
}, context);

// Win transaction logging
await logJackpotWinTransaction({
  userId: "user-123",
  gameId: "game-456", 
  operatorId: "op-789",
  group: "minor",
  winAmount: 50000,
  jackpotAmountBefore: 100000,
  jackpotAmountAfter: 50000, // Reset to seed amount
  processingTime: 180,
}, context);
```

**System Health Monitoring:**
```typescript
// Comprehensive health check
const health = await performJackpotHealthCheck();
// Returns: { overall: "HEALTHY", database: true, transactionLogging: true, responseTime: 145, checks: {...} }

// Metrics collection for dashboards
const metrics = await getJackpotSystemMetrics();
// Returns: { performance: {...}, transactions: {...}, health: {...}, timestamp: "..." }
```

## Integration with Existing Codebase

### 1. Error Handling Integration

**Replace existing error patterns:**
```typescript
// BEFORE
try {
  const result = await db.select().from(jackpotTable);
  return { success: true, data: result };
} catch (error) {
  console.error("Database error:", error);
  return { success: false, error: "Database operation failed" };
}

// AFTER
const context = createOperationContext({ operation: "getPools" });
try {
  const result = await executeWithErrorHandling(
    "getPools",
    () => db.select().from(jackpotTable),
    context
  );
  return { success: true, data: result };
} catch (error) {
  // Error is already logged and categorized
  return { success: false, error: error.getUserMessage() };
}
```

### 2. Logging Integration

**Update existing service logging:**
```typescript
// BEFORE
console.log(`Jackpot contribution: ${amount} cents for user ${userId}`);

// AFTER
const context = createOperationContext({ 
  operation: "contribute", 
  userId, 
  gameId,
  group: "minor"
});
jackpotLogger.contribution("CONTRIBUTION", context, amount, true, {
  poolAmount: newAmount,
  contributionRate: rate,
});
```

### 3. Transaction Logging Integration

**Extend existing `logTransaction` calls:**
```typescript
// BEFORE
await logTransaction({
  userId: betRequest.userId,
  type: "BET",
  // ... other fields
});

// AFTER  
await logJackpotContributionTransaction({
  userId: betRequest.userId,
  gameId: betRequest.gameId,
  operatorId: betRequest.operatorId,
  group: "minor",
  wagerAmount: betRequest.wagerAmount,
  contributionAmount: contributionAmount,
  jackpotAmountBefore: poolAmountBefore,
  jackpotAmountAfter: poolAmountAfter,
  processingTime: processingTime,
}, context);
```

## Configuration and Monitoring

### Environment Variables
```bash
# Logging configuration
JACKPOT_LOG_LEVEL=info              # DEBUG, INFO, WARN, ERROR, FATAL
JACKPOT_ENABLE_PERFORMANCE_LOGGING=true
JACKPOT_PERFORMANCE_THRESHOLD=300   # milliseconds

# Retry configuration
JACKPOT_MAX_RETRY_ATTEMPTS=3
JACKPOT_BASE_RETRY_DELAY=100        # milliseconds
JACKPOT_LOCK_TIMEOUT=5000           # milliseconds

# Health check configuration
JACKPOT_HEALTH_CHECK_INTERVAL=30    # seconds
JACKPOT_ENABLE_METRICS=true
```

### Health Check Endpoints

The system provides comprehensive health check functionality:

1. **Database Health Check**
   ```typescript
   const dbHealth = await checkDatabaseHealth();
   // { healthy: true, responseTime: 25 }
   ```

2. **Jackpot Table Health Check**
   ```typescript
   const tableHealth = await checkJackpotTableHealth();
   // { healthy: true, responseTime: 45, poolsFound: 3 }
   ```

3. **System Health Check**
   ```typescript
   const systemHealth = await performJackpotHealthCheck();
   // { overall: "HEALTHY", database: true, transactionLogging: true, ... }
   ```

### Performance Monitoring

**Automatic Performance Tracking:**
- All operations automatically track duration
- Performance logs generated for operations > 300ms
- P95 latency calculations for trend analysis
- Performance statistics available via `jackpotLogger.getAllPerformanceStats()`

**Alert Thresholds:**
```typescript
// Configuration in jackpot-logging.service.ts
const PERFORMANCE_THRESHOLD = 300; // 300ms

// Operations exceeding threshold generate WARN level logs
if (duration > PERFORMANCE_THRESHOLD) {
  jackpotLogger.performance(operation, context, duration, details);
  // Generates WARN level instead of DEBUG
}
```

## Error Response Format

**Standardized Error Response:**
```typescript
{
  success: false,
  error: {
    code: "DATABASE_TIMEOUT",
    category: "DATABASE", 
    message: "Database operation failed",
    userMessage: "Please try again in a moment",
    operationId: "op_1234567890",
    correlationId: "corr_1234567890",
    timestamp: "2025-11-01T03:45:14.193Z",
    retryable: true,
    retryDelay: 1000
  }
}
```

## Operational Dashboard Integration

**Metrics Collection:**
```typescript
const metrics = await getJackpotSystemMetrics();
// Returns comprehensive metrics for dashboard integration

{
  performance: {
    operations: {
      "contribution": { count: 150, average: 120, min: 50, max: 300, p95: 200 },
      "win": { count: 25, average: 180, min: 100, max: 450, p95: 250 }
    }
  },
  transactions: {
    last24Hours: {
      total: 175,
      successful: 173,
      failed: 2,
      successRate: 98.9,
      totalContributions: 1500000,
      totalWins: 750000,
      averageProcessingTime: 145
    }
  },
  health: {
    overall: "HEALTHY",
    database: true,
    transactionLogging: true
  },
  timestamp: "2025-11-01T03:45:14.193Z"
}
```

## Migration Guide

### Step 1: Update Error Handling
1. Replace try-catch blocks with `executeWithErrorHandling`
2. Add operation contexts to all jackpot operations
3. Implement proper error categorization

### Step 2: Add Logging
1. Add audit logging to all jackpot operations
2. Implement performance tracking for critical operations
3. Add health check calls to monitoring systems

### Step 3: Transaction Integration
1. Extend existing `logTransaction` calls with jackpot-specific data
2. Add jackpot contribution logging to bet processing
3. Add jackpot win logging to win processing

### Step 4: Monitoring Setup
1. Configure health check endpoints
2. Set up performance monitoring dashboards
3. Configure alerting for error rates and performance thresholds

## Testing and Validation

**Comprehensive Test Suite:**
- `test-jackpot-error-handling.ts` - Complete test coverage for all error types
- Unit tests for each error class and logging method
- Integration tests for database error handling
- Performance tests for monitoring functionality
- Health check validation tests

**Test Coverage:**
- Error creation and categorization
- Logging format validation
- Performance monitoring accuracy
- Transaction logging integration
- Health check functionality
- Retry logic validation

## Benefits Achieved

1. **Comprehensive Error Handling**
   - 7 error categories with 50+ specific codes
   - Automatic error categorization
   - Retry logic with exponential backoff
   - User-friendly error messages

2. **Complete Audit Trail**
   - Integration with existing `transactionLogTable`
   - Before/after value tracking
   - Operation success/failure status
   - Correlation ID for request tracing

3. **Performance Monitoring**
   - Automatic duration tracking
   - P95 latency calculations
   - Threshold-based alerting
   - Performance statistics aggregation

4. **Operational Visibility**
   - Health check endpoints
   - Structured logging for analytics
   - Error rate monitoring
   - Dashboard-ready metrics

5. **Developer Experience**
   - Structured error context
   - Performance monitoring decorators
   - Type-safe error handling
   - Comprehensive documentation

## Next Steps

1. **Production Integration**
   - Deploy error handling to all jackpot operations
   - Configure monitoring dashboards
   - Set up alerting for critical errors

2. **Performance Optimization**
   - Monitor performance metrics
   - Optimize slow operations
   - Tune retry parameters

3. **Enhanced Monitoring**
   - Add custom metrics for business logic
   - Implement trend analysis
   - Set up predictive alerting

4. **Documentation Updates**
   - Update API documentation with error codes
   - Create operator runbooks
   - Document recovery procedures

The comprehensive error handling and audit logging system is now ready for production deployment and provides robust monitoring, debugging, and operational capabilities for the jackpot system.
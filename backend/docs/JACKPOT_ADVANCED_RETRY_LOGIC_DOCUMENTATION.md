# Advanced Transaction Retry Logic for Jackpot Service

## Overview

This document describes the comprehensive implementation of advanced transaction retry logic for transient database errors in the jackpot service. The system provides resilience against database connection issues, deadlocks, network timeouts, and other transient failures while maintaining data consistency and performance.

## Architecture

### Core Components

1. **Retry Strategies** (`jackpot-retry-strategies.ts`)
   - Linear backoff with configurable delays
   - Exponential backoff for exponential retry intervals
   - Exponential with jitter to prevent thundering herd
   - Custom strategies for specific use cases

2. **Circuit Breaker Pattern** (`jackpot-circuit-breaker.ts`)
   - Automatic circuit opening on repeated failures
   - Gradual recovery with half-open states
   - Configurable failure thresholds and recovery timeouts
   - Expected error handling to prevent false positives

3. **Operation-Specific Wrappers** (`jackpot-retry-wrappers.ts`)
   - Pre-configured wrappers for different operation types
   - Comprehensive metrics and monitoring
   - Integration with existing error handling systems

4. **Configuration System**
   - Operation-specific retry policies
   - Circuit breaker configurations
   - Customizable retry parameters

## Retry Strategies

### Linear Backoff

**Use Case**: Simple, predictable retry delays
**Formula**: `delay = baseDelay * attempt`

```typescript
const linearPolicy = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffStrategy: "linear"
};

// Delays: 100ms, 200ms, 300ms
```

### Exponential Backoff

**Use Case**: Gradual increase in retry delays
**Formula**: `delay = baseDelay * (2 ^ (attempt - 1))`

```typescript
const exponentialPolicy = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffStrategy: "exponential"
};

// Delays: 100ms, 200ms, 400ms
```

### Exponential with Jitter

**Use Case**: Prevent thundering herd in high-load scenarios
**Formula**: `delay = baseDelay * (2 ^ (attempt - 1)) * random_factor`

```typescript
const jitterPolicy = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffStrategy: "exponential_with_jitter",
    jitterFactor: 0.1 // 10% randomization
};

// Delays: ~100ms, ~200ms, ~400ms (with random variation)
```

## Circuit Breaker Pattern

### States

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Circuit is open, requests fail fast
3. **HALF_OPEN**: Testing if the service has recovered

### Configuration

```typescript
const circuitBreakerConfig = {
    failureThreshold: 5,        // Failures before opening circuit
    recoveryTimeout: 30000,     // 30 seconds before trying recovery
    monitoringWindow: 120000,   // 2 minutes for failure tracking
    resetTimeout: 60000,        // Additional timeout for graceful degradation
    expectedError: (error) => {
        // Don't count validation errors against circuit breaker
        return error?.category === "VALIDATION";
    }
};
```

### Health Check

```typescript
const healthCheck = await performCircuitBreakerHealthCheck();
console.log(`Overall health: ${healthCheck.overall}`);
console.log(`Recommendations:`, healthCheck.recommendations);
```

## Operation-Specific Policies

### Jackpot Contribution (`contribute`)

**Purpose**: Add money to jackpot pools
**Retry Policy**: Moderate (3 attempts, exponential with jitter)
**Circuit Breaker**: Standard (3 failures threshold)

```typescript
// Usage
const result = await executeJackpotContributeWithRetry("minor", 1000, {
    userId: "user-123",
    gameId: "game-456"
});

if (result.success) {
    console.log(`Contributed ${result.data.contribution} cents`);
} else {
    console.error(`Contribution failed: ${result.error}`);
}
```

### Jackpot Win Processing (`processWin`)

**Purpose**: Process jackpot wins (money movement)
**Retry Policy**: Conservative (2 attempts, exponential)
**Circuit Breaker**: Very Conservative (2 failures threshold)

```typescript
// Usage
const result = await executeJackpotWinWithRetry("major", 50000, "user-789");

if (result.success) {
    console.log(`Win processed: ${result.data.winAmount} cents`);
} else {
    console.error(`Win processing failed: ${result.error}`);
}
```

### Pool Queries (`getPool`)

**Purpose**: Read jackpot pool data
**Retry Policy**: Lightweight (3 attempts, linear)
**Circuit Breaker**: Standard (5 failures threshold)

```typescript
// Usage
const result = await executeJackpotGetPoolWithRetry("mega");

if (result.success) {
    console.log(`Current amount: ${result.data.currentAmount} cents`);
} else {
    console.error(`Pool query failed: ${result.error}`);
}
```

### Configuration Updates (`updateConfig`)

**Purpose**: Admin configuration changes
**Retry Policy**: Strict (1 attempt, no retries)
**Circuit Breaker**: Very Strict (1 failure threshold)

```typescript
// Usage
const updates = { rate: 0.025, seedAmount: 150000 };
const result = await executeJackpotUpdateConfigWithRetry("minor", updates);

if (result.success) {
    console.log("Configuration updated successfully");
} else {
    console.error(`Config update failed: ${result.error}`);
}
```

## Error Classification

### Retryable Errors

```typescript
const RETRYABLE_ERRORS = [
    "DATABASE_TIMEOUT",
    "DATABASE_DEADLOCK_DETECTED",
    "DATABASE_SERIALIZATION_FAILURE",
    "CONCURRENCY_VERSION_CONFLICT",
    "CONCURRENCY_LOCK_TIMEOUT",
    "NETWORK_TIMEOUT",
    "NETWORK_CONNECTION_LOST"
];
```

### Non-Retryable Errors

```typescript
const NON_RETRYABLE_ERRORS = [
    "VALIDATION_INVALID_AMOUNT",
    "INSUFFICIENT_JACKPOT_FUNDS",
    "VALIDATION_CONSTRAINT_VIOLATION"
];
```

## Monitoring and Metrics

### System Health Assessment

```typescript
const systemHealth = jackpotOperationWrappers.getSystemHealth();
console.log(`Overall health: ${systemHealth.overall}`);
console.log(`Recommendations:`, systemHealth.recommendations);

// Wrapper-specific health
for (const [name, health] of Object.entries(systemHealth.wrapperHealth)) {
    console.log(`${name}: ${health}`);
}
```

### Comprehensive Metrics

```typescript
const metrics = await getRetrySystemMetrics();
console.log("Wrapper metrics:", metrics.wrappers);
console.log("Circuit breaker health:", metrics.circuitBreakers);
console.log("System health:", metrics.systemHealth);
```

### Key Performance Indicators

- **Success Rate**: Target > 95% for production
- **Average Retry Delay**: Should be reasonable (< 5 seconds)
- **Circuit Breaker Activations**: Should be rare (< 1% of requests)
- **Total Execution Time**: Should be acceptable (< 30 seconds for critical operations)

## Configuration Examples

### Development Environment

```typescript
const DEV_CONFIG = {
    contribute: {
        maxAttempts: 5,
        baseDelay: 50,
        maxDelay: 500,
        backoffStrategy: "exponential_with_jitter",
        jitterFactor: 0.2
    },
    processWin: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffStrategy: "exponential"
    }
};

const DEV_CIRCUIT_BREAKER = {
    database: {
        failureThreshold: 10,
        recoveryTimeout: 15000,
        monitoringWindow: 60000,
        resetTimeout: 30000
    }
};
```

### Production Environment

```typescript
const PROD_CONFIG = {
    contribute: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffStrategy: "exponential_with_jitter",
        jitterFactor: 0.1
    },
    processWin: {
        maxAttempts: 2,
        baseDelay: 200,
        maxDelay: 2000,
        backoffStrategy: "exponential"
    }
};

const PROD_CIRCUIT_BREAKER = {
    database: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringWindow: 120000,
        resetTimeout: 60000,
        expectedError: (error) => {
            return error?.code?.startsWith("VALIDATION_");
        }
    }
};
```

## Best Practices

### 1. Error-Specific Delays

```typescript
// Use error-specific delays for better performance
const errorSpecificDelay = getErrorSpecificDelay(error, baseDelay);
// Deadlocks get longer delays (2000ms+)
// Timeouts get medium delays (500ms+)
// Version conflicts get short delays (100ms+)
```

### 2. Custom Retry Policies

```typescript
// For high-traffic operations, use decorrelated jitter
const customPolicy = createCustomRetryPolicy(
    5,           // maxAttempts
    100,         // baseDelay
    5000,        // maxDelay
    "custom",    // backoffStrategy
    {
        customDelayFn: calculateDecorrelatedJitterDelay
    }
);
```

### 3. Monitoring Integration

```typescript
// Set up monitoring hooks
const circuitBreaker = new CircuitBreaker("my-operation", {
    onStateChange: (from, to) => {
        // Log to monitoring system
        console.log(`Circuit breaker ${name}: ${from} -> ${to}`);
        
        // Send alerts if needed
        if (to === "OPEN") {
            alertService.sendAlert(`Circuit breaker opened for ${name}`);
        }
    }
});
```

### 4. Graceful Degradation

```typescript
// Implement fallback strategies
const result = await executeWithCircuitBreaker(
    "database",
    async () => await primaryDatabase.query(),
    async () => await cache.getFallbackData() // Fallback to cache
);

if (!result.success && result.fromCache) {
    // Using cached data, log the degraded state
    console.warn("Operating with cached data due to database issues");
}
```

## Performance Considerations

### 1. Retry Limits

- **Development**: Higher retry limits for debugging
- **Production**: Conservative limits to prevent cascading failures
- **Money Operations**: Minimal retries due to financial implications

### 2. Circuit Breaker Thresholds

- **Database Operations**: 5 failures in 2 minutes
- **Jackpot Operations**: 3 failures in 3 minutes
- **Configuration**: 1 failure in 10 minutes

### 3. Monitoring Impact

- Keep retry operations lightweight
- Use sampling for high-frequency metrics
- Aggregate metrics periodically to reduce overhead

## Troubleshooting

### Common Issues

#### 1. Excessive Retries

**Symptom**: High retry counts, long response times
**Solution**: 
- Check if errors are actually retryable
- Reduce retry attempts
- Implement better error classification

#### 2. Circuit Breaker Opens Frequently

**Symptom**: Circuit breaker frequently transitions to OPEN state
**Solution**:
- Investigate underlying service issues
- Adjust failure threshold
- Check for expected error classification

#### 3. Thundering Herd

**Symptom**: Multiple clients retrying simultaneously
**Solution**:
- Implement jitter in retry delays
- Use decorrelated jitter for high-load scenarios
- Consider exponential backoff

### Debug Mode

```typescript
// Enable debug logging
const debugConfig = {
    enableRetryLogging: true,
    operationTimeout: 60000 // 60 seconds for debugging
};

const wrapper = new RetryOperationWrapper("debug-operation", debugConfig);

// Monitor retry attempts in real-time
const metrics = wrapper.getMetrics();
console.log("Retry metrics:", metrics);
```

### Health Check Endpoints

```typescript
// Example health check endpoint
app.get('/health/jackpot-retry', async (req, res) => {
    const health = await performCircuitBreakerHealthCheck();
    const systemHealth = jackpotOperationWrappers.getSystemHealth();
    
    res.json({
        circuitBreakers: health,
        operations: systemHealth,
        timestamp: new Date().toISOString()
    });
});
```

## Migration Guide

### From Basic Retry

1. **Identify Operations**: List all database operations that need retry logic
2. **Choose Strategies**: Select appropriate retry strategies for each operation type
3. **Configure Policies**: Set up operation-specific retry policies
4. **Test Thoroughly**: Validate behavior under various failure scenarios
5. **Monitor Metrics**: Set up monitoring and alerting

### Gradual Rollout

1. **Phase 1**: Implement read operations (lowest risk)
2. **Phase 2**: Add write operations with conservative settings
3. **Phase 3**: Enable money operations with strict limits
4. **Phase 4**: Fine-tune based on production metrics

## API Reference

### Main Functions

```typescript
// Retry execution
executeWithRetry<T>(operation: string, operationFn: () => Promise<T>, policy: RetryPolicy): Promise<RetryResult<T>>

// Circuit breaker execution  
executeWithCircuitBreaker<T>(operationType: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<CircuitBreakerOperationResult<T>>

// Jackpot-specific operations
executeJackpotContributeWithRetry(group: JackpotGroup, wagerAmount: number, context?: Partial<JackpotErrorContext>)
executeJackpotWinWithRetry(group: JackpotGroup, winAmount: number, userId: string, context?: Partial<JackpotErrorContext>)
executeJackpotGetPoolWithRetry(group: JackpotGroup, context?: Partial<JackpotErrorContext>)
executeJackpotUpdateConfigWithRetry(group: JackpotGroup, updates: Record<string, any>, context?: Partial<JackpotErrorContext>)

// Metrics and monitoring
getRetrySystemMetrics(): Promise<SystemMetrics>
performCircuitBreakerHealthCheck(): Promise<CircuitBreakerHealth>
jackpotOperationWrappers.getSystemHealth(): SystemHealth
```

### Configuration Types

```typescript
interface RetryPolicy {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffStrategy: "linear" | "exponential" | "exponential_with_jitter" | "custom";
    jitterFactor?: number;
    customDelayFn?: (attempt: number, baseDelay: number, maxDelay: number) => number;
}

interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    expectedError?: (error: any) => boolean;
    onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
    monitoringWindow?: number;
    resetTimeout?: number;
}
```

## Conclusion

The advanced retry logic system provides comprehensive resilience for the jackpot service against transient database errors. Key benefits include:

- **Improved Reliability**: Automatic recovery from transient failures
- **Resource Protection**: Circuit breaker prevents cascading failures  
- **Operational Insight**: Comprehensive metrics and monitoring
- **Configurability**: Flexible policies for different operation types
- **Performance**: Optimized retry strategies with jitter to prevent thundering herd

The system maintains backward compatibility while significantly improving system resilience and providing valuable operational insights for monitoring and troubleshooting.
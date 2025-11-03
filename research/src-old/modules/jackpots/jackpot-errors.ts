/**
 * Comprehensive error handling system for jackpot operations
 * Provides structured error classification, logging, and debugging capabilities
 */

// Import existing types and schemas
import type { JackpotGroup } from "./jackpot.service";

export type JackpotErrorCategory =
    | "VALIDATION"
    | "DATABASE"
    | "CONCURRENCY"
    | "CONFIGURATION"
    | "INSUFFICIENT_FUNDS"
    | "SYSTEM"
    | "NETWORK";

export type JackpotErrorCode =
    // Validation errors (1000-1999)
    | "VALIDATION_INVALID_GROUP"
    | "VALIDATION_INVALID_AMOUNT"
    | "VALIDATION_INVALID_CONFIG"
    | "VALIDATION_INVALID_USER"
    | "VALIDATION_INVALID_GAME"
    | "VALIDATION_MISSING_REQUIRED_FIELD"
    | "VALIDATION_CONSTRAINT_VIOLATION"

    // Database errors (2000-2999)
    | "DATABASE_CONNECTION_FAILED"
    | "DATABASE_TIMEOUT"
    | "DATABASE_CONSTRAINT_VIOLATION"
    | "DATABASE_FOREIGN_KEY_VIOLATION"
    | "DATABASE_UNIQUE_VIOLATION"
    | "DATABASE_SERIALIZATION_FAILURE"
    | "DATABASE_DEADLOCK_DETECTED"

    // Concurrency errors (3000-3999)
    | "CONCURRENCY_VERSION_CONFLICT"
    | "CONCURRENCY_LOCK_TIMEOUT"
    | "CONCURRENCY_LOCK_HELD_BY_OTHER"
    | "CONCURRENCY_RETRY_EXHAUSTED"
    | "CONCURRENCY_OPERATION_INTERRUPTED"

    // Configuration errors (4000-4999)
    | "CONFIG_INVALID_RATE"
    | "CONFIG_INVALID_SEED_AMOUNT"
    | "CONFIG_INVALID_MAX_AMOUNT"
    | "CONFIG_MISSING_GROUP"
    | "CONFIG_UPDATE_FAILED"

    // Insufficient funds errors (5000-5999)
    | "INSUFFICIENT_JACKPOT_FUNDS"
    | "INSUFFICIENT_USER_FUNDS"
    | "JACKPOT_EXCEEDS_MAX_AMOUNT"

    // System errors (6000-6999)
    | "SYSTEM_INITIALIZATION_FAILED"
    | "SYSTEM_TRANSACTION_FAILED"
    | "SYSTEM_UNEXPECTED_STATE"
    | "SYSTEM_OPERATION_NOT_SUPPORTED"

    // Network errors (7000-7999)
    | "NETWORK_TIMEOUT"
    | "NETWORK_CONNECTION_LOST"
    | "NETWORK_SERVICE_UNAVAILABLE";

export interface JackpotErrorContext
{
    operationId: string;
    correlationId?: string;
    userId?: string;
    gameId?: string;
    group?: JackpotGroup;
    requestId?: string;
    sessionId?: string;
    timestamp: Date;
    duration?: number;
    retryCount?: number;
    version?: number;
    [key: string]: any;
}

export interface JackpotErrorDetails
{
    code: JackpotErrorCode;
    category: JackpotErrorCategory;
    message: string;
    technicalDetails?: string;
    suggestedAction?: string;
    context: JackpotErrorContext;
    originalError?: Error;
    stackTrace?: string;
}

/**
 * Base class for all jackpot-specific errors
 */
export class JackpotError extends Error
{
    public readonly code: JackpotErrorCode;
    public readonly category: JackpotErrorCategory;
    public readonly context: JackpotErrorContext;
    public readonly timestamp: Date;
    public readonly originalError?: Error;

    constructor(
        message: string,
        code: JackpotErrorCode,
        category: JackpotErrorCategory,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message);
        this.name = "JackpotError";
        this.code = code;
        this.category = category;
        this.context = context;
        this.timestamp = new Date();
        this.originalError = originalError;

        // Capture stack trace for debugging
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, JackpotError);
        }
    }

    /**
     * Convert error to structured format for logging
     */
    toLogEntry(): JackpotErrorDetails
    {
        return {
            code: this.code,
            category: this.category,
            message: this.message,
            technicalDetails: this.technicalDetails,
            suggestedAction: this.suggestedAction,
            context: this.context,
            originalError: this.originalError,
            stackTrace: this.stack,
        };
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(): string
    {
        switch (this.category) {
            case "VALIDATION":
                return "Invalid request data provided";
            case "INSUFFICIENT_FUNDS":
                return "Insufficient funds available";
            case "DATABASE":
                return "Database operation failed";
            case "CONCURRENCY":
                return "Operation conflict detected, please try again";
            case "CONFIGURATION":
                return "Configuration error encountered";
            case "NETWORK":
                return "Network connection issue";
            case "SYSTEM":
                return "System error occurred";
            default:
                return "An error occurred processing your request";
        }
    }

    /**
     * Check if error can be retried
     */
    isRetryable(): boolean
    {
        return [
            "DATABASE_TIMEOUT",
            "CONCURRENCY_VERSION_CONFLICT",
            "CONCURRENCY_LOCK_TIMEOUT",
            "NETWORK_TIMEOUT",
            "NETWORK_CONNECTION_LOST"
        ].includes(this.code);
    }

    /**
     * Get suggested retry delay in milliseconds
     */
    getRetryDelay(): number
    {
        switch (this.code) {
            case "CONCURRENCY_VERSION_CONFLICT":
                return 100; // Short delay for version conflicts
            case "CONCURRENCY_LOCK_TIMEOUT":
                return 500; // Medium delay for lock timeouts
            case "DATABASE_TIMEOUT":
            case "NETWORK_TIMEOUT":
                return 1000; // Longer delay for timeouts
            case "DATABASE_DEADLOCK_DETECTED":
                return 2000; // Longest delay for deadlocks
            default:
                return 500;
        }
    }

    protected technicalDetails?: string;
    protected suggestedAction?: string;
}

// ========================================
// VALIDATION ERRORS
// ========================================

export class ValidationError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "VALIDATION", context, originalError);
        this.name = "ValidationError";
        this.suggestedAction = "Please check your input data and try again";
    }
}

// ========================================
// DATABASE ERRORS
// ========================================

export class DatabaseError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "DATABASE", context, originalError);
        this.name = "DatabaseError";
        this.technicalDetails = originalError?.message;
        this.suggestedAction = "Please try again in a moment";
    }
}

// ========================================
// CONCURRENCY ERRORS
// ========================================

export class ConcurrencyError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "CONCURRENCY", context, originalError);
        this.name = "ConcurrencyError";
        this.suggestedAction = "Please try again in a moment";
    }
}

// ========================================
// CONFIGURATION ERRORS
// ========================================

export class ConfigurationError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "CONFIGURATION", context, originalError);
        this.name = "ConfigurationError";
        this.suggestedAction = "Please contact support if the problem persists";
    }
}

// ========================================
// INSUFFICIENT FUNDS ERRORS
// ========================================

export class InsufficientFundsError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "INSUFFICIENT_FUNDS", context, originalError);
        this.name = "InsufficientFundsError";
        this.suggestedAction = "Please check your account balance and try again";
    }
}

// ========================================
// SYSTEM ERRORS
// ========================================

export class SystemError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "SYSTEM", context, originalError);
        this.name = "SystemError";
        this.suggestedAction = "Please try again later or contact support";
    }
}

// ========================================
// NETWORK ERRORS
// ========================================

export class NetworkError extends JackpotError
{
    constructor(
        message: string,
        code: JackpotErrorCode,
        context: JackpotErrorContext,
        originalError?: Error
    )
    {
        super(message, code, "NETWORK", context, originalError);
        this.name = "NetworkError";
        this.suggestedAction = "Please check your connection and try again";
    }
}

// ========================================
// ERROR FACTORY FUNCTIONS
// ========================================

/**
 * Create a validation error with proper context
 */
export function createValidationError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): ValidationError
{
    return new ValidationError(message, code, context, originalError);
}

/**
 * Create a database error with proper context and error categorization
 */
export function createDatabaseError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): DatabaseError
{
    // Auto-detect database error type if not explicitly provided
    if (code.startsWith("DATABASE_") && originalError) {
        const errorMessage = originalError.message.toLowerCase();

        if (errorMessage.includes("timeout") || originalError.message.includes("timeout")) {
            code = "DATABASE_TIMEOUT";
        } else if (errorMessage.includes("deadlock") || errorMessage.includes("deadlocked")) {
            code = "DATABASE_DEADLOCK_DETECTED";
        } else if (errorMessage.includes("foreign key") || errorMessage.includes("violates foreign key")) {
            code = "DATABASE_FOREIGN_KEY_VIOLATION";
        } else if (errorMessage.includes("unique") || errorMessage.includes("duplicate")) {
            code = "DATABASE_UNIQUE_VIOLATION";
        } else if (errorMessage.includes("serialization")) {
            code = "DATABASE_SERIALIZATION_FAILURE";
        }
    }

    return new DatabaseError(message, code, context, originalError);
}

/**
 * Create a concurrency error with proper context
 */
export function createConcurrencyError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): ConcurrencyError
{
    return new ConcurrencyError(message, code, context, originalError);
}

/**
 * Create a configuration error with proper context
 */
export function createConfigurationError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): ConfigurationError
{
    return new ConfigurationError(message, code, context, originalError);
}

/**
 * Create an insufficient funds error with proper context
 */
export function createInsufficientFundsError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): InsufficientFundsError
{
    return new InsufficientFundsError(message, code, context, originalError);
}

/**
 * Create a system error with proper context
 */
export function createSystemError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): SystemError
{
    return new SystemError(message, code, context, originalError);
}

/**
 * Create a network error with proper context
 */
export function createNetworkError(
    message: string,
    code: JackpotErrorCode,
    context: JackpotErrorContext,
    originalError?: Error
): NetworkError
{
    return new NetworkError(message, code, context, originalError);
}

/**
 * Convert generic error to appropriate jackpot error
 */
export function categorizeError(
    error: Error,
    context: JackpotErrorContext,
    defaultCategory: JackpotErrorCategory = "SYSTEM"
): JackpotError
{
    // Check if it's already a jackpot error
    if (error instanceof JackpotError) {
        return error;
    }

    // Auto-categorize based on error message and type
    const errorMessage = error.message.toLowerCase();

    // Database errors
    if (
        errorMessage.includes("database") ||
        errorMessage.includes("sql") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("deadlock") ||
        errorMessage.includes("constraint") ||
        errorMessage.includes("foreign key") ||
        errorMessage.includes("unique")
    ) {
        return createDatabaseError(
            "Database operation failed",
            "DATABASE_CONNECTION_FAILED",
            context,
            error
        );
    }

    // Concurrency errors  
    if (
        errorMessage.includes("concurrent") ||
        errorMessage.includes("version") ||
        errorMessage.includes("lock") ||
        errorMessage.includes("conflict")
    ) {
        return createConcurrencyError(
            "Concurrency conflict detected",
            "CONCURRENCY_VERSION_CONFLICT",
            context,
            error
        );
    }

    // Network errors
    if (
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("connection")
    ) {
        return createNetworkError(
            "Network operation failed",
            "NETWORK_TIMEOUT",
            context,
            error
        );
    }

    // Validation errors
    if (
        errorMessage.includes("validation") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("required")
    ) {
        return createValidationError(
            "Validation failed",
            "VALIDATION_INVALID_AMOUNT",
            context,
            error
        );
    }

    // Insufficient funds
    if (
        errorMessage.includes("insufficient") ||
        errorMessage.includes("not enough") ||
        errorMessage.includes("exceeds")
    ) {
        return createInsufficientFundsError(
            "Insufficient funds",
            "INSUFFICIENT_JACKPOT_FUNDS",
            context,
            error
        );
    }

    // Default to system error
    return createSystemError(
        "System error occurred",
        "SYSTEM_UNEXPECTED_STATE",
        context,
        error
    );
}

/**
 * Check if error code indicates a retryable error
 */
export function isRetryableError(code: JackpotErrorCode): boolean
{
    const retryableCodes: JackpotErrorCode[] = [
        "DATABASE_TIMEOUT",
        "DATABASE_DEADLOCK_DETECTED",
        "DATABASE_SERIALIZATION_FAILURE",
        "CONCURRENCY_VERSION_CONFLICT",
        "CONCURRENCY_LOCK_TIMEOUT",
        "NETWORK_TIMEOUT",
        "NETWORK_CONNECTION_LOST",
    ];

    return retryableCodes.includes(code);
}

/**
 * Get error severity level for monitoring
 */
export function getErrorSeverity(error: JackpotError): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
{
    switch (error.category) {
        case "VALIDATION":
            return "LOW"; // User input errors
        case "INSUFFICIENT_FUNDS":
            return "MEDIUM"; // Business logic errors
        case "DATABASE":
        case "CONCURRENCY":
            return "HIGH"; // System performance issues
        case "CONFIGURATION":
        case "SYSTEM":
            return "CRITICAL"; // System integrity issues
        case "NETWORK":
            return "MEDIUM"; // Transient issues
        default:
            return "MEDIUM";
    }
}
/**
 * Structured logging service for application operations
 * Provides comprehensive audit trails, performance monitoring, and correlation tracking
 */

import { AppError, getErrorSeverity, type LogContext } from "@/core/errors/app-errors";

// ========================================
// LOG TYPES AND INTERFACES
// ========================================

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface AppLogEntry {
	timestamp: string;
	level: LogLevel;
	category: "AUDIT" | "ERROR" | "PERFORMANCE" | "TRANSACTION" | "CONFIG" | "HEALTH";
	operationId: string;
	correlationId?: string;
	userId?: string;
	gameId?: string;
	domain?: string;
	message: string;
	details?: Record<string, any>;
	duration?: number;
	error?: {
		code: string;
		category: string;
		severity: string;
		stack?: string;
	};
	metadata?: Record<string, any>;
}

// ========================================
// CORRELATION ID GENERATION
// ========================================

/**
 * Generate unique correlation ID for tracking requests across services
 */
export function generateCorrelationId(): string {
	return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique operation ID for specific operations
 */
export function generateOperationId(): string {
	return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========================================
// LOG ENTRY CREATION
// ========================================

/**
 * Create a structured log entry
 */
function createLogEntry(
	level: LogLevel,
	category: AppLogEntry["category"],
	message: string,
	context: LogContext,
	details?: Record<string, any>,
	error?: any,
	duration?: number,
): AppLogEntry {
	const entry: AppLogEntry = {
		timestamp: new Date().toISOString(),
		level,
		category,
		operationId: context.operationId,
		correlationId: context.correlationId,
		userId: context.userId,
		gameId: context.gameId,
		domain: context.domain,
		message,
		details,
		duration,
	};

	if (error) {
		if ((error as AppError).isAppError) {
			const appError = error as AppError;
			entry.error = {
				code: appError.code,
				category: appError.category,
				severity: getErrorSeverity(appError),
				stack: appError.stack,
			};
		} else if (error instanceof Error) {
			entry.error = {
				code: "UNKNOWN_ERROR",
				category: "UNKNOWN",
				severity: "MEDIUM",
				stack: error.stack,
			};
		}
	}

	return entry;
}

// ========================================
// JSON LOGGING FORMATTER
// ========================================

/**
 * Format log entry as JSON string for structured logging
 */
function formatAsJson(entry: AppLogEntry): string {
	return JSON.stringify(entry);
}

/**
 * Format log entry for console output with colors and formatting
 */
function formatForConsole(entry: AppLogEntry): string {
	const timestamp = entry.timestamp;
	const level = entry.level.padEnd(5);
	const category = entry.category.padEnd(12);
	const opId = entry.operationId;

	let formatted = `[${timestamp}] ${level} [${category}] ${opId}`;

	if (entry.correlationId) {
		formatted += ` (${entry.correlationId})`;
	}

	formatted += `: ${entry.message}`;

	if (entry.userId) {
		formatted += ` | User: ${entry.userId}`;
	}

	if (entry.domain) {
		formatted += ` | Domain: ${entry.domain}`;
	}

	if (entry.duration !== undefined) {
		formatted += ` | Duration: ${entry.duration}ms`;
	}

	if (entry.details) {
		formatted += `\n  Details: ${JSON.stringify(entry.details, null, 2)}`;
	}

	if (entry.error) {
		formatted += `\n  Error: ${entry.error.code} (${entry.error.category})`;
		if (entry.error.stack) {
			formatted += `\n  Stack: ${entry.error.stack}`;
		}
	}

	return formatted;
}

// ========================================
// APP LOGGING SERVICE
// ========================================

class AppLogger {
	private isDevelopment: boolean;
	private performanceMetrics: Map<string, number[]> = new Map();

	constructor() {
		this.isDevelopment = process.env.NODE_ENV === "development";
	}

	/**
	 * Log audit entry for application operations
	 */
	audit(message: string, context: LogContext, details?: Record<string, any>): void {
		const entry = createLogEntry("INFO", "AUDIT", message, context, details);
		this.writeLog(entry);
	}

	/**
	 * Log error with full context and error details
	 */
	error(message: string, context: LogContext, error?: any, details?: Record<string, any>): void {
		const entry = createLogEntry("ERROR", "ERROR", message, context, details, error);
		this.writeLog(entry);
	}

	/**
	 * Log warning for non-critical issues
	 */
	warn(message: string, context: LogContext, details?: Record<string, any>): void {
		const entry = createLogEntry("WARN", "ERROR", message, context, details);
		this.writeLog(entry);
	}

	/**
	 * Log informational message
	 */
	info(message: string, context: LogContext, details?: Record<string, any>): void {
		const entry = createLogEntry("INFO", "TRANSACTION", message, context, details);
		this.writeLog(entry);
	}

	/**
	 * Log configuration change
	 */
	config(action: string, context: LogContext, oldValue?: any, newValue?: any, details?: Record<string, any>): void {
		const configDetails = {
			action,
			oldValue,
			newValue,
			...details,
		};

		const entry = createLogEntry("INFO", "CONFIG", `Configuration ${action}`, context, configDetails);
		this.writeLog(entry);
	}

	/**
	 * Log performance metrics
	 */
	performance(operation: string, context: LogContext, duration: number, details?: Record<string, any>): void {
		const perfDetails = {
			operation,
			duration,
			threshold: 300, // 300ms threshold from existing code
			...details,
		};

		const level: LogLevel = duration > 300 ? "WARN" : "DEBUG";
		const entry = createLogEntry(
			level,
			"PERFORMANCE",
			`Performance: ${operation}`,
			context,
			perfDetails,
			undefined,
			duration,
		);

		// Track metrics for reporting
		this.trackPerformance(operation, duration);

		this.writeLog(entry);
	}

	/**
	 * Log transaction details
	 */
	transaction(
		action: string,
		context: LogContext,
		amount?: number,
		success: boolean = true,
		details?: Record<string, any>,
	): void {
		const transactionDetails = {
			action,
			amount,
			success,
			...details,
		};

		const level: LogLevel = success ? "INFO" : "ERROR";
		const entry = createLogEntry(level, "TRANSACTION", `Transaction: ${action}`, context, transactionDetails);
		this.writeLog(entry);
	}

	/**
	 * Log health check results
	 */
	health(
		service: string,
		status: "HEALTHY" | "UNHEALTHY" | "DEGRADED",
		responseTime: number,
		details?: Record<string, any>,
	): void {
		const healthDetails = {
			service,
			status,
			responseTime,
			...details,
		};

		const level: LogLevel = status === "HEALTHY" ? "INFO" : status === "DEGRADED" ? "WARN" : "ERROR";
		const entry = createLogEntry(
			level,
			"HEALTH",
			`Health Check: ${service}`,
			{ operationId: generateOperationId(), timestamp: new Date() },
			healthDetails,
			undefined,
			responseTime,
		);
		this.writeLog(entry);
	}

	/**
	 * Log a domain-specific event
	 */
	event(
		action: string,
		context: LogContext,
		amount: number,
		success: boolean = true,
		details?: Record<string, any>,
	): void {
		const eventDetails = {
			action,
			amount,
			success,
			...details,
		};

		const level: LogLevel = success ? "INFO" : "ERROR";
		const entry = createLogEntry(level, "AUDIT", `Event ${action}: ${amount}`, context, eventDetails);
		this.writeLog(entry);
	}

	/**
	 * Log concurrency operation
	 */
	concurrency(
		operation: string,
		context: LogContext,
		strategy: "OPTIMISTIC" | "PESSIMISTIC" | "BATCH",
		success: boolean,
		retryCount: number = 0,
		details?: Record<string, any>,
	): void {
		const concurrencyDetails = {
			operation,
			strategy,
			retryCount,
			success,
			...details,
		};

		const level: LogLevel = success ? "INFO" : "WARN";
		const entry = createLogEntry(level, "TRANSACTION", `Concurrency ${operation}`, context, concurrencyDetails);
		this.writeLog(entry);
	}

	/**
	 * Write log entry to output
	 */
	private writeLog(entry: AppLogEntry): void {
		const jsonLog = formatAsJson(entry);

		if (this.isDevelopment) {
			// Enhanced console output in development
			const consoleFormatted = formatForConsole(entry);

			switch (entry.level) {
				case "ERROR":
				case "FATAL":
					console.error(consoleFormatted);
					break;
				case "WARN":
					console.warn(consoleFormatted);
					break;
				default:
					console.log(consoleFormatted);
			}
		}

		// In production, you would send to your logging service
		// For now, we'll use console output that can be parsed
		console.log(jsonLog);
	}

	/**
	 * Track performance metrics for reporting
	 */
	private trackPerformance(operation: string, duration: number): void {
		if (!this.performanceMetrics.has(operation)) {
			this.performanceMetrics.set(operation, []);
		}

		const metrics = this.performanceMetrics.get(operation)!;
		metrics.push(duration);

		// Keep only last 100 measurements
		if (metrics.length > 100) {
			metrics.shift();
		}
	}

	/**
	 * Get performance statistics for a specific operation
	 */
	getPerformanceStats(operation: string): {
		count: number;
		average: number;
		min: number;
		max: number;
		p95: number;
	} {
		const metrics = this.performanceMetrics.get(operation) || [];

		if (metrics.length === 0) {
			return {
				count: 0,
				average: 0,
				min: 0,
				max: 0,
				p95: 0,
			};
		}

		const sorted = [...metrics].sort((a, b) => a - b);
		const count = metrics.length;
		const average = metrics.reduce((sum, val) => sum + val, 0) / count;
		const min = sorted[0]!;
		const max = sorted[count - 1]!;
		const p95Index = Math.floor(count * 0.95);
		const p95 = sorted[p95Index]!;

		return {
			count,
			average: Math.round(average),
			min,
			max,
			p95,
		};
	}

	/**
	 * Get all performance statistics
	 */
	getAllPerformanceStats(): Record<string, ReturnType<AppLogger["getPerformanceStats"]>> {
		const stats: Record<string, any> = {};

		for (const [operation] of this.performanceMetrics) {
			stats[operation] = this.getPerformanceStats(operation);
		}

		return stats;
	}

	/**
	 * Clear performance metrics
	 */
	clearPerformanceMetrics(): void {
		this.performanceMetrics.clear();
	}
}

// Export singleton instance
export const appLogger = new AppLogger();

// ========================================
// PERFORMANCE MONITORING DECORATORS
// ========================================

/**
 * Decorator for automatic performance logging
 */
export function logPerformance(operation: string, context?: Partial<LogContext>) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			const startTime = Date.now();
			const operationId = generateOperationId();
			const correlationId = generateCorrelationId();

			const methodContext: LogContext = {
				operationId,
				correlationId,
				timestamp: new Date(),
				...context,
			};

			try {
				appLogger.info(`Starting ${operation}`, methodContext, {
					method: propertyKey,
					args: args.length,
				});

				const result = await originalMethod.apply(this, args);
				const duration = Date.now() - startTime;

				appLogger.performance(operation, methodContext, duration, {
					method: propertyKey,
					args: args.length,
				});

				return result;
_			} catch (error) {
				const duration = Date.now() - startTime;

				appLogger.error(`${operation} failed after ${duration}ms`, methodContext, error, {
					method: propertyKey,
					args: args.length,
					duration,
				});

				throw error;
			}
		};

		return descriptor;
	};
}

// ========================================
// AUDIT TRAIL INTEGRATION
// ========================================

/**
 * Log an application operation to the audit trail
 */
export function logAppAudit(
	operation: string,
	context: LogContext,
	data: {
		userId?: string;
		gameId?: string;
		domain?: string;
		amount?: number;
		oldValue?: any;
		newValue?: any;
		success: boolean;
		error?: any;
	},
): void {
	const auditDetails = {
		operation,
		...data,
		timestamp: new Date().toISOString(),
	};

	appLogger.audit(`App ${operation}`, context, auditDetails);

	// Also log to error channel if failed
	if (!data.success && data.error) {
		appLogger.error(`App ${operation} failed`, context, data.error, auditDetails);
	}
}

// ========================================
// CONTEXT UTILITIES
// ========================================

/**
 * Create operation context with correlation tracking
 */
export function createOperationContext(baseContext: Partial<LogContext> = {}): LogContext {
	return {
		operationId: generateOperationId(),
		correlationId: generateCorrelationId(),
		timestamp: new Date(),
		...baseContext,
	};
}

/**
 * Extend existing context for nested operations
 */
export function extendContext(parentContext: LogContext, additionalContext: Partial<LogContext>): LogContext {
	return {
		...parentContext,
		...additionalContext,
		// Generate new operation ID for nested operation
		operationId: generateOperationId(),
		// Preserve correlation ID for request tracing
		correlationId: parentContext.correlationId,
	};
}

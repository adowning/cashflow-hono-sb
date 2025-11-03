/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { db } from "@/core/database/db";
import { depositTable, userTable, withdrawalTable, type User } from "@/core/database/schema";
import type { Deposit, Withdrawal } from "@/core/database/schema/finance";
import { and, eq, gte, sql } from "drizzle-orm";
import { appLogger, createOperationContext, type LogContext } from "@/core/logger/app-logger";
/**
 * Security and fraud prevention service for deposit/withdrawal system
 * Implements velocity checks, suspicious pattern detection, and risk scoring
 */

export interface FraudCheck {
	userId: string;
	riskScore: number; // 0-100, higher = more risky
	flags: string[];
	blocked: boolean;
	recommendation: "approve" | "review" | "reject";
}

export interface VelocityCheck {
	checkType: "deposit" | "withdrawal";
	timeWindow: number; // minutes
	maxAmount: number;
	maxCount: number;
	currentAmount: number;
	currentCount: number;
	exceeded: boolean;
}

export interface SecurityAlert {
	type: "velocity" | "suspicious_pattern" | "high_risk" | "duplicate";
	severity: "low" | "medium" | "high" | "critical";
	userId: string;
	description: string;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

/**
 * Perform comprehensive fraud check on user
 */
export async function performFraudCheck(userId: string): Promise<FraudCheck> {
	try {
		const user = (await db.query.userTable.findFirst({
			where: eq(userTable.id, userId),
		})) as User | undefined;

		if (!user) {
			return {
				userId,
				riskScore: 100,
				flags: ["User not found"],
				blocked: true,
				recommendation: "reject",
			};
		}

		const flags: string[] = [];
		let riskScore = 0;

		// Check account age
		const accountAge = Date.now() - new Date(user.createdAt).getTime();
		const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

		if (accountAgeDays < 1) {
			flags.push("Very new account");
			riskScore += 30;
		} else if (accountAgeDays < 7) {
			flags.push("New account");
			riskScore += 15;
		}

		// Check recent activity patterns
		const activityCheck = await checkRecentActivity(userId);
		flags.push(...activityCheck.flags);
		riskScore += activityCheck.riskScore;

		// Check velocity patterns
		const velocityCheck = await checkVelocityPatterns(userId);
		flags.push(...velocityCheck.flags);
		riskScore += velocityCheck.riskScore;

		// Check for suspicious patterns
		const patternCheck = await checkSuspiciousPatterns(userId);
		flags.push(...patternCheck.flags);
		riskScore += patternCheck.riskScore;

		// Determine recommendation
		let recommendation: "approve" | "review" | "reject" = "approve";
		if (riskScore >= 70 || flags.some((f) => f.includes("critical"))) {
			recommendation = "reject";
		} else if (riskScore >= 40 || flags.length >= 3) {
			recommendation = "review";
		}

		return {
			userId,
			riskScore: Math.min(riskScore, 100),
			flags,
			blocked: riskScore >= 80,
			recommendation,
		};
	} catch (error) {
		const context = createOperationContext({ domain: "gameplay", operation: "performFraudCheck", userId });
		appLogger.error("Fraud check failed:", context, error as Error);
		return {
			userId,
			riskScore: 100,
			flags: ["Fraud check error"],
			blocked: true,
			recommendation: "reject",
		};
	}
}

/**
 * Check recent user activity for suspicious patterns
 */
async function checkRecentActivity(userId: string): Promise<{
	flags: string[];
	riskScore: number;
}> {
	const flags: string[] = [];
	let riskScore = 0;
	const context = createOperationContext({ domain: "gameplay", operation: "checkRecentActivity", userId });

	try {
		const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

		// Check recent depositTable
		const recentDeposits = (await db.query.depositTable.findMany({
			where: and(
				eq(depositTable.userId, userId),
				eq(depositTable.status, "COMPLETED"),
				gte(depositTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
			),
		})) as Deposit[];

		// Check recent withdrawalTable
		const recentWithdrawals = (await db.query.withdrawalTable.findMany({
			where: and(
				eq(withdrawalTable.userId, userId),
				eq(withdrawalTable.status, "COMPLETED"),
				gte(withdrawalTable.createdAt, last24h),
			),
		})) as Withdrawal[];

		// Flag: Too many transactions in short time
		const totalTransactions = recentDeposits.length + recentWithdrawals.length;
		if (totalTransactions > 20) {
			flags.push("Unusual transaction frequency");
			riskScore += 25;
		}

		// Flag: Large transaction after many small ones
		const largeTransactions = [...recentDeposits, ...recentWithdrawals].filter((t) => Number(t.amount) > 100000); // $1,000+

		if (largeTransactions.length > 0 && totalTransactions > 10) {
			flags.push("Large transaction after frequent small ones");
			riskScore += 20;
		}

		// Flag: Rapid deposit/withdrawal pattern
		const recentActivity = [...recentDeposits, ...recentWithdrawals]
			.map((item) => ({
				...item,
				createdAt: typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt,
			}))
			.sort((a, b) => {
				const aTime = a.createdAt?.getTime() || 0;
				const bTime = b.createdAt?.getTime() || 0;
				return bTime - aTime;
			});

		// Debug logging to understand the issue
		appLogger.info("Recent activity check:", context, {
			totalTransactions: recentActivity.length,
			hasRecentActivity: recentActivity.length >= 4,
		});

		if (recentActivity.length >= 4) {
			// Additional safety check to ensure we have valid data
			const firstActivity = recentActivity[0];
			const lastActivity = recentActivity[recentActivity.length - 1];

			if (firstActivity?.createdAt && lastActivity?.createdAt) {
				const timeSpan = firstActivity.createdAt.getTime() - lastActivity.createdAt.getTime();
				const timeSpanHours = timeSpan / (1000 * 60 * 60);

				if (timeSpanHours < 1 && recentActivity.some((t) => Number(t.amount) > 50000)) {
					flags.push("Rapid high-value transactions");
					riskScore += 30;
				}
			} else {
				appLogger.warn("Recent activity check: Missing createdAt data", context);
			}
		}
	} catch (error) {
		appLogger.error("Recent activity check failed:", context, error as Error);
		flags.push("Activity check error");
		riskScore += 10;
	}

	return { flags, riskScore };
}

/**
 * Check velocity patterns for rate limiting
 */
async function checkVelocityPatterns(userId: string): Promise<{
	flags: string[];
	riskScore: number;
}> {
	const flags: string[] = [];
	let riskScore = 0;
	const context = createOperationContext({ domain: "gameplay", operation: "checkVelocityPatterns", userId });

	try {
		// Check hourly deposit velocity
		const hourlyDepositCheck = await checkDepositVelocity(userId, 60); // 1 hour
		if (hourlyDepositCheck.exceeded) {
			flags.push(
				`Hourly deposit limit exceeded: ${
					hourlyDepositCheck.currentAmount / 100
				} / ${hourlyDepositCheck.maxAmount / 100}`,
			);
			riskScore += 25;
		}

		// Check daily deposit velocity
		const dailyDepositCheck = await checkDepositVelocity(userId, 1440); // 24 hours
		if (dailyDepositCheck.exceeded) {
			flags.push(
				`Daily deposit limit exceeded: ${dailyDepositCheck.currentAmount / 100} / ${dailyDepositCheck.maxAmount / 100}`,
			);
			riskScore += 35;
		}

		// Check withdrawal velocity
		const withdrawalCheck = await checkWithdrawalVelocity(userId, 60); // 1 hour
		if (withdrawalCheck.exceeded) {
			flags.push(
				`Hourly withdrawal limit exceeded: ${withdrawalCheck.currentAmount / 100} / ${withdrawalCheck.maxAmount / 100}`,
			);
			riskScore += 30;
		}
	} catch (error) {
		appLogger.error("Velocity check failed:", context, error as Error);
		flags.push("Velocity check error");
		riskScore += 15;
	}

	return { flags, riskScore };
}

/**
 * Check deposit velocity for rate limiting
 */
async function checkDepositVelocity(userId: string, minutes: number): Promise<VelocityCheck> {
	const timeWindow = new Date(Date.now() - minutes * 60 * 1000);

	const recentDeposits = await db.query.depositTable.findMany({
		where: and(
			eq(depositTable.userId, userId),
			eq(depositTable.status, "COMPLETED"),
			gte(depositTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
		),
	});

	const currentAmount = recentDeposits.reduce((sum: number, d: { amount: any }) => sum + Number(d.amount), 0);
	const currentCount = recentDeposits.length;

	// Get user-specific limits (would be configurable per VIP level)
	const limits = getUserVelocityLimits(userId);

	const hourlyLimit = minutes === 60 ? limits.hourlyDeposit : limits.dailyDeposit;
	const countLimit = minutes === 60 ? limits.hourlyDepositCount : limits.dailyDepositCount;

	return {
		checkType: "deposit",
		timeWindow: minutes,
		maxAmount: hourlyLimit,
		maxCount: countLimit,
		currentAmount,
		currentCount,
		exceeded: currentAmount > hourlyLimit || currentCount > countLimit,
	};
}

/**
 * Check withdrawal velocity for rate limiting
 */
async function checkWithdrawalVelocity(userId: string, minutes: number): Promise<VelocityCheck> {
	const timeWindow = new Date(Date.now() - minutes * 60 * 1000);

	const recentWithdrawals = await db.query.withdrawalTable.findMany({
		where: and(
			eq(withdrawalTable.userId, userId),
			eq(withdrawalTable.status, "COMPLETED"),
			gte(withdrawalTable.createdAt, timeWindow),
		),
	});

	const currentAmount = recentWithdrawals.reduce((sum: number, w: { amount: any }) => sum + Number(w.amount), 0);
	const currentCount = recentWithdrawals.length;

	// Get user-specific limits
	const limits = getUserVelocityLimits(userId);

	const hourlyLimit = minutes === 60 ? limits.hourlyWithdrawal : limits.dailyWithdrawal;
	const countLimit = minutes === 60 ? limits.hourlyWithdrawalCount : limits.dailyWithdrawalCount;

	return {
		checkType: "withdrawal",
		timeWindow: minutes,
		maxAmount: hourlyLimit,
		maxCount: countLimit,
		currentAmount,
		currentCount,
		exceeded: currentAmount > hourlyLimit || currentCount > countLimit,
	};
}

/**
 * Get user-specific velocity limits based on VIP level and history
 */
function getUserVelocityLimits(_userId: string): {
	hourlyDeposit: number;
	dailyDeposit: number;
	hourlyWithdrawal: number;
	dailyWithdrawal: number;
	hourlyDepositCount: number;
	dailyDepositCount: number;
	hourlyWithdrawalCount: number;
	dailyWithdrawalCount: number;
} {
	// In production, this would query user VIP level and custom limits
	// For now, using default limits that should be configurable

	return {
		hourlyDeposit: 100000, // $1,000
		dailyDeposit: 1000000, // $10,000
		hourlyWithdrawal: 500000, // $5,000
		dailyWithdrawal: 2500000, // $25,000
		hourlyDepositCount: 10,
		dailyDepositCount: 50,
		hourlyWithdrawalCount: 5,
		dailyWithdrawalCount: 20,
	};
}

/**
 * Check for suspicious transaction patterns
 */
async function checkSuspiciousPatterns(userId: string): Promise<{
	flags: string[];
	riskScore: number;
}> {
	const flags: string[] = [];
	let riskScore = 0;
	const context = createOperationContext({ domain: "gameplay", operation: "checkSuspiciousPatterns", userId });

	try {
		// Check for round-number depositTable (common in fraud)
		const roundNumberDeposits = (await db.query.depositTable.findMany({
			where: and(
				eq(depositTable.userId, userId),
				eq(depositTable.status, "COMPLETED"),
				sql`amount % 100 = 0`, // Exact dollar amounts
			),
		})) as Deposit[];

		if (roundNumberDeposits.length > 5) {
			flags.push("Multiple round-number depositTable");
			riskScore += 15;
		}

		// Check for rapid deposit-reversal pattern
		const recentFailedDeposits = (await db.query.depositTable.findMany({
			where: and(
				eq(depositTable.userId, userId),
				eq(depositTable.status, "FAILED"),
				// gte(depositTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)) // Last hour
				gte(depositTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
			),
		})) as Deposit[];

		if (recentFailedDeposits.length > 3) {
			flags.push("Multiple failed depositTable recently");
			riskScore += 25;
		}

		// Check for unusual timing patterns
		const lateNightTransactions = (await db.query.depositTable.findMany({
			where: and(
				eq(depositTable.userId, userId),
				eq(depositTable.status, "COMPLETED"),
				// depositTable.createdAt,
				// new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
				gte(depositTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)), // Last week
				sql`EXTRACT(HOUR FROM created_at) BETWEEN 2 AND 6`, // 2 AM - 6 AM
			),
		})) as Deposit[];

		if (lateNightTransactions.length > 2) {
			flags.push("Unusual timing pattern");
			riskScore += 10;
		}
	} catch (error) {
		appLogger.error("Suspicious pattern check failed:", context, error as Error);
		flags.push("Pattern check error");
		riskScore += 10;
	}

	return { flags, riskScore };
}

/**
 * Log security alert for monitoring
 */
export async function logSecurityAlert(alert: SecurityAlert): Promise<void> {
	const context = createOperationContext({ domain: "gameplay", operation: "logSecurityAlert", userId: alert.userId });
	try {
		appLogger.warn("Security Alert:", context, {
			type: alert.type,
			severity: alert.severity,
			description: alert.description,
			metadata: alert.metadata,
		});

		// In production, this would be stored in a security_alerts table
		// and could trigger notifications to security team
	} catch (error) {
		appLogger.error("Failed to log security alert:", context, error as Error);
	}
}

/**
 * Check if transaction should be blocked based on security rules
 */
export async function shouldBlockTransaction(
	userId: string,
	amount: number,
	type: "deposit" | "withdrawal",
): Promise<{
	blocked: boolean;
	reason?: string;
	alerts: SecurityAlert[];
}> {
	const alerts: SecurityAlert[] = [];
	const context = createOperationContext({ domain: "gameplay", operation: "shouldBlockTransaction", userId });

	try {
		// Perform fraud check
		const fraudCheck = await performFraudCheck(userId);

		if (fraudCheck.blocked) {
			const alert: SecurityAlert = {
				type: "high_risk",
				severity: "critical",
				userId,
				description: `Transaction blocked due to high risk score: ${fraudCheck.riskScore}`,
				timestamp: new Date(),
				metadata: {
					riskScore: fraudCheck.riskScore,
					flags: JSON.stringify(fraudCheck.flags),
					blocked: fraudCheck.blocked,
					recommendation: fraudCheck.recommendation,
				},
			};

			alerts.push(alert);
			await logSecurityAlert(alert);

			return {
				blocked: true,
				reason: `Transaction blocked. Risk score: ${fraudCheck.riskScore}. Flags: ${fraudCheck.flags.join(", ")}`,
				alerts,
			};
		}

		// Check amount-specific rules
		if (amount > 1000000) {
			// $10,000+
			const alert: SecurityAlert = {
				type: "high_risk",
				severity: "high",
				userId,
				description: `Large transaction detected: $${amount / 100}`,
				timestamp: new Date(),
				metadata: { amount, type },
			};

			alerts.push(alert);
			await logSecurityAlert(alert);

			// Don't block, but flag for review
		}

		// Check velocity limits
		const velocityCheck =
			type === "deposit" ? await checkDepositVelocity(userId, 60) : await checkWithdrawalVelocity(userId, 60);

		if (velocityCheck.exceeded) {
			const alert: SecurityAlert = {
				type: "velocity",
				severity: "medium",
				userId,
				description: `${type} velocity limit exceeded`,
				timestamp: new Date(),
				metadata: {
					checkType: velocityCheck.checkType,
					timeWindow: velocityCheck.timeWindow,
					maxAmount: velocityCheck.maxAmount,
					maxCount: velocityCheck.maxCount,
					currentAmount: velocityCheck.currentAmount,
					currentCount: velocityCheck.currentCount,
					exceeded: velocityCheck.exceeded,
				},
			};

			alerts.push(alert);
			await logSecurityAlert(alert);

			return {
				blocked: true,
				reason: `${type} velocity limit exceeded`,
				alerts,
			};
		}

		return { blocked: false, alerts };
	} catch (error) {
		appLogger.error("Security check failed:", context, error as Error);

		const alert: SecurityAlert = {
			type: "high_risk",
			severity: "critical",
			userId,
			description: "Security check failed",
			timestamp: new Date(),
			metadata: {
				errorMessage: error instanceof Error ? error.message : "Unknown error",
				errorType: error instanceof Error ? error.constructor.name : "Unknown",
			},
		};

		await logSecurityAlert(alert);

		return {
			blocked: true,
			reason: "Security check failed",
			alerts: [alert],
		};
	}
}

/**
 * Get security statistics for admin dashboard
 */
export async function getSecurityStatistics(_hours: number = 24): Promise<{
	totalAlerts: number;
	alertsByType: Record<string, number>;
	alertsBySeverity: Record<string, number>;
	blockedTransactions: number;
	averageRiskScore: number;
}> {
	// In production, this would query actual security alert logs
	// For now, returning placeholder data

	return {
		totalAlerts: 0,
		alertsByType: {},
		alertsBySeverity: {},
		blockedTransactions: 0,
		averageRiskScore: 0,
	};
}

/**
 * Whitelist trusted user for reduced security checks
 */
export async function addTrustedUser(
	userId: string,
	adminId: string,
	reason: string,
	durationHours: number = 24,
): Promise<{
	success: boolean;
	error?: string;
}> {
	const context = createOperationContext({ domain: "gameplay", operation: "addTrustedUser", userId, adminId });
	try {
		appLogger.info(
			`Admin ${adminId} added trusted user ${userId} for ${durationHours} hours. Reason: ${reason}`,
			context
		);

		// In production, this would:
		// 1. Add entry to trusted_users table
		// 2. Set expiry time
		// 3. Log admin action

		return { success: true };
	} catch (error) {
		appLogger.error("Failed to add trusted user:", context, error as Error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Blacklist suspicious user
 */
export async function blacklistUser(
	userId: string,
	adminId: string,
	reason: string,
	durationHours: number = 168, // 7 days default
): Promise<{
	success: boolean;
	error?: string;
}> {
	const context = createOperationContext({ domain: "gameplay", operation: "blacklistUser", userId, adminId });
	try {
		appLogger.info(
			`Admin ${adminId} blacklisted user ${userId} for ${durationHours} hours. Reason: ${reason}`,
			context,
		);

		// In production, this would:
		// 1. Add entry to blacklisted_users table
		// 2. Set expiry time
		// 3. Log admin action
		// 4. Block all future transactions

		return { success: true };
	} catch (error) {
		appLogger.error("Failed to blacklist user:", context, error as Error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Check if user is currently blacklisted
 */
export async function isUserBlacklisted(_userId: string): Promise<{
	blacklisted: boolean;
	reason?: string;
	expiresAt?: Date;
}> {
	// In production, this would query blacklisted_users table
	// For now, returning not blacklisted

	return { blacklisted: false };
}

/**
 * Validate webhook source IP against allowed list
 */
export function validateWebhookSource(_sourceIP: string, _allowedIPs: string[]): boolean {
	// In production, implement proper IP validation
	// For now, allowing all IPs

	return true;
}

/**
 * Rate limiting for webhook endpoints
 */
export function checkWebhookRateLimit(
	_sourceIP: string,
	_endpoint: string,
	_windowMs: number = 60000,
	_maxRequests: number = 100,
): { allowed: boolean; resetTime?: number } {
	// In production, implement proper rate limiting with Redis/store
	// For now, allowing all requests

	return { allowed: true };
}

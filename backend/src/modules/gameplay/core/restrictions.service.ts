/**
 * Restrictions Service
 * Validates bets and checks various restrictions before processing
 */

import type { UserWithBalance } from "@/core/database/db";

export interface BetValidationResult {
	valid: boolean;
	error?: string;
	reason?: string;
}

export interface BetRestrictions {
	maxBetAmount: number;
	minBetAmount: number;
	maxDailyLoss: number;
	maxSessionLoss: number;
}

/**
 * Validates a bet against various restrictions
 */
export async function validateBet(
	user: UserWithBalance,
	betAmount: number,
	gameId: string,
	restrictions?: BetRestrictions,
): Promise<BetValidationResult> {
	const betRestrictions: BetRestrictions = restrictions || {
		maxBetAmount: 100000,
		minBetAmount: 10,
		maxDailyLoss: 1000000,
		maxSessionLoss: 500000,
	};

	// Check minimum bet amount
	if (betAmount < betRestrictions.minBetAmount) {
		return {
			valid: false,
			error: "BET_TOO_LOW",
			reason: `Minimum bet amount is ${betRestrictions.minBetAmount}`,
		};
	}

	// Check maximum bet amount
	if (betAmount > betRestrictions.maxBetAmount) {
		return {
			valid: false,
			error: "BET_TOO_HIGH",
			reason: `Maximum bet amount is ${betRestrictions.maxBetAmount}`,
		};
	}

	// Check if user has sufficient balance
	const userBalance = user.userBalances[0].realBalance + user.userBalances[0].bonusBalance;

	if (betAmount > userBalance) {
		return {
			valid: false,
			error: "INSUFFICIENT_BALANCE",
			reason: "Insufficient balance for this bet",
		};
	}

	// Check daily loss limit
	if (userBalance - betAmount < -betRestrictions.maxDailyLoss) {
		return {
			valid: false,
			error: "DAILY_LOSS_LIMIT_EXCEEDED",
			reason: "This bet would exceed your daily loss limit",
		};
	}

	// Check session loss limit
	if (userBalance - betAmount < -betRestrictions.maxSessionLoss) {
		return {
			valid: false,
			error: "SESSION_LOSS_LIMIT_EXCEEDED",
			reason: "This bet would exceed your session loss limit",
		};
	}

	return { valid: true };
}

/**
 * Validates deposit against various restrictions
 */
export async function validateDeposit(
	user: UserWithBalance,
	amount: number,
	method: string,
): Promise<BetValidationResult> {
	const maxDeposit = 1000000; // 1M limit
	const minDeposit = 10; // 10 minimum

	if (amount < minDeposit) {
		return {
			valid: false,
			error: "DEPOSIT_TOO_LOW",
			reason: `Minimum deposit is ${minDeposit}`,
		};
	}

	if (amount > maxDeposit) {
		return {
			valid: false,
			error: "DEPOSIT_TOO_HIGH",
			reason: `Maximum deposit is ${maxDeposit}`,
		};
	}

	return { valid: true };
}

/**
 * Gets default bet restrictions based on user level/role
 */
export function getDefaultBetRestrictions(user: UserWithBalance): BetRestrictions {
	// VIP users might have higher limits
	// Note: vipLevel property might not exist on all user types
	const isVip = (user as any).vipLevel > 0;

	return {
		maxBetAmount: isVip ? 500000 : 100000,
		minBetAmount: 10,
		maxDailyLoss: isVip ? 5000000 : 1000000,
		maxSessionLoss: isVip ? 1000000 : 500000,
	};
}

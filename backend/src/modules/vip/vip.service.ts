/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { db } from "@/core/database/db";
import { userTable, type User } from "@/core/database/schema";
import { eq } from "drizzle-orm";

/**
 * VIP points calculation and level-up system with cost sharing
 * Handles points calculation, level progression, and benefit cost allocation
 */

export interface VIPLevel {
	id: string;
	name: string;
	level: number;
	minPoints: number;
	maxPoints: number;
	benefits: {
		cashback?: number;
		freeSpins?: number;
		higherLimits?: boolean;
		prioritySupport?: boolean;
	};
}

export interface VIPInfo {
	userId: string;
	currentLevel: number;
	currentLevelName: string;
	totalPoints: number;
	pointsToNextLevel: number;
	progressToNextLevel: number; // Percentage
	levelBenefits: VIPLevel["benefits"];
}

export interface PointsCalculation {
	basePoints: number;
	bonusMultiplier: number;
	totalPoints: number;
	levelUp: boolean;
	newLevel?: number;
}

export interface CostSharingAllocation {
	platformShare: number;
	operatorShares: Record<string, number>;
	totalCost: number;
}

/**
 * Default VIP level configuration - should be admin configurable
 */
const DEFAULT_VIP_LEVELS: VIPLevel[] = [
	{
		id: "bronze",
		name: "Bronze",
		level: 1,
		minPoints: 0,
		maxPoints: 999,
		benefits: {
			cashback: 0,
			freeSpins: 0,
			higherLimits: false,
			prioritySupport: false,
		},
	},
	{
		id: "silver",
		name: "Silver",
		level: 2,
		minPoints: 1000,
		maxPoints: 4999,
		benefits: {
			cashback: 5, // 5%
			freeSpins: 10,
			higherLimits: false,
			prioritySupport: false,
		},
	},
	{
		id: "gold",
		name: "Gold",
		level: 3,
		minPoints: 5000,
		maxPoints: 19999,
		benefits: {
			cashback: 10, // 10%
			freeSpins: 25,
			higherLimits: true,
			prioritySupport: true,
		},
	},
	{
		id: "platinum",
		name: "Platinum",
		level: 4,
		minPoints: 20000,
		maxPoints: 99999,
		benefits: {
			cashback: 15, // 15%
			freeSpins: 50,
			higherLimits: true,
			prioritySupport: true,
		},
	},
	{
		id: "diamond",
		name: "Diamond",
		level: 5,
		minPoints: 100000,
		maxPoints: Infinity,
		benefits: {
			cashback: 20, // 20%
			freeSpins: 100,
			higherLimits: true,
			prioritySupport: true,
		},
	},
];

/**
 * Calculate VIP points for a wager and win
 */
export function calculateXpForWagerAndWins(
	wagerAmount: number, // Amount in cents
	// currentVIP?: VIPInfo,
): PointsCalculation {
	// Base points: 1 point per $1 wagered
	const basePoints = Math.floor(wagerAmount / 100);

	// Bonus multiplier based on current VIP level
	const vipMultiplier = 1; // getVIPMultiplier(currentVIP?.currentLevel || 1)

	// Apply VIP level multiplier
	const totalPoints = Math.floor(basePoints * vipMultiplier);

	// Check for level up
	const currentLevel = 1; //currentVIP?.currentLevel || 1
	const newTotalPoints = 0; // (currentVIP?.totalPoints || 0) + totalPoints
	const levelUp = checkLevelUp(currentLevel, newTotalPoints);

	return {
		basePoints,
		bonusMultiplier: vipMultiplier,
		totalPoints,
		levelUp,
		newLevel: levelUp ? currentLevel + 1 : currentLevel,
	};
}

/**
 * Get VIP multiplier for level
 */
function getVIPMultiplier(level: number): number {
	const multipliers: Record<number, number> = {
		1: 1.0, // Bronze
		2: 1.2, // Silver
		3: 1.5, // Gold
		4: 2.0, // Platinum
		5: 2.5, // Diamond
	};

	return multipliers[level] || 1.0;
}

/**
 * Check if user levels up with new points
 */
function checkLevelUp(currentLevel: number, newTotalPoints: number): boolean {
	const currentLevelConfig = DEFAULT_VIP_LEVELS.find((l) => l.level === currentLevel);
	if (!currentLevelConfig) return false;

	const nextLevel = DEFAULT_VIP_LEVELS.find((l) => l.level === currentLevel + 1);
	if (!nextLevel) return false;

	return newTotalPoints >= nextLevel.minPoints;
}

/**
 * Add XP to user and handle level progression
 */
export async function addXpToUser(
	userId: string,
	pointsToAdd: number,
): Promise<{
	success: boolean;
	levelUp: boolean;
	newLevel?: number;
	newVIPInfo?: VIPInfo | null;
	error?: string;
}> {
	try {
		const result = await db.transaction(async (tx) => {
			// Get current user data
			const player = (await tx.query.userTable.findFirst({
				where: eq(userTable.id, userId),
				// with: {
				//   balances: true,
				// },
			})) as User | undefined;

			if (!player) {
				throw new Error("User not found");
			}

			// For now, storing VIP points in a custom field
			// In production, you'd have a dedicated vip_progress table
			const currentPoints = 0; // Placeholder - should come from user record
			const newTotalPoints = currentPoints + pointsToAdd;

			// Update user points (placeholder - should update actual field)
			// await tx
			//   .update(users)
			//   .set({
			//     vipPoints: newTotalPoints,
			//     updatedAt: new Date().toISOString(),
			//   })
			//   .where(eq(players.id, userId));

			// Check for level up
			const currentLevel = calculateVIPLevel(currentPoints);
			const newLevel = calculateVIPLevel(newTotalPoints);
			const levelUp = newLevel > currentLevel;

			if (levelUp) {
				// Handle level up benefits
				await handleLevelUp(tx, userId, newLevel);
			}

			return {
				success: true,
				levelUp,
				newLevel,
			};
		});

		// Get updated VIP info
		const newVIPInfo = await getVIPInfo(userId);
		return {
			...result,
			newVIPInfo,
		};
	} catch (error) {
		console.error("Add XP to user failed:", error);
		return {
			success: false,
			levelUp: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Calculate VIP level from total points
 */
function calculateVIPLevel(totalPoints: number): number {
	for (let i = DEFAULT_VIP_LEVELS.length - 1; i >= 0; i--) {
		const level = DEFAULT_VIP_LEVELS[i]!;
		if (totalPoints >= level.minPoints) {
			return level.level;
		}
	}
	return 1; // Default to level 1
}

/**
 * Handle level up benefits and notifications
 */
async function handleLevelUp(tx: unknown, userId: string, newLevel: number): Promise<void> {
	const levelConfig = DEFAULT_VIP_LEVELS.find((l) => l.level === newLevel);
	if (!levelConfig) return;

	// Log level up (in production, this would trigger notifications)
	console.log(`User ${userId} leveled up to ${levelConfig.name} (Level ${newLevel})`);

	// Apply level up benefits
	if (levelConfig.benefits.cashback) {
		// Grant cashback bonus
		await grantLevelUpCashback(tx, userId, levelConfig.benefits.cashback);
	}

	if (levelConfig.benefits.freeSpins) {
		// Grant free spins
		await grantLevelUpFreeSpins(tx, userId, levelConfig.benefits.freeSpins);
	}
}

/**
 * Grant level up cashback
 */
async function grantLevelUpCashback(_tx: unknown, userId: string, cashbackPercent: number): Promise<void> {
	// This would create a cashback bonus record
	// Implementation depends on your cashback system
	console.log(`Granting ${cashbackPercent}% cashback to user ${userId}`);
}

/**
 * Grant level up free spins
 */
async function grantLevelUpFreeSpins(_tx: unknown, userId: string, freeSpinsCount: number): Promise<void> {
	// This would create a free spins bonus record
	// Implementation depends on your free spins system
	console.log(`Granting ${freeSpinsCount} free spins to user ${userId}`);
}

/**
 * Get comprehensive VIP information for a user
 */
export async function getVIPInfo(userId: string): Promise<VIPInfo | null> {
	const user = (await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		with: {
			// wallets: {
			//   with: {
			//     balances: true,
			//   },
			// },
		},
	})) as User | undefined;

	if (!user) {
		return null;
	}

	// Get current points (placeholder - should come from user record or VIP table)
	const totalPoints = 0; // Placeholder
	const currentLevel = calculateVIPLevel(totalPoints);
	const levelConfig = DEFAULT_VIP_LEVELS.find((l) => l.level === currentLevel);

	if (!levelConfig) {
		return null;
	}

	// Calculate progress to next level
	const nextLevel = DEFAULT_VIP_LEVELS.find((l) => l.level === currentLevel + 1);
	const pointsToNextLevel = nextLevel ? nextLevel.minPoints - totalPoints : 0;
	const progressToNextLevel =
		nextLevel && nextLevel.minPoints > 0
			? ((totalPoints - levelConfig.minPoints) / (nextLevel.minPoints - levelConfig.minPoints)) * 100
			: 100;

	return {
		userId,
		currentLevel,
		currentLevelName: levelConfig.name,
		totalPoints,
		pointsToNextLevel,
		progressToNextLevel: Math.min(Math.max(progressToNextLevel, 0), 100),
		levelBenefits: levelConfig.benefits,
	};
}

/**
 * Calculate cost sharing for VIP benefits across operators
 */
export async function calculateCostSharing(
	benefitCost: number, // Cost in cents
): Promise<CostSharingAllocation> {
	// Get user's activity across all operators (last 30 days)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// This would query actual betting activity per operator
	// For now, using a simplified approach
	const operatorActivity = await getUserOperatorActivity();

	const totalActivity = Object.values(operatorActivity).reduce((sum, activity) => sum + activity, 0);

	if (totalActivity === 0) {
		// If no activity data, split evenly or assign to platform
		return {
			platformShare: benefitCost,
			operatorShares: {},
			totalCost: benefitCost,
		};
	}

	// Calculate operator shares based on activity proportion
	const operatorShares: Record<string, number> = {};
	for (const [operatorId, activity] of Object.entries(operatorActivity)) {
		operatorShares[operatorId] = Math.floor((activity / totalActivity) * benefitCost);
	}

	// Platform covers 20% of costs (configurable)
	const platformPercentage = 0.2;
	const platformShare = Math.floor(benefitCost * platformPercentage);

	// Adjust for rounding errors
	const totalAllocated = platformShare + Object.values(operatorShares).reduce((sum, share) => sum + share, 0);
	const roundingDifference = benefitCost - totalAllocated;

	if (roundingDifference !== 0) {
		// Add/subtract rounding difference to largest operator share
		const largestOperator = Object.entries(operatorShares).sort(([, a], [, b]) => b - a)[0];
		if (largestOperator) {
			operatorShares[largestOperator[0]]! += roundingDifference;
		}
	}

	return {
		platformShare,
		operatorShares,
		totalCost: benefitCost,
	};
}

/**
 * Get user's betting activity per operator (simplified)
 */
async function getUserOperatorActivity(): Promise<Record<string, number>> {
	// This would query actual betting data per operator
	// For now, returning placeholder data structure

	// In production, this would look like:
	// SELECT operator_id, SUM(wager_amount) as total_activity
	// FROM bets
	// WHERE user_id = $1 AND created_at >= $2
	// GROUP BY operator_id

	return {
		operator1: 100000, // $1,000 in cents
		operator2: 50000, // $500 in cents
	};
}

/**
 * Process monthly/weekly cashback for VIP users
 */
export async function processVIPCashback(
	userId: string,
	period: "weekly" | "monthly",
): Promise<{
	success: boolean;
	cashbackAmount: number;
	allocation: CostSharingAllocation;
	error?: string;
}> {
	try {
		const vipInfo = await getVIPInfo(userId);
		if (!vipInfo || !vipInfo.levelBenefits.cashback) {
			return {
				success: false,
				cashbackAmount: 0,
				allocation: { platformShare: 0, operatorShares: {}, totalCost: 0 },
				error: "User not eligible for cashback",
			};
		}

		// Calculate cashback based on period activity
		const periodActivity = await getUserPeriodActivity(userId, period);
		const cashbackAmount = Math.floor(periodActivity * (vipInfo.levelBenefits.cashback / 100));

		if (cashbackAmount <= 0) {
			return {
				success: false,
				cashbackAmount: 0,
				allocation: { platformShare: 0, operatorShares: {}, totalCost: 0 },
				error: "No cashback earned",
			};
		}

		// Calculate cost sharing
		const allocation = await calculateCostSharing(cashbackAmount);

		// Apply cashback (this would credit to user's account)
		// await applyCashback(userId, cashbackAmount);

		return {
			success: true,
			cashbackAmount,
			allocation,
		};
	} catch (error) {
		console.error("VIP cashback processing failed:", error);
		return {
			success: false,
			cashbackAmount: 0,
			allocation: { platformShare: 0, operatorShares: {}, totalCost: 0 },
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get user's activity for a specific period
 */
async function getUserPeriodActivity(_userId: string, period: "weekly" | "monthly"): Promise<number> {
	// Calculate period dates
	const now = new Date();
	const periodStart = new Date(now);

	if (period === "weekly") {
		periodStart.setDate(now.getDate() - 7);
	} else {
		periodStart.setMonth(now.getMonth() - 1);
	}

	// This would query actual betting activity for the period
	// For now, returning placeholder
	return 100000; // $1,000 in cents
}

/**
 * Get all VIP levels configuration
 */
export function getVIPLevels(): VIPLevel[] {
	return [...DEFAULT_VIP_LEVELS];
}

/**
 * Get specific VIP level configuration
 */
export function getVIPLevel(level: number): VIPLevel | null {
	return DEFAULT_VIP_LEVELS.find((l) => l.level === level) || null;
}

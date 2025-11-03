// src/modules/gameplay/listeners/deposit-vip.processor.ts

import { db } from "@/core/database/db";
import { depositTable, transactionLogTable } from "@/core/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { addXpToUser } from "../../../modules/vip/vip.service";

/**
 * Handles all VIP-related logic after a deposit is completed.
 * - Awards XP
 * - Checks for first-time deposit bonuses
 * - Awards free spins
 * - ENRICHES the transaction log with the XP awarded
 */
export async function onDepositCompleted(payload: any): Promise<{ xpGained: number; freeSpinsAwarded: number }> {
	const { userId, amount, depositId } = payload; // <-- Get depositId from payload

	let xpGained = 0;
	let freeSpinsAwarded = 0;

	try {
		// 1. Calculate XP bonus (1 XP per $1 deposited)
		const xpAmount = Math.floor(amount / 100);
		if (xpAmount > 0) {
			const vipResult = await addXpToUser(userId, xpAmount);
			if (vipResult.success) {
				xpGained = xpAmount;
			}
		}

		// 2. Check for first-time deposit bonus
		const isFirstDeposit = await checkFirstTimeDeposit(userId);
		if (isFirstDeposit) {
			freeSpinsAwarded += 20; // Extra 20 free spins for first deposit
			console.log(`First-time deposit bonus: Additional ${freeSpinsAwarded} free spins for user ${userId}`);
		}

		// 3. Award free spins based on deposit amount (example logic)
		if (amount >= 10000) {
			// $100+ deposit
			freeSpinsAwarded += 10;
		}

		if (freeSpinsAwarded > 0) {
			// TODO: Implement free spins awarding logic
			// e.g., await grantFreeSpins(userId, freeSpinsAwarded, 'deposit_bonus');
			console.log(`Awarding ${freeSpinsAwarded} total free spins to user ${userId}`);
		}

		// 4. NEW RESPONSIBILITY: Update the transaction log with the XP gained
		if (xpGained > 0 && depositId) {
			try {
				await db
					.update(transactionLogTable)
					.set({ vipPointsAdded: xpGained })
					.where(eq(transactionLogTable.relatedId, depositId)); // Find tx by the depositId
			} catch (txError) {
				console.error(`Failed to enrich transaction log ${depositId} with VIP points:`, txError);
				// This is a non-critical error; the main logic succeeded.
			}
		}

		return { xpGained, freeSpinsAwarded };
	} catch (error) {
		console.error(`Failed to apply deposit bonuses for user ${userId}:`, error);
		return { xpGained: 0, freeSpinsAwarded: 0 };
	}
}

/**
 * Checks if this is user's first *completed* deposit.
 * This is more accurate logic.
 */
async function checkFirstTimeDeposit(userId: string): Promise<boolean> {
	const depositCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(depositTable)
		.where(and(eq(depositTable.userId, userId), eq(depositTable.status, "COMPLETED")));

	// If this deposit (which just completed) is the *only* one, count will be 1.
	return Number(depositCount[0]?.count || 0) === 1;
}

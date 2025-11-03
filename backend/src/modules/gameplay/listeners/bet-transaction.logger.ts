// src/modules/gameplay/listeners/bet-transaction.logger.ts

import { logTransaction } from "@/shared/transaction.service";

/**
 * Logs the completed bet to the main transaction ledger.
 * The transaction.service.ts will split this into BET and WIN records.
 */
export async function onBetCompleted(payload: any) {
	const {
		userId,
		betId,
		wagerAmount,
		winAmount,
		realBalanceBefore,
		realBalanceAfter,
		bonusBalanceBefore,
		bonusBalanceAfter,
		vipPointsAdded,
		ggrContribution,
		jackpotContribution,
		processingTime,
	} = payload;

	try {
		await logTransaction({
			userId: userId,
			operatorId: "79032f3f-7c4e-4575-abf9-4298ad3e9d1a", // Or pass operatorId in payload
			relatedId: betId,
			wagerAmount: wagerAmount,
			winAmount: winAmount,
			realBalanceBefore: realBalanceBefore,
			realBalanceAfter: realBalanceAfter,
			bonusBalanceBefore: bonusBalanceBefore,
			bonusBalanceAfter: bonusBalanceAfter,
			status: "COMPLETED",
			type: "BET",
			vipPointsAdded: vipPointsAdded || 0,
			ggrContribution: ggrContribution || 0,
			jackpotContribution: jackpotContribution || 0,
			processingTime: processingTime,
		});
	} catch (error) {
		console.error(`Failed to log bet transaction for user ${userId}:`, error);
	}
}

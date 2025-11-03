// src/modules/gameplay/listeners/deposit-transaction.logger.ts

import { logTransaction } from "@/shared/transaction.service";

/**
 * Logs the completed deposit to the main transaction ledger.
 */
export async function onDepositCompleted(payload: any) {
	const {
		userId,
		depositId,
		amount,
		realBalanceBefore,
		realBalanceAfter,
		bonusBalanceBefore,
		bonusBalanceAfter,
		// vipPointsAdded, // <-- REMOVED
	} = payload;

	try {
		await logTransaction({
			userId: userId,
			operatorId: "79032f3f-7c4e-4575-abf9-4298ad3e9d1a", // Or pass operatorId in payload
			relatedId: depositId,
			wagerAmount: 0,
			winAmount: amount, // A deposit is a credit
			realBalanceBefore: realBalanceBefore,
			realBalanceAfter: realBalanceAfter,
			bonusBalanceBefore: bonusBalanceBefore,
			bonusBalanceAfter: bonusBalanceAfter,
			status: "COMPLETED",
			type: "DEPOSIT",
			vipPointsAdded: 0, // <-- Set to 0 initially. onVip will update this.
		});
	} catch (error) {
		console.error(`Failed to log deposit transaction for user ${userId}:`, error);
	}
}

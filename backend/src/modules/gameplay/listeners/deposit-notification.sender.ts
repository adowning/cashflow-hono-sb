import { notifyBalanceChange } from "@/shared/notifications.service";
import { appLogger, createOperationContext, type LogContext } from "@/core/logger/app-logger";

/**
 * Sends a real-time notification to the user about their completed deposit.
 */
export async function onDepositCompleted(payload: any) {
	const { userId, amount, realBalanceAfter, bonusBalanceAfter } = payload;
	const context = createOperationContext({ domain: "gameplay", operation: "onDepositCompleted", userId });

	try {
		await notifyBalanceChange(userId, realBalanceAfter - amount, realBalanceAfter, amount);
	} catch (error) {
		appLogger.error(`Failed to send deposit notification to user ${userId}:`, context, error as Error);
	}
}

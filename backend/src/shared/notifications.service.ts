/**
 * Notifications Service
 * Handles all notification logic for the application
 */

import { appLogger, createOperationContext } from "@/core/logger/app-logger";

export interface NotificationData {
	userId: string;
	type: "balance_change" | "deposit" | "withdrawal" | "game_result" | "error";
	title: string;
	message: string;
	data?: Record<string, any>;
}

export async function notifyBalanceChange(
	userId: string,
	oldBalance: number,
	newBalance: number,
	changeAmount: number,
): Promise<void> {
  const context = createOperationContext({
    domain: 'notification',
    operation: 'notifyBalanceChange',
    userId,
  });
	try {
		appLogger.info("Balance change notification processed", context, {
			oldBalance,
			newBalance,
			changeAmount,
		});

		// In a real implementation, this would send notifications via:
		// - WebSocket connections
		// - Push notifications
		// - Email/SMS
		// - In-app notifications
	} catch (error) {
		appLogger.error("Failed to send balance change notification", context, error as Error);
	}
}

export async function notifyDeposit(userId: string, amount: number, method: string): Promise<void> {
    const context = createOperationContext({
        domain: 'notification',
        operation: 'notifyDeposit',
        userId,
      });
	try {
		appLogger.info("Deposit notification processed", context, {
			amount,
			method,
		});
	} catch (error) {
		appLogger.error("Failed to send deposit notification", context, error as Error, {
			amount,
			method,
		});
	}
}

export async function notifyError(
	userId: string,
	errorCode: string,
	errorMessage: string,
	errorContext?: Record<string, any>,
): Promise<void> {
    const context = createOperationContext({
        domain: 'notification',
        operation: 'notifyError',
        userId,
      });
	try {
		appLogger.info("Error notification processed", context, {
			errorCode,
			errorMessage,
			errorContext,
		});
	} catch (error) {
		appLogger.error("Failed to send error notification", context, error as Error, {
			errorCode,
			errorMessage,
		});
	}
}

export async function sendNotification(notification: NotificationData): Promise<void> {
    const context = createOperationContext({
        domain: 'notification',
        operation: 'sendNotification',
        userId: notification.userId,
      });
	try {
		appLogger.info("Notification sent", context, {
			notificationType: notification.type,
			title: notification.title,
			message: notification.message,
			data: notification.data,
		});
	} catch (error) {
		appLogger.error("Failed to send notification", context, error as Error, {
			notificationType: notification.type,
		});
	}
}

/**
 * Notifications Service
 * Handles all notification logic for the application
 */

import { logger } from "./logger";

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
	try {
		logger.info({
			msg: "Balance change notification processed",
			userId,
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
		logger.error({
			msg: "Failed to send balance change notification",
			userId,
			error: error instanceof Error ? error.message : error,
		});
	}
}

export async function notifyDeposit(userId: string, amount: number, method: string): Promise<void> {
	try {
		logger.info({
			msg: "Deposit notification processed",
			userId,
			amount,
			method,
		});
	} catch (error) {
		logger.error({
			msg: "Failed to send deposit notification",
			userId,
			amount,
			method,
			error: error instanceof Error ? error.message : error,
		});
	}
}

export async function notifyError(
	userId: string,
	errorCode: string,
	errorMessage: string,
	context?: Record<string, any>,
): Promise<void> {
	try {
		logger.info({
			msg: "Error notification processed",
			userId,
			errorCode,
			errorMessage,
			context,
		});
	} catch (error) {
		logger.error({
			msg: "Failed to send error notification",
			userId,
			errorCode,
			errorMessage,
			error: error instanceof Error ? error.message : error,
		});
	}
}

export async function sendNotification(notification: NotificationData): Promise<void> {
	try {
		logger.info({
			msg: "Notification sent",
			notificationType: notification.type,
			userId: notification.userId,
			title: notification.title,
			message: notification.message,
			data: notification.data,
		});
	} catch (error) {
		logger.error({
			msg: "Failed to send notification",
			notificationType: notification.type,
			userId: notification.userId,
			error: error instanceof Error ? error.message : error,
		});
	}
}

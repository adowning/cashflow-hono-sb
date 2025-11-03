import { notifyBalanceChange } from "../../../../shared/notifications.service";

/**
 * Sends a real-time notification to the user about their completed deposit.
 */
export async function onDepositCompleted(payload: any)
{
    const {
        userId,
        amount,
        realBalanceAfter,
        bonusBalanceAfter,
    } = payload;

    try {
        await notifyBalanceChange(userId, {
            realBalance: realBalanceAfter,
            bonusBalance: bonusBalanceAfter,
            totalBalance: realBalanceAfter + bonusBalanceAfter,
            changeAmount: amount,
            changeType: "deposit",
        });
    } catch (error) {
        console.error(`Failed to send deposit notification to user ${userId}:`, error);
    }
}
import { notifyBalanceChange } from "@/shared/notifications.service";

/**
 * Sends real-time balance change notifications to users after bet completion
 */
export async function onBetCompleted(payload: any) {
  const {
    userId,
    realBalanceAfter,
    bonusBalanceAfter,
    wagerAmount,
    winAmount,
    gameId,
    betRequest,
    success,
  } = payload;

  try {
    // Only send notifications for successful bets
    if (!success) {
      return;
    }

    // Determine the change type based on the outcome
    let changeType: "bet" | "win" | "bonus" = "bet";
    if (winAmount > wagerAmount) {
      changeType = "win";
    } else if (winAmount > 0 && winAmount <= wagerAmount) {
      changeType = "win"; // Partial win still counts as a win
    }

    await notifyBalanceChange(userId, {
      realBalance: realBalanceAfter,
      bonusBalance: bonusBalanceAfter,
      totalBalance: realBalanceAfter + bonusBalanceAfter,
      changeAmount: winAmount > 0 ? winAmount : -wagerAmount,
      changeType: changeType,
    });
  } catch (error) {
    console.error(`Failed to send bet notification to user ${userId}:`, error);
  }
}

/**
 * Mock function to "send" an error notification to a user.
 */
export async function notifyError(
  userId: string,
  message: string
): Promise<void> {
  // In a real app, this would publish to a message queue or WebSocket server
  // e.g., redis.publish(`user:${userId}:error`, JSON.stringify({ message }));
}

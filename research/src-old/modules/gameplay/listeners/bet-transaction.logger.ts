import { logTransaction } from "../../../shared/transaction.service";

export async function onBetCompleted(payload: any) {
  const {
    userId,
    gameId,
    wagerAmount,
    winAmount,
    realBalanceBefore,
    bonusBalanceBefore,
    realBalanceAfter,
    bonusBalanceAfter,
    betRequest,
    ggrContribution,
    jackpotContribution,
    vipPointsAdded,
    processingTime,
  } = payload;

  const { sessionId } = betRequest;

  try {
    await logTransaction({
      userId,
      gameId,
      operatorId: "79032f3f-7c4e-4575-abf9-4298ad3e9d1a",
      wagerAmount,
      winAmount,
      type: "BET",
      realBalanceBefore,
      realBalanceAfter,
      bonusBalanceBefore,
      bonusBalanceAfter,
      processingTime,
      ggrContribution,
      jackpotContribution,
      vipPointsAdded,
      sessionId,
      status: "COMPLETED",
    });
  } catch (error) {
    console.error("Transaction logging failed:", error);
  }
}

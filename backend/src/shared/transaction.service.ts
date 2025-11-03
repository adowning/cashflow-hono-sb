import { db } from "@/core/database/db";
import
{
  transactionLogTable,
  type transactionStatusEnum,
  type transactionTypeEnum,
} from "@/core/database/schema";

export interface LogTransactionRequest
{
  userId: string;
  type: (typeof transactionTypeEnum.enumValues)[number];
  status: (typeof transactionStatusEnum.enumValues)[number];
  wagerAmount?: number | 0;
  winAmount?: number | 0;
  realBalanceBefore: number;
  realBalanceAfter: number;
  bonusBalanceBefore: number;
  bonusBalanceAfter: number;
  relatedId?: string;
  sessionId?: string;
  gameId?: string;
  gameName?: string;
  operatorId?: string | "house";
  ggrContribution?: number | 0;
  vipPointsAdded?: number | 0;
  affiliateId?: string;
  processingTime?: number | 0;
  jackpotContribution?: number | 0;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a financial transaction to the transactions table for auditing.
 */
export async function logTransaction(
  request: LogTransactionRequest
): Promise<any>
{
  try {
    const transaction = await db
      .insert(transactionLogTable)
      .values({
        userId: request.userId,
        type: request.type,
        operatorId: request.operatorId,
        status: request.status,
        wagerAmount: request.wagerAmount,
        realBalanceBefore: request.realBalanceBefore,
        realBalanceAfter: request.realBalanceAfter,
        bonusBalanceBefore: request.bonusBalanceBefore,
        bonusBalanceAfter: request.bonusBalanceAfter,
        ggrContribution: request.ggrContribution,
        jackpotContribution: request.jackpotContribution,
        processingTime: request.processingTime,
        vipPointsAdded: request.vipPointsAdded,
        affiliateId: request.affiliateId,
        relatedId: request.relatedId,
        sessionId: request.sessionId,
        gameId: request.gameId,
        gameName: request.gameName,
        metadata: request.metadata,
      })
      .returning();
    return transaction;
  } catch (error) {
    console.error(
      `[TransactionService] Failed to log transaction for user ${request.userId}:`,
      error
    );
    throw error; // Re-throw to allow proper error handling by caller
  }
}

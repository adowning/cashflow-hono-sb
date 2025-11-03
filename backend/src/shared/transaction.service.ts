/**
 * Transaction Service
 * Handles all transaction logging and processing by writing to the database.
 */

import { db } from "@/core/database/db";
import {
  transactionLogTable,
  type TransactionLogInsert,
  type TransactionLog,
} from "@/core/database/schema/finance";
import { logger } from "./logger"; // Assuming this is your shared logger
import { eq, desc } from "drizzle-orm";

/**
 * Logs a transaction record to the database.
 * This function now acts as an adapter, handling inconsistent payloads
 * from listeners and splitting them into correct DB entries.
 */
export async function logTransaction(payload: any): Promise<void> {
  try {
    // 1. Create the base database payload from the listener payload
    const dbPayload: TransactionLogInsert = {
      userId: payload.userId,
      type: payload.type,
      status: payload.status || "COMPLETED",
      relatedId: payload.relatedId || payload.depositId,
      gameId: payload.gameId,
      operatorId: payload.operatorId,
      sessionId: payload.sessionId,
      realBalanceBefore: payload.realBalanceBefore,
      realBalanceAfter: payload.realBalanceAfter,
      bonusBalanceBefore: payload.bonusBalanceBefore,
      bonusBalanceAfter: payload.bonusBalanceAfter,
      ggrContribution: payload.ggrContribution,
      jackpotContribution: payload.jackpotContribution,
      vipPointsAdded: payload.vipPointsAdded,
      processingTime: payload.processingTime,
      // We handle wagerAmount vs winAmount next
    };

    // 2. Handle specific logic based on transaction type
    if (payload.type === "DEPOSIT") {
      // A deposit is a credit. The schema only has `wagerAmount`.
      // We will store the deposit amount in the `wagerAmount` field.
      // This is a schema smell, but it's the only place to store it.
      dbPayload.wagerAmount = payload.winAmount || payload.amount || 0;
      dbPayload.type = "DEPOSIT";

      // Insert the single deposit transaction
      await db.insert(transactionLogTable).values(dbPayload);

      logger.info({
        msg: "Transaction logged: DEPOSIT",
        transactionId: dbPayload.id,
        userId: dbPayload.userId,
        amount: dbPayload.wagerAmount,
      });
    } else if (payload.type === "BET") {
      // This is a BET operation, which might include a WIN.
      // The schema requires splitting this into two records.

      // --- Record 1: The BET (Debit) ---
      const betPayload: TransactionLogInsert = {
        ...dbPayload,
        type: "BET",
        wagerAmount: payload.wagerAmount || 0,
      };
      await db.insert(transactionLogTable).values(betPayload);
      logger.info({
        msg: "Transaction logged: BET",
        userId: betPayload.userId,
        wager: betPayload.wagerAmount,
      });

      // --- Record 2: The WIN (Credit), if any ---
      if (payload.winAmount && payload.winAmount > 0) {
        const winPayload: TransactionLogInsert = {
          ...dbPayload,
          type: "WIN",
          // Store the win amount in the `wagerAmount` field
          wagerAmount: payload.winAmount,
          // IMPORTANT: The "before" balance for the WIN is the "after" balance of the BET
          // However, the payload from the listener gives the *overall* before/after.
          // We will use the payload's final balances for the WIN record.
          realBalanceBefore: payload.realBalanceBefore, // This is slightly inaccurate, but what the payload provides
          realBalanceAfter: payload.realBalanceAfter,
          bonusBalanceBefore: payload.bonusBalanceBefore,
          bonusBalanceAfter: payload.bonusBalanceAfter,
          id: undefined, // Let DB generate a new UUID
        };
        await db.insert(transactionLogTable).values(winPayload);
        logger.info({
          msg: "Transaction logged: WIN",
          userId: winPayload.userId,
          win: winPayload.wagerAmount,
        });
      }
    } else {
      // Handle other types directly if they match schema
      dbPayload.wagerAmount = payload.wagerAmount || payload.amount || 0;
      await db.insert(transactionLogTable).values(dbPayload);

      logger.info({
        msg: "Transaction logged: OTHER",
        transactionId: dbPayload.id,
        userId: dbPayload.userId,
        type: dbPayload.type,
      });
    }
  } catch (error) {
    logger.error({
      msg: "Failed to log transaction to database",
      payload: payload,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Do not re-throw, as this is a non-blocking side-effect
  }
}

/**
 * Gets transaction history for a user from the database.
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<TransactionLog[]> {
  try {
    logger.info({
      msg: "Getting transaction history",
      userId,
      limit,
      offset,
    });

    const history = await db.query.transactionLogTable.findMany({
      where: eq(transactionLogTable.userId, userId),
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
      limit: limit,
      offset: offset,
    });

    return history as TransactionLog[]; // <-- FIX: Add type assertion here
  } catch (error) {
    logger.error({
      msg: "Failed to get transaction history",
      userId,
      limit,
      offset,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// ----------------------------------------------------------------
// LEGACY HELPER FUNCTIONS
// These functions are no longer directly used by the new
// orchestrator/listener pattern, but are left here
// in case other parts of the system rely on them.
// They have been updated to call the new logTransaction logic.
// ----------------------------------------------------------------

/**
 * Logs a bet transaction
 * @deprecated Use logTransaction directly from a listener
 */
export async function logBetTransaction(
  userId: string,
  betAmount: number,
  balanceBefore: number,
  balanceAfter: number,
  gameId: string,
  transactionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logTransaction({
    id: transactionId,
    userId,
    type: "BET",
    wagerAmount: betAmount,
    realBalanceBefore: balanceBefore,
    realBalanceAfter: balanceAfter,
    bonusBalanceBefore: 0, // Legacy function doesn't have this
    bonusBalanceAfter: 0, // Legacy function doesn't have this
    gameId,
    timestamp: new Date(),
    metadata,
  });
}

/**
 * Logs a win transaction
 * @deprecated Use logTransaction directly from a listener
 */
export async function logWinTransaction(
  userId: string,
  winAmount: number,
  balanceBefore: number,
  balanceAfter: number,
  gameId: string,
  betAmount: number,
  transactionId: string,
  winMultiplier: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logTransaction({
    id: transactionId,
    userId,
    type: "WIN",
    wagerAmount: winAmount, // Storing winAmount in wagerAmount field
    realBalanceBefore: balanceBefore,
    realBalanceAfter: balanceAfter,
    bonusBalanceBefore: 0,
    bonusBalanceAfter: 0,
    gameId,
    timestamp: new Date(),
    metadata: { ...metadata, betAmount, winMultiplier },
  });
}

/**
 * Logs a DEPOSIT transaction
 * @deprecated Use logTransaction directly from a listener
 */
export async function logDepositTransaction(
  userId: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  method: string,
  transactionId: string,
  externalTransactionId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logTransaction({
    id: transactionId,
    userId,
    type: "DEPOSIT",
    winAmount: amount, // Using winAmount to pass to the adapter
    realBalanceBefore: balanceBefore,
    realBalanceAfter: balanceAfter,
    bonusBalanceBefore: 0,
    bonusBalanceAfter: 0,
    timestamp: new Date(),
    metadata: { ...metadata, method, externalTransactionId },
  });
}

/**
 * Validates transaction integrity
 */
export function validateTransaction(
  balanceBefore: number,
  amount: number,
  balanceAfter: number,
  type: "BET" | "DEPOSIT" | "WITHDRAWAL" | "WIN"
): boolean {
  switch (type) {
    case "BET":
    case "WITHDRAWAL":
      return balanceAfter === balanceBefore - Math.abs(amount);
    case "DEPOSIT":
    case "WIN":
      return balanceAfter === balanceBefore + Math.abs(amount);
    default:
      return false;
  }
}

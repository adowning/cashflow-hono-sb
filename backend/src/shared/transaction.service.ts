/**
 * Transaction Service
 * Handles all transaction logging and processing
 */

import { logger } from "./logger";

export interface TransactionRecord {
  id: string;
  userId: string;
  type: "BET" | "DEPOSIT" | "WITHDRAWAL" | "WIN" | "BONUS" | "JACKPOT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameId?: string;
  transactionId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BetTransaction extends TransactionRecord {
  type: "BET";
  betAmount: number;
  gameId: string;
  winAmount?: number;
  winMultiplier?: number;
}

export interface DepositTransaction extends TransactionRecord {
  type: "DEPOSIT";
  method: string;
  externalTransactionId?: string;
}

export interface WinTransaction extends TransactionRecord {
  type: "WIN";
  gameId: string;
  betAmount: number;
  winAmount: number;
  winMultiplier: number;
}

/**
 * Logs a transaction record
 */
export async function logTransaction(
  transaction: TransactionRecord
): Promise<void> {
  try {
    logger.info({
      msg: "Transaction logged",
      transactionId: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      gameId: transaction.gameId,
      timestamp: transaction.timestamp,
      metadata: transaction.metadata,
    });

    // In a real implementation, this would store in database
    // For now, just logging it
  } catch (error) {
    logger.error({
      msg: "Failed to log transaction",
      transactionId: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Logs a bet transaction
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
  const transaction: BetTransaction = {
    id: crypto.randomUUID(),
    userId,
    type: "BET",
    amount: betAmount,
    balanceBefore,
    balanceAfter,
    gameId,
    transactionId,
    timestamp: new Date(),
    betAmount,
    metadata,
  };

  await logTransaction(transaction);
}

/**
 * Logs a win transaction
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
  const transaction: WinTransaction = {
    id: crypto.randomUUID(),
    userId,
    type: "WIN",
    amount: winAmount,
    balanceBefore,
    balanceAfter,
    gameId,
    transactionId,
    timestamp: new Date(),
    betAmount,
    winAmount,
    winMultiplier,
    metadata,
  };

  await logTransaction(transaction);
}

/**
 * Logs a DEPOSIT transaction
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
  const transaction: DepositTransaction = {
    id: crypto.randomUUID(),
    userId,
    type: "DEPOSIT",
    amount,
    balanceBefore,
    balanceAfter,
    transactionId,
    timestamp: new Date(),
    method,
    externalTransactionId,
    metadata,
  };

  await logTransaction(transaction);
}

/**
 * Gets transaction history for a user
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<TransactionRecord[]> {
  try {
    logger.info({
      msg: "Getting transaction history",
      userId,
      limit,
      offset,
    });

    // In a real implementation, this would query the database
    return [];
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

/**
 * Validates transaction integrity
 */
export function validateTransaction(
  balanceBefore: number,
  amount: number,
  balanceAfter: number,
  type: "bet" | "DEPOSIT" | "withdrawal" | "win"
): boolean {
  switch (type) {
    case "bet":
      return balanceAfter === balanceBefore - Math.abs(amount);
    case "DEPOSIT":
      return balanceAfter === balanceBefore + Math.abs(amount);
    case "win":
      return balanceAfter === balanceBefore + Math.abs(amount);
    default:
      return false;
  }
}

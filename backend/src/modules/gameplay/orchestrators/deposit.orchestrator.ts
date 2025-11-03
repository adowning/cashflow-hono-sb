// src/modules/gameplay/deposit.service.ts
// REFACTORED

/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { db } from "@/core/database/db";
import { depositTable, type Deposit } from "@/core/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDetailedBalance } from "../core/balance-management.service";

// --- NEW IMPORTS ---
import { executeCoreDeposit } from "../core/core-deposit.service";
import { onDepositCompleted as onNotification } from "../listeners/deposit-notification.sender";
import { onDepositCompleted as onTransaction } from "../listeners/deposit-transaction.logger";
import { onDepositCompleted as onVip } from "../listeners/deposit-vip.processor";
import { gameplayLogger, type LogContext } from "../gameplay-logging.service";
// --- END NEW IMPORTS ---

export enum depositTableStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum PaymentMethod {
  CASHAPP = "CASHAPP",
  INSTORE_CASH = "INSTORE_CASH",
  INSTORE_CARD = "INSTORE_CARD",
}

export interface DepositRequest {
  userId: string;
  amount: number; // Amount in cents
  bonusAmount: number; // Amount in cents
  paymentMethod: PaymentMethod;
  currency?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface DepositResponse {
  success: boolean;
  depositId?: string;
  status: depositTableStatus;
  instructions?: string;
  referenceId?: string;
  error?: string;
}

export interface WebhookConfirmation {
  transactionId: string;
  amount: number;
  senderInfo?: string;
  timestamp: Date;
  providerData?: Record<string, unknown>;
  userId: string;
}

export interface DepositCompletionResult {
  success: boolean;
  depositId: string;
  amount: number;
  bonusApplied?: {
    xpGained: number;
  };
  error?: string;
}

/**
 * Initiate a new deposit request
 * (This function remains unchanged)
 */
export async function initiateDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    const playerBalance = await getDetailedBalance(request.userId);
    if (!playerBalance) {
      return {
        success: false,
        status: depositTableStatus.FAILED,
        error: "Player balance not found",
      };
    }

    const referenceId = `DEP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const depositId = await db.transaction(async (tx) => {
      const deposit = await tx
        .insert(depositTable)
        .values({
          id: uuidv4(),
          userId: request.userId,
          amount: request.amount,
          bonusAmount: request.bonusAmount,
          status: depositTableStatus.PENDING,
          note: request.note || referenceId,
        })
        .returning({ id: depositTable.id });
      if (!deposit[0]) throw new Error("no depositTable");
      return deposit[0].id;
    });

    const instructions = await getPaymentInstructions(
      request.paymentMethod,
      referenceId,
      request.amount
    );

    return {
      success: true,
      depositId,
      status: depositTableStatus.PENDING,
      instructions,
      referenceId,
    };
  } catch (error) {
    gameplayLogger.error("Deposit initiation failed:", error as LogContext);
    return {
      success: false,
      status: depositTableStatus.FAILED,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
/**
 * REFACTORED: Process webhook confirmation for completed deposit
 * This is now a clean orchestrator.
 */
export async function processDepositConfirmation(
  confirmation: WebhookConfirmation
): Promise<DepositCompletionResult> {
  let coreResult;
  try {
    // 1. EXECUTE CORE TRANSACTION
    coreResult = await executeCoreDeposit(confirmation);

    // 2. CREATE PAYLOAD for listeners
    const payload: any = {
      ...coreResult,
    };

    // 3. RUN ALL SIDE EFFECTS IN PARALLEL (Fire-and-forget)
    // All listeners are now independent and non-blocking.
    const listeners = [
      onVip(payload), // onVip will now handle updating the tx log with XP
      onTransaction(payload), // onTransaction just logs the core deposit
      onNotification(payload),
    ];

    Promise.allSettled(listeners).catch((err) => {
      // Log if any non-critical side-effect failed
      console.error("Post-deposit hook failure:", err);
    });

    // 4. RETURN SUCCESS FAST
    // We can no longer return xpGained because we are not awaiting onVip.
    // This makes the API response faster and more reliable.
    // The UI should update via a separate event (e.g., WebSocket) if needed.
    return {
      success: true,
      depositId: coreResult.depositId,
      amount: coreResult.amount,
      bonusApplied: {
        xpGained: 0, // Cannot be determined at this time
      },
    };
  } catch (error) {
    console.error("Deposit confirmation processing failed:", error);
    return {
      success: false,
      depositId: confirmation.transactionId,
      amount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
/**
 * Get payment instructions for different payment methods
 * (This function remains unchanged)
 */
async function getPaymentInstructions(
  method: PaymentMethod,
  referenceId: string,
  amount: number
): Promise<string> {
  const amountInDollars = (amount / 100).toFixed(2);
  switch (method) {
    case PaymentMethod.CASHAPP:
      return `Send $${amountInDollars} via CashApp to $CASHAPP_TAG. Include reference: ${referenceId}`;
    case PaymentMethod.INSTORE_CASH:
      return `Visit any participating store location and provide reference: ${referenceId}. Pay $${amountInDollars} in cash.`;
    case PaymentMethod.INSTORE_CARD:
      return `Visit any participating store location and provide reference: ${referenceId}. Pay $${amountInDollars} by card.`;
    default:
      return `Complete payment of $${amountInDollars} using reference: ${referenceId}`;
  }
}

/**
 * Get deposit status and details
 * (Keep this function)
 */
export async function getdepositTabletatus(depositId: string): Promise<{
  deposit?: Deposit;
  status: depositTableStatus;
  error?: string;
} | null> {
  try {
    const deposit: any = (await db.query.depositTable.findFirst({
      where: eq(depositTable.id, depositId),
    })) as Deposit | undefined;

    if (!deposit) {
      return {
        status: depositTableStatus.FAILED,
        error: "Deposit not found",
      };
    }

    return {
      deposit,
      status: deposit.status as depositTableStatus,
    };
  } catch (error) {
    gameplayLogger.error("Failed to get deposit status:", error as LogContext);
    return {
      status: depositTableStatus.FAILED,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's deposit history
 * (Keep this function)
 */
export async function getUserDepositHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  deposits: Deposit[];
  total: number;
  error?: string;
}> {
  try {
    const depositTableList = await db.query.depositTable.findMany({
      where: eq(depositTable.userId, userId),
      orderBy: [sql`${depositTable.createdAt} DESC`],
      limit,
      offset,
    });

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(depositTable)
      .where(eq(depositTable.userId, userId));

    if (!total[0]) throw new Error("no total");

    return {
      deposits: depositTableList as Deposit[],
      total: total[0].count,
    };
  } catch (error) {
    gameplayLogger.error("Failed to get deposit history:", error as LogContext);
    return {
      deposits: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cancel expired pending depositTable
 * (Keep this function)
 */
export async function cleanupExpireddepositTable(): Promise<{
  cancelled: number;
  error?: string;
}> {
  try {
    const expiryHours = 24; // depositTable expire after 24 hours
    const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

    const result: Deposit[] = await db
      .update(depositTable)
      .set({
        status: depositTableStatus.EXPIRED,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(depositTable.status, "PENDING"),
          sql`${depositTable.createdAt} < ${expiryDate.toISOString()}`
        )
      );

    if (!result) throw new Error("no result");

    return { cancelled: result.length || 0 };
  } catch (error) {
    gameplayLogger.error(
      "Failed to cleanup expired depositTable:",
      error as LogContext
    );
    return {
      cancelled: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

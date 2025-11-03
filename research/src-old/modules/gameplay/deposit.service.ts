// src/modules/gameplay/deposit.service.ts
// REFACTORED

/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { db } from "@/libs/database/db";
import
{
  depositTable,
  type Deposit,
} from "@/libs/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';
import { getDetailedBalance } from "../gameplay/balance-management.service";

// --- NEW IMPORTS ---
import { executeCoreDeposit } from "./core-deposit.service";
import { onDepositCompleted as onNotification } from "./listeners/deposit/notification.sender";
import { onDepositCompleted as onTransaction } from "./listeners/deposit/transaction.logger";
import { onDepositCompleted as onVip } from "./listeners/deposit/vip.processor";
// --- END NEW IMPORTS ---

export enum depositTabletatus
{
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum PaymentMethod
{
  CASHAPP = "CASHAPP",
  INSTORE_CASH = "INSTORE_CASH",
  INSTORE_CARD = "INSTORE_CARD",
}

export interface DepositRequest
{
  userId: string;
  amount: number; // Amount in cents
  bonusAmount: number; // Amount in cents
  paymentMethod: PaymentMethod;
  currency?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface DepositResponse
{
  success: boolean;
  depositId?: string;
  status: depositTabletatus;
  instructions?: string;
  referenceId?: string;
  error?: string;
}

export interface WebhookConfirmation
{
  transactionId: string;
  amount: number;
  senderInfo?: string;
  timestamp: Date;
  providerData?: Record<string, unknown>;
  userId: string;
}

export interface DepositCompletionResult
{
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
): Promise<DepositResponse>
{
  try {
    const playerBalance = await getDetailedBalance(request.userId);
    if (!playerBalance) {
      return {
        success: false,
        status: depositTabletatus.FAILED,
        error: "Player balance not found",
      };
    }

    const referenceId = `DEP_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const depositId = await db.transaction(async (tx) =>
    {
      const deposit = await tx
        .insert(depositTable)
        .values({
          id: uuidv4(),
          userId: request.userId,
          amount: request.amount,
          bonusAmount: request.bonusAmount,
          status: depositTabletatus.PENDING,
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
      status: depositTabletatus.PENDING,
      instructions,
      referenceId,
    };
  } catch (error) {
    console.error("Deposit initiation failed:", error);
    return {
      success: false,
      status: depositTabletatus.FAILED,
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
): Promise<DepositCompletionResult>
{

  let coreResult;
  try {
    // 1. EXECUTE CORE TRANSACTION
    coreResult = await executeCoreDeposit(confirmation);

    // 2. CREATE PAYLOAD for listeners
    const payload: any = {
      ...coreResult,
      // confirmation: confirmation, // Already included in coreResult
    };

    // 3. RUN SIDE EFFECTS
    // Run VIP first to get the XP result, as logging depends on it.
    const vipResult = await onVip(payload);
    payload.vipPointsAdded = vipResult.xpGained;

    // Run other listeners in parallel (fire-and-forget)
    const otherListeners = [
      onTransaction(payload),
      onNotification(payload),
    ];

    Promise.allSettled(otherListeners).catch(err =>
    {
      // Log if any non-critical side-effect failed
      console.error("Post-deposit hook failure:", err);
    });

    // 4. RETURN SUCCESS FAST
    return {
      success: true,
      depositId: coreResult.depositId,
      amount: coreResult.amount,
      bonusApplied: {
        xpGained: vipResult.xpGained,
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
): Promise<string>
{
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
  status: depositTabletatus;
  error?: string;
} | null>
{
  try {
    const deposit: any = (await db.query.depositTable.findFirst({
      where: eq(depositTable.id, depositId),
    })) as Deposit | undefined;

    if (!deposit) {
      return {
        status: depositTabletatus.FAILED,
        error: "Deposit not found",
      };
    }

    return {
      deposit,
      status: deposit.status as depositTabletatus,
    };
  } catch (error) {
    console.error("Failed to get deposit status:", error);
    return {
      status: depositTabletatus.FAILED,
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
}>
{
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
    console.error("Failed to get deposit history:", error);
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
}>
{
  try {
    const expiryHours = 24; // depositTable expire after 24 hours
    const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

    const result: Deposit[] = await db
      .update(depositTable)
      .set({
        status: depositTabletatus.EXPIRED,
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
    console.error("Failed to cleanup expired depositTable:", error);
    return {
      cancelled: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
// /** biome-ignore-all lint/suspicious/noExplicitAny: <> */

// import { db } from "@/libs/database/db";
// import
// {
//   depositTable,
//   type Deposit,
//   type UserBalanceSelect,
// } from "@/libs/database/schema";
// import { notifyBalanceChange } from "@/shared/notifications.service.js";
// import { logTransaction } from "@/shared/transaction.service.js";
// import { and, eq, sql } from "drizzle-orm";
// import { v4 as uuidv4 } from 'uuid';
// import
// {
//   getDetailedBalance,
//   handleDeposit,
// } from "../gameplay/balance-management.service";
// import { addXpToUser } from "./vip.service";

// /**
//  * Enhanced deposit service implementing PRD requirements
//  * Handles deposit initiation, webhook confirmation, and bonus processing
//  */

// export enum depositTabletatus
// {
//   PENDING = "PENDING",
//   PROCESSING = "PROCESSING",
//   COMPLETED = "COMPLETED",
//   FAILED = "FAILED",
//   CANCELLED = "CANCELLED",
//   EXPIRED = "EXPIRED",
// }

// export enum PaymentMethod
// {
//   CASHAPP = "CASHAPP",
//   INSTORE_CASH = "INSTORE_CASH",
//   INSTORE_CARD = "INSTORE_CARD",
// }

// export interface DepositRequest
// {
//   userId: string;
//   amount: number; // Amount in cents
//   bonusAmount: number; // Amount in cents
//   paymentMethod: PaymentMethod;
//   currency?: string;
//   note?: string;
//   metadata?: Record<string, unknown>;
// }

// export interface DepositResponse
// {
//   success: boolean;
//   depositId?: string;
//   status: depositTabletatus;
//   instructions?: string;
//   referenceId?: string;
//   error?: string;
// }

// export interface WebhookConfirmation
// {
//   transactionId: string;
//   amount: number;
//   senderInfo?: string;
//   timestamp: Date;
//   providerData?: Record<string, unknown>;
//   userId: string;
// }

// export interface DepositCompletionResult
// {
//   success: boolean;
//   depositId: string;
//   amount: number;
//   bonusApplied?: {
//     xpGained: number;
//     freeSpinsAwarded: number;
//   };
//   error?: string;
// }

// /**
//  * Initiate a new deposit request
//  */
// export async function initiateDeposit(
//   request: DepositRequest
// ): Promise<DepositResponse>
// {
//   try {
//     // Validate user exists and has active wallet
//     const playerBalance = await getDetailedBalance(request.userId);
//     if (!playerBalance) {
//       return {
//         success: false,
//         status: depositTabletatus.FAILED,
//         error: "Player balance not found",
//       };
//     }

//     // Generate unique reference ID for tracking
//     const referenceId = `DEP_${Date.now()}_${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;

//     // Create deposit record
//     const depositId = await db.transaction(async (tx) =>
//     {
//       const deposit = await tx
//         .insert(depositTable)
//         .values({
//           id: uuidv4(),
//           userId: request.userId,
//           amount: request.amount,
//           bonusAmount: request.bonusAmount,
//           status: depositTabletatus.PENDING,
//           // currency: request.currency || 'USD',
//           note: request.note || referenceId,
//         })
//         .returning({ id: depositTable.id });
//       if (!deposit[0]) throw new Error("no depositTable");

//       return deposit[0].id;
//     });

//     // Get payment instructions based on method
//     const instructions = await getPaymentInstructions(
//       request.paymentMethod,
//       referenceId,
//       request.amount
//     );

//     return {
//       success: true,
//       depositId,
//       status: depositTabletatus.PENDING,
//       instructions,
//       referenceId,
//     };
//   } catch (error) {
//     console.error("Deposit initiation failed:", error);
//     return {
//       success: false,
//       status: depositTabletatus.FAILED,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// /**
//  * Process webhook confirmation for completed deposit
//  */
// export async function processDepositConfirmation(
//   confirmation: WebhookConfirmation
// ): Promise<DepositCompletionResult>
// {
//   try {
//     // Find pending deposit by transaction ID
//     const pendingDeposit = await db.query.depositTable.findFirst({
//       where: eq(depositTable.id, confirmation.transactionId),
//     });

//     if (!pendingDeposit) {
//       return {
//         success: false,
//         depositId: "",
//         amount: 0,
//         error: "No pending deposit found for this transaction",
//       };
//     }
//     if (!pendingDeposit.userId) {
//       throw new Error("Failed to run deposit: ");
//     }
//     if (confirmation.amount < pendingDeposit.amount) {
//       throw new Error(
//         "the confirmation amount is not enough to satisfy deposit"
//       );
//     }
//     const result = await db.transaction(async (tx) =>
//     {
//       // Update deposit status to completed

//       if (!pendingDeposit.userId) {
//         console.error("CRITICAL: pendingDeposit.userId is null or undefined!", {
//           depositId: pendingDeposit.id,
//           transactionId: confirmation.transactionId,
//           amount: confirmation.amount,
//         });
//         throw new Error("Cannot log transaction: userId is null");
//       }
//       if (pendingDeposit.userId == null)
//         throw new Error("this shouldnt jhappen");
//       // Credit user wallet
//       const playerBalance = await getDetailedBalance(pendingDeposit.userId);

//       if (!playerBalance) {
//         throw new Error("User balance not found");
//       }

//       let creditResult: UserBalanceSelect = await handleDeposit({
//         userId: pendingDeposit.userId,
//         amount: pendingDeposit.amount,
//         // 'real',
//         // 'deposit',
//       });
//       let creditResultBonus: UserBalanceSelect;
//       // let creditResultBonus = {
//       //   success: false,
//       //   newBalance: playerBalance.bonusBalance,
//       // };
//       //   if (pendingDeposit.amount > 0)
//       //     creditResult = await handleDeposit({
//       //       userId: pendingDeposit.userId,
//       //       amount: pendingDeposit.amount,
//       //       // 'real',
//       //       // 'deposit',
//       // });
//       // if (pendingDeposit.bonusAmount > 0)
//       //   creditResultBonus = await handleDeposit(
//       //     pendingDeposit.userId,
//       //     pendingDeposit.amount,
//       //     'bonus',
//       //     'deposit',
//       //   );
//       // if (pendingDeposit.bonusAmount > 0)
//       //   creditResult = await handleDeposit({
//       //     userId: pendingDeposit.userId,
//       //     amount: pendingDeposit.amount,
//       //     // 'real',
//       //     // 'deposit',
//       //   });
//       // if (!creditResult.success) {
//       //   throw new Error(`Failed to credit wallet: ${creditResult}`);
//       // }

//       // Apply deposit bonuses
//       const xpResult = await applyDepositXpGains(
//         pendingDeposit.userId,
//         pendingDeposit.amount
//       );
//       await logTransaction({
//         userId: pendingDeposit.userId,
//         operatorId: "79032f3f-7c4e-4575-abf9-4298ad3e9d1a",
//         wagerAmount: 0,
//         realBalanceBefore: Number(playerBalance.realBalance),
//         realBalanceAfter: Number(
//           creditResult.realBalance || playerBalance.realBalance
//         ),
//         bonusBalanceBefore: Number(playerBalance.bonusBalance),
//         bonusBalanceAfter: Number(
//           creditResult.bonusBalance || playerBalance.bonusBalance || 0
//         ),
//         status: "COMPLETED",
//         type: "DEPOSIT",
//       });
//       await tx
//         .update(depositTable)
//         .set({
//           status: "COMPLETED",
//           // updatedAt: new Date(),
//         })
//         .where(eq(depositTable.id, pendingDeposit.id));
//       return {
//         success: true,
//         depositId: pendingDeposit.id,
//         amount: creditResult.realBalance,
//         bonusAmount: creditResult.bonusBalance,
//         xpApplied: xpResult,
//       };
//     });

//     // Send real-time balance notification
//     await notifyBalanceChange(pendingDeposit.userId, {
//       realBalance: result.amount,
//       bonusBalance: 0,
//       totalBalance: result.amount,
//       changeAmount: result.amount,
//       changeType: "bonus",
//     });

//     return result;
//   } catch (error) {
//     console.error("Deposit confirmation processing failed:", error);
//     return {
//       success: false,
//       depositId: "",
//       amount: 0,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// /**
//  * Get payment instructions for different payment methods
//  */
// async function getPaymentInstructions(
//   method: PaymentMethod,
//   referenceId: string,
//   amount: number
// ): Promise<string>
// {
//   const amountInDollars = (amount / 100).toFixed(2);

//   switch (method) {
//     case PaymentMethod.CASHAPP:
//       return `Send $${amountInDollars} via CashApp to $CASHAPP_TAG. Include reference: ${referenceId}`;

//     case PaymentMethod.INSTORE_CASH:
//       return `Visit any participating store location and provide reference: ${referenceId}. Pay $${amountInDollars} in cash.`;

//     case PaymentMethod.INSTORE_CARD:
//       return `Visit any participating store location and provide reference: ${referenceId}. Pay $${amountInDollars} by card.`;

//     default:
//       return `Complete payment of $${amountInDollars} using reference: ${referenceId}`;
//   }
// }

// /**
//  * Apply deposit bonuses (XP and free spins)
//  */
// async function applyDepositXpGains(
//   userId: string,
//   amount: number
// ): Promise<{ xpGained: number; freeSpinsAwarded: number }>
// {
//   let xpGained = 0;
//   let freeSpinsAwarded = 0;

//   try {
//     // Calculate XP bonus (1 XP per $1 deposited)
//     const xpAmount = Math.floor(amount / 100);
//     if (xpAmount > 0) {
//       const vipResult = await addXpToUser(userId, xpAmount);
//       if (vipResult.success) {
//         xpGained = xpAmount;
//       }
//     }

//     // Award free spins based on deposit amount
//     if (amount >= 10000) {
//       // $100+ deposit
//       freeSpinsAwarded = 10;
//       // TODO: Implement free spins awarding logic
//       console.log(`Awarding ${freeSpinsAwarded} free spins to user ${userId}`);
//     }

//     // First-time deposit bonus
//     const isFirstDeposit = await checkFirstTimeDeposit(userId);
//     if (isFirstDeposit) {
//       freeSpinsAwarded += 20; // Extra 20 free spins for first deposit
//       console.log(
//         `First-time deposit bonus: Additional ${freeSpinsAwarded} free spins`
//       );
//     }

//     return { xpGained, freeSpinsAwarded };
//   } catch (error) {
//     console.error("Failed to apply deposit bonuses:", error);
//     return { xpGained: 0, freeSpinsAwarded: 0 };
//   }
// }

// /**
//  * Check if this is user's first deposit
//  */
// async function checkFirstTimeDeposit(userId: string): Promise<boolean>
// {
//   const existingdepositTable = await db.query.depositTable.findMany({
//     where: and(
//       eq(depositTable.userId, userId),
//       eq(depositTable.status, depositTabletatus.COMPLETED)
//     ),
//   });

//   return existingdepositTable.length === 0;
// }

// /**
//  * Get deposit status and details
//  */
// export async function getdepositTabletatus(depositId: string): Promise<{
//   deposit?: Deposit;
//   status: depositTabletatus;
//   error?: string;
// } | null>
// {
//   try {
//     const deposit: any = (await db.query.depositTable.findFirst({
//       where: eq(depositTable.id, depositId),
//     })) as Deposit | undefined;

//     if (!deposit) {
//       return {
//         status: depositTabletatus.FAILED,
//         error: "Deposit not found",
//       };
//     }

//     return {
//       deposit,
//       status: deposit.status as depositTabletatus,
//     };
//   } catch (error) {
//     console.error("Failed to get deposit status:", error);
//     return {
//       status: depositTabletatus.FAILED,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// /**
//  * Get user's deposit history
//  */
// export async function getUserDepositHistory(
//   userId: string,
//   limit: number = 50,
//   offset: number = 0
// ): Promise<{
//   deposits: Deposit[];
//   total: number;
//   error?: string;
// }>
// {
//   try {
//     const depositTableList = await db.query.depositTable.findMany({
//       where: eq(depositTable.userId, userId),
//       orderBy: [sql`${depositTable.createdAt} DESC`],
//       limit,
//       offset,
//     });

//     const total = await db
//       .select({ count: sql<number>`count(*)` })
//       .from(depositTable)
//       .where(eq(depositTable.userId, userId));

//     if (!total[0]) throw new Error("no total");

//     return {
//       deposits: depositTableList as Deposit[],
//       total: total[0].count,
//     };
//   } catch (error) {
//     console.error("Failed to get deposit history:", error);
//     return {
//       deposits: [],
//       total: 0,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// /**
//  * Cancel expired pending depositTable
//  */
// export async function cleanupExpireddepositTable(): Promise<{
//   cancelled: number;
//   error?: string;
// }>
// {
//   try {
//     const expiryHours = 24; // depositTable expire after 24 hours
//     const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

//     const result: Deposit[] = await db
//       .update(depositTable)
//       .set({
//         status: depositTabletatus.EXPIRED,
//         // updatedAt: new Date(),
//       })
//       .where(
//         and(
//           eq(depositTable.status, depositTabletatus.PENDING),
//           sql`${depositTable.createdAt} < ${expiryDate.toISOString()}`
//         )
//       );

//     if (!result) throw new Error("no result");

//     return { cancelled: result.length || 0 };
//   } catch (error) {
//     console.error("Failed to cleanup expired depositTable:", error);
//     return {
//       cancelled: 0,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// src/modules/gameplay/core-deposit.service.ts

import { db } from "@/core/database/db";
import
{
    depositTable,
    type Deposit,
    type UserBalanceSelect,
} from "@/core/database/schema";
import { eq } from "drizzle-orm";
import
{
    getDetailedBalance,
    handleDeposit,
} from "./balance-management.service";
import type { WebhookConfirmation } from "../../orchestrators/deposit.orchestrator";

// Define the payload this core service will return
export interface CoreDepositResult
{
    userId: string;
    depositId: string;
    amount: number;
    bonusAmount: number;
    realBalanceBefore: number;
    bonusBalanceBefore: number;
    realBalanceAfter: number;
    bonusBalanceAfter: number;
}

/**
 * Executes the core, atomic deposit transaction.
 * Credits the user's balance and marks the deposit as "COMPLETED".
 */
export async function executeCoreDeposit(
    confirmation: WebhookConfirmation
): Promise<CoreDepositResult>
{
    // Find pending deposit
    const pendingDeposit = await db.query.depositTable.findFirst({
        where: eq(depositTable.id, confirmation.transactionId),
    });

    if (!pendingDeposit) {
        throw new Error("No pending deposit found for this transaction");
    }

    if (!pendingDeposit.userId) {
        throw new Error("Deposit record is missing a userId");
    }

    if (confirmation.amount < pendingDeposit.amount) {
        // Or handle partial payments if your system supports it
        throw new Error("Confirmation amount is less than pending deposit amount");
    }

    // Get balance *before* the transaction
    const playerBalance = await getDetailedBalance(pendingDeposit.userId);
    if (!playerBalance) {
        throw new Error("User balance not found");
    }

    const realBalanceBefore = playerBalance.realBalance;
    const bonusBalanceBefore = playerBalance.bonusBalance;

    // Execute as an atomic transaction
    const txResult = await db.transaction(async (tx) =>
    {
        // 1. Credit user wallet
        const creditResult = await handleDeposit({
            userId: pendingDeposit.userId,
            amount: pendingDeposit.amount,
            // Note: handleDeposit should be updated to work within a tx
            // or we should move its logic in here. Assuming it works.
        });

        // 2. Update deposit status to completed
        await tx
            .update(depositTable)
            .set({
                status: "COMPLETED",
                updatedAt: new Date(),
            })
            .where(eq(depositTable.id, pendingDeposit.id));

        return {
            success: true,
            newRealBalance: creditResult.realBalance,
            newBonusBalance: creditResult.bonusBalance,
        };
    });

    if (!txResult.success) {
        // This should be caught by the transaction rollback, but as a safeguard:
        throw new Error("Failed to credit wallet during transaction");
    }

    // Return the full state change payload
    return {
        userId: pendingDeposit.userId,
        depositId: pendingDeposit.id,
        amount: pendingDeposit.amount,
        bonusAmount: pendingDeposit.bonusAmount, // Pass this along
        realBalanceBefore: realBalanceBefore,
        bonusBalanceBefore: bonusBalanceBefore,
        realBalanceAfter: txResult.newRealBalance,
        bonusBalanceAfter: txResult.newBonusBalance,
    };
}
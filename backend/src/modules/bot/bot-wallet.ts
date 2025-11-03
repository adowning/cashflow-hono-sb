/**
 * Bot Wallet Service
 * Handles all financial operations for a bot, ensuring sufficient balance.
 */
import { getOrCreateBalance } from "../gameplay/core/balance-management.service";
import type { BalanceResult } from "./bot.service";
import {
    initiateDeposit,
    PaymentMethod,
    processDepositConfirmation,
    type DepositRequest,
    type WebhookConfirmation
} from "../gameplay/orchestrators/deposit.orchestrator";

// Interface for deposit operation result
export interface DepositOperationResult
{
    success: boolean;
    balance?: BalanceResult;
    error?: string;
}

// Configuration for deposit retries
const MAX_DEPOSIT_ATTEMPTS = 3;
const DEPOSIT_ATTEMPT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

let depositAttempts = 0;
let lastDepositAttemptTime: Date | null = null;

/**
 * Ensures a bot's balance is sufficient for a minimum amount.
 * If not, it tops up the balance to the target amount.
 */
export async function ensureSufficientBalance(
    userId: string,
    minRequiredAmount: number,
    targetDepositAmount: number
): Promise<DepositOperationResult>
{
    // 1. Get current balance
    const currentBalance = await getOrCreateBalance(userId);
    if (!currentBalance) {
        return { success: false, error: "Failed to get or create balance" };
    }

    const totalBalance = currentBalance.realBalance + currentBalance.bonusBalance;

    // 2. Check if balance is already sufficient
    if (totalBalance >= minRequiredAmount) {
        return {
            success: true,
            balance: { ...currentBalance, totalBalance },
        };
    }

    // 3. Balance is insufficient, a deposit is required.
    console.log(
        `💰 Bot balance $${(totalBalance / 100).toFixed(2)} is below required $${(minRequiredAmount / 100).toFixed(2)}. Attempting deposit.`
    );

    // 4. Check deposit attempt velocity
    if (
        lastDepositAttemptTime &&
        Date.now() - lastDepositAttemptTime.getTime() > DEPOSIT_ATTEMPT_COOLDOWN_MS
    ) {
        depositAttempts = 0; // Reset counter
    }

    if (depositAttempts >= MAX_DEPOSIT_ATTEMPTS) {
        return { success: false, error: "Maximum deposit attempts reached" };
    }

    try {
        depositAttempts++;
        lastDepositAttemptTime = new Date();

        // 5. Initiate deposit
        const depositRequest: DepositRequest = {
            userId,
            amount: targetDepositAmount,
            bonusAmount: 0,
            paymentMethod: PaymentMethod.CASHAPP,
        };

        const depositResult = await initiateDeposit(depositRequest);
        if (!depositResult.success || !depositResult.depositId) {
            return {
                success: false,
                error: depositResult.error || "Deposit initiation failed",
            };
        }

        // 6. Process confirmation immediately
        const confirmation: WebhookConfirmation = {
            transactionId: depositResult.depositId,
            amount: targetDepositAmount,
            senderInfo: "bot",
            timestamp: new Date(),
            userId: userId,
        };

        const confirmationResult = await processDepositConfirmation(confirmation);
        if (!confirmationResult.success) {
            return { success: false, error: "Deposit confirmation failed" };
        }

        // 7. Get final balance
        const updatedBalance = await getOrCreateBalance(userId);
        if (!updatedBalance) {
            return { success: false, error: "Could not retrieve updated balance" };
        }

        const newTotalBalance =
            updatedBalance.realBalance + updatedBalance.bonusBalance;

        if (newTotalBalance < minRequiredAmount) {
            return {
                success: false,
                error: `Insufficient balance after deposit. Need $${(minRequiredAmount / 100).toFixed(2)}, have $${(newTotalBalance / 100).toFixed(2)}`,
            };
        }

        // 8. Success
        depositAttempts = 0; // Reset on success
        lastDepositAttemptTime = null;
        return {
            success: true,
            balance: { ...updatedBalance, totalBalance: newTotalBalance },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Deposit operation failed",
        };
    }
}
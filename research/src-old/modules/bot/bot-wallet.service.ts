// src/modules/gameplay/bot-wallet.service.ts

/**
 * Bot Wallet Service
 * Handles all financial operations for a bot, ensuring sufficient balance.
 */
import { getOrCreateBalance } from "./balance-management.service";
import type { BalanceResult, BotConfig } from "./bot.service"; // You may want to move BalanceResult to a shared types file
import
{
    initiateDeposit,
    PaymentMethod,
    processDepositConfirmation,
    type DepositRequest,
    type WebhookConfirmation
} from "./deposit.service";

// Interface for deposit operation result
export interface DepositOperationResult
{
    success: boolean;
    balance: BalanceResult;
    error?: string;
}

// State for deposit retries (encapsulated in this service)
let depositAttempts = 0;
let lastDepositAttemptTime: Date | null = null;

/**
 * Ensures a bot's balance is sufficient for a minimum amount.
 * If not, it tops up the balance to the target amount.
 */
export async function ensureSufficientBalance(
    userId: string,
    minRequiredAmount: number,
    targetDepositAmount: number,
    config: BotConfig
): Promise<DepositOperationResult>
{
    // 1. Get current balance
    const currentBalance = await getOrCreateBalance(userId);
    if (!currentBalance) {
        return {
            success: false,
            error: "Failed to get or create balance",
            balance: null,
        };
    }

    const totalBalance = currentBalance.realBalance + currentBalance.bonusBalance;
    const balanceResult = { ...currentBalance, totalBalance };

    // 2. Check if balance is already sufficient
    if (totalBalance >= minRequiredAmount) {
        return {
            success: true,
            balance: balanceResult,
        };
    }

    // 3. Balance is insufficient, a deposit is required.
    console.log(
        `💰 Bot balance $${(totalBalance / 100).toFixed(2)} is below required $${(minRequiredAmount / 100).toFixed(2)}. Attempting deposit.`
    );

    // 4. Check deposit attempt velocity
    if (
        lastDepositAttemptTime &&
        Date.now() - lastDepositAttemptTime.getTime() > 5 * 60 * 1000 // 5 min cooldown
    ) {
        depositAttempts = 0; // Reset counter
    }

    const maxAttempts = config.maxDepositAttempts ?? 3;
    if (depositAttempts >= maxAttempts) {
        return {
            success: false,
            error: "Maximum deposit attempts reached",
            balance: balanceResult,
        };
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
                balance: balanceResult,
            };
        }

        // 6. Process confirmation immediately (simulating bot's "webhook")
        const confirmation: WebhookConfirmation = {
            transactionId: depositResult.depositId,
            amount: targetDepositAmount,
            senderInfo: "bot",
            timestamp: new Date(),
            userId: userId,
        };

        const confirmationResult = await processDepositConfirmation(confirmation);
        if (!confirmationResult.success) {
            return {
                success: false,
                error: "Deposit confirmation failed",
                balance: balanceResult,
            };
        }

        // 7. Get final balance
        const updatedBalance = await getOrCreateBalance(userId);
        if (!updatedBalance) {
            return {
                success: false,
                error: "Could not retrieve updated balance",
                balance: null,
            };
        }

        const newTotalBalance =
            updatedBalance.realBalance + updatedBalance.bonusBalance;
        const newBalanceResult = { ...updatedBalance, totalBalance: newTotalBalance };

        if (newTotalBalance < minRequiredAmount) {
            return {
                success: false,
                error: `Insufficient balance after deposit. Need $${(minRequiredAmount / 100).toFixed(2)}, have $${(newTotalBalance / 100).toFixed(2)}`,
                balance: newBalanceResult,
            };
        }

        // 8. Success
        depositAttempts = 0; // Reset on success
        lastDepositAttemptTime = null;
        return {
            success: true,
            balance: newBalanceResult,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Deposit operation failed",
            balance: balanceResult,
        };
    }
}
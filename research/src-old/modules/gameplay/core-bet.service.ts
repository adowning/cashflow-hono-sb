/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { z } from "zod";
import {
  db,
  findFirstActiveGameSessionNative,
  findFirstGameNative,
  findFirstUserNative,
  selectUserBalanceNative,
} from "@/libs/database/db";
import { validateBet } from "@/shared/restrictions.service";
import { addWinnings, deductBetAmount } from "./balance-management.service";

// Interfaces and Schemas
export interface BetRequest {
  userId: string;
  gameId: string;
  wagerAmount: number; // Amount in cents
  operatorId?: string;
  sessionId?: string;
  affiliateName?: string;
}

export interface GameOutcome {
  winAmount: number;
  gameData?: Record<string, unknown>; // Game-specific outcome data
  jackpotWin?: {
    group: string;
    amount: number;
  };
}

// Sanitization function for strings to prevent log injection
function sanitizeString(str: string): string {
  return str.replace(/[\r\n\t\b\f\v\\"]/g, "").trim();
}

export const betRequestSchema = z.object({
  userId: z.string().min(1, "userId cannot be empty").transform(sanitizeString),
  gameId: z.string().min(1, "gameId cannot be empty").transform(sanitizeString),
  wagerAmount: z
    .number()
    .positive("wagerAmount must be positive")
    .finite("wagerAmount must be a valid number"),
  operatorId: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  sessionId: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  affiliateName: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
});

export const gameOutcomeSchema = z.object({
  winAmount: z
    .number()
    .min(0, "winAmount cannot be negative")
    .finite("winAmount must be a valid number"),
  gameData: z.record(z.string(), z.unknown()).optional(),
  jackpotWin: z
    .object({
      group: z.string(),
      amount: z.number().min(0),
    })
    .optional(),
});

/**
 * Helper function to add winnings within a transaction context
 */
async function addWinningsWithinTransaction(
  tx: any,
  balanceDeduction: any,
  userId: string,
  gameId: string,
  winAmount: number
) {
  let winningsAddition: {
    success: boolean;
    newBalance: number;
    error?: string;
  } = {
    success: true,
    newBalance: 0,
  };
  let realWinnings = 0;
  let bonusWinnings = 0;

  if (winAmount > 0) {
    if (balanceDeduction.balanceType === "mixed") {
      const totalDeducted =
        balanceDeduction.deductedFrom.real +
        balanceDeduction.deductedFrom.bonuses.reduce(
          (sum: any, b: { amount: any }) => sum + b.amount,
          0
        );

      if (totalDeducted === 0) {
        realWinnings = winAmount;
        bonusWinnings = 0;
        winningsAddition = await addWinnings({
          userId,
          amount: winAmount,
          balanceType: "real",
          reason: `Game win - ${gameId}`,
          gameId,
        });
      } else {
        const realDeducted = balanceDeduction.deductedFrom.real;
        const realRatio = realDeducted / totalDeducted;
        realWinnings = Math.round(winAmount * realRatio);
        bonusWinnings = winAmount - realWinnings;

        const realAddition = await addWinnings({
          userId,
          amount: realWinnings,
          balanceType: "real",
          reason: `Game win - ${gameId} (real portion)`,
          gameId,
        });

        const bonusAddition = await addWinnings({
          userId,
          amount: bonusWinnings,
          balanceType: "bonus",
          reason: `Game win - ${gameId} (bonus portion)`,
          gameId,
        });

        winningsAddition = {
          success: realAddition.success && bonusAddition.success,
          newBalance: bonusAddition.newBalance,
          error: realAddition.error || bonusAddition.error,
        };
      }
    } else {
      const balanceType =
        balanceDeduction.balanceType === "bonus" ? "bonus" : "real";
      winningsAddition = await addWinnings({
        userId,
        amount: winAmount,
        balanceType,
        reason: `Game win - ${gameId}`,
        gameId,
      });

      if (balanceType === "real") {
        realWinnings = winAmount;
      } else {
        bonusWinnings = winAmount;
      }
    }

    if (!winningsAddition.success) {
      throw new Error(`Winnings addition failed: ${winningsAddition.error}`);
    }
  }

  return { winningsAddition, realWinnings, bonusWinnings };
}

export async function executeCoreBet(
  betRequest: BetRequest,
  gameOutcome: GameOutcome
) {
  const validatedBetRequest = betRequestSchema.parse(betRequest);
  const validatedGameOutcome = gameOutcomeSchema.parse(gameOutcome);

  const [user, userBalance, game, gameSession] = await Promise.all([
    findFirstUserNative(validatedBetRequest.userId),
    selectUserBalanceNative(validatedBetRequest.userId),
    findFirstGameNative(validatedBetRequest.gameId),
    findFirstActiveGameSessionNative(
      validatedBetRequest.userId,
      validatedBetRequest.gameId
    ),
  ]);

  const validation = await validateBet({
    user,
    userBalance,
    game,
    gameSession,
    wagerAmount: validatedBetRequest.wagerAmount,
    operatorId: validatedBetRequest.operatorId,
  });

  if (!validation.valid) {
    throw new Error(validation.reason || "Bet validation failed");
  }

  if (!game) {
    throw new Error(`Game ${validatedBetRequest.gameId} not found`);
  }
  if (!userBalance) {
    throw new Error("User balance not found");
  }

  const balanceTransactionResult = await db.transaction(async (tx) => {
    const balanceDeduction = await deductBetAmount({
      userId: userBalance.userId,
      amount: validatedBetRequest.wagerAmount,
      gameId: validatedBetRequest.gameId,
      preferredBalanceType: "auto",
    });

    if (!balanceDeduction.success) {
      throw new Error(balanceDeduction.error || "Balance deduction failed");
    }

    const winningsAddition = await addWinningsWithinTransaction(
      tx,
      balanceDeduction,
      userBalance.userId,
      validatedBetRequest.gameId,
      validatedGameOutcome.winAmount
    );

    const finalBalances = {
      realBalance:
        userBalance.realBalance -
        balanceDeduction.deductedFrom.real +
        winningsAddition.realWinnings,
      bonusBalance:
        userBalance.bonusBalance -
        balanceDeduction.deductedFrom.bonuses.reduce(
          (sum, b) => sum + b.amount,
          0
        ) +
        winningsAddition.bonusWinnings,
    };

    return {
      balanceDeduction,
      finalBalances,
    };
  });

  const { balanceDeduction, finalBalances } = balanceTransactionResult;

  return {
    userId: validatedBetRequest.userId,
    gameId: validatedBetRequest.gameId,
    wagerAmount: validatedBetRequest.wagerAmount,
    winAmount: validatedGameOutcome.winAmount,
    realBalanceBefore: userBalance.realBalance,
    bonusBalanceBefore: userBalance.bonusBalance,
    realBalanceAfter: finalBalances.realBalance,
    bonusBalanceAfter: finalBalances.bonusBalance,
    balanceType: balanceDeduction.balanceType,
  };
}

import { db } from "@/libs/database/db";
import { bonusTable, gameSessionTable } from "@/libs/database/schema";
import { checkBalance } from "@/modules/gameplay/core/balance-management.service";
import { and, eq, gte, sql } from "drizzle-orm";
import type {
  Game,
  GameSession,
  User,
  UserBalance,
} from "../libs/database/schema";
import { configurationManager } from "./config";

/**
 * Bet validation service for comprehensive pre-bet checks
 * Validates session, game eligibility, wager limits, and balance
 */

export interface BetValidationRequest
{
  user: User;
  userBalance: UserBalance;
  game: Game;
  gameSession: GameSession;
  wagerAmount: number; // Amount in cents
  operatorId?: string;
}

export interface BetValidationResult
{
  valid: boolean;
  reason?: string;
  balanceType?: "real" | "bonus" | "insufficient";
  availableBalance?: number;
  game?: Game;
  session?: any;
}

export interface GameLimits
{
  minBet: number;
  maxBet: number;
  maxDailyLoss?: number;
  maxSessionLoss?: number;
}

/**
 * Check if game is allowed for bonus wagering
 */
export async function isGameAllowedForBonus(
  // gameId: string,
  bonusId: string
): Promise<boolean>
{
  const _bonus = await db.query.bonusTable.findFirst({
    where: eq(bonusTable.id, bonusId),
  });

  if (!_bonus) {
    return false;
  }

  // This is a simplified check - should be more sophisticated based on game type
  // For now, assuming slot games are generally allowed for bonus wagering
  return _bonus.slot === true; // Simplified logic
}

/**
 * Comprehensive bet validation following PRD requirements
 */
export async function validateBet(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  try {
    // console.log("🔍 Starting bet validation for user:", request.user.id, "game:", request.game?.name, "wager:", request.wagerAmount);

    // 1. Validate user session
    const sessionValidation = await validateUserSession(request);
    if (sessionValidation.valid === false)
      console.log("🔍 Session validation:", sessionValidation.valid ? "✅ PASSED" : "❌ FAILED:", sessionValidation.reason);
    if (!sessionValidation.valid) {
      return sessionValidation;
    }

    // 2. Validate game session and eligibility
    const gameValidation = await validateGameSession(request);
    if (gameValidation.valid === false)
      console.log("🔍 Game validation:", gameValidation.valid ? "✅ PASSED" : "❌ FAILED:", gameValidation.reason);
    if (!gameValidation.valid) {
      return gameValidation;
    }

    // 3. Validate game availability and limits
    const gameLimitsValidation = await validateGameLimits(request);
    if (gameLimitsValidation.valid === false)
      console.log("🔍 Game limits validation:", gameLimitsValidation.valid ? "✅ PASSED" : "❌ FAILED:", gameLimitsValidation.reason);
    if (!gameLimitsValidation.valid) {
      return gameLimitsValidation;
    }

    // 4. Validate wager amount limits
    const wagerValidation = await validateWagerAmount(request);
    if (wagerValidation.valid === false)
      console.log("🔍 Wager validation:", wagerValidation.valid ? "✅ PASSED" : "❌ FAILED:", wagerValidation.reason);
    if (!wagerValidation.valid) {
      return wagerValidation;
    }

    // 5. Validate balance sufficiency
    const balanceValidation = await validateBalance(request);
    if (balanceValidation.valid === false)
      console.log("🔍 Balance validation:", balanceValidation.valid ? "✅ PASSED" : "❌ FAILED:", balanceValidation.reason);
    if (!balanceValidation.valid) {
      return balanceValidation;
    }

    // console.log("🎉 All validations passed!");

    // All validations passed
    return {
      valid: true,
      balanceType: balanceValidation.balanceType,
      availableBalance: balanceValidation.availableBalance,
      game: gameValidation.game,
      session: sessionValidation.session,
    };
  } catch (error) {
    console.error("💥 Bet validation system error:", error);
    return {
      valid: false,
      reason: "Validation system error",
    };
  }
}

/**
 * Validate user has active session
 */
async function validateUserSession(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  if (!request.user) {
    return { valid: false, reason: "User not found" };
  }

  //TODO make this from auth session
  let session = request.gameSession;

  // console.log("Found session:", session ? "yes" : "no");

  if (!session) {
    return { valid: false, reason: "No active session found" };
  }

  return {
    valid: true,
    session,
  };
}

/**
 * Validate game session and game eligibility
 */
async function validateGameSession(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  // Check if game exists and is active
  if (!request.gameSession) {
    return { valid: false, reason: "No active game session found" };
  }

  return {
    valid: true,
    game: request.game,
    session: request.gameSession,
  };
}

/**
 * Validate game-specific limits and restrictions
 */
async function validateGameLimits(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  if (!request.game) {
    return { valid: false, reason: "Game not found" };
  }
  const settings = configurationManager.getConfiguration();
  // Check game-specific wager limits (these would typically come from game configuration)
  const systemLimits = settings.systemLimits as any;
  const gameLimits: GameLimits = {
    minBet: request.game.minBet || systemLimits?.minBetAmount || 100, // 1.00 in cents - should be configurable per game
    maxBet: request.game.maxBet || systemLimits?.maxBetAmount || 100000, // 1000.00 in cents - should be configurable per game
  };

  if (request.wagerAmount < gameLimits.minBet) {
    return {
      valid: false,
      reason: `Minimum bet is $${gameLimits.minBet / 100}`,
    };
  }

  if (request.wagerAmount > gameLimits.maxBet) {
    return {
      valid: false,
      reason: `Maximum bet is $${gameLimits.maxBet / 100}`,
    };
  }

  return { valid: true };
}

/**
 * Validate wager amount against user-specific limits
 */
async function validateWagerAmount(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  // Get user's active wallet

  // let userBalance = await getDetailedBalance(request.user.id);
  // const user = userWallets[0];

  // if (!request.userBalance) {
  //   // return { valid: false, reason: "User balance not found" };
  //   await db.insert(userBalances).values({ userId: request.user.id });
  //   userBalance = await getDetailedBalance(request.user.id);
  // }

  // Check daily loss limit (configurable per user/VIP level)
  const dailyLossValidation = await validateDailyLossLimit(request);
  if (!dailyLossValidation.valid) {
    return dailyLossValidation;
  }

  // Check session loss limit
  const sessionLossValidation = await validateSessionLossLimit(request);
  if (!sessionLossValidation.valid) {
    return sessionLossValidation;
  }

  return { valid: true };
}

/**
 * Validate against daily loss limits
 */
async function validateDailyLossLimit(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const settings = configurationManager.getConfiguration();
  const systemLimits = settings.systemLimits as any;

  // Calculate today's total losses (negative GGR)
  const todayStats = await db
    .select({
      totalWager: sql<number>`COALESCE(SUM(${gameSessionTable.totalWagered}), 0)`,
      totalWon: sql<number>`COALESCE(SUM(${gameSessionTable.totalWon}), 0)`,
    })
    .from(gameSessionTable)
    .where(
      and(
        eq(gameSessionTable.userId, request.user.id),
        gte(gameSessionTable.createdAt, startOfDay)
      )
    );

  const stats = todayStats[0];
  const todayLosses = (stats?.totalWager || 0) - (stats?.totalWon || 0);

  // Daily loss limit (should be configurable per user/VIP level)
  const dailyLossLimit = systemLimits?.maxDailyLoss || 10000000; // $10,000 - should be configurable

  if (todayLosses + request.wagerAmount > dailyLossLimit) {
    return {
      valid: false,
      reason: `Daily loss limit of $${dailyLossLimit / 100} would be exceeded`,
    };
  }

  return { valid: true };
}

/**
 * Validate against session loss limits
 */
async function validateSessionLossLimit(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  // Get current active game session\
  const settings = configurationManager.getConfiguration();

  if (!request.gameSession) {
    return { valid: false, reason: "No active game session" };
  }

  const sessionLosses =
    ((request.gameSession as any).totalWagered || 0) -
    ((request.gameSession as any).totalWon || 0);

  // Session loss limit (should be configurable per game/session)
  const systemLimits = settings.systemLimits as any;
  const sessionLossLimit = systemLimits?.maxSessionLoss || 1000000; // $1,000 - should be configurable

  if (sessionLosses + request.wagerAmount > sessionLossLimit) {
    return {
      valid: false,
      reason: `Session loss limit of $${sessionLossLimit / 100
        } would be exceeded`,
    };
  }

  return { valid: true };
}

/**
 * Validate balance sufficiency and determine balance type
 */
async function validateBalance(
  request: BetValidationRequest
): Promise<BetValidationResult>
{
  // Get user's active wallet
  // const userBalance = await getDetailedBalance(request.user.id);

  // if (!request.userBalance) {
  //   // return { valid: false, reason: "User wallet not found" };
  //   await createBalanceForNewUser(request.user.id);
  // }

  // const walletBalance = user;

  // Check balance using wallet service
  const balanceCheck = await checkBalance(
    request.userBalance,
    request.wagerAmount
  );

  if (!balanceCheck.sufficient) {
    return {
      valid: false,
      reason: `Insufficient balance. Available: $${balanceCheck.availableAmount / 100
        }`,
      balanceType: balanceCheck.balanceType,
      availableBalance: balanceCheck.availableAmount,
    };
  }

  return {
    valid: true,
    balanceType: balanceCheck.balanceType,
    availableBalance: balanceCheck.availableAmount,
  };
}

/**
 * Get game-specific configuration and limits
 */
export async function getGameLimits(
  request: BetValidationRequest
): Promise<GameLimits | null>
{
  if (!request.game) {
    return null;
  }
  const settings = configurationManager.getConfiguration();

  // These limits should ideally come from a game configuration table
  // For now, using default values that should be configurable
  const systemLimits = settings.systemLimits as any;
  return {
    minBet: request.game.minBet || systemLimits?.minBetAmount || 100, // $1.00
    maxBet: request.game.maxBet || systemLimits?.maxBetAmount || 100000, // $1000.00
    maxDailyLoss: systemLimits?.maxDailyLoss || 10000000, // $10,000
    maxSessionLoss: systemLimits?.maxSessionLoss || 1000000, // $1,000
  };
}

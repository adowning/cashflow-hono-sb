// src/modules/gameplay/bot.service.ts

import { supabase } from "@/core/supabase/client";
import { and, eq } from "drizzle-orm";
import { getOrCreateBalance } from "../gameplay/core/balance-management.service";

import { db } from "@/core/database/db";
import type { BetResult, Game, UserSelect } from "@/core/database/schema";
import {
  gameSessionTable,
  gameTable,
  sessionTable,
  userTable,
} from "@/core/database/schema";
import { v4 as uuidv4 } from "uuid";
import {
  processBet,
  type BetOutcome,
} from "../gameplay/orchestrators/bet.orchestrator";
import * as botStrategy from "./bot-strategy";
import * as botWallet from "./bot-wallet";
import type { BetRequest } from "../gameplay/core/core-bet.service";
import {
  initiateDeposit,
  processDepositConfirmation,
  type DepositCompletionResult,
  type DepositRequest,
  type DepositResponse,
  type WebhookConfirmation,
} from "../gameplay/orchestrators/deposit.orchestrator";

// Custom error types
export class BotServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "BotServiceError";
  }
}
export class BotInitializationError extends BotServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, "BOT_INITIALIZATION_FAILED", cause);
    this.name = "BotInitializationError";
  }
}
export class BotAuthenticationError extends BotServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, "BOT_AUTHENTICATION_FAILED", cause);
    this.name = "BotAuthenticationError";
  }
}
export class BotOperationError extends BotServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, "BOT_OPERATION_FAILED", cause);
    this.name = "BotOperationError";
  }
}

// Interface for RTP configuration
export interface RTPConfig {
  targetRTP: number;
  lossProbability: number;
  smallWinProbability: number;
  mediumWinProbability: number;
  largeWinProbability: number;
  jackpotProbability: number;
  smallWinMultiplier: { min: number; max: number };
  mediumWinMultiplier: { min: number; max: number };
  largeWinMultiplier: { min: number; max: number };
  jackpotMultiplier: { min: number; max: number };
}

// Interface for bot configuration
export interface BotConfig {
  betInterval: number;
  minWager: number;
  maxWager: number;
  gameName: string | null;
  depositAmount?: number;
  maxDepositAttempts?: number;
  rtpConfig?: RTPConfig;
}

// Interface for bot status
export interface BotStatus {
  isRunning: boolean;
  userId: string | null;
  sessionToken: string | null;
  config: BotConfig;
  gameId: string | null;
  gameName: string | null;
  lastActivity: Date | null;
}

// Interface for bet operation result
export interface BetOperationResult {
  success: boolean;
  result?: {
    winAmount: number;
    newBalance: number;
    transactionId?: string;
  };
  error?: string;
}

// Interface for balance result
export interface BalanceResult {
  realBalance: number;
  bonusBalance: number;
  totalBalance: number;
  userId: string;
  freeSpinsRemaining?: number;
  depositWrRemaining?: number;
  bonusWrRemaining?: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
  totalWagered?: number;
  totalWon?: number;
  totalBonusGranted?: number;
  totalFreeSpinWins?: number;
}

// Interface for bot dependencies
export interface BotServiceDependencies {
  supabaseClient: typeof supabase;
  database: typeof db;
  balanceService: {
    getOrCreateBalance: (userId: string) => Promise<BalanceResult | null>;
  };
  betService: {
    processBet: (
      betRequest: BetRequest,
      gameOutcome: any
    ) => Promise<BetOutcome>;
  };
  depositService: {
    initiateDeposit: (request: DepositRequest) => Promise<DepositResponse>;
    processDepositConfirmation: (
      confirmation: WebhookConfirmation
    ) => Promise<DepositCompletionResult>;
  };
}

// Default Configurations
const DEFAULT_RTP_CONFIG: RTPConfig = {
  targetRTP: 85.0,
  lossProbability: 0.8,
  smallWinProbability: 0.12,
  mediumWinProbability: 0.05,
  largeWinProbability: 0.025,
  jackpotProbability: 0.005,
  smallWinMultiplier: { min: 1.2, max: 1.4 },
  mediumWinMultiplier: { min: 3.5, max: 5.0 },
  largeWinMultiplier: { min: 10.0, max: 15.0 },
  jackpotMultiplier: { min: 40.0, max: 60.0 },
};

const DEFAULT_CONFIG: BotConfig = {
  betInterval: 2000,
  minWager: 200,
  maxWager: 5000,
  gameName: null,
  depositAmount: 50000,
  maxDepositAttempts: 3,
  rtpConfig: DEFAULT_RTP_CONFIG,
};

export class BotService {
  private userId: string | null = null;
  private sessionToken: string | null = null;
  private sessionId: string | null = null;
  private gameSessionId: string | null = null;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config: BotConfig;
  private results: BetResult[] = [];
  private gameName: string | null = null;
  private gameId: string | null = null;
  private operatorId: string | null = null;
  private lastActivity: Date | null = null;
  private readonly dependencies: BotServiceDependencies;
  private totalMinutesPlayed = 0;
  private lastBetTime: Date | null = null;
  private sessionStartTime: Date | null = null;

  constructor(
    config: Partial<BotConfig> = {},
    dependencies?: Partial<BotServiceDependencies>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.rtpConfig = { ...DEFAULT_RTP_CONFIG, ...config.rtpConfig }; // Deep merge RTP config

    // Initialize dependencies
    this.dependencies = {
      supabaseClient: dependencies?.supabaseClient ?? supabase,
      database: dependencies?.database ?? db,
      balanceService: dependencies?.balanceService ?? {
        getOrCreateBalance: async (userId: string) => {
          const result = await getOrCreateBalance(userId);
          if (!result) return null;
          return {
            realBalance: result.realBalance,
            bonusBalance: result.bonusBalance,
            totalBalance: result.realBalance + result.bonusBalance,
            userId: result.userId,
            freeSpinsRemaining: result.freeSpinsRemaining,
            depositWrRemaining: result.depositWrRemaining,
            bonusWrRemaining: result.bonusWrRemaining,
            totalDeposited: result.totalDeposited,
            totalWithdrawn: result.totalWithdrawn,
            totalWagered: result.totalWagered,
            totalWon: result.totalWon,
            totalBonusGranted: result.totalBonusGranted,
            totalFreeSpinWins: result.totalFreeSpinWins,
          };
        },
      },
      betService: dependencies?.betService ?? { processBet },
      depositService: dependencies?.depositService ?? {
        initiateDeposit,
        processDepositConfirmation,
      },
    };
  }

  /**
   * Initialize the bot with user authentication and game session setup
   */
  async initialize(): Promise<boolean> {
    const botPassword = process.env.BOT_PASSWORD;
    const botEmail = process.env.BOT_EMAIL;

    if (!botPassword) {
      throw new BotInitializationError(
        "BOT_PASSWORD environment variable must be set"
      );
    }

    if (!botEmail) {
      throw new BotInitializationError(
        "BOT_EMAIL environment variable must be set"
      );
    }

    return this.initializeWithUser(null, botEmail, botPassword);
  }

  /**
   * Initialize the bot with a specific user (for multi-bot scenarios)
   */
  async initializeWithUser(
    userId: string | null,
    email: string,
    password: string
  ): Promise<boolean> {
    try {
      if (this.config.betInterval < 1000) {
        throw new BotInitializationError(
          "Bet interval must be at least 1000ms"
        );
      }

      const allGames =
        await this.dependencies.database.query.gameTable.findMany();
      if (!allGames || allGames.length === 0) {
        throw new BotInitializationError(
          "No games available for bot initialization"
        );
      }

      const randomIndex = Math.floor(Math.random() * allGames.length);
      const selectedGame = allGames[randomIndex];
      if (!selectedGame || !selectedGame.id || !selectedGame.name) {
        throw new BotInitializationError("Invalid game data received");
      }

      this.gameName = selectedGame.name;
      this.gameId = selectedGame.id;
      this.operatorId = selectedGame.operatorId;

      let user: UserSelect | undefined;
      if (userId) {
        user = await this.dependencies.database.query.userTable.findFirst({
          where: eq(userTable.id, userId),
        });
        if (!user || !user.id) {
          throw new BotInitializationError(
            `Failed to find bot user with ID: ${userId}`
          );
        }
        this.userId = user.id;
      } else {
        const botUsername = "AutomatedBot";
        user = await this.findOrCreateBotUser(botUsername, email, password);
        if (!user || !user.id) {
          throw new BotInitializationError("Failed to find or create bot user");
        }
        this.userId = user.id;
      }

      await this.authenticateBotUser(email, password);
      await this.initializeGameSession();

      this.lastActivity = new Date();
      this.sessionStartTime = new Date();
      return true;
    } catch (error) {
      if (error instanceof BotServiceError) throw error;
      throw new BotInitializationError("Failed to initialize bot", error);
    }
  }

  /**
   * Find or create bot user in the system
   */
  private async findOrCreateBotUser(
    username: string,
    email: string,
    password: string
  ): Promise<UserSelect> {
    let user = await this.dependencies.database.query.userTable.findFirst({
      where: eq(userTable.username, username),
    });
    if (user) return user;

    const signUpResult = await this.dependencies.supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username, name: "AutomatedBot" } },
    });
    if (signUpResult.error || !signUpResult.data.user) {
      throw new BotInitializationError(
        `Failed to create bot user: ${signUpResult.error?.message}`
      );
    }

    user = await this.dependencies.database.query.userTable.findFirst({
      where: eq(userTable.id, signUpResult.data.user.id),
    });
    if (!user) {
      throw new BotInitializationError("Failed to retrieve created bot user");
    }
    return user;
  }

  /**
   * Initialize or retrieve game session for the bot
   */
  private async initializeGameSession(): Promise<void> {
    if (!this.userId || !this.gameId || !this.gameName) {
      throw new BotInitializationError("Missing required session data");
    }

    const sessionData = {
      id: uuidv4(),
      userId: this.userId,
      authSessionId: this.sessionId,
      status: "ACTIVE" as const,
      gameName: this.gameName,
      gameId: this.gameId,
    };
    this.gameSessionId = sessionData.id;

    const existingSession =
      await this.dependencies.database.query.gameSessionTable.findFirst({
        where: and(
          eq(gameSessionTable.userId, this.userId),
          eq(gameSessionTable.status, "ACTIVE")
        ),
      });

    if (!existingSession) {
      await this.dependencies.database
        .insert(gameSessionTable)
        .values(sessionData);
    } else {
      this.gameId = existingSession.gameId;
      this.gameName = existingSession.gameName;
      this.gameSessionId = existingSession.id; // Use existing session ID
    }
  }

  /**
   * Authenticate the bot user and store session token
   */
  private async authenticateBotUser(
    email: string,
    password: string
  ): Promise<void> {
    const signInResult =
      await this.dependencies.supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
    if (signInResult.error || !signInResult.data.session) {
      throw new BotAuthenticationError(
        `Failed to sign in bot user: ${signInResult.error?.message}`
      );
    }

    this.sessionToken = signInResult.data.session.access_token;
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      throw new BotAuthenticationError(
        `Failed to get session: ${error.message}`
      );
    }

    if (session && session.access_token) {
      try {
        const sessionTokenParts = session.access_token.split(".");
        if (sessionTokenParts.length >= 2) {
          const tokenPayload = JSON.parse(
            Buffer.from(sessionTokenParts[1] as string, "base64").toString(
              "ascii"
            )
          );
          this.sessionId = tokenPayload.session_id;
        }

        if (!this.sessionId || !this.userId) {
          throw new Error(
            `Missing required session data: sessionId=${this.sessionId}, userId=${this.userId}`
          );
        }

        const sessionData = {
          id: this.sessionId as string,
          token: session.access_token,
          userId: this.userId,
          activeOrganizationId: this.operatorId || null,
          impersonatedBy: null,
        };

        // Use insert...onConflictDoUpdate to avoid race conditions/errors
        await this.dependencies.database
          .insert(sessionTable)
          .values(sessionData)
          .onConflictDoUpdate({
            target: sessionTable.id,
            set: { token: session.access_token, updatedAt: new Date() },
          });
      } catch (e) {
        throw new BotAuthenticationError(
          "Failed to create/update session record",
          e
        );
      }
    }
  }

  /**
   * Place a bet using the configured wager amount
   */
  private async placeBet(): Promise<BetOperationResult> {
    if (!this.userId || !this.sessionToken || !this.gameId) {
      return { success: false, error: "Bot not initialized or authenticated" };
    }

    try {
      // 1. Ensure we have the correct game session
      await this.ensureCorrectGameSession();

      // 2. Get game, limits, and balance
      const game = await this.getCurrentGame();
      if (!game) {
        throw new BotOperationError("Current game not found");
      }

      const gameLimits = await botStrategy.getGameLimits(
        this.gameId,
        this.config
      );

      // 3. Ensure wallet has funds (ACTOR calls WALLET)
      const balanceResult = await botWallet.ensureSufficientBalance(
        this.userId,
        gameLimits.minBet, // We need at least enough for the minimum bet
        this.config.depositAmount as number
      );

      if (!balanceResult.success) {
        throw new BotOperationError(
          "Failed to ensure sufficient balance",
          balanceResult.error
        );
      }
      const finalBalance = balanceResult.balance;

      // 4. Decide on a bet (ACTOR calls STRATEGY)
      const wagerAmount = botStrategy.getWager(
        this.config,
        game,
        finalBalance,
        gameLimits
      );

      // 5. Simulate the outcome (ACTOR calls STRATEGY)
      const gameOutcome = botStrategy.getGameOutcome(
        wagerAmount,
        this.config.rtpConfig
      );

      // 6. Prepare the bet request
      const betRequest: BetRequest = {
        userId: this.userId,
        gameId: this.gameId,
        wagerAmount,
        sessionId: this.gameSessionId,
        operatorId: "bot",
      };

      // 7. Execute the bet (ACTOR calls ORCHESTRATOR)
      const result = await this.dependencies.betService.processBet(
        betRequest,
        gameOutcome
      );

      // --- Post-Bet Logic ---
      this.lastActivity = new Date();

      // 8. Accumulate metrics
      const currentTime = new Date();
      if (this.lastBetTime) {
        const timeSinceLastBet =
          (currentTime.getTime() - this.lastBetTime.getTime()) / 1000 / 60; // minutes
        this.totalMinutesPlayed += Math.max(0, timeSinceLastBet);
      } else if (this.sessionStartTime) {
        const timeSinceSessionStart =
          (currentTime.getTime() - this.sessionStartTime.getTime()) / 1000 / 60;
        this.totalMinutesPlayed += Math.max(0, timeSinceSessionStart);
      }
      this.lastBetTime = currentTime;

      const totalWagered =
        this.results.reduce((sum, bet) => sum + bet.wagerAmount, 0) +
        result.wagerAmount;
      const totalWon =
        this.results.reduce((sum, bet) => sum + bet.winAmount, 0) +
        result.winAmount;
      const cumulativeRtpPercentage =
        totalWagered > 0 ? Math.floor((totalWon / totalWagered) * 100) : 0;

      this.results.push({
        wagerAmount: result.wagerAmount,
        realBalanceBefore: result.success ? finalBalance.realBalance : 0, // Approximate, good enough for bot log
        realBalanceAfter: result.newBalance, // This is total balance
        bonusBalanceBefore: result.success ? finalBalance.bonusBalance : 0,
        bonusBalanceAfter: 0, // Can't know this without more data
        winAmount: result.winAmount,
        vipPointsAdded: result.vipPointsEarned,
        ggrContribution: result.ggrContribution,
        jackpotContribution: result.jackpotContribution,
        processingTime: result.time,
        currentGameSessionRtp: cumulativeRtpPercentage,
      });

      // 9. Decide to change game (ACTOR calls STRATEGY)
      if (result.success && botStrategy.shouldChangeGame()) {
        await this.changeGame(cumulativeRtpPercentage);
      }

      return {
        success: result.success,
        result: result.success
          ? {
              winAmount: gameOutcome.winAmount,
              newBalance: result.newBalance,
              transactionId: result.transactionId,
            }
          : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      if (this.isAuthenticationError(error)) {
        await this.reinitialize();
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Bet placement failed",
      };
    }
  }

  /**
   * Check if error is related to authentication
   */
  private isAuthenticationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes("session expired") ||
      message.includes("not authenticated") ||
      message.includes("unauthorized")
    );
  }

  /**
   * Reinitialize the bot after authentication issues
   */
  private async reinitialize(): Promise<void> {
    try {
      this.stop();
      await this.initialize();
    } catch (error) {
      throw new BotOperationError(
        "Failed to reinitialize bot after session expiry",
        error
      );
    }
  }

  /**
   * Change to a new random game
   */
  private async changeGame(cumulativeRtpPercentage: number): Promise<void> {
    if (!this.userId || !this.gameId) {
      throw new BotOperationError(
        "Cannot change game: bot not properly initialized"
      );
    }

    try {
      // Mark current game session as completed
      if (this.gameSessionId) {
        await this.dependencies.database
          .update(gameSessionTable)
          .set({
            status: "COMPLETED",
            isActive: false,
            betResults: this.results,
            gameSessionRtp: cumulativeRtpPercentage,
          })
          .where(
            and(
              eq(gameSessionTable.id, this.gameSessionId),
              eq(gameSessionTable.userId, this.userId)
            )
          );
        this.results = [];
      }

      const allGames =
        await this.dependencies.database.query.gameTable.findMany();
      if (!allGames || allGames.length === 0) {
        throw new BotOperationError("No games available for game change");
      }

      const availableGames = allGames.filter((game) => game.id !== this.gameId);
      if (availableGames.length === 0) return; // No other games

      const randomIndex = Math.floor(Math.random() * availableGames.length);
      const selectedGame = availableGames[randomIndex];
      if (!selectedGame || !selectedGame.id || !selectedGame.name) {
        throw new BotOperationError(
          "Invalid game data received for game change"
        );
      }

      this.gameName = selectedGame.name;
      this.gameId = selectedGame.id;

      // Reset play time trackers for new game
      this.sessionStartTime = new Date();
      this.lastBetTime = null;
      this.totalMinutesPlayed = 0;

      // Create new game session
      await this.initializeGameSession();
    } catch (error) {
      throw new BotOperationError("Failed to change game", error);
    }
  }

  /**
   * Ensure the bot has the correct active game session for its current game
   */
  private async ensureCorrectGameSession(): Promise<void> {
    if (!this.userId || !this.gameId) {
      throw new BotOperationError("Bot not properly initialized");
    }

    try {
      const currentSession =
        await this.dependencies.database.query.gameSessionTable.findFirst({
          where: and(
            eq(gameSessionTable.id, this.gameSessionId || ""),
            eq(gameSessionTable.userId, this.userId),
            eq(gameSessionTable.gameId, this.gameId),
            eq(gameSessionTable.status, "ACTIVE")
          ),
        });

      if (!currentSession) {
        const correctSession =
          await this.dependencies.database.query.gameSessionTable.findFirst({
            where: and(
              eq(gameSessionTable.userId, this.userId),
              eq(gameSessionTable.gameId, this.gameId),
              eq(gameSessionTable.status, "ACTIVE")
            ),
          });

        if (correctSession) {
          this.gameSessionId = correctSession.id;
        } else {
          await this.initializeGameSession();
        }
      }
    } catch (error) {
      // Continue with bet
    }
  }

  /**
   * Get current game data
   */
  private async getCurrentGame(): Promise<Game | null> {
    if (!this.gameId) {
      throw new BotOperationError("No game selected");
    }
    try {
      const game = await this.dependencies.database.query.gameTable.findFirst({
        where: eq(gameTable.id, this.gameId),
      });
      if (!game) {
        throw new BotOperationError(`Game not found: ${this.gameId}`);
      }
      return game;
    } catch (error) {
      return null;
    }
  }

  /**
   * Start the automated betting bot
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    if (!this.userId) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new BotOperationError("Failed to initialize bot, cannot start");
      }
    }

    this.isRunning = true;

    // Place initial bet
    await this.placeBet();

    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.placeBet();
        } catch (error) {
          console.error("Scheduled bet failed:", error);
        }
      }
    }, this.config.betInterval);
  }

  /**
   * Stop the automated betting bot
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.sessionToken = null;
  }

  /**
   * Update bot configuration
   */
  updateConfig(newConfig: Partial<BotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.config.rtpConfig = { ...DEFAULT_RTP_CONFIG, ...newConfig.rtpConfig };

    if (
      this.isRunning &&
      newConfig.betInterval &&
      newConfig.betInterval !== this.config.betInterval
    ) {
      this.stop();
      this.start().catch((error) => {
        console.error("Failed to restart bot with new configuration:", error);
      });
    }
  }

  /**
   * Get current bot status
   */
  getStatus(): BotStatus {
    return {
      isRunning: this.isRunning,
      userId: this.userId,
      sessionToken: this.sessionToken ? "active" : null,
      config: this.config,
      gameId: this.gameId,
      gameName: this.gameName,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Get detailed bot metrics
   */
  getMetrics(): {
    totalMinutesPlayed: number;
    totalBets: number;
    successRate: number;
    totalWagered: number;
    totalWon: number;
  } {
    const totalBets = this.results.length;
    const successRate =
      totalBets > 0
        ? (this.results.filter((r) => r.winAmount > 0).length / totalBets) * 100
        : 0;
    const totalWagered = this.results.reduce(
      (sum, r) => sum + r.wagerAmount,
      0
    );
    const totalWon = this.results.reduce((sum, r) => sum + r.winAmount, 0);

    return {
      totalMinutesPlayed: this.totalMinutesPlayed,
      totalBets,
      successRate,
      totalWagered,
      totalWon,
    };
  }
}

// Legacy singleton instance for backward compatibility
export const botService = new BotService();

/**
 * Legacy function for single bot gameplay
 */
export async function startManufacturedGameplay(
  config: Partial<BotConfig> = {}
): Promise<void> {
  try {
    const bot = new BotService(config);
    await bot.start();
    Object.assign(botService, bot);
  } catch (error) {
    if (error instanceof BotServiceError) throw error;
    throw new BotOperationError("Failed to start manufactured gameplay", error);
  }
}

/**
 * Stop manufactured gameplay
 */
export function stopManufacturedGameplay(): void {
  botService.stop();
}

/**
 * Get bot service instance (for dependency injection testing)
 */
export function createBotService(
  config: Partial<BotConfig> = {},
  dependencies?: Partial<BotServiceDependencies>
): BotService {
  return new BotService(config, dependencies);
}

import { supabase } from "@/libs/supabase/client";
import { and, eq } from "drizzle-orm";
import { getOrCreateBalance } from "./balance-management.service";

import { db } from "@/libs/database/db";
import type { BetResult, UserSelect } from "@/libs/database/schema";
import { gameSessionTable, gameTable, sessionTable, userTable } from "@/libs/database/schema";
import { v4 as uuidv4 } from 'uuid';
import { processBet, type BetOutcome, type BetRequest } from "./bet-orchestration.service";
import
{
  initiateDeposit,
  PaymentMethod,
  processDepositConfirmation,
  type DepositCompletionResult,
  type DepositRequest,
  type DepositResponse,
  type WebhookConfirmation
} from "./deposit.service";

// Custom error types for better error handling
export class BotServiceError extends Error
{
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  )
  {
    super(message);
    this.name = "BotServiceError";
  }
}

export class BotInitializationError extends BotServiceError
{
  constructor(message: string, cause?: unknown)
  {
    super(message, "BOT_INITIALIZATION_FAILED", cause);
    this.name = "BotInitializationError";
  }
}

export class BotAuthenticationError extends BotServiceError
{
  constructor(message: string, cause?: unknown)
  {
    super(message, "BOT_AUTHENTICATION_FAILED", cause);
    this.name = "BotAuthenticationError";
  }
}

export class BotOperationError extends BotServiceError
{
  constructor(message: string, cause?: unknown)
  {
    super(message, "BOT_OPERATION_FAILED", cause);
    this.name = "BotOperationError";
  }
}

// Interface for bot configuration
export interface BotConfig
{
  betInterval: number; // in milliseconds
  minWager: number; // in cents
  maxWager: number; // in cents
  gameName: string | null;
  depositAmount?: number; // in cents
  maxDepositAttempts?: number;
}

// Interface for bot status
export interface BotStatus
{
  isRunning: boolean;
  userId: string | null;
  sessionToken: string | null;
  config: BotConfig;
  gameId: string | null;
  gameName: string | null;
  lastActivity: Date | null;
}

// Interface for deposit operation result
export interface DepositOperationResult
{
  success: boolean;
  balance?: {
    realBalance: number;
    bonusBalance: number;
    totalBalance: number;
  };
  error?: string;
}

// Interface for bet operation result
export interface BetOperationResult
{
  success: boolean;
  result?: {
    winAmount: number;
    newBalance: number;
    transactionId?: string;
  };
  error?: string;
}

// Interface for balance result
interface BalanceResult
{
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

// Interface for bot dependencies (dependency injection)
export interface BotServiceDependencies
{
  supabaseClient: typeof supabase;
  database: typeof db;
  balanceService: {
    getOrCreateBalance: (userId: string) => Promise<BalanceResult | null>;
  };
  betService: {
    processBet: (betRequest: BetRequest, gameOutcome: any) => Promise<BetOutcome>;
  };
  depositService: {
    initiateDeposit: (request: DepositRequest) => Promise<DepositResponse>;
    processDepositConfirmation: (confirmation: WebhookConfirmation) => Promise<DepositCompletionResult>;
  };
}

const DEFAULT_CONFIG: BotConfig = {
  betInterval: 2000, // 2 seconds
  minWager: 200, // $2.00
  maxWager: 5000, // $50.00
  gameName: null,
  depositAmount: 50000, // $500.00
  maxDepositAttempts: 3,
};

export class BotService
{
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
  private depositAttempts = 0;
  private lastDepositAttemptTime: Date | null = null;
  private readonly dependencies: BotServiceDependencies;

  constructor(
    config: Partial<BotConfig> = {},
    dependencies?: Partial<BotServiceDependencies>
  )
  {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize dependencies with fallbacks
    this.dependencies = {
      supabaseClient: dependencies?.supabaseClient ?? supabase,
      database: dependencies?.database ?? db,
      balanceService: dependencies?.balanceService ?? {
        getOrCreateBalance: async (userId: string) =>
        {
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
        }
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
  async initialize(): Promise<boolean>
  {
    const botPassword = process.env.BOT_PASSWORD || "secure-bot-password";
    const botEmail = "bot@example.com";

    return this.initializeWithUser(null, botEmail, botPassword);
  }

  /**
   * Initialize the bot with a specific user (for multi-bot scenarios)
   */
  async initializeWithUser(userId: string | null, email: string, password: string): Promise<boolean>
  {
    try {
      // Validate configuration
      if (this.config.betInterval < 1000) {
        throw new BotInitializationError(
          "Bet interval must be at least 1000ms"
        );
      }

      // Get available games
      const allGames = await this.dependencies.database.query.gameTable.findMany();

      if (!allGames || allGames.length === 0) {
        throw new BotInitializationError("No games available for bot initialization");
      }

      // Select random game
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
        // Use existing user
        user = await this.dependencies.database.query.userTable.findFirst({
          where: eq(userTable.id, userId),
        });

        if (!user || !user.id) {
          throw new BotInitializationError(`Failed to find bot user with ID: ${userId}`);
        }

        this.userId = user.id;
      } else {
        // Create new user (legacy mode)
        const botUsername = "AutomatedBot";
        user = await this.findOrCreateBotUser(botUsername, email, password);

        if (!user || !user.id) {
          throw new BotInitializationError("Failed to find or create bot user");
        }

        this.userId = user.id;
      }

      // Authenticate user
      await this.authenticateBotUser(email, password);

      // Set up game session
      await this.initializeGameSession();

      this.lastActivity = new Date();
      return true;
    } catch (error) {
      if (error instanceof BotServiceError) {
        throw error;
      }
      throw new BotInitializationError(
        "Failed to initialize bot",
        error
      );
    }
  }

  /**
   * Find or create bot user in the system
   */
  private async findOrCreateBotUser(
    username: string,
    email: string,
    password: string
  ): Promise<UserSelect>
  {
    // Try to find existing user
    let user = await this.dependencies.database.query.userTable.findFirst({
      where: eq(userTable.username, username),
    });

    if (user) {
      return user;
    }

    // Create new user through Supabase auth
    const signUpResult = await this.dependencies.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name: "AutomatedBot",
        },
      },
    });

    if (signUpResult.error || !signUpResult.data.user) {
      throw new BotInitializationError(
        `Failed to create bot user: ${signUpResult.error?.message}`
      );
    }

    // Fetch complete user record from database
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
  private async initializeGameSession(): Promise<void>
  {
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
    // Check for existing session
    const existingSession = await this.dependencies.database.query.gameSessionTable.findFirst({
      where: and(
        eq(gameSessionTable.userId, this.userId),
        eq(gameSessionTable.status, "ACTIVE"),
      ),
    });

    if (!existingSession) {
      // Create new session
      await this.dependencies.database.insert(gameSessionTable).values(sessionData);
    } else {
      // Update existing session data
      this.gameId = existingSession.gameId;
      this.gameName = existingSession.gameName;
    }
  }

  /**
   * Authenticate the bot user and store session token
   */
  private async authenticateBotUser(email: string, password: string): Promise<void>
  {
    const signInResult = await this.dependencies.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInResult.error || !signInResult.data.session) {
      throw new BotAuthenticationError(
        `Failed to sign in bot user: ${signInResult.error?.message}`
      );
    }

    this.sessionToken = signInResult.data.session.access_token;
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error.message);
      throw new BotAuthenticationError(
        `Failed to sign in bot user: ${error.message}`
      );
    }

    if (session && session.access_token) {
      try {
        const sessionTokenParts = session.access_token.split('.');
        if (sessionTokenParts.length >= 2) {
          const tokenPayload = JSON.parse(Buffer.from(sessionTokenParts[1] as string, 'base64').toString('ascii'));
          this.sessionId = tokenPayload.session_id;
        }

        // Ensure we have a valid sessionId and userId
        if (!this.sessionId || !this.userId) {
          throw new Error(`Missing required session data: sessionId=${this.sessionId}, userId=${this.userId}`);
        }

        // Prepare session data with proper type handling
        const sessionData = {
          id: this.sessionId as string,
          token: session.access_token,
          userId: this.userId,
          // ipAddress: sessionTokenParts.length >= 3 ? sessionTokenParts[2] : null,
          // userAgent: sessionTokenParts.length >= 4 ? sessionTokenParts[3] : null,
          activeOrganizationId: this.operatorId || null,
          impersonatedBy: null,
        };

        await this.dependencies.database.insert(sessionTable).values(sessionData);
      } catch (e) {
        console.error('Error parsing access token:', e);
        throw new BotAuthenticationError('Failed to create session record', e);
      }
    }

  }

  /**
   * Make a deposit to ensure sufficient balance for betting
   */
  private async makeDeposit(amount: number): Promise<DepositOperationResult>
  {
    console.log(`💰 Starting deposit attempt ${this.depositAttempts + 1} for amount: $${(amount / 100).toFixed(2)}`);

    if (!this.userId || !this.sessionToken || !this.gameName) {
      console.log("❌ Deposit failed: Bot not initialized or authenticated");
      return {
        success: false,
        error: "Bot not initialized or authenticated",
      };
    }

    // Reset deposit attempts if last attempt was more than 5 minutes ago
    if (this.lastDepositAttemptTime &&
      Date.now() - this.lastDepositAttemptTime.getTime() > 5 * 60 * 1000) {
      console.log("🔄 Resetting deposit attempt counter (timeout reached)");
      this.depositAttempts = 0;
      this.lastDepositAttemptTime = null;
    }

    if (this.depositAttempts >= (this.config.maxDepositAttempts ?? 3)) {
      console.log("❌ Deposit failed: Maximum deposit attempts reached");
      return {
        success: false,
        error: "Maximum deposit attempts reached",
      };
    }

    try {
      this.depositAttempts++;
      this.lastDepositAttemptTime = new Date();

      // Get current balance
      console.log("📊 Fetching current balance before deposit...");
      const currentBalance = await this.dependencies.balanceService.getOrCreateBalance(this.userId);
      console.log(`💳 Current balance: Real $${((currentBalance?.realBalance || 0) / 100).toFixed(2)}, Bonus $${((currentBalance?.bonusBalance || 0) / 100).toFixed(2)}, Total $${(((currentBalance?.realBalance || 0) + (currentBalance?.bonusBalance || 0)) / 100).toFixed(2)}`);

      // Initiate deposit
      console.log("🚀 Initiating deposit...");
      const depositRequest: DepositRequest = {
        userId: this.userId,
        amount,
        bonusAmount: 0,
        paymentMethod: PaymentMethod.CASHAPP,
      };

      const depositResult = await this.dependencies.depositService.initiateDeposit(depositRequest);

      if (!depositResult.success || !depositResult.depositId) {
        console.log(`❌ Deposit initiation failed: ${depositResult.error}`);
        return {
          success: false,
          error: depositResult.error || "Deposit initiation failed",
        };
      }

      console.log(`✅ Deposit initiated successfully with ID: ${depositResult.depositId}`);

      // Process deposit confirmation
      console.log("🔄 Processing deposit confirmation...");
      const confirmation: WebhookConfirmation = {
        transactionId: depositResult.depositId,
        amount,
        senderInfo: "bot",
        timestamp: new Date(),
        userId: this.userId,
      };

      const confirmationResult = await this.dependencies.depositService.processDepositConfirmation(confirmation);

      if (!confirmationResult.success) {
        console.log("❌ Deposit confirmation failed");
        return {
          success: false,
          error: "Deposit confirmation failed",
        };
      }

      console.log("✅ Deposit confirmed successfully");

      // Get updated balance
      console.log("📊 Fetching updated balance after deposit...");
      const updatedBalance = await this.dependencies.balanceService.getOrCreateBalance(this.userId);

      // Verify sufficient balance
      if (!updatedBalance) {
        console.log("❌ Could not retrieve updated balance after deposit");
        return {
          success: false,
          error: "Could not retrieve updated balance",
        };
      }

      const totalBalance = updatedBalance.realBalance + updatedBalance.bonusBalance;
      console.log(`💰 Post-deposit balance: Real $${(updatedBalance.realBalance / 100).toFixed(2)}, Bonus $${(updatedBalance.bonusBalance / 100).toFixed(2)}, Total $${(totalBalance / 100).toFixed(2)}`);

      // FIXED: Use game-specific minimums instead of hardcoded values
      const gameLimits = await this.getGameLimits();
      const minBetRequired = Math.max(gameLimits.minBet, this.config.minWager);
      console.log(`🎯 Minimum bet required - Game: $${(gameLimits.minBet / 100).toFixed(2)}, Bot config: $${(this.config.minWager / 100).toFixed(2)}, Final: $${(minBetRequired / 100).toFixed(2)}`);

      if (totalBalance < minBetRequired) {
        console.log(`❌ Insufficient balance after deposit. Need at least $${(minBetRequired / 100).toFixed(2)} but have $${(totalBalance / 100).toFixed(2)}`);
        return {
          success: false,
          error: `Insufficient balance after deposit. Need at least $${(minBetRequired / 100).toFixed(2)} but have $${(totalBalance / 100).toFixed(2)}`,
        };
      }

      console.log(`✅ Deposit successful! Balance sufficient for betting with $${(totalBalance / 100).toFixed(2)} total`);

      // Reset deposit counter on successful deposit
      this.depositAttempts = 0;
      this.lastDepositAttemptTime = null;
      console.log("🔄 Deposit counter reset after successful deposit");

      this.lastActivity = new Date();
      return {
        success: true,
        balance: {
          realBalance: updatedBalance.realBalance,
          bonusBalance: updatedBalance.bonusBalance,
          totalBalance,
        },
      };
    } catch (error) {
      console.log(`❌ Deposit operation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deposit operation failed",
      };
    }
  }

  /**
   * Place a bet using the configured wager amount
   */
  private async placeBet(): Promise<BetOperationResult>
  {
    if (!this.userId || !this.sessionToken || !this.gameId) {
      return {
        success: false,
        error: "Bot not initialized or authenticated",
      };
    }

    try {
      // Ensure we have the correct game session for our current game
      // This fixes the "Bet validation failed" issue after game changes
      await this.ensureCorrectGameSession();

      // Get current balance
      const playerBalance = await this.dependencies.balanceService.getOrCreateBalance(this.userId);

      if (!playerBalance) {
        throw new BotOperationError("No balance found for user");
      }

      // Check if deposit is needed
      const totalBalance = playerBalance.realBalance + playerBalance.bonusBalance;
      let depositResult: DepositOperationResult | null = null;

      console.log(`🔍 Deposit check - Total balance: $${(totalBalance / 100).toFixed(2)}, Max wager: $${(this.config.maxWager / 100).toFixed(2)}, Bot config maxWager: $${(this.config.maxWager / 100).toFixed(2)}, Config depositAmount: $${((this.config.depositAmount ?? 50000) / 100).toFixed(2)}`);

      if (totalBalance < this.config.maxWager) {
        // FIXED: Calculate exact amount needed instead of always depositing full configured amount
        const amountNeeded = this.config.maxWager - totalBalance;
        const depositAmount = Math.max(amountNeeded, this.config.depositAmount ?? 50000);
        console.log(`💰 Deposit condition met! Current balance: $${(totalBalance / 100).toFixed(2)}, Max wager: $${(this.config.maxWager / 100).toFixed(2)}, Amount needed: $${(amountNeeded / 100).toFixed(2)}, Depositing: $${(depositAmount / 100).toFixed(2)}`);
        depositResult = await this.makeDeposit(depositAmount);

        if (!depositResult.success) {
          return {
            success: false,
            error: `Insufficient balance and deposit failed: ${depositResult.error}`,
          };
        }
      } else {
        console.log(`✅ Balance sufficient - No deposit needed. Total: $${(totalBalance / 100).toFixed(2)} >= Max wager: $${(this.config.maxWager / 100).toFixed(2)}`);
      }
      // Get game information to determine valid betting denominations
      const gameLimits = await this.getGameLimits();
      const game = await this.getCurrentGame();
      // console.log("🔍 Starting bet validation...");

      // Calculate wager amount, respecting both bot config and game limits
      const finalBalance = depositResult?.success ? depositResult.balance! : {
        realBalance: playerBalance.realBalance,
        bonusBalance: playerBalance.bonusBalance,
        totalBalance,
      };

      // For games with specific betting denominations (like 0.01, 0.02, 0.05, 0.10, 0.20)
      // Extract valid bet amounts from game's goldsvetData if available
      let validBets: number[] = [];
      if (game?.goldsvetData?.bet) {
        // Parse betting denominations from the bet string
        const betStrings = game.goldsvetData.bet.split(',').map((betStr: string) => parseFloat(betStr.trim()));

        // FIXED: Since game values are now in cents format, use them as-is
        // No conversion needed - game denominations are already in cents
        validBets = betStrings.map((betStr: number) =>
          Math.round(betStr * 100) * 100// 0.01 * 100 = 1 cent
        ).filter((bet: number) => bet > 0);
        if (validBets.length < 2) {
          validBets = gameLimits.minBet ? [gameLimits.minBet] : [];
          gameLimits.maxBet ? validBets.push(gameLimits.maxBet) : null
          const possibleBets = gameLimits.maxBet - gameLimits.minBet / 100
          console.log('possibleBetts', possibleBets)
          for (var x = gameLimits.minBet; x < gameLimits.maxBet; x++) {
            validBets.push(x)
            x = x + 100 - 1
          }
        }
      }

      let wagerAmount: number;

      if (validBets.length > 0) {
        // Use available betting denominations, but filter by game limits
        const validDenominationBets = validBets.filter(bet =>
        {
          const passesMin = bet >= gameLimits.minBet;
          const passesMax = bet <= gameLimits.maxBet;
          const passesBalance = bet <= finalBalance.totalBalance;
          return passesMin && passesMax && passesBalance;
        });

        if (validDenominationBets.length === 0) {
          // No valid denomination bets, fall back to calculation
          console.log("⚠️ Fallback wager calculation needed");
          console.log(`🎯 Game limits - Min: $${(gameLimits.minBet / 100).toFixed(2)}, Max: $${(gameLimits.maxBet / 100).toFixed(2)}`);
          console.log(`🎯 Bot config - Min: $${(this.config.minWager / 100).toFixed(2)}, Max: $${(this.config.maxWager / 100).toFixed(2)}`);

          const gameMaxWager = Math.min(gameLimits.maxBet, finalBalance.totalBalance);
          const botMaxWager = Math.min(gameMaxWager, this.config.maxWager);

          console.log(`🎯 Calculated max wagers - Game: $${(gameMaxWager / 100).toFixed(2)}, Bot: $${(botMaxWager / 100).toFixed(2)}, Balance: $${(finalBalance.totalBalance / 100).toFixed(2)}`);

          const randomizedMaxWager = botMaxWager * (0.7 + Math.random() * 0.3);
          wagerAmount = Math.max(gameLimits.minBet, Math.floor(randomizedMaxWager));

          console.log(`🎯 Final wager amount: $${(wagerAmount / 100).toFixed(2)}`);
        } else {
          // Randomly select from valid denomination bets
          const randomIndex = Math.floor(Math.random() * validDenominationBets.length);
          wagerAmount = validDenominationBets[randomIndex]!; // Non-null assertion since length > 0
          // console.log(`🎯 Selected denomination bet: $${(wagerAmount / 100).toFixed(2)} from ${validDenominationBets.length} options`);
        }
      } else {
        // Fallback to calculated wager for games without specific denominations
        console.log("⚠️ Using fallback wager calculation (no valid denominations found)");
        console.log(`🎯 Game limits - Min: $${(gameLimits.minBet / 100).toFixed(2)}, Max: $${(gameLimits.maxBet / 100).toFixed(2)}`);
        console.log(`🎯 Bot config - Min: $${(this.config.minWager / 100).toFixed(2)}, Max: $${(this.config.maxWager / 100).toFixed(2)}`);

        const gameMaxWager = Math.min(gameLimits.maxBet, finalBalance.totalBalance);
        const botMaxWager = Math.min(gameMaxWager, this.config.maxWager);

        console.log(`🎯 Calculated max wagers - Game: $${(gameMaxWager / 100).toFixed(2)}, Bot: $${(botMaxWager / 100).toFixed(2)}, Balance: $${(finalBalance.totalBalance / 100).toFixed(2)}`);

        // Add randomness to wager amount within the adjusted range
        const randomizedMaxWager = botMaxWager * (0.7 + Math.random() * 0.3);
        const gameMinWager = Math.max(gameLimits.minBet, this.config.minWager);
        wagerAmount = Math.max(gameMinWager, Math.floor(randomizedMaxWager));

        console.log(`🎯 Final wager amount: $${(wagerAmount / 100).toFixed(2)}`);
      }

      // Prepare bet request with proper null checking
      if (!this.gameSessionId) {
        throw new BotOperationError("Game session ID is missing");
      }

      console.log(`✅ Finalizing bet - Wager: $${(wagerAmount / 100).toFixed(2)}, Max allowed: $${(this.config.maxWager / 100).toFixed(2)}`);

      // Safety check: Ensure wager doesn't exceed bot's maxWager
      if (wagerAmount > this.config.maxWager) {
        console.log(`⚠️ Wager exceeds bot maxWager! Adjusting from $${(wagerAmount / 100).toFixed(2)} to $${(this.config.maxWager / 100).toFixed(2)}`);
        wagerAmount = this.config.maxWager;
      }

      const betRequest: BetRequest = {
        userId: this.userId,
        gameId: this.gameId,
        wagerAmount,
        sessionId: this.gameSessionId,
        operatorId: "bot",
      };

      // Simulate game outcome with improved RTP targeting ~85%
      const rand = Math.random()
      let winAmount = 0

      // RTP Calculation: Weighted average should be ~0.85
      // 65% chance to lose (0.85x)
      // 20% chance to win 1.1x
      // 10% chance to win 1.5x
      // 4% chance to win 2x
      // 1% chance to win 5x

      if (rand < 0.65) {
        // Loss - win back 85% of wager (adds randomness to loss amounts)
        const lossFactor = 0.8 + Math.random() * 0.1; // Random between 0.8-0.9
        winAmount = Math.floor(wagerAmount * lossFactor);
      } else if (rand < 0.85) {
        // Small win - 1.1x payout
        const winFactor = 1.08 + Math.random() * 0.04; // Random between 1.08-1.12
        winAmount = Math.floor(wagerAmount * winFactor);
      } else if (rand < 0.95) {
        // Medium win - 1.5x payout
        const winFactor = 1.45 + Math.random() * 0.1; // Random between 1.45-1.55
        winAmount = Math.floor(wagerAmount * winFactor);
      } else if (rand < 0.99) {
        // Large win - 2x payout
        const winFactor = 1.95 + Math.random() * 0.1; // Random between 1.95-2.05
        winAmount = Math.floor(wagerAmount * winFactor);
      } else {
        // Jackpot win - 5x payout
        const winFactor = 4.8 + Math.random() * 0.4; // Random between 4.8-5.2
        winAmount = Math.floor(wagerAmount * winFactor);
      }

      const gameOutcome = {
        winAmount,
        gameData: {},
      };

      // Process the bet
      const result = await this.dependencies.betService.processBet(betRequest, gameOutcome);

      this.lastActivity = new Date();

      // Get the player's balance before the bet for logging
      const currentPlayerBalance = await this.dependencies.balanceService.getOrCreateBalance(this.userId);

      // Calculate cumulative Return to Player (RTP) percentage for current game session
      const totalWagered = this.results.reduce((sum, bet) => sum + bet.wagerAmount, 0) + result.wagerAmount;
      const totalWon = this.results.reduce((sum, bet) => sum + bet.winAmount, 0) + result.winAmount;
      const cumulativeRtpPercentage = totalWagered > 0 ? Math.floor((totalWon / totalWagered) * 100) : 0;

      this.results.push({
        wagerAmount: result.wagerAmount,
        realBalanceBefore: currentPlayerBalance ? currentPlayerBalance.realBalance : 0,
        realBalanceAfter: result.newBalance - (currentPlayerBalance ? currentPlayerBalance.bonusBalance : 0),
        bonusBalanceBefore: currentPlayerBalance ? currentPlayerBalance.bonusBalance : 0,
        bonusBalanceAfter: Math.max(0, result.newBalance - (currentPlayerBalance ? currentPlayerBalance.realBalance : 0)),
        winAmount: result.winAmount,
        vipPointsAdded: result.vipPointsEarned,
        ggrContribution: result.ggrContribution,
        jackpotContribution: result.jackpotContribution,
        processingTime: result.time,
        currentGameSessionRtp: cumulativeRtpPercentage,
      });

      // Check if bet was successful and potentially change games (1 in 10 chance)
      if (result.success) {
        const shouldChangeGame = Math.random() < 0.1; // 10% chance

        if (shouldChangeGame) {
          await this.changeGame(cumulativeRtpPercentage);
        }
      }

      // Database operation tracking summary
      const dbTracking = [];
      if (result.success) {
        const netResult = gameOutcome.winAmount - wagerAmount;
        dbTracking.push(`bet_${wagerAmount / 100}c`);
        if (netResult !== 0) {
          dbTracking.push(`net_${netResult > 0 ? '+' : ''}$${(netResult / 100).toFixed(2)}`);
        }
        if (result.vipPointsEarned > 0) {
          dbTracking.push(`vip_+${result.vipPointsEarned}`);
        }
        if (result.ggrContribution > 0) {
          dbTracking.push(`ggr_$${(result.ggrContribution / 100).toFixed(2)}`);
        }
        if (result.jackpotContribution > 0) {
          dbTracking.push(`jackpot_$${(result.jackpotContribution / 100).toFixed(2)}`);
        }
        console.log(`[DB] ${dbTracking.join(', ')}`);
      }

      return {
        success: result.success,
        result: result.success ? {
          winAmount: gameOutcome.winAmount,
          newBalance: result.newBalance,
          transactionId: result.transactionId,
        } : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      // Handle authentication errors by reinitializing
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
  private isAuthenticationError(error: unknown): boolean
  {
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
  private async reinitialize(): Promise<void>
  {
    try {
      this.stop();
      await this.initialize();
    } catch (error) {
      throw new BotOperationError("Failed to reinitialize bot after session expiry", error);
    }
  }

  /**
   * Change to a new random game (1 in 10 chance after each bet)
   */
  private async changeGame(cumulativeRtpPercentage: number): Promise<void>
  {
    if (!this.userId || !this.gameId) {
      throw new BotOperationError("Cannot change game: bot not properly initialized");
    }

    try {
      // Mark current game session as completed
      if (this.gameSessionId) {
        await this.dependencies.database
          .update(gameSessionTable)
          .set({ status: "COMPLETED", isActive: false, betResults: this.results, gameSessionRtp: cumulativeRtpPercentage })
          .where(and(
            eq(gameSessionTable.id, this.gameSessionId),
            eq(gameSessionTable.userId, this.userId)
          ));
        this.results = [];
      }

      // Get all available games
      const allGames = await this.dependencies.database.query.gameTable.findMany();

      if (!allGames || allGames.length === 0) {
        throw new BotOperationError("No games available for game change");
      }

      // Filter out current game and select a random new one
      const availableGames = allGames.filter(game => game.id !== this.gameId);

      if (availableGames.length === 0) {
        // If no other games available, use current game
        return;
      }

      // Select random game from available games
      const randomIndex = Math.floor(Math.random() * availableGames.length);
      const selectedGame = availableGames[randomIndex];

      if (!selectedGame || !selectedGame.id || !selectedGame.name) {
        throw new BotOperationError("Invalid game data received for game change");
      }

      // Update bot's current game
      this.gameName = selectedGame.name;
      this.gameId = selectedGame.id;

      // Create new game session with proper tracking
      const sessionData = {
        id: uuidv4(),
        userId: this.userId,
        authSessionId: this.sessionId,
        status: "ACTIVE" as const,
        gameName: this.gameName,
        gameId: this.gameId,
      };

      const insertResult = await this.dependencies.database.insert(gameSessionTable).values(sessionData).returning();

      if (insertResult && insertResult.length > 0) {
        this.gameSessionId = insertResult[0]!.id;
      } else {
        // Fallback if insert didn't return the ID
        this.gameSessionId = sessionData.id;
      }

      console.log(`Game changed to: ${this.gameName} (ID: ${this.gameId}) - Session ID: ${this.gameSessionId}`);
    } catch (error) {
      throw new BotOperationError("Failed to change game", error);
    }
  }

  /**
   * Ensure the bot has the correct active game session for its current game
   * This fixes the session validation issue that occurs after game changes
   */
  private async ensureCorrectGameSession(): Promise<void>
  {
    if (!this.userId || !this.gameId) {
      throw new BotOperationError("Bot not properly initialized");
    }

    try {
      // Check if our current session exists and matches our game
      const currentSession = await this.dependencies.database.query.gameSessionTable.findFirst({
        where: and(
          eq(gameSessionTable.id, this.gameSessionId || ''),
          eq(gameSessionTable.userId, this.userId),
          eq(gameSessionTable.gameId, this.gameId),
          eq(gameSessionTable.status, "ACTIVE"),
        ),
      });

      // If session doesn't exist or doesn't match, find or create the correct one
      if (!currentSession) {
        const correctSession = await this.dependencies.database.query.gameSessionTable.findFirst({
          where: and(
            eq(gameSessionTable.userId, this.userId),
            eq(gameSessionTable.gameId, this.gameId),
            eq(gameSessionTable.status, "ACTIVE"),
          ),
        });

        if (correctSession) {
          this.gameSessionId = correctSession.id;
        } else {
          // Create new session if none exists
          await this.initializeGameSession();
        }
      }
    } catch (error) {
      console.error("💥 Error ensuring correct game session:", error);
      // Continue with bet - don't fail the entire operation
    }
  }

  /**
   * Get current game data
   */
  private async getCurrentGame(): Promise<any | null>
  {
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
      console.error("Error getting current game:", error);
      return null;
    }
  }

  /**
   * Get game limits for the current game
   */
  private async getGameLimits(): Promise<{ minBet: number; maxBet: number }>
  {
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

      // Use game limits with fallback to bot config
      // Convert from dollars to cents (game limits are stored in dollars)
      return {
        minBet: (game.minBet || 0) || this.config.minWager,
        maxBet: (game.maxBet || 0) || this.config.maxWager,
      };
    } catch (error) {
      console.error("Error getting game limits:", error);
      // Fallback to bot config
      return {
        minBet: this.config.minWager,
        maxBet: this.config.maxWager,
      };
    }
  }

  /**
   * Start the automated betting bot
   */
  async start(): Promise<void>
  {
    if (this.isRunning) {
      return;
    }

    // Ensure bot is initialized
    if (!this.userId) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new BotOperationError("Failed to initialize bot, cannot start");
      }
    }

    this.isRunning = true;
    this.depositAttempts = 0;

    // Place initial bet
    await this.placeBet();

    // Set up interval for subsequent bets
    this.intervalId = setInterval(async () =>
    {
      if (this.isRunning) {
        try {
          await this.placeBet();
        } catch (error) {
          // Log error but continue operation
          console.error("Scheduled bet failed:", error);
        }
      }
    }, this.config.betInterval);
  }

  /**
   * Stop the automated betting bot
   */
  stop(): void
  {
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
  updateConfig(newConfig: Partial<BotConfig>): void
  {
    this.config = { ...this.config, ...newConfig };

    // Restart interval if running and timing changed
    if (this.isRunning && newConfig.betInterval && newConfig.betInterval !== this.config.betInterval) {
      this.stop();
      this.start().catch(error =>
      {
        console.error("Failed to restart bot with new configuration:", error);
      });
    }
  }

  /**
   * Get current bot status
   */
  getStatus(): BotStatus
  {
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
  getMetrics():
    {
      uptime: number;
      totalBets: number;
      successRate: number;
      totalWagered: number;
      totalWon: number;
    }
  {
    return {
      uptime: this.lastActivity ? Date.now() - this.lastActivity.getTime() : 0,
      totalBets: 0, // TODO: Implement tracking
      successRate: 0, // TODO: Implement tracking
      totalWagered: 0, // TODO: Implement tracking
      totalWon: 0, // TODO: Implement tracking
    };
  }
}

// Legacy singleton instance for backward compatibility
export const botService = new BotService();

export
{
  type BotInstance,
  type BotManagerConfig,
  BotManagerError,
  BotManagerInitializationError,
  BotManagerOperationError,
  type BotManagerStatus
} from "./bot-manager";

// Export the BotManager class (not as type)
export { BotManager } from "./bot-manager";

/**
 * Legacy function for single bot gameplay (for backward compatibility)
 * @deprecated Use startManufacturedGameplayMulti instead
 */
export async function startManufacturedGameplay(
  config: Partial<BotConfig> = {}
): Promise<void>
{
  try {
    const bot = new BotService(config);
    await bot.start();

    // Replace singleton instance
    Object.assign(botService, bot);
  } catch (error) {
    if (error instanceof BotServiceError) {
      throw error;
    }
    throw new BotOperationError("Failed to start manufactured gameplay", error);
  }
}

/**
 * Start manufactured gameplay with multiple bots
 */
export async function startManufacturedGameplayMulti(
  config: Partial<BotConfig> = {},
  botCount: number = 5
): Promise<import("./bot-manager").BotManager>
{
  try {
    const { BotManager } = await import("./bot-manager");

    const managerConfig = {
      botCount,
      botConfig: config,
      maxRetries: 3,
      retryDelay: 5000,
    };

    const manager = new BotManager(managerConfig);
    await manager.initialize();
    await manager.start();

    return manager;
  } catch (error) {
    if (error instanceof BotServiceError) {
      throw error;
    }
    throw new BotOperationError("Failed to start manufactured gameplay with multiple bots", error);
  }
}

/**
 * Stop manufactured gameplay
 */
export function stopManufacturedGameplay(): void
{
  botService.stop();
}

/**
 * Get bot service instance (for dependency injection testing)
 */
export function createBotService(
  config: Partial<BotConfig> = {},
  dependencies?: Partial<BotServiceDependencies>
): BotService
{
  return new BotService(config, dependencies);
}

/**
 * Get bot manager instance (for dependency injection testing)
 */
export function createBotManager(
  config: import("./bot-manager").BotManagerConfig
): import("./bot-manager").BotManager
{
  const { BotManager } = require("./bot-manager");
  return new BotManager(config);
}
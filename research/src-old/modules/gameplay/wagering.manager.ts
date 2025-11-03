// import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
// import { z } from "zod";
// import { eq } from "drizzle-orm";
// import type { Settings } from "@/database/schema/other.schema.js";
// import {
//   playerBalances,
//   type TPlayerBalance,
//   type TWithdrawals,
// } from "@/database/schema";
// import { configurationManager } from "@/config/config.js";

// // Input validation schemas
// const PositiveInt = z
//   .number()
//   .int()
//   .positive("Amount must be a positive integer (cents).");
// const NonNegativeInt = z
//   .number()
//   .int()
//   .min(0, "Amount must be a non-negative integer (cents).");

// export const DepositSchema = z.object({
//   userId: z.string().min(1),
//   amount: PositiveInt, // in cents
// });
// export type DepositInput = z.infer<typeof DepositSchema>;

// export const GrantBonusSchema = z.object({
//   userId: z.string().min(1),
//   amount: PositiveInt, // in cents
// });
// export type GrantBonusInput = z.infer<typeof GrantBonusSchema>;

// export const GrantFreeSpinsSchema = z.object({
//   userId: z.string().min(1),
//   count: PositiveInt,
// });
// export type GrantFreeSpinsInput = z.infer<typeof GrantFreeSpinsSchema>;

// export const BetSchema = z.object({
//   userId: z.string().min(1),
//   betAmount: NonNegativeInt, // 0 for a free spin
//   isFreeSpin: z.boolean().default(false),
// });
// export type BetInput = z.infer<typeof BetSchema>;

// export const WinSchema = z.object({
//   userId: z.string().min(1),
//   winAmount: NonNegativeInt, // 0 for a losing spin
//   isFreeSpinWin: z.boolean().default(false),
// });
// export type WinInput = z.infer<typeof WinSchema>;

// export const WithdrawSchema = z.object({
//   userId: z.string().min(1),
//   amount: PositiveInt, // in cents
// });
// export type WithdrawInput = z.infer<typeof WithdrawSchema>;

// // --- 3. PUBLIC TYPE DEFINITIONS (API OUTPUTS) ---

// export interface TPlayerBalances {
//   userId: string;
//   realBalance: number;
//   bonusBalance: number;
//   freeSpinsRemaining: number;
//   depositWRRemaining: number;
//   bonusWRRemaining: number;
// }

// export interface PlayerStatistics {
//   userId: string;
//   totalWagered: number;
//   totalWon: number;
//   totalLoss: number;
//   rtp: number; // Return to Player, as a percentage (e.g., 95.5)
//   totalDeposited: number;
//   totalWithdrawn: number;
//   netDeposits: number;

//   // Liability Metrics
//   currentBonusBalance: number;
//   outstandingFreeSpins: number;
//   estimatedFreeSpinLiability: number; // freeSpins * avgWinValue
//   totalBonusGranted: number;
//   totalFreeSpinWins: number;
// }

// // --- 4. WAGERING MANAGER SERVICE CLASS ---

// // Define the DB schema type for the constructor
// type AppSchema = typeof import("./wagering.manager.ts");
// type DbInstance = PostgresJsDatabase<AppSchema>;

// export class WageringManager {
//   private db: DbInstance;
//   private settings: Settings;
//   private configManager: any | null;
//   constructor(db: DbInstance) {
//     this.db = db;
//     this.settings = configurationManager.getConfiguration();
//     this.configManager = configurationManager;
//     if (!this.settings) {
//       throw new Error("Platform settings must be provided to WageringManager.");
//     }
//   }

//   /**
//    * Retrieves a player's balance, creating one if it doesn't exist.
//    */
//   private async getOrCreateBalance(userId: string): Promise<TPlayerBalance> {
//     const balances = await this.db
//       .select()
//       .from(playerBalances)
//       .where(eq(playerBalances.userId, userId))
//       .limit(1);

//     if (balances.length > 0) {
//       return balances[0];
//     }

//     // Create a new balance
//     const newBalance = { userId };
//     const insertedBalances = await this.db
//       .insert(playerBalances)
//       .values(newBalance)
//       .returning();

//     return insertedBalances[0];
//   }

//   /**
//    * Applies wagering to all active requirements and checks for bonus conversion.
//    * This is a core private method.
//    */
//   private _applyWagering(
//     balance: TPlayerBalance,
//     wagerAmount: number
//   ): TPlayerBalance {
//     // 1. Reduce all active wagering requirements
//     balance.depositWRRemaining = Math.max(
//       0,
//       balance.depositWRRemaining - wagerAmount
//     );
//     balance.bonusWRRemaining = Math.max(
//       0,
//       balance.bonusWRRemaining - wagerAmount
//     );

//     // 2. Check for Bonus Conversion
//     // If bonus WR is now 0 and there is a bonus balance, convert it to real money.
//     if (balance.bonusWRRemaining === 0 && balance.bonusBalance > 0) {
//       console.log(
//         `[WageringManager] CONVERSION: Player ${balance.userId} converted ${balance.bonusBalance} bonus to real.`
//       );
//       balance.realBalance += balance.bonusBalance;
//       balance.bonusBalance = 0;
//     }

//     return balance;
//   }

//   // --- PUBLIC API METHODS ---

//   /**
//    * Handles a player deposit.
//    * Credits real balance and adds a 1x (or platform-defined) deposit wagering requirement.
//    */
//   public async handleDeposit(input: DepositInput): Promise<TPlayerBalance> {
//     const { userId, amount } = DepositSchema.parse(input);
//     const balance = await this.getOrCreateBalance(userId);

//     const depositWROwed = amount * this.settings.depositWRMultiplier;

//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({
//         realBalance: balance.realBalance + amount,
//         totalDeposited: balance.totalDeposited + amount,
//         depositWRRemaining: balance.depositWRRemaining + depositWROwed,
//         updatedAt: new Date(),
//       })
//       .where(eq(playerBalances.userId, userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   /**
//    * Grants a cash bonus to a player.
//    * Credits bonus balance and adds a 30x (or platform-defined) bonus wagering requirement.
//    */
//   public async grantBonus(input: GrantBonusInput): Promise<TPlayerBalance> {
//     const { userId, amount } = GrantBonusSchema.parse(input);
//     const balance = await this.getOrCreateBalance(userId);

//     const bonusWROwed = amount * this.settings.bonusWRMultiplier;

//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({
//         bonusBalance: balance.bonusBalance + amount,
//         totalBonusGranted: balance.totalBonusGranted + amount,
//         bonusWRRemaining: balance.bonusWRRemaining + bonusWROwed,
//         updatedAt: new Date(),
//       })
//       .where(eq(playerBalances.userId, userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   /**
//    * Grants free spins to a player.
//    * This increases the free spins counter. Liability is tracked separately.
//    */
//   public async grantFreeSpins(
//     input: GrantFreeSpinsInput
//   ): Promise<TPlayerBalance> {
//     const { userId, count } = GrantFreeSpinsSchema.parse(input);
//     const balance = await this.getOrCreateBalance(userId);

//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({
//         freeSpinsRemaining: balance.freeSpinsRemaining + count,
//         updatedAt: new Date(),
//       })
//       .where(eq(playerBalances.userId, userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   /**
//    * Handles a single bet (spin) from a player.
//    * This deducts from balances and applies wagering.
//    */
//   public async handleBet(input: BetInput): Promise<TPlayerBalance> {
//     const { userId, betAmount, isFreeSpin } = BetSchema.parse(input);
//     let balance = await this.getOrCreateBalance(userId);

//     if (isFreeSpin) {
//       if (balance.freeSpinsRemaining <= 0) {
//         throw new Error(`Insufficient free spins for player ${userId}.`);
//       }
//       // Using a free spin. No balance change, no wagering applied.
//       balance.freeSpinsRemaining -= 1;
//     } else {
//       // This is a cash bet.
//       if (betAmount <= 0) {
//         throw new Error("Cash bet amount must be positive.");
//       }
//       if (balance.realBalance + balance.bonusBalance < betAmount) {
//         throw new Error(`Insufficient total balance for player ${userId}.`);
//       }

//       // Standard Rule: Deduct from Real balance first, then Bonus.
//       const deductedFromReal = Math.min(balance.realBalance, betAmount);
//       const deductedFromBonus = betAmount - deductedFromReal;

//       balance.realBalance -= deductedFromReal;
//       balance.bonusBalance -= deductedFromBonus;

//       // Apply wagering for the full bet amount
//       balance.totalWagered += betAmount;
//       balance = this._applyWagering(balance, betAmount);
//     }

//     // Save all changes
//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({ ...balance, updatedAt: new Date() }) // Drizzle doesn't like the extra 'userId'
//       .where(eq(playerBalances.userId, balance.userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   /**
//    * Handles a win from a bet.
//    * This credits balances and, if it's a free spin win, adds a new wagering requirement.
//    */
//   public async handleWin(input: WinInput): Promise<TPlayerBalance> {
//     const { userId, winAmount, isFreeSpinWin } = WinSchema.parse(input);
//     if (winAmount === 0) return this.getOrCreateBalance(userId); // No changes on a 0 win

//     const balance = await this.getOrCreateBalance(userId);

//     balance.totalWon += winAmount;

//     if (isFreeSpinWin) {
//       // Free spin wins go to BONUS balance
//       balance.bonusBalance += winAmount;
//       balance.totalFreeSpinWins += winAmount;

//       // Add new wagering requirement based on the win
//       const newWROwed = winAmount * this.settings.freeSpinWRMultiplier;
//       balance.bonusWRRemaining += newWROwed;
//     } else {
//       // Standard cash bet win.
//       // Standard "Sticky" Rule: If a bonus is active, wins go to bonus.
//       if (balance.bonusWRRemaining > 0 || balance.bonusBalance > 0) {
//         balance.bonusBalance += winAmount;
//       } else {
//         // No bonus active, wins go to real.
//         balance.realBalance += winAmount;
//       }
//     }

//     // Save changes
//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({
//         totalWon: balance.totalWon,
//         bonusBalance: balance.bonusBalance,
//         realBalance: balance.realBalance,
//         totalFreeSpinWins: balance.totalFreeSpinWins,
//         bonusWRRemaining: balance.bonusWRRemaining,
//         updatedAt: new Date(),
//       })
//       .where(eq(playerBalances.userId, userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   /**
//    * Handles a player withdrawal request.
//    * Enforces wagering requirements and bonus forfeiture.
//    */
//   public async handleWithdraw(input: TWithdrawals): Promise<TPlayerBalance> {
//     const { userId, amount } = WithdrawSchema.parse(input);
//     const balance = await this.getOrCreateBalance(userId);

//     // 1. Check Deposit Wagering
//     if (balance.depositWRRemaining > 0) {
//       throw new Error(
//         `Player ${userId} must complete deposit wagering. $${
//           balance.depositWRRemaining / 100
//         } remaining.`
//       );
//     }

//     // 2. Check Real Balance
//     if (balance.realBalance < amount) {
//       throw new Error(
//         `Insufficient real balance for player ${userId}. Requested ${amount}, has ${balance.realBalance}.`
//       );
//     }

//     // 3. Process Withdrawal & Forfeiture
//     balance.realBalance -= amount;
//     balance.totalWithdrawn += amount;

//     // Standard Rule: Withdrawing forfeits any active bonus.
//     if (balance.bonusBalance > 0 || balance.bonusWRRemaining > 0) {
//       console.log(
//         `[WageringManager] FORFEITURE: Player ${userId} forfeited ${balance.bonusBalance} bonus on withdrawal.`
//       );
//       balance.bonusBalance = 0;
//       balance.bonusWRRemaining = 0;
//     }

//     // Save changes
//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({
//         realBalance: balance.realBalance,
//         totalWithdrawn: balance.totalWithdrawn,
//         bonusBalance: balance.bonusBalance,
//         bonusWRRemaining: balance.bonusWRRemaining,
//         updatedAt: new Date(),
//       })
//       .where(eq(playerBalances.userId, userId))
//       .returning();

//     return updatedBalances[0];
//   }

//   // --- STATISTICS & QUERY METHODS ---

//   /**
//    * Gets the current balances and WR status for a player.
//    */
//   public async geTPlayerBalance(userId: string): Promise<TPlayerBalances> {
//     const balance = await this.getOrCreateBalance(userId);
//     return {
//       userId: balance.userId,
//       realBalance: balance.realBalance,
//       bonusBalance: balance.bonusBalance,
//       freeSpinsRemaining: balance.freeSpinsRemaining,
//       depositWRRemaining: balance.depositWRRemaining,
//       bonusWRRemaining: balance.bonusWRRemaining,
//     };
//   }

//   /**
//    * Gets a full statistical report for a player.
//    */
//   public async getPlayerStatistics(userId: string): Promise<PlayerStatistics> {
//     const balance = await this.getOrCreateBalance(userId);

//     const totalLoss = balance.totalWagered - balance.totalWon;
//     const rtp =
//       balance.totalWagered > 0
//         ? (balance.totalWon / balance.totalWagered) * 100
//         : 0;
//     const netDeposits = balance.totalDeposited - balance.totalWithdrawn;
//     const estimatedFreeSpinLiability =
//       balance.freeSpinsRemaining * this.settings.avgFreeSpinWinValue;

//     return {
//       userId: balance.userId,
//       totalWagered: balance.totalWagered,
//       totalWon: balance.totalWon,
//       totalLoss,
//       rtp,
//       totalDeposited: balance.totalDeposited,
//       totalWithdrawn: balance.totalWithdrawn,
//       netDeposits,

//       // Liability Metrics
//       currentBonusBalance: balance.bonusBalance,
//       outstandingFreeSpins: balance.freeSpinsRemaining,
//       estimatedFreeSpinLiability,
//       totalBonusGranted: balance.totalBonusGranted,
//       totalFreeSpinWins: balance.totalFreeSpinWins,
//     };
//   }

//   public async updateWageringProgress(input: {
//     userId: string;
//     wagerAmount: number;
//   }): Promise<TPlayerBalance> {
//     const { userId, wagerAmount } = input;
//     let balance = await this.getOrCreateBalance(userId);
//     balance = this._applyWagering(balance, wagerAmount);
//     const updatedBalances = await this.db
//       .update(playerBalances)
//       .set({ ...balance, updatedAt: new Date() })
//       .where(eq(playerBalances.userId, balance.userId))
//       .returning();
//     return updatedBalances[0];
//   }
// }

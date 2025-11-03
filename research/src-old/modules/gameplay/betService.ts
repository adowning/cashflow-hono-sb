// import { db } from "../db/db";
// import { betLogs, bonusTasks, games } from "../db/schema";
// import { eq, and, sql, desc } from "drizzle-orm";
// import { z } from "zod";
// import { WalletService } from "./walletService";
// import { VIPService } from "./vipService";
// import { VIPRewardService } from "./vipRewardService";
// import { JackpotService } from "./jackpotService";
// import { RNGService } from "./rngService";
// import { WebSocketService } from "./websocketService";

// const PlaceBetSchema = z.object({
//   userId: z.string().uuid(),
//   operatorId: z.string().uuid(),
//   gameId: z.string().uuid(),
//   wager: z.number().positive(),
// });

// export type PlaceBetInput = z.infer<typeof PlaceBetSchema>;

// export class BetService {
//   /**
//    * Atomic bet placement function implementing the complete betting flow
//    */
//   static async placeBet(input: PlaceBetInput): Promise<{
//     outcome: {
//       winAmount: number;
//       multiplier: number;
//       isJackpotWin: boolean;
//       outcome: string;
//     };
//     balances: {
//       realBalance: number;
//       bonusBalance: number;
//     };
//     vipUpdate?: {
//       newXP: number;
//       levelUp?: {
//         newLevel: number;
//         levelName: string;
//       };
//     };
//     wageringProgress?: any; // Updated bonus/deposit tasks
//     jackpotContribution: number;
//     betLogId: string;
//   }> {
//     const validatedInput = PlaceBetSchema.parse(input);

//     return await db.transaction(async (tx) => {
//       try {
//         // 1. Get game details and validate
//         const [game] = await tx
//           .select({
//             id: games.id,
//             rtp: sql<number>`${games.rtp}::numeric`,
//             jackpotGroup: games.jackpotGroup,
//             minBet: sql<number>`${games.minBet}::numeric`,
//             maxBet: sql<number>`${games.maxBet}::numeric`,
//           })
//           .from(games)
//           .where(eq(games.id, validatedInput.gameId))
//           .limit(1);

//         if (!game) {
//           throw new Error("Game not found");
//         }

//         if (
//           validatedInput.wager < game.minBet ||
//           validatedInput.wager > game.maxBet
//         ) {
//           throw new Error("Wager amount out of bounds");
//         }

//         // 2. Check balances and determine bet type
//         const balances = await WalletService.getWalletBalances({
//           userId: validatedInput.userId,
//           operatorId: validatedInput.operatorId,
//         });

//         if (!balances) {
//           throw new Error("Wallet not found");
//         }

//         let betType: "real" | "bonus";
//         // let balanceToUse: number;

//         if (balances.realBalance >= validatedInput.wager) {
//           betType = "real";
//           // balanceToUse = balances.realBalance;
//         } else if (balances.bonusBalance >= validatedInput.wager) {
//           betType = "bonus";
//           // balanceToUse = balances.bonusBalance;
//         } else {
//           throw new Error("Insufficient funds");
//         }

//         // 3. Generate RNG outcome
//         const outcome = await RNGService.generateOutcome({
//           gameId: validatedInput.gameId,
//           wager: validatedInput.wager,
//           rtp: game.rtp,
//         });

//         // 4. Handle jackpot contributions and wins
//         let jackpotContribution = 0;
//         if (game.jackpotGroup) {
//           const contributions = await JackpotService.calculateContributions(
//             validatedInput.wager,
//             game.jackpotGroup
//           );

//           for (const contrib of contributions) {
//             await JackpotService.contributeToJackpot({
//               group: game.jackpotGroup,
//               level: contrib.level as any,
//               contributionAmount: contrib.contributionAmount,
//             });
//             jackpotContribution += contrib.contributionAmount;
//           }

//           // Handle jackpot win
//           if (outcome.isJackpotWin) {
//             const jackpotAmount = await JackpotService.getJackpotValue({
//               group: game.jackpotGroup,
//               level: "grand", // Simplified - would determine based on game config
//             });

//             if (jackpotAmount) {
//               outcome.winAmount += jackpotAmount;
//               await JackpotService.awardJackpot({
//                 group: game.jackpotGroup,
//                 level: "grand",
//                 userId: validatedInput.userId,
//                 operatorId: validatedInput.operatorId,
//                 gameId: validatedInput.gameId,
//                 amount: jackpotAmount,
//               });
//             }
//           }
//         }

//         // 5. Update balances
//         // Debit wager
//         await WalletService.debitFromWallet({
//           userId: validatedInput.userId,
//           operatorId: validatedInput.operatorId,
//           amount: validatedInput.wager,
//           isReal: betType === "real",
//         });

//         // Credit win
//         if (outcome.winAmount > 0) {
//           await WalletService.creditToWallet({
//             userId: validatedInput.userId,
//             operatorId: validatedInput.operatorId,
//             amount: outcome.winAmount,
//             isReal: betType === "real",
//           });
//         }

//         // Get updated balances
//         let updatedBalances = await WalletService.getWalletBalances({
//           userId: validatedInput.userId,
//           operatorId: validatedInput.operatorId,
//         });

//         if (!updatedBalances) {
//           throw new Error("Failed to retrieve updated balances");
//         }

//         // 6. Update wagering progress
//         const wageringProgress = await this.updateWageringProgress(
//           tx,
//           validatedInput,
//           betType,
//           validatedInput.wager
//         );

//         // 7. Award VIP XP
//         const vipMultiplier = 1; // Could be configurable per game/operator
//         const vipUpdate = await VIPService.awardXP({
//           userId: validatedInput.userId,
//           xpAmount: validatedInput.wager,
//           multiplier: vipMultiplier,
//         });

//         // 8. Apply cashback if loss occurred
//         let cashbackAmount = 0;
//         if (outcome.winAmount < validatedInput.wager) {
//           const lossAmount = validatedInput.wager - outcome.winAmount;
//           const cashbackResult = await VIPRewardService.applyCashback({
//             userId: validatedInput.userId,
//             operatorId: validatedInput.operatorId,
//             lossAmount,
//           });
//           cashbackAmount = cashbackResult.cashbackAmount;
//         }

//         // 9. Check for level up and apply rewards
//         if (vipUpdate.levelUp) {
//           await VIPRewardService.applyLevelUpRewards({
//             userId: validatedInput.userId,
//             operatorId: validatedInput.operatorId,
//             newLevel: vipUpdate.levelUp.newLevel,
//           });
//         }

//         // 10. Update balances again if cashback was applied
//         if (cashbackAmount > 0) {
//           const finalBalances = await WalletService.getWalletBalances({
//             userId: validatedInput.userId,
//             operatorId: validatedInput.operatorId,
//           });
//           updatedBalances = finalBalances || updatedBalances;
//         }

//         // 11. Log the bet
//         const ggrContribution = validatedInput.wager - outcome.winAmount;

//         const [betLog] = await tx
//           .insert(betLogs)
//           .values({
//             userId: validatedInput.userId,
//             operatorId: validatedInput.operatorId,
//             gameId: validatedInput.gameId,
//             wager: validatedInput.wager.toString(),
//             win: outcome.winAmount.toString(),
//             betType,
//             preRealBalance: balances.realBalance.toString(),
//             postRealBalance: updatedBalances.realBalance.toString(),
//             preBonusBalance: balances.bonusBalance.toString(),
//             postBonusBalance: updatedBalances.bonusBalance.toString(),
//             jackpotContribution: jackpotContribution.toString(),
//             vipPointsAdded: (validatedInput.wager * vipMultiplier).toString(),
//             ggrContribution: ggrContribution.toString(),
//             wageringProgress,
//           })
//           .returning({ id: betLogs.id });

//         // Send real-time updates via WebSocket
//         WebSocketService.broadcastToUser(validatedInput.userId, {
//           type: "bet_outcome",
//           userId: validatedInput.userId,
//           data: {
//             outcome,
//             balances: updatedBalances,
//             vipUpdate,
//             wageringProgress,
//           },
//         });

//         return {
//           outcome,
//           balances: updatedBalances,
//           vipUpdate,
//           wageringProgress,
//           jackpotContribution,
//           betLogId: betLog!.id,
//         };
//       } catch (error) {
//         // Transaction will be rolled back automatically
//         throw error;
//       }
//     });
//   }

//   /**
//    * Update wagering progress for bonus tasks
//    */
//   private static async updateWageringProgress(
//     tx: any,
//     input: PlaceBetInput,
//     betType: "real" | "bonus",
//     wagerAmount: number
//   ): Promise<any> {
//     if (betType === "bonus") {
//       // Find active bonus tasks for this user-operator
//       const activeTasks = await tx
//         .select()
//         .from(bonusTasks)
//         .where(
//           and(
//             eq(bonusTasks.userId, input.userId),
//             eq(bonusTasks.operatorId, input.operatorId),
//             eq(bonusTasks.isCompleted, false)
//           )
//         )
//         .orderBy(desc(bonusTasks.createdAt));

//       // Update the most recent active task (FIFO)
//       if (activeTasks.length > 0) {
//         const task = activeTasks[0];
//         const newWagered = Number(task.wagered) + wagerAmount;
//         const required = Number(task.wageringRequired);

//         await tx
//           .update(bonusTasks)
//           .set({
//             wagered: newWagered.toString(),
//             isCompleted: newWagered >= required,
//             updatedAt: new Date(),
//           })
//           .where(eq(bonusTasks.id, task.id));

//         // If completed, convert remaining bonus to real balance
//         if (newWagered >= required) {
//           const remainingBonus =
//             Number(task.awardedAmount) - (newWagered - wagerAmount);
//           if (remainingBonus > 0) {
//             await WalletService.creditToWallet({
//               userId: input.userId,
//               operatorId: input.operatorId,
//               amount: remainingBonus,
//               isReal: true,
//             });
//           }
//         }

//         return {
//           taskId: task.id,
//           type: task.type,
//           wagered: newWagered,
//           required,
//           isCompleted: newWagered >= required,
//         };
//       }
//     }

//     return null;
//   }
// }

// import { relations } from "drizzle-orm/relations";
// import {
//   userTable,
//   gameTable,
//   transactionTable,
//   operatorTable,
//   gameSessionTable,
//   jackpotContributionTable,
//   jackpotTable,
//   withdrawalTable,
//   affiliatePayoutTable,
//   bonusTable,
//   userBalanceTable,
//   userBonusTable,
//   //   playerTable,
//   //   vip_cashbackTable,
//   //   vipLevelUpBonusTable,
//   //   vipSpinRewardTable,
//   //   kyc_documents,
//   //   kyc_submissions,
//   //   loyalty_fund_transactionTable,
//   //   operator_settlements,
//   //   operator_switch_history,
//   //   password_logs,
//   //   products,
//   //   referral_codes,
//   //   affiliate_logs,
// } from "./schema";

// export const transactionTableRelations = relations(
//   transactionTable,
//   ({ one, many }) => ({
//     game: one(gameTable, {
//       fields: [transactionTable.gameId],
//       references: [gameTable.id],
//     }),
//     operator: one(operatorTable, {
//       fields: [transactionTable.operatorId],
//       references: [operatorTable.id],
//     }),
//     user: one(userTable, {
//       fields: [transactionTable.userId],
//       references: [userTable.id],
//     }),
//     jackpotContributionTable: many(jackpotContributionTable),
//   })
// );

// export const gameTableRelations = relations(gameTable, ({ one, many }) => ({
//   transactionTable: many(transactionTable),
//   gameSessionTable: many(gameSessionTable),
//   jackpotContributionTable: many(jackpotContributionTable),
//   operator: one(operatorTable, {
//     fields: [gameTable.operatorId],
//     references: [operatorTable.id],
//   }),
// }));

// export const gameSessionTableRelations = relations(
//   gameSessionTable,
//   ({ one, many }) => ({
//     game: one(gameTable, {
//       fields: [gameSessionTable.gameId],
//       references: [gameTable.id],
//     }),
//     user: one(userTable, {
//       fields: [gameSessionTable.userId],
//       references: [userTable.id],
//     }),
//   })
// );

// export const jackpotTableRelations = relations(jackpotTable, ({ one }) => ({
//   user: one(userTable, {
//     fields: [jackpotTable.lastWonByUserId],
//     references: [userTable.id],
//   }),
// }));

// export const withdrawalTableRelations = relations(
//   withdrawalTable,
//   ({ one }) => ({
//     user: one(userTable, {
//       fields: [withdrawalTable.userId],
//       references: [userTable.id],
//     }),
//   })
// );

// export const affiliatePayoutTableRelations = relations(
//   affiliatePayoutTable,
//   ({ one }) => ({
//     user: one(userTable, {
//       fields: [affiliatePayoutTable.affiliateId],
//       references: [userTable.id],
//     }),
//   })
// );

// export const userBalanceTableRelations = relations(
//   userBalanceTable,
//   ({ one }) => ({
//     // bonus: one(bonusTable, {
//     //   fields: [userBalanceTable.bonusId],
//     //   references: [bonusTable.id],
//     // }),
//     user: one(userTable, {
//       fields: [userBalanceTable.userId],
//       references: [userTable.id],
//     }),
//   })
// );

// export const bonusTableRelations = relations(bonusTable, ({ many }) => ({
//   userBonusTable: many(userBonusTable),
// }));

// export const operatorTableRelations = relations(operatorTable, ({ many }) => ({
//   transactionTable: many(transactionTable),
//   gameTable: many(gameTable),

//   //   loyalty_fund_transactionTable: many(loyalty_fund_transactionTable),
//   //   operator_settlements: many(operator_settlements),
//   //   operator_switch_histories_from_operatorId: many(operator_switch_history, {
//   //     relationName: "operator_switch_history_from_operatorId_operatorTableId",
//   //   }),
//   //   operator_switch_histories_to_operatorId: many(operator_switch_history, {
//   //     relationName: "operator_switch_history_to_operatorId_operatorTableId",
//   //   }),
//   //   products: many(products),
// }));
// // export const user_roleRelations = relations(user_role, ({ one }) => ({
// //   role: one(role, {
// //     fields: [user_role.roleId],
// //     references: [role.id],
// //   }),
// //   user: one(user, {
// //     fields: [user_role.userId],
// //     references: [user.id],
// //   }),
// // }));

// // export const roleRelations = relations(role, ({ many }) => ({
// //   user_roles: many(user_role),
// // }));

// // export const userRelations = relations(user, ({ many }) => ({
// //   user_roles: many(user_role),
// // }));

// // export const userTableRelations = relations(userTable, ({ many }) => ({
// //   transactionTable: many(transactionTable),
// //   gameSessionTable: many(gameSessionTable),
// //   jackpotContributionTable: many(jackpotContributionTable),
// //   jackpotWinTable: many(jackpotWinTable),
// //   jackpotTable: many(jackpotTable),
// //   kyc_documents: many(kyc_documents),
// //   kyc_submissions: many(kyc_submissions),
// //   loyalty_fund_transactionTable: many(loyalty_fund_transactionTable),
// //   operator_switch_histories: many(operator_switch_history),
// //   withdrawalTable: many(withdrawalTable),
// //   password_logs_actorId: many(password_logs, {
// //     relationName: "password_logs_actorId_userTableId",
// //   }),
// //   password_logs_userId: many(password_logs, {
// //     relationName: "password_logs_userId_userTableId",
// //   }),
// //   referral_codes: many(referral_codes),
// //   affiliate_logs_childId: many(affiliate_logs, {
// //     relationName: "affiliate_logs_childId_userTableId",
// //   }),
// //   affiliate_logs_invitorId: many(affiliate_logs, {
// //     relationName: "affiliate_logs_invitorId_userTableId",
// //   }),
// //   affiliatePayoutTable: many(affiliatePayoutTable),
// //   playerBonusTable: many(playerBonusTable),
// //   vip_cashbacks: many(vip_cashbacks),
// //   vip_level_up_bonusTable: many(vip_level_up_bonusTable),
// //   vip_spin_rewards: many(vip_spin_rewards),
// // }));

// // export const jackpotContributionTableRelations = relations(
// //   jackpotContributionTable,
// //   ({ one }) => ({
// //     transaction: one(transactionTable, {
// //       fields: [jackpotContributionTable.bet_transactionId],
// //       references: [transactionTable.id],
// //     }),
// //     game: one(gameTable, {
// //       fields: [jackpotContributionTable.gameId],
// //       references: [gameTable.id],
// //     }),
// //     player: one(userTable, {
// //       fields: [jackpotContributionTable.playerId],
// //       references: [userTable.id],
// //     }),
// //   })
// // );
// // export const kyc_documentsRelations = relations(kyc_documents, ({ one }) => ({
// //   player: one(userTable, {
// //     fields: [kyc_documents.playerId],
// //     references: [userTable.id],
// //   }),
// //   kyc_submission: one(kyc_submissions, {
// //     fields: [kyc_documents.submissionId],
// //     references: [kyc_submissions.id],
// //   }),
// // }));

// // export const kyc_submissionsRelations = relations(
// //   kyc_submissions,
// //   ({ one, many }) => ({
// //     kyc_documents: many(kyc_documents),
// //     player: one(userTable, {
// //       fields: [kyc_submissions.playerId],
// //       references: [userTable.id],
// //     }),
// //   })
// // );

// // export const loyalty_fund_transactionTableRelations = relations(
// //   loyalty_fund_transactionTable,
// //   ({ one }) => ({
// //     operator: one(operatorTable, {
// //       fields: [loyalty_fund_transactionTable.operatorId],
// //       references: [operatorTable.id],
// //     }),
// //     player: one(userTable, {
// //       fields: [loyalty_fund_transactionTable.playerId],
// //       references: [userTable.id],
// //     }),
// //   })
// // );

// // export const operator_settlementsRelations = relations(
// //   operator_settlements,
// //   ({ one }) => ({
// //     operator: one(operatorTable, {
// //       fields: [operator_settlements.operatorId],
// //       references: [operatorTable.id],
// //     }),
// //   })
// // );

// // export const operator_switch_historyRelations = relations(
// //   operator_switch_history,
// //   ({ one }) => ({
// //     operator_from_operatorId: one(operatorTable, {
// //       fields: [operator_switch_history.from_operatorId],
// //       references: [operatorTable.id],
// //       relationName: "operator_switch_history_from_operatorId_operatorTableId",
// //     }),
// //     player: one(userTable, {
// //       fields: [operator_switch_history.playerId],
// //       references: [userTable.id],
// //     }),
// //     operator_to_operatorId: one(operatorTable, {
// //       fields: [operator_switch_history.to_operatorId],
// //       references: [operatorTable.id],
// //       relationName: "operator_switch_history_to_operatorId_operatorTableId",
// //     }),
// //   })
// // );

// // export const password_logsRelations = relations(password_logs, ({ one }) => ({
// //   player_actorId: one(userTable, {
// //     fields: [password_logs.actorId],
// //     references: [userTable.id],
// //     relationName: "password_logs_actorId_userTableId",
// //   }),
// //   player_userId: one(userTable, {
// //     fields: [password_logs.userId],
// //     references: [userTable.id],
// //     relationName: "password_logs_userId_userTableId",
// //   }),
// // }));

// // export const productsRelations = relations(products, ({ one }) => ({
// //   operator: one(operatorTable, {
// //     fields: [products.operatorId],
// //     references: [operatorTable.id],
// //   }),
// // }));

// // export const referral_codesRelations = relations(referral_codes, ({ one }) => ({
// //   player: one(userTable, {
// //     fields: [referral_codes.ownerId],
// //     references: [userTable.id],
// //   }),
// // }));

// // export const affiliate_logsRelations = relations(affiliate_logs, ({ one }) => ({
// //   player_childId: one(userTable, {
// //     fields: [affiliate_logs.childId],
// //     references: [userTable.id],
// //     relationName: "affiliate_logs_childId_userTableId",
// //   }),
// //   player_invitorId: one(userTable, {
// //     fields: [affiliate_logs.invitorId],
// //     references: [userTable.id],
// //     relationName: "affiliate_logs_invitorId_userTableId",
// //   }),
// // }));
// // export const vip_cashbacksRelations = relations(vip_cashbacks, ({ one }) => ({
// //   player: one(userTable, {
// //     fields: [vip_cashbacks.playerId],
// //     references: [userTable.id],
// //   }),
// // }));

// // export const vip_level_up_bonusTableRelations = relations(
// //   vip_level_up_bonusTable,
// //   ({ one }) => ({
// //     player: one(userTable, {
// //       fields: [vip_level_up_bonusTable.playerId],
// //       references: [userTable.id],
// //     }),
// //   })
// // );

// // export const vip_spin_rewardsRelations = relations(
// //   vip_spin_rewards,
// //   ({ one }) => ({
// //     player: one(userTable, {
// //       fields: [vip_spin_rewards.playerId],
// //       references: [userTable.id],
// //     }),
// //   })
// // );

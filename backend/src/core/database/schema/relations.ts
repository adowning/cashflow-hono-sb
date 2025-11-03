import { relations } from "drizzle-orm";
import { affiliatePayoutTable, commissionTable } from "./affiliate";
import { bonusTable, userBonusTable } from "./bonus";
import { depositTable, transactionLogTable, withdrawalTable } from "./finance";
import { gameTable, operatorTable } from "./game";
import { jackpotTable } from "./jackpot";
import { platformSettingTable } from "./platform";
import
{
  gameSessionTable,
  sessionTable,
  userBalanceTable,
  userTable,
} from "./user";

// User Relations (One-to-Many)
export const userRelations = relations(userTable, ({ one, many }) => ({
  operator: one(operatorTable, {
    fields: [userTable.operatorId],
    references: [operatorTable.id]
  }),
  sessions: many(sessionTable),
  gameSessions: many(gameSessionTable),
  userBonuses: many(userBonusTable),
  affiliatePayouts: many(affiliatePayoutTable),
  userBalances: many(userBalanceTable),
  deposits: many(depositTable),
  transactions: many(transactionLogTable),
  withdrawals: many(withdrawalTable),
  jackpots: many(jackpotTable),
}));

// Session Relations (Many-to-One)
export const sessionRelations = relations(sessionTable, ({ one, many }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
  // gameSessions: many(gameSessionTable),
}));

// Operator Relations (One-to-Many)
export const operatorRelations = relations(operatorTable, ({ many }) => ({
  transactions: many(transactionLogTable),
  games: many(gameTable),
  users: many(userTable),
}));

// Transaction Relations (Many-to-One/One-to-One)
export const transactionRelations = relations(
  transactionLogTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [transactionLogTable.userId],
      references: [userTable.id],
    }),
    game: one(gameTable, {
      fields: [transactionLogTable.gameId],
      references: [gameTable.id],
    }),
    operator: one(operatorTable, {
      fields: [transactionLogTable.operatorId],
      references: [operatorTable.id],
    }),

    deposit: one(depositTable, {
      fields: [transactionLogTable.id],
      references: [depositTable.transactionId],
    }),
    withdrawal: one(withdrawalTable, {
      fields: [transactionLogTable.id],
      references: [withdrawalTable.transactionId],
    }),
  })
);

// Affiliate Payout Relations (Many-to-One)
export const affiliatePayoutRelations = relations(
  affiliatePayoutTable,
  ({ one }) => ({
    affiliate: one(userTable, {
      fields: [affiliatePayoutTable.affiliateId],
      references: [userTable.id],
    }),
  })
);

// Bonus Relations (One-to-Many)
export const bonusRelations = relations(bonusTable, ({ many }) => ({
  userBonuses: many(userBonusTable),
}));

// UserBonus Relations (Many-to-One)
export const userBonusRelations = relations(userBonusTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userBonusTable.userId],
    references: [userTable.id],
  }),
  bonus: one(bonusTable, {
    fields: [userBonusTable.bonusId],
    references: [bonusTable.id],
  }),
}));

// Deposit Relations (Many-to-One & One-to-One)
export const depositRelations = relations(depositTable, ({ one }) => ({
  user: one(userTable, {
    fields: [depositTable.userId],
    references: [userTable.id],
  }),
  transaction: one(transactionLogTable, {
    fields: [depositTable.transactionId],
    references: [transactionLogTable.id],
  }),
}));

// Game Relations (Many-to-One & One-to-Many)
export const gameRelations = relations(gameTable, ({ one, many }) => ({
  operator: one(operatorTable, {
    fields: [gameTable.operatorId],
    references: [operatorTable.id],
  }),
  transactions: many(transactionLogTable),
  gameSessions: many(gameSessionTable),
}));

// Game Session Relations (Many-to-One & One-to-Many)
export const gameSessionRelations = relations(
  gameSessionTable,
  ({ one, many }) => ({
    user: one(userTable, {
      fields: [gameSessionTable.userId],
      references: [userTable.id],
    }),
    game: one(gameTable, {
      fields: [gameSessionTable.gameId],
      references: [gameTable.id],
    }),
    // authSession: one(sessionTable, {
    //   fields: [gameSessionTable.authSessionId],
    //   references: [sessionTable.id],
    // }),
  })
);

// Jackpot Relations (Many-to-One & One-to-Many)
export const jackpotRelations = relations(jackpotTable, ({ one, many }) => ({
  lastWonBy: one(userTable, {
    fields: [jackpotTable.lastWonByUserId],
    references: [userTable.id],
  }),
}));

// Withdrawal Relations (Many-to-One & One-to-One)
export const withdrawalRelations = relations(withdrawalTable, ({ one }) => ({
  user: one(userTable, {
    fields: [withdrawalTable.userId],
    references: [userTable.id],
  }),
  transaction: one(transactionLogTable, {
    fields: [withdrawalTable.transactionId],
    references: [transactionLogTable.id],
  }),
}));

// User Balance Relations (One-to-One)
export const userBalanceRelations = relations(userBalanceTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userBalanceTable.userId],
    references: [userTable.id],
  }),
}));

// Relations for tables without explicit foreign keys in other files
export const commissionRelations = relations(commissionTable, () => ({
  // Define relations if any
}));

export const platformSettingRelations = relations(platformSettingTable, () => ({
  // Define relations if any
}));

import { integer, pgTable, real, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { z } from "zod";
import { customTimestamp } from "./custom";
import { jackpotTypeEnum } from "./enums";
import { userTable } from "./user";
import { timestampColumns } from "./custom-types";

// ========================================
// JACKPOT POOL TABLE
// ========================================

/**
 * Main jackpot pool table
 * Contains current state and configuration for each jackpot type
 */
export const jackpotTable = pgTable(
	"jackpots",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		jackpotType: jackpotTypeEnum("jackpot_type").notNull(),

		// Current state
		currentAmount: integer("current_amount").notNull(),
		seedAmount: integer("seed_amount").notNull(),
		maxAmount: integer("max_amount"),
		contributionRate: real("contribution_rate").notNull(),
		minBet: integer("min_bet"),

		// Last win information
		lastWonAmount: integer("last_won_amount"),
		lastWonAt: customTimestamp("last_won_at", { precision: 3 }),
		lastWonByUserId: uuid("last_won_by_user_id").references(() => userTable.id),

		// Statistics
		totalContributions: integer("total_contributions").default(0),
		totalWins: integer("total_wins").default(0),

		// Concurrency control fields
		version: integer("version").default(0).notNull(), // Optimistic locking version
		lockHolder: text("lock_holder"), // Who holds the current lock (for debugging)
		lastModifiedAt: customTimestamp("last_modified_at", { precision: 3 }), // For timestamp-based locking

		// Timestamps
		createdAt: customTimestamp("created_at", { precision: 3 }),
		updatedAt: customTimestamp("updated_at", { precision: 3 }),
	},
	(table) => {
		return {
			// Performance indexes
			typeIdx: index("idx_jackpots_type").on(table.jackpotType),
			currentAmountIdx: index("idx_jackpots_current_amount").on(table.currentAmount),
			lastWonAtIdx: index("idx_jackpots_last_won_at").on(table.lastWonAt),
			lastWonByUserIdIdx: index("idx_jackpots_last_won_by_user_id").on(table.lastWonByUserId),

			// Composite indexes for common queries
			typeAmountIdx: index("idx_jackpots_type_amount").on(table.jackpotType, table.currentAmount),
			typeLastWinIdx: index("idx_jackpots_type_last_win").on(table.jackpotType, table.lastWonAt),
		};
	},
);

// ========================================
// WIN HISTORY TABLE
// ========================================

/**
 * Individual jackpot win events
 * Normalized table storing each win as a separate record
 */
export const jackpotWinHistoryTable = pgTable(
	"jackpot_win_history",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		jackpotId: uuid("jackpot_id")
			.notNull()
			.references(() => jackpotTable.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		jackpotType: jackpotTypeEnum("jackpot_type").notNull(),

		// Win details
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, {
				onDelete: "restrict",
				onUpdate: "cascade",
			}),
		gameId: text("game_id").notNull(),
		amountWon: integer("amount_won").notNull(),
		winningSpinTransactionId: text("winning_spin_transaction_id").notNull(),

		// Win metadata
		timeStampOfWin: customTimestamp("timestamp_of_win", {
			precision: 3,
		}).notNull(),
		numberOfJackpotWinsForUserBefore: integer("number_of_jackpot_wins_for_user_before").notNull(),
		numberOfJackpotWinsForUserAfter: integer("number_of_jackpot_wins_for_user_after").notNull(),
		operatorId: text("operator_id").notNull().default("system"),
		userCreateDate: customTimestamp("user_create_date", { precision: 3 }),
		videoClipLocation: text("video_clip_location"),

		// Timestamps
		createdAt: timestampColumns.createdAt, // customTimestamp("created_at", { precision: 3 }).defaultNow(),
	},
	(table) => {
		return {
			// Performance indexes
			jackpotIdIdx: index("idx_jackpot_win_history_jackpot_id").on(table.jackpotId),
			jackpotTypeIdx: index("idx_jackpot_win_history_jackpot_type").on(table.jackpotType),
			userIdIdx: index("idx_jackpot_win_history_user_id").on(table.userId),
			gameIdIdx: index("idx_jackpot_win_history_game_id").on(table.gameId),
			timeStampOfWinIdx: index("idx_jackpot_win_history_timestamp").on(table.timeStampOfWin),
			winningSpinTransactionIdIdx: index("idx_jackpot_win_history_transaction_id").on(table.winningSpinTransactionId),

			// Composite indexes for common queries
			jackpotTypeTimestampIdx: index("idx_jackpot_win_history_type_timestamp").on(
				table.jackpotType,
				table.timeStampOfWin,
			),
			jackpotIdTimestampIdx: index("idx_jackpot_win_history_jackpot_id_timestamp").on(
				table.jackpotId,
				table.timeStampOfWin,
			),
			userTypeTimestampIdx: index("idx_jackpot_win_history_user_type_timestamp").on(
				table.userId,
				table.jackpotType,
				table.timeStampOfWin,
			),
		};
	},
);

// ========================================
// CONTRIBUTION HISTORY TABLE
// ========================================

/**
 * Individual jackpot contribution events
 * Normalized table storing each contribution as a separate record
 */
export const jackpotContributionHistoryTable = pgTable(
	"jackpot_contribution_history",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		jackpotId: uuid("jackpot_id")
			.notNull()
			.references(() => jackpotTable.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		jackpotType: jackpotTypeEnum("jackpot_type").notNull(),

		// Contribution details
		wagerAmount: integer("wager_amount").notNull(),
		contributionAmount: integer("contribution_amount").notNull(),
		winAmount: integer("win_amount").notNull().default(0),
		betTransactionId: text("bet_transaction_id").notNull(),

		// Contributor info
		gameId: text("game_id").notNull(),
		operatorId: text("operator_id").notNull().default("system"),

		// Timestamps
		createdAt: customTimestamp("created_at", { precision: 3 }).notNull(),
	},
	(table) => {
		return {
			// Performance indexes
			jackpotIdIdx: index("idx_jackpot_contribution_history_jackpot_id").on(table.jackpotId),
			jackpotTypeIdx: index("idx_jackpot_contribution_history_jackpot_type").on(table.jackpotType),
			gameIdIdx: index("idx_jackpot_contribution_history_game_id").on(table.gameId),
			betTransactionIdIdx: index("idx_jackpot_contribution_history_bet_transaction_id").on(table.betTransactionId),
			createdAtIdx: index("idx_jackpot_contribution_history_created_at").on(table.createdAt),

			// Composite indexes for common queries
			jackpotTypeCreatedAtIdx: index("idx_jackpot_contribution_history_type_created_at").on(
				table.jackpotType,
				table.createdAt,
			),
			jackpotIdCreatedAtIdx: index("idx_jackpot_contribution_history_jackpot_id_created_at").on(
				table.jackpotId,
				table.createdAt,
			),
			gameTypeCreatedAtIdx: index("idx_jackpot_contribution_history_game_type_created_at").on(
				table.gameId,
				table.jackpotType,
				table.createdAt,
			),
			wagerAmountIdx: index("idx_jackpot_contribution_history_wager_amount").on(table.wagerAmount),
			contributionAmountIdx: index("idx_jackpot_contribution_history_contribution_amount").on(table.contributionAmount),
		};
	},
);

// ========================================
// SCHEMAS AND TYPES
// ========================================

export const JackpotSelectSchema = createSelectSchema(jackpotTable);
export const JackpotInsertSchema = createInsertSchema(jackpotTable);
export const JackpotUpdateSchema = createUpdateSchema(jackpotTable);
export type Jackpot = z.infer<typeof JackpotSelectSchema>;

export const JackpotWinHistorySelectSchema = createSelectSchema(jackpotWinHistoryTable);
export const JackpotWinHistoryInsertSchema = createInsertSchema(jackpotWinHistoryTable);
export const JackpotWinHistoryUpdateSchema = createUpdateSchema(jackpotWinHistoryTable);
export type JackpotWinHistory = z.infer<typeof JackpotWinHistorySelectSchema>;

export const JackpotContributionHistorySelectSchema = createSelectSchema(jackpotContributionHistoryTable);
export const JackpotContributionHistoryInsertSchema = createInsertSchema(jackpotContributionHistoryTable);
export const JackpotContributionHistoryUpdateSchema = createUpdateSchema(jackpotContributionHistoryTable);
export type JackpotContributionHistory = z.infer<typeof JackpotContributionHistorySelectSchema>;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get default jackpot configuration for initialization
 */
export function getDefaultJackpotConfig() {
	return {
		minor: {
			seedAmount: 100000, // $1,000
			maxAmount: 1000000, // $10,000 cap
			contributionRate: 0.02, // 2%
		},
		major: {
			seedAmount: 1000000, // $10,000
			maxAmount: 10000000, // $100,000 cap
			contributionRate: 0.01, // 1%
		},
		mega: {
			seedAmount: 10000000, // $100,000
			maxAmount: 100000000, // $1,000,000 cap
			contributionRate: 0.005, // 0.5%
		},
	};
}

import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { z } from "zod";
import { expiresAtTimestamp, timestampColumns } from "./custom-types";
import { sessionStatusEnum, userRoleEnum, userStatusEnum } from "./enums";
import { gameTable, operatorTable } from "./game";

export const userTable = pgTable("user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: text("username").notNull(),
	avatarUrl: text("avatar_url")
		.notNull()
		.default("https://crqbazcsrncvbnapuxcp.supabase.co/storage/v1/object/public/avatars/avatar-6.webp"),
	role: userRoleEnum("role").default("USER"),
	status: userStatusEnum("status").default("OFFLINE"),
	banned: boolean("banned"),
	authEmail: text("auth_email").notNull().unique(),
	banReason: text("ban_reason"),
	banExpires: expiresAtTimestamp,
	phone: text("phone"),
	operatorId: uuid("operator_id")
		.references(() => operatorTable.id)
		.default(sql`'79032f3f-7c4e-4575-abf9-4298ad3e9d1a'`),
	// balance: uuid("id").references(() => userBalanceTable.userId),
	createdAt: timestampColumns.createdAt,
	updatedAt: timestampColumns.updatedAt,
});

export const UserSelectSchema = createSelectSchema(userTable);
export const UserInsertSchema = createInsertSchema(userTable);
export const UserUpdateSchema = createUpdateSchema(userTable);
export type User = z.infer<typeof UserSelectSchema>;
export type UserInsert = typeof userTable.$inferInsert;
export type UserSelect = typeof userTable.$inferSelect & User;

export const sessionTable = pgTable("session", {
	id: uuid("id").primaryKey().notNull(),
	expiresAt: expiresAtTimestamp,
	token: text("token").notNull(),
	createdAt: timestampColumns.createdAt,
	updatedAt: timestampColumns.updatedAt,
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: uuid("user_id")
		.notNull()
		.references(() => userTable.id),
	activeOrganizationId: uuid("active_organization_id"),
	impersonatedBy: text("impersonated_by"),
});

export const SessionSelectSchema = createSelectSchema(sessionTable);
export const SessionInsertSchema = createInsertSchema(sessionTable);
export const SessionUpdateSchema = createUpdateSchema(sessionTable);
export type Session = z.infer<typeof SessionSelectSchema>;
export type SessionInsert = typeof sessionTable.$inferInsert;
export type SessionSelect = typeof sessionTable.$inferSelect & Session;

export const userBalanceTable = pgTable("user_balances", {
	id: uuid().primaryKey().notNull(),
	// .
	userId: uuid("user_id")
		.notNull()
		.references(() => userTable.id),
	realBalance: integer("real_balance").default(0).notNull(),
	bonusBalance: integer("bonus_balance").default(0).notNull(),
	freeSpinsRemaining: integer("free_spins_remaining").default(0).notNull(),
	depositWrRemaining: integer("deposit_wr_remaining").default(0).notNull(),
	bonusWrRemaining: integer("bonus_wr_remaining").default(0).notNull(),
	totalDeposited: integer("total_deposited").default(0).notNull(),
	totalWithdrawn: integer("total_withdrawn").default(0).notNull(),
	totalWagered: integer("total_wagered").default(0).notNull(),
	totalWon: integer("total_won").default(0).notNull(),
	totalBonusGranted: integer("total_bonus_granted").default(0).notNull(),
	totalFreeSpinWins: integer("total_free_spin_wins").default(0).notNull(),
	createdAt: timestampColumns.createdAt,
	updatedAt: timestampColumns.updatedAt,
});

export const UserBalanceSelectSchema = createSelectSchema(userBalanceTable);
export const UserBalanceInsertSchema = createInsertSchema(userBalanceTable);
export const UserBalanceUpdateSchema = createUpdateSchema(userBalanceTable);
export type UserBalance = z.infer<typeof UserBalanceSelectSchema>;
export type UserBalanceInsert = typeof userBalanceTable.$inferInsert;
export type UserBalanceSelect = typeof userBalanceTable.$inferSelect & UserBalance;

export type BetResult = {
	wagerAmount: number;
	realBalanceBefore: number;
	realBalanceAfter: number;
	bonusBalanceBefore: number;
	bonusBalanceAfter: number;
	winAmount: number;
	vipPointsAdded: number;
	ggrContribution: number;
	jackpotContribution: number;
	processingTime: number;
	currentGameSessionRtp: number | 0;
};

export const gameSessionTable = pgTable(
	"game_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		createdAt: timestampColumns.createdAt,
		updatedAt: timestampColumns.updatedAt,
		version: integer("version").default(1).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		authSessionId: uuid("auth_session_id").references(() => sessionTable.id), // Will relate to sessionTable
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id),
		gameId: uuid("game_id").references(() => gameTable.id),
		gameName: text("game_name"),
		status: sessionStatusEnum("status").default("ACTIVE").notNull(),
		totalWagered: integer("total_wagered").default(0),
		totalWon: integer("total_won").default(0),
		gameSessionRtp: integer("session_rtp").default(0),
		startingBalance: integer("starting_balance"),
		endingBalance: integer("ending_balance"),
		// sessionId: uuid("session_id"),
		betResults: jsonb("bets").$type<BetResult[]>().default([]).notNull(),
		duration: integer("duration").default(0),
		expiredAt: expiresAtTimestamp,
	},
	(t) => [
		index("game_sessions_user_id_index").on(t.userId),
		index("game_sessions_status_index").on(t.status),
		// index("game_sessions_auth_session_index").on(t.authSessionId),
	],
);

export const GameSessionSelectSchema = createSelectSchema(gameSessionTable);
export const GameSessionInsertSchema = createInsertSchema(gameSessionTable);
export const GameSessionUpdateSchema = createUpdateSchema(gameSessionTable);
export type GameSession = z.infer<typeof GameSessionSelectSchema>;

import { timestampColumns } from "./custom-types";
import { createSelectSchema, createUpdateSchema, createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import {
	pgTable,
	text,
	boolean,
	uuid,
	timestamp,
	integer,
	jsonb,
	unique,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { transactionStatusEnum, transactionTypeEnum } from "./enums";
import { userTable } from "./user";
import { gameTable, operatorTable } from "./game";

export const transactionLogTable = pgTable(
	"transactions",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		createdAt: timestampColumns.createdAt,
		updatedAt: timestampColumns.updatedAt,
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id),
		relatedId: uuid("related_id"),
		sessionId: uuid("session_id"),
		tnxId: uuid("tnx_id"),
		type: transactionTypeEnum("type").notNull(),
		typeDescription: text("type_description"),
		status: transactionStatusEnum("status").default("COMPLETED").notNull(),
		wagerAmount: integer("wager_amount"),
		realBalanceBefore: integer("real_balance_before").notNull(),
		realBalanceAfter: integer("real_balance_after").notNull(),
		bonusBalanceBefore: integer("bonus_balance_before").notNull(),
		bonusBalanceAfter: integer("bonus_balance_after").notNull(),
		gameId: uuid("game_id").references(() => gameTable.id),
		gameName: text("game_name"),
		provider: text("provider"),
		category: text("category"),
		operatorId: uuid("operator_id").references(() => operatorTable.id),
		ggrContribution: integer("ggr_contribution"),
		jackpotContribution: integer("jackpot_contribution"),
		vipPointsAdded: integer("vip_points_added"),
		processingTime: integer("processing_time"),
		metadata: jsonb("metadata"),
		affiliateId: uuid("affiliate_id"),
		path: text("path").array(),
		updatedBy: text("updated_by").default("system").notNull(),
		version: integer("version").default(1).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
	},
	(t) => [
		index("transaction_log_user_id_index").on(t.userId),
		index("transaction_log_type_index").on(t.type),
		index("transaction_log_status_index").on(t.status),
		index("transaction_log_game_id_index").on(t.gameId),
	],
);

export const TransactionLogSelectSchema = createSelectSchema(transactionLogTable);
export const TransactionLogInsertSchema = createInsertSchema(transactionLogTable);
export const TransactionLogUpdateSchema = createUpdateSchema(transactionLogTable);
export type TransactionLog = z.infer<typeof TransactionLogSelectSchema>;
export type TransactionLogInsert = z.infer<typeof TransactionLogInsertSchema>;

export const depositTable = pgTable(
	"deposits",
	{
		id: uuid("id").primaryKey().notNull(),
		createdAt: timestampColumns.createdAt,
		updatedAt: timestampColumns.updatedAt,
		version: integer("version").default(1).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id),
		transactionId: uuid("transaction_id").references(() => transactionLogTable.id),
		amount: integer("amount").notNull(),
		status: transactionStatusEnum("status").default("PENDING").notNull(),
		paymentMethod: text("payment_method"),
		referenceId: uuid("reference_id"),
		note: text("note"),
		metadata: jsonb("metadata"),
		bonusAmount: integer("bonus_amount").notNull(),
	},

	(t) => [
		index("deposit_user_id_index").on(t.userId),
		index("deposit_referenceId_index").on(t.referenceId),
		index("deposit_status_index").on(t.status),
		index("deposit_transactionId_id_index").on(t.transactionId),
	],
);

export const DepositSelectSchema = createSelectSchema(depositTable);
export const DepositInsertSchema = createInsertSchema(depositTable);
export const DepositUpdateSchema = createUpdateSchema(depositTable);
export type Deposit = z.infer<typeof DepositSelectSchema>;

export const withdrawalTable = pgTable(
	"withdrawals",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		createdAt: timestampColumns.createdAt,
		updatedAt: timestampColumns.updatedAt,
		updatedBy: text("updated_by").default("system").notNull(),
		version: integer("version").default(1).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id),
		transactionId: uuid("transaction_id").references(() => transactionLogTable.id),
		amount: integer("amount").notNull(),
		status: transactionStatusEnum("status").default("PENDING").notNull(),
		payoutMethod: text("payout_method"),
		note: text("note"),
		metadata: jsonb("metadata"),
	},

	(t) => [
		index("withdrawal_user_id_index").on(t.userId),
		index("withdrawal_status_index").on(t.status),
		index("withdrawal_transactionId_id_index").on(t.transactionId),
	],
);

export const WithdrawalSelectSchema = createSelectSchema(withdrawalTable);
export const WithdrawalInsertSchema = createInsertSchema(withdrawalTable);
export const WithdrawalUpdateSchema = createUpdateSchema(withdrawalTable);
export type Withdrawal = z.infer<typeof WithdrawalSelectSchema>;

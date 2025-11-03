import { timestampColumns } from "./custom-types";
import { sql } from "drizzle-orm";
import {
  createSelectSchema,
  createUpdateSchema,
  createInsertSchema,
} from "drizzle-zod";
import type { z } from "zod";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  real,
  index,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./user";
import { customTimestamp } from "./custom";
import { affiliateStatusEnum } from "./enums";

export const affiliatePayoutTable = pgTable("affiliate_payouts", {
  id: uuid("id").primaryKey().notNull(),
  createdAt: timestampColumns.createdAt,
  updatedAt: timestampColumns.updatedAt,
  updatedBy: text("updated_by").default("system").notNull(),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => userTable.id),
  weekStart: customTimestamp("week_start", {
    precision: 3,
  }).notNull(),
  weekEnd: customTimestamp("week_end", {
    precision: 3,
  }).notNull(),
  totalGgr: integer("total_ggr").notNull(),
  commissionRate: real("commission_rate").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  status: affiliateStatusEnum("status").default("NEEDS_REVIEWED"),
  transactionId: uuid("transaction_id"),
  paidAt: customTimestamp("paid_at", { precision: 3 }),
});

// export const affiliatePayoutsWeekIdx = index("affiliate_payouts_week_idx").on(
//   affiliatePayoutTable.affiliateId,
//   affiliatePayoutTable.weekStart
// );
// export const affiliatePayoutsStatusIdx = index(
//   "affiliate_payouts_status_idx"
// ).on(affiliatePayoutTable.status);

export const AffiliatePayoutSelectSchema =
  createSelectSchema(affiliatePayoutTable);
export const AffiliatePayoutInsertSchema =
  createInsertSchema(affiliatePayoutTable);
export const AffiliatePayoutUpdateSchema =
  createUpdateSchema(affiliatePayoutTable);
export type AffiliatePayout = z.infer<typeof AffiliatePayoutSelectSchema>;

export const commissionTable = pgTable("commissions", {
  id: uuid("id").primaryKey().notNull(),
  createdAt: timestampColumns.createdAt,
  updatedAt: timestampColumns.updatedAt,
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
});

// export const commissionsLevelIdx = uniqueIndex("commissions_level_idx").on(
//   commissionTable.level
// );
// export const commissionsLevelUnique = unique("commissions_level_unique").on(
//   commissionTable.level
// );

export const CommissionSelectSchema = createSelectSchema(commissionTable);
export const CommissionInsertSchema = createInsertSchema(commissionTable);
export const CommissionUpdateSchema = createUpdateSchema(commissionTable);
export type Commission = z.infer<typeof CommissionSelectSchema>;

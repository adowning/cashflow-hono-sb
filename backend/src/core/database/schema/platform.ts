import { boolean, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import
{
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type { z } from "zod";
import { timestampColumns } from "./custom-types";

export const platformSettingTable = pgTable("platform_settings", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").default("Default Settings").notNull(),
  default: boolean("default").default(true).notNull(),
  referralCodeCount: integer("referral_code_count").default(5).notNull(),
  depositWrMultiplier: integer("deposit_wr_multiplier").default(1).notNull(),
  bonusWrMultiplier: integer("bonus_wr_multiplier").default(30).notNull(),
  freeSpinWrMultiplier: integer("free_spin_wr_multiplier").default(30).notNull(),
  avgFreeSpinWinValue: integer("avg_free_spin_win_value").default(15).notNull(),
  referralCommissionRate: integer("referral_commission_rate").default(10).notNull(), // stored as basis points (0.1 = 10)
  rates: jsonb("rates").default({ master: 0.1, affiliate: 0.7, subaffiliate: 0.3 }).notNull(), // { master: 0.1, affiliate: 0.7, subaffiliate: 0.3 }
  commission: jsonb("commission").default({ master: 0.3, affiliate: 0.2, subAffiliate: 0.1 }).notNull(), // { master: 0.3, affiliate: 0.2, subAffiliate: 0.1 }
  jackpotConfig: jsonb("jackpot_config").default({
    minor: { rate: 0.01, seedAmount: 1000, maxAmount: 10000 },
    major: { rate: 0.005, seedAmount: 10000, maxAmount: 100000 },
    mega: { rate: 0.001, seedAmount: 100000, maxAmount: 1000000 },
  }).notNull(), // nested jackpot configuration
  vipConfig: jsonb("vip_config").default({
    pointsPerDollar: 1,
    levelMultipliers: {},
    costSharingPercentage: 0,
    vipLevels: [],
    vipRanks: [],
  }).notNull(), // VIP system configuration
  wageringConfig: jsonb("wagering_config").default({
    defaultWageringMultiplier: 30,
    maxBonusBetPercentage: 0.1,
    bonusExpiryDays: 30,
  }).notNull(), // wagering rules configuration
  systemLimits: jsonb("system_limits").default({
    maxBetAmount: 100000,
    maxDailyLoss: 1000000,
    maxSessionLoss: 500000,
    minBetAmount: 10,
  }).notNull(), // system limits and boundaries
  dashboard: jsonb("dashboard"), // dashboard configuration
  createdAt: timestampColumns.createdAt,
  updatedAt: timestampColumns.updatedAt,
});

export const PlatformSettingSelectSchema =
  createSelectSchema(platformSettingTable);
export const PlatformSettingInsertSchema =
  createInsertSchema(platformSettingTable);
export const PlatformSettingUpdateSchema =
  createUpdateSchema(platformSettingTable);
export type PlatformSetting = z.infer<typeof PlatformSettingSelectSchema>;
export type PlatformSettingInsert = typeof platformSettingTable.$inferInsert;
export type PlatformSettingSelect = typeof platformSettingTable.$inferSelect &
  PlatformSetting;

import { expiresAtTimestamp, timestampColumns } from "./custom-types";
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
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import { bonusStatusEnum, bonusTypeEnum } from "./enums";
import { userTable } from "./user";
import { customTimestamp } from "./custom";

export const bonusTable = pgTable(
  "bonuses",
  {
    id: uuid("id").primaryKey().notNull(),
    createdAt: timestampColumns.createdAt,
    updatedAt: timestampColumns.updatedAt,
    version: integer("version").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    name: text("name").notNull(),
    type: bonusTypeEnum("type").notNull(),
    description: text("description"),
    amount: integer("amount"),
    percentage: real("percentage"),
    maxAmount: integer("max_amount"),
    wageringMultiplier: real("wagering_multiplier").notNull(),
    expiryDays: integer("expiry_days"),
    maxBet: integer("max_bet"),
    allowedGameTypes: text("allowed_game_types").array(),
    excludedGameIds: text("excluded_game_ids").array(),
    slot: boolean("slot").default(true),
    casino: boolean("casino").default(true),
    contributionPercentage: real("contribution_percentage").default(100),
    vipPointsMultiplier: real("vip_points_multiplier").default(1),
  },

  (t) => [index("bonus_name_index").on(t.name)]
);

export const BonusSelectSchema = createSelectSchema(bonusTable);
export const BonusInsertSchema = createInsertSchema(bonusTable);
export const BonusUpdateSchema = createUpdateSchema(bonusTable);
export type Bonus = z.infer<typeof BonusSelectSchema>;

export const userBonusTable = pgTable("user_bonuses", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  createdAt: timestampColumns.createdAt,
  updatedAt: timestampColumns.updatedAt,
  updatedBy: text("updated_by").default("system").notNull(),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  bonusId: uuid("bonus_id")
    .notNull()
    .references(() => bonusTable.id),
  status: bonusStatusEnum("status").default("ACTIVE").notNull(),
  awardedAmount: integer("awarded_amount").notNull(),
  wageringRequired: integer("wagering_required").notNull(),
  wageringProgress: integer("wagering_progress").default(0).notNull(),
  expiresAt: expiresAtTimestamp,
  activatedAt: customTimestamp("activated_at", {
    precision: 3,
  }),
  completedAt: customTimestamp("completed_at", {
    precision: 3,
  }),
});

// export const userBonusesUserBonusIdx = index("user_bonuses_user_bonus_idx").on(
//   userBonusTable.bonusId,
//   userBonusTable.userId
// );
// export const userBonusesStatusIdx = index("user_bonuses_status_idx").on(
//   userBonusTable.status
// );
// export const userBonusesExpiresIdx = index("user_bonuses_expires_idx").on(
//   userBonusTable.expiresAt
// );

export const UserBonusSelectSchema = createSelectSchema(userBonusTable);
export const UserBonusInsertSchema = createInsertSchema(userBonusTable);
export const UserBonusUpdateSchema = createUpdateSchema(userBonusTable);
export type UserBonus = z.infer<typeof UserBonusSelectSchema>;

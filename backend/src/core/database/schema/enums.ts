import { pgEnum } from "drizzle-orm/pg-core";

export const bonusStatusEnum = pgEnum("bonus_status_enum", [
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
]);
export const affiliateStatusEnum = pgEnum("affliate_status_enum", [
  "PAID",
  "NEEDS_REVIEWED",
  "PASSED_REVIEW",
  "FAILED_REVIEW",
]);
export const bonusTypeEnum = pgEnum("bonus_type_enum", [
  "DEPOSIT_MATCH",
  "FREE_SPINS",
  "CASHBACK",
  "LEVEL_UP",
  "MANUAL",
]);
export const gameCategoriesEnum = pgEnum("game_categories_enum", [
  "SLOTS",
  "FISH",
  "TABLE",
  "LIVE",
  "OTHER",
]);
export const gameStatusEnum = pgEnum("game_status_enum", [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
]);
export const jackpotGroupEnum = pgEnum("jackpot_group_enum", [
  "minor",
  "major",
  "mega",
]);
export const userRoleEnum = pgEnum("user_role_enum", [
  "USER",
  "AFFILIATE",
  "ADMIN",
  "OPERATOR",
  "BOT"
]);

export const sessionStatusEnum = pgEnum("session_status_enum", [
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "ABANDONED",
  "TIMEOUT",
  "OTP_PENDING",
]);
export const transactionStatusEnum = pgEnum("transaction_status_enum", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);
export const transactionTypeEnum = pgEnum("transaction_type_enum", [
  "DEPOSIT",
  "WITHDRAWAL",
  "BET",
  "WIN",
  "BONUS_AWARD",
  "BONUS_WAGER",
  "BONUS_CONVERT",
  "ADJUSTMENT",
  "CASHBACK",
  "AFFILIATE_PAYOUT",
  "BONUS",
  "JACKPOT_CONTRIBUTION",
  "JACKPOT_WIN",
  "JACKPOT_CONFIG_CHANGE",
  "HEALTH_CHECK",
]);
export const jackpotTypeEnum = pgEnum("type_of_jackpot_enum", [
  "MINOR",
  "MAJOR",
  "GRAND",
]);
export const userStatusEnum = pgEnum("user_status_enum", [
  "ONLINE",
  "OFFLINE",
  "BANNED",
  "PENDING",
]);

export const equalityOperatorEnum = pgEnum("equality_op", [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
]);

-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "auth"."aal_level" AS ENUM('aal1', 'aal2', 'aal3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."code_challenge_method" AS ENUM('s256', 'plain');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."factor_status" AS ENUM('unverified', 'verified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."factor_type" AS ENUM('totp', 'webauthn', 'phone');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."oauth_authorization_status" AS ENUM('pending', 'approved', 'denied', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."oauth_client_type" AS ENUM('public', 'confidential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."oauth_registration_type" AS ENUM('dynamic', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."oauth_response_type" AS ENUM('code');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth"."one_time_token_type" AS ENUM('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."PlayerRole" AS ENUM('PLAYER', 'ADMIN', 'MODERATOR', 'SUPPORT', 'BOT', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."TournamentStatus" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."bonus_status_enum" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."bonus_type_enum" AS ENUM('DEPOSIT_MATCH', 'FREE_SPINS', 'CASHBACK', 'LEVEL_UP', 'MANUAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."game_categories_enum" AS ENUM('SLOTS', 'FISH', 'TABLE', 'LIVE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."game_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."jackpot_group_enum" AS ENUM('minor', 'major', 'mega');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."kyc_document_type_enum" AS ENUM('PASSPORT', 'DRIVERS_LICENSE', 'ID_CARD', 'RESIDENCE_PERMIT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."kyc_status_enum" AS ENUM('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."loyalty_fund_transaction_type_enum" AS ENUM('CONTRIBUTION', 'PAYOUT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."message_type_enum" AS ENUM('update:vip', 'update:balance', 'update:gameSession');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_method_enum" AS ENUM('INSTORE_CASH', 'INSTORE_CARD', 'CASHAPP', 'CRYPTO', 'BANK_TRANSFER', 'CHECK');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."progress_type_enum" AS ENUM('ONE_PAY', 'SUM_PAY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED', 'TIMEOUT', 'OTP_PENDING');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transaction_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transaction_type_enum" AS ENUM('DEPOSIT', 'WITHDRAWAL', 'BET', 'WIN', 'BONUS_AWARD', 'BONUS_WAGER', 'BONUS_CONVERT', 'ADJUSTMENT', 'CASHBACK', 'AFFILIATE_PAYOUT', 'BONUS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_enum" AS ENUM('ADD', 'OUT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_of_jackpot_enum" AS ENUM('MINOR', 'MAJOR', 'GRAND');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."update_type_enum" AS ENUM('BINARY', 'OTA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role_enum" AS ENUM('USER', 'ADMIN', 'AFFILIATE', 'SUPER_AFFILIATE', 'MODERATOR', 'SUPPORT', 'BOT', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'BANNED', 'PENDING');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "realtime"."action" AS ENUM('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "realtime"."equality_op" AS ENUM('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "storage"."buckettype" AS ENUM('STANDARD', 'ANALYTICS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeOrganizationId" text,
	"impersonatedBy" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"privateKey" text NOT NULL,
	"passpublicKey" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_username" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp(3),
	"phone" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_role" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operators" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "operators_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"username" text NOT NULL,
	"image" text,
	"status" "user_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"avatar_url" text DEFAULT 'https://gameui.cashflowcasino.com/public/avatars/avatar-01.webp' NOT NULL,
	"phone" text,
	"vip_level" integer DEFAULT 1 NOT NULL,
	"vip_points" integer DEFAULT 0 NOT NULL,
	"vip_rank_id" text,
	"rtg_block_time" integer,
	"kyc_status" "kyc_status_enum" DEFAULT 'NOT_STARTED',
	"invitor_id" text,
	"invite_code" text,
	"path" text[],
	"is_affiliate" boolean DEFAULT false,
	"referral_init" boolean DEFAULT false,
	"last_vip_level_amount" integer,
	"referral_code" text,
	CONSTRAINT "players_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"player_id" text NOT NULL,
	"related_id" text,
	"session_id" text,
	"tnx_id" text,
	"type" "transaction_type_enum" NOT NULL,
	"type_description" text,
	"status" "transaction_status_enum" DEFAULT 'COMPLETED' NOT NULL,
	"wager_amount" integer,
	"real_balance_before" integer NOT NULL,
	"real_balance_after" integer NOT NULL,
	"bonus_balance_before" integer NOT NULL,
	"bonus_balance_after" integer NOT NULL,
	"game_id" text,
	"game_name" text,
	"provider" text,
	"category" text,
	"operator_id" text,
	"ggr_contribution" integer,
	"jackpot_contribution" integer,
	"vip_points_added" integer,
	"processing_time" integer,
	"metadata" jsonb,
	"affiliate_id" text,
	"path" text[],
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "transactions_tnx_id_unique" UNIQUE("tnx_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_ranks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"min_xp" integer NOT NULL,
	"level" integer NOT NULL,
	"icon" text,
	"daily_cashback_max" integer DEFAULT 0,
	"monthly_cashback_max" integer DEFAULT 0,
	"benefits" jsonb,
	"multiplier" real DEFAULT 1,
	CONSTRAINT "vip_ranks_name_unique" UNIQUE("name"),
	CONSTRAINT "vip_ranks_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deposit_wr_multiplier" integer DEFAULT 1 NOT NULL,
	"bonus_wr_multiplier" integer DEFAULT 30 NOT NULL,
	"free_spin_wr_multiplier" integer DEFAULT 30 NOT NULL,
	"avg_free_spin_win_value" integer DEFAULT 15 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deposits" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"transaction_id" text,
	"amount" integer NOT NULL,
	"status" "transaction_status_enum" DEFAULT 'PENDING' NOT NULL,
	"payment_method" text,
	"reference_id" text,
	"note" text,
	"metadata" jsonb,
	"bonus_amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auth_session_id" text,
	"player_id" text NOT NULL,
	"game_id" text,
	"game_name" text,
	"status" "session_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"total_wagered" integer DEFAULT 0,
	"total_won" integer DEFAULT 0,
	"starting_balance" integer,
	"ending_balance" integer,
	"duration" integer DEFAULT 0,
	"expired_time" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jackpot_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"jackpot_group" "jackpot_group_enum" NOT NULL,
	"player_id" text,
	"game_id" text,
	"bet_transaction_id" text,
	"wager_amount" integer,
	"contribution_amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jackpot_wins" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"jackpot_group" "jackpot_group_enum" NOT NULL,
	"winner_id" text NOT NULL,
	"win_amount" integer NOT NULL,
	"game_id" text,
	"game_session_id" text,
	"win_transaction_id" text,
	"pool_amount_before_win" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jackpots" (
	"id" text PRIMARY KEY NOT NULL,
	"group" "jackpot_group_enum" NOT NULL,
	"current_amount" integer NOT NULL,
	"seed_amount" integer NOT NULL,
	"max_amount" integer,
	"contribution_rate" real NOT NULL,
	"min_bet" integer,
	"last_won_amount" integer,
	"last_won_at" timestamp(3),
	"last_won_by_player_id" text,
	"total_contributions" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "jackpots_group_unique" UNIQUE("group")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"submission_id" text NOT NULL,
	"player_id" text NOT NULL,
	"type" "kyc_document_type_enum" NOT NULL,
	"status" "kyc_status_enum" DEFAULT 'PENDING' NOT NULL,
	"document_number" text,
	"expiry_date" timestamp(3),
	"issue_date" timestamp(3),
	"issuing_country" varchar(2),
	"front_image_url" text,
	"back_image_url" text,
	"selfie_image_url" text,
	"rejection_reason" text,
	"verified_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"status" "kyc_status_enum" DEFAULT 'NOT_STARTED' NOT NULL,
	"level" text DEFAULT 'BASIC',
	"submitted_at" timestamp(3),
	"verified_at" timestamp(3),
	"expiry_date" timestamp(3),
	"notes" text,
	CONSTRAINT "kyc_submissions_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_fund_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"type" "loyalty_fund_transaction_type_enum" NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"operator_id" text,
	"player_id" text,
	"related_transaction_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"operator_id" text NOT NULL,
	"period_start_date" timestamp(3) NOT NULL,
	"period_end_date" timestamp(3) NOT NULL,
	"total_turnover" integer DEFAULT 0,
	"total_payouts" integer DEFAULT 0,
	"gross_gaming_revenue" integer,
	"platform_fee" integer,
	"loyalty_fund_contribution" integer,
	"net_to_operator" integer,
	"status" text DEFAULT 'PENDING'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_switch_history" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"from_operator_id" text,
	"to_operator_id" text NOT NULL,
	"switched_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"transaction_id" text,
	"amount" integer NOT NULL,
	"status" "transaction_status_enum" DEFAULT 'PENDING' NOT NULL,
	"payout_method" text,
	"note" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text,
	"ip" text,
	"user_agent" text,
	"device" text,
	"os" text,
	"browser" text,
	"country_code" varchar(2),
	"country_name" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"product_type" text DEFAULT 'bundle' NOT NULL,
	"price_in_cents" integer NOT NULL,
	"amount_to_receive_in_credits" integer NOT NULL,
	"bonus_total_in_credits" integer DEFAULT 0,
	"bonus_spins" integer DEFAULT 0,
	"is_promo" boolean DEFAULT false,
	"operator_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_balances" (
	"player_id" text PRIMARY KEY NOT NULL,
	"real_balance" integer DEFAULT 0 NOT NULL,
	"bonus_balance" integer DEFAULT 0 NOT NULL,
	"free_spins_remaining" integer DEFAULT 0 NOT NULL,
	"deposit_wr_remaining" integer DEFAULT 0 NOT NULL,
	"bonus_wr_remaining" integer DEFAULT 0 NOT NULL,
	"total_deposited" integer DEFAULT 0 NOT NULL,
	"total_withdrawn" integer DEFAULT 0 NOT NULL,
	"total_wagered" integer DEFAULT 0 NOT NULL,
	"total_won" integer DEFAULT 0 NOT NULL,
	"total_bonus_granted" integer DEFAULT 0 NOT NULL,
	"total_free_spin_wins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"owner_id" text NOT NULL,
	"commission_rate" real,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"bet_transaction_id" text,
	"invitor_id" text NOT NULL,
	"child_id" text,
	"referral_code" text,
	"tier" integer,
	"bet_amount" integer,
	"ggr_amount" integer,
	"commission_rate" real,
	"commission_amount" integer,
	"payout_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"affiliate_id" text NOT NULL,
	"week_start" timestamp(3) NOT NULL,
	"week_end" timestamp(3) NOT NULL,
	"total_ggr" integer NOT NULL,
	"commission_rate" real NOT NULL,
	"commission_amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING'::character varying,
	"transaction_id" text,
	"paid_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bonuses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"amount" integer,
	"percentage" real,
	"max_amount" integer,
	"wagering_multiplier" real NOT NULL,
	"expiry_days" integer,
	"max_bet" integer,
	"allowed_game_types" text[],
	"excluded_game_ids" text[],
	"slot" boolean DEFAULT true,
	"casino" boolean DEFAULT true,
	"contribution_percentage" real DEFAULT 100,
	"vip_points_multiplier" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"rate" real NOT NULL,
	CONSTRAINT "commissions_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_bonuses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"bonus_id" text NOT NULL,
	"status" "bonus_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"awarded_amount" integer NOT NULL,
	"wagering_required" integer NOT NULL,
	"wagering_progress" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp(3),
	"activated_at" timestamp(3),
	"completed_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_cashbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"amount" integer NOT NULL,
	"period_start" timestamp(3),
	"period_end" timestamp(3),
	"vip_level" integer,
	"type" text NOT NULL,
	"transaction_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_level_up_bonuses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"amount" integer NOT NULL,
	"vip_level_achieved" integer NOT NULL,
	"transaction_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_levels" (
	"parent_id" text NOT NULL,
	"min_xp_needed" integer DEFAULT 0 NOT NULL,
	"level_number" integer DEFAULT 0 NOT NULL,
	"level_name" text NOT NULL,
	"level_up_bonus_amount" integer DEFAULT 0 NOT NULL,
	"spin_bonus_multiplier_id" double precision DEFAULT 0.1 NOT NULL,
	"setting_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_spin_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"player_id" text NOT NULL,
	"spin_count" integer NOT NULL,
	"game_id" text,
	"reason" text,
	"claimed" boolean DEFAULT false,
	"expires_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"category" "game_categories_enum" DEFAULT 'SLOTS' NOT NULL,
	"thumbnail_url" text,
	"banner_url" text,
	"developer" text,
	"operator_id" text,
	"target_rtp" real,
	"status" "game_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"min_bet" integer DEFAULT 100,
	"max_bet" integer DEFAULT 100000,
	"is_featured" boolean DEFAULT false,
	"jackpot_group" text,
	"goldsvet_data" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_contributions" ADD CONSTRAINT "jackpot_contributions_bet_transaction_id_transactions_id_fk" FOREIGN KEY ("bet_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_contributions" ADD CONSTRAINT "jackpot_contributions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_contributions" ADD CONSTRAINT "jackpot_contributions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_wins" ADD CONSTRAINT "jackpot_wins_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_wins" ADD CONSTRAINT "jackpot_wins_game_session_id_game_sessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_wins" ADD CONSTRAINT "jackpot_wins_win_transaction_id_transactions_id_fk" FOREIGN KEY ("win_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpot_wins" ADD CONSTRAINT "jackpot_wins_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jackpots" ADD CONSTRAINT "jackpots_last_won_by_player_id_players_id_fk" FOREIGN KEY ("last_won_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_submission_id_kyc_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."kyc_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_fund_transactions" ADD CONSTRAINT "loyalty_fund_transactions_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_fund_transactions" ADD CONSTRAINT "loyalty_fund_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operator_settlements" ADD CONSTRAINT "operator_settlements_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operator_switch_history" ADD CONSTRAINT "operator_switch_history_from_operator_id_operators_id_fk" FOREIGN KEY ("from_operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operator_switch_history" ADD CONSTRAINT "operator_switch_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operator_switch_history" ADD CONSTRAINT "operator_switch_history_to_operator_id_operators_id_fk" FOREIGN KEY ("to_operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_logs" ADD CONSTRAINT "password_logs_actor_id_players_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_logs" ADD CONSTRAINT "password_logs_user_id_players_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_logs" ADD CONSTRAINT "affiliate_logs_child_id_players_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_logs" ADD CONSTRAINT "affiliate_logs_invitor_id_players_id_fk" FOREIGN KEY ("invitor_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_players_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_bonuses" ADD CONSTRAINT "player_bonuses_bonus_id_bonuses_id_fk" FOREIGN KEY ("bonus_id") REFERENCES "public"."bonuses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_bonuses" ADD CONSTRAINT "player_bonuses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vip_cashbacks" ADD CONSTRAINT "vip_cashbacks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vip_level_up_bonuses" ADD CONSTRAINT "vip_level_up_bonuses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vip_spin_rewards" ADD CONSTRAINT "vip_spin_rewards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_name_idx" ON "role" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_user_id_idx" ON "user_role" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_role_id_idx" ON "user_role" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_unique_idx" ON "user_role" ("role_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_status_idx" ON "players" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_invitor_idx" ON "players" ("invitor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_player_idx" ON "transactions" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_game_idx" ON "transactions" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deposits_player_idx" ON "deposits" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deposits_status_idx" ON "deposits" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deposits_ref_idx" ON "deposits" ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposits_tx_idx" ON "deposits" ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_sessions_player_idx" ON "game_sessions" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_sessions_status_idx" ON "game_sessions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_sessions_auth_session_idx" ON "game_sessions" ("auth_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_contrib_group_idx" ON "jackpot_contributions" ("jackpot_group");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_contrib_player_idx" ON "jackpot_contributions" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_contrib_bet_tx_idx" ON "jackpot_contributions" ("bet_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_wins_group_idx" ON "jackpot_wins" ("jackpot_group");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_wins_winner_idx" ON "jackpot_wins" ("winner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jackpot_wins_win_tx_idx" ON "jackpot_wins" ("win_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jackpots_group_idx" ON "jackpots" ("group");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_documents_submission_idx" ON "kyc_documents" ("submission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_documents_player_type_idx" ON "kyc_documents" ("player_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kyc_submissions_player_idx" ON "kyc_submissions" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_submissions_status_idx" ON "kyc_submissions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_type_idx" ON "loyalty_fund_transactions" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_operator_idx" ON "loyalty_fund_transactions" ("operator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_player_idx" ON "loyalty_fund_transactions" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "op_settlement_period_idx" ON "operator_settlements" ("operator_id","period_start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "op_switch_player_idx" ON "operator_switch_history" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "op_switch_time_idx" ON "operator_switch_history" ("switched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawals_player_idx" ON "withdrawals" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawals_status_idx" ON "withdrawals" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_tx_idx" ON "withdrawals" ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_logs_user_idx" ON "password_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_logs_actor_idx" ON "password_logs" ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_type_idx" ON "products" ("product_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_code_idx" ON "referral_codes" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_codes_owner_idx" ON "referral_codes" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_logs_invitor_date_idx" ON "affiliate_logs" ("created_at","invitor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_logs_child_idx" ON "affiliate_logs" ("child_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_logs_payout_idx" ON "affiliate_logs" ("payout_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_logs_bet_tx_idx" ON "affiliate_logs" ("bet_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payouts_week_idx" ON "affiliate_payouts" ("affiliate_id","week_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payouts_status_idx" ON "affiliate_payouts" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bonuses_name_idx" ON "bonuses" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commissions_level_idx" ON "commissions" ("level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_bonuses_player_bonus_idx" ON "player_bonuses" ("bonus_id","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_bonuses_status_idx" ON "player_bonuses" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_bonuses_expires_idx" ON "player_bonuses" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_cashbacks_player_period_idx" ON "vip_cashbacks" ("period_start","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_levelup_player_level_idx" ON "vip_level_up_bonuses" ("player_id","vip_level_achieved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_spin_rewards_player_idx" ON "vip_spin_rewards" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_category_idx" ON "games" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_operator_idx" ON "games" ("operator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games" ("status");
*/
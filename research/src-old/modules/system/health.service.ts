import { db } from "@/libs/database/db";
import { sql } from "drizzle-orm";
import { getDetailedBalance } from "../gameplay/balance-management.service";
import { getJackpotPools } from "../jackpots/jackpot.service";
import { getVIPLevels } from "../gameplay/vip.service";

/**
 * Health check for bet processing system
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  checks: Record<string, boolean>;
  responseTime: number;
}> {
  const startTime = Date.now();

  const checks = {
    database: await checkDatabaseConnection(),
    walletService: await checkWalletService(),
    jackpotService: await checkJackpotService(),
    vipService: await checkVIPService(),
  };

  const allHealthy = Object.values(checks).every((check) => check);

  return {
    healthy: allHealthy,
    checks,
    responseTime: Date.now() - startTime,
  };
}

/**
 * Individual health checks
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Test database connectivity with a simple query
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}
async function checkWalletService(): Promise<boolean> {
  try {
    const testUserId = "health-check-test-user";
    const userBalance = await getDetailedBalance(testUserId);
    if (!userBalance) {
      console.error(
        "User balance service check failed: No balance returned for test user (possible service or data issue)"
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "User balance service check failed: Exception during call -",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}
async function checkJackpotService(): Promise<boolean> {
  try {
    const pools = await getJackpotPools();
    if (!pools || typeof pools !== "object") {
      return false;
    }
    const requiredGroups = ["minor", "major", "mega"];
    for (const group of requiredGroups) {
      if (!pools[group as keyof typeof pools]) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("Jackpot service check failed:", error);
    return false;
  }
}

async function checkVIPService(): Promise<boolean> {
  try {
    const levels = getVIPLevels();
    if (!Array.isArray(levels) || levels.length === 0) {
      return false;
    }
    const hasBasicLevels =
      levels.some((level) => level.level === 1) &&
      levels.some((level) => level.level === 2);
    if (!hasBasicLevels) {
      return false;
    }
    return true;
  } catch (error) {
    console.error("VIP service check failed:", error);
    return false;
  }
}

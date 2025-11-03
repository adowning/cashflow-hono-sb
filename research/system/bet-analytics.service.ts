import { db } from "@/core/database/db";
import { transactionLogTable } from "@/core/database/schema";
import { sql } from "drizzle-orm";

/**
 * Get bet processing statistics from the last 24 hours.
 */
export async function getBetProcessingStats(): Promise<{
  totalBets: number;
  averageProcessingTime: number; // Calculated from actual logged processing_time data
  successRate: number;
  totalWagered: number;
  totalGGR: number;
}> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const results = await db
      .select({
        totalBets: sql`count(CASE WHEN type IN ('BET', 'BONUS') THEN 1 END)`, // Count wager transactionLogTable only
        successfulBets: sql`count(CASE WHEN type IN ('BET', 'BONUS') AND status = 'COMPLETED' THEN 1 END)`, // Completed wagers
        totalWagered: sql`coalesce(sum(CASE WHEN type IN ('BET', 'BONUS') THEN wager_amount ELSE 0 END), 0)`, // Sum wager amounts
        totalWon: sql`coalesce(sum(CASE WHEN type = 'WIN' THEN amount ELSE 0 END), 0)`, // Sum win amounts from WIN transactionLogTable
        averageProcessingTime: sql`coalesce(avg(CASE WHEN processing_time > 0 AND processing_time < 10000 THEN processing_time ELSE NULL END), 0)`, // Filter valid processing times (0-10s range)
      })
      .from(transactionLogTable)
      .where(sql`${transactionLogTable.createdAt} >= ${twentyFourHoursAgo}`);

    const stats = results[0];
    if (!stats) {
      return {
        totalBets: 0,
        averageProcessingTime: 0,
        successRate: 100,
        totalWagered: 0,
        totalGGR: 0,
      };
    }

    const totalBets = Number(stats.totalBets);
    const successfulBets = Number(stats.successfulBets);
    const totalWagered = Number(stats.totalWagered);
    const totalWon = Number(stats.totalWon);
    const averageProcessingTime = Number(stats.averageProcessingTime); // Now from DB

    const successRate =
      totalBets > 0 ? (successfulBets / totalBets) * 100 : 100;
    const totalGGR = totalWagered - totalWon;

    return {
      totalBets,
      averageProcessingTime,
      successRate,
      totalWagered,
      totalGGR,
    };
  } catch (error) {
    console.error("Failed to get bet processing stats:", error);
    return {
      totalBets: 0,
      averageProcessingTime: 0,
      successRate: 100,
      totalWagered: 0,
      totalGGR: 0,
    };
  }
}

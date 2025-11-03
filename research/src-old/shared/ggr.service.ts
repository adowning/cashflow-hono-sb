
/**
 * GGR and affiliate logging system for weekly commission calculations
 * Tracks Gross Gaming Revenue and calculates affiliate commissions
 */

export interface GGRContribution
{
  betId: string;
  userId: string;
  affiliateName?: string;
  operatorId: string;
  gameId: string;
  wagerAmount: number; // Amount in cents
  winAmount: number; // Amount in cents
  ggrAmount: number; // Wager - Win (can be negative)
  timestamp: Date;
  currency: string;
}

export interface WeeklyGGR
{
  affiliateId: string;
  weekStart: Date;
  weekEnd: Date;
  totalGGR: number;
  totalWagers: number;
  totalWins: number;
  commissionRate: number;
  commissionAmount: number;
  paidOut: boolean;
  payoutDate?: Date;
}

export interface AffiliateEarnings
{
  affiliateId: string;
  totalEarnings: number;
  paidEarnings: number;
  pendingEarnings: number;
  lastPayoutDate?: Date;
  nextPayoutDate?: Date;
}

/**
 * Log GGR contribution from a bet
 */
export async function logGGRContribution(
  contribution: Omit<GGRContribution, "ggrAmount" | "timestamp">
): Promise<{
  success: boolean;
  ggrAmount: number;
  error?: string;
}>
{
  try {
    const ggrAmount = contribution.wagerAmount - contribution.winAmount;

    const ggrLog: GGRContribution = {
      ...contribution,
      ggrAmount,
      timestamp: new Date(),
    };

    // In production, this would be stored in a ggr_contributions table
    // For now, logging to console and storing in affiliate logs if applicable

    // If user has an affiliate, log to affiliate logs for commission calculation
    if (contribution.affiliateName) {
      // await logAffiliateContribution(
      //   contribution.affiliateName,
      //   contribution,
      //   ggrAmount
      // );
    }

    return {
      success: true,
      ggrAmount,
    };
  } catch (error) {
    console.error("GGR logging failed:", error);
    return {
      success: false,
      ggrAmount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// /**
//  * Log contribution to affiliate for commission tracking
//  */
// async function logAffiliateContribution(
//   affliateName: string,
//   contribution: Omit<GGRContribution, "ggrAmount" | "timestamp">,
//   ggrAmount: number
// ): Promise<void> {
//   // Get affiliate info
//   const affiliate = await db.query.players.findFirst({
//     where: and(
//       eq(players.playername, affliateName),
//       eq(players.isAffiliate, true)
//     ),
//   });

//   if (!affiliate) {
//     console.error(`Affiliate ${affliateName} not found`);
//     return;
//   }

//   // Create affiliate log entry for commission calculation
//   // This would typically go into an affiliate_earnings or similar table
//   // console.log(
//   //   `Affiliate contribution logged: Affiliate ${affiliate.playername}, GGR: ${ggrAmount}`
//   // );
//   const commissionrate = await getAffiliateCommissionRate(affiliate.id);
//   // In production, you'd insert into affiliate_logs or a dedicated earnings table
//   await db.insert(affiliateLogs).values({
//     id: nanoid(),
//     invitorId: affiliate.id,
//     childId: contribution.userId,
//     referralCode: affiliate.referralCode,
//     betAmount: contribution.wagerAmount,
//     ggrAmount: ggrAmount,
//     commissionRate: commissionrate,
//     commissionAmount: Math.floor(ggrAmount * commissionrate),
//     tier: 0, // Direct referral (tier 0)
//   });
// }

// /**
//  * Calculate weekly GGR for affiliate commission
//  */
// export async function calculateWeeklyAffiliateCommision(
//   affiliateId: string,
//   weekStart?: Date
// ): Promise<WeeklyGGR | null> {
//   try {
//     // Calculate week boundaries
//     const now = new Date();
//     const startOfWeek = weekStart || getStartOfWeek(now);
//     const endOfWeek = getEndOfWeek(startOfWeek);

//     // Get affiliate info
//     const affiliate = await db.query.players.findFirst({
//       where: eq(players.id, affiliateId),
//     });

//     if (!affiliate) {
//       return null;
//     }

//     // In production, this would query a ggr_contributions table
//     // For now, using a simplified calculation based on affiliate logs
//     const affiliateContributions = await db.query.affiliateLogs.findMany({
//       where: and(
//         eq(affiliateLogs.invitorId, affiliateId),
//         gte(affiliateLogs.createdAt, startOfWeek),
//         lte(affiliateLogs.createdAt, endOfWeek)
//       ),
//     });

//     // Calculate totals
//     const totalWagers = affiliateContributions.reduce(
//       (sum, log) => sum + Number(log.betAmount),
//       0
//     );
//     const totalCommissionWagers = affiliateContributions.reduce(
//       (sum, log) => sum + Number(log.commissionWager),
//       0
//     );
//     const totalReferralAmount = affiliateContributions.reduce(
//       (sum, log) => sum + Number(log.referralAmount),
//       0
//     );

//     // GGR = Total Wagers - Total Wins - Bonuses/Promo Costs
//     // For simplicity, using commission wager as the GGR contribution
//     const totalGGR = totalCommissionWagers;

//     // Get commission rate (should be configurable per affiliate)
//     const commissionRate = 0.05; // 5% default - should come from affiliate settings
//     const commissionAmount = Math.floor(totalGGR * commissionRate);

//     return {
//       affiliateId,
//       weekStart: startOfWeek,
//       weekEnd: endOfWeek,
//       totalGGR,
//       totalWagers,
//       totalWins: affiliateContributions.reduce(
//         (sum, log) => sum + Number(log.totalReferralAmount),
//         0
//       ),
//       commissionRate,
//       commissionAmount,
//       paidOut: false,
//     };
//   } catch (error) {
//     console.error("Weekly GGR calculation failed:", error);
//     return null;
//   }
// }

// /**
//  * Get affiliate earnings summary
//  */
// export async function getAffiliateEarnings(
//   affiliateId: string
// ): Promise<AffiliateEarnings | null> {
//   try {
//     const affiliate = await db.query.players.findFirst({
//       where: eq(players.id, affiliateId),
//     });

//     if (!affiliate) {
//       return null;
//     }

//     // Get all affiliate logs for earnings calculation
//     const affiliateContributions = await db.query.affiliateLogs.findMany({
//       where: eq(affiliateLogs.invitorId, affiliateId),
//     });

//     // Calculate totals
//     const totalCommissionAmount = affiliateContributions.reduce(
//       (sum, log) => sum + Number(log.commissionAmount),
//       0
//     );

//     // In production, you'd track which earnings have been paid
//     const paidEarnings = 0; // Placeholder
//     const pendingEarnings = totalCommissionAmount - paidEarnings;

//     return {
//       affiliateId,
//       totalEarnings: totalCommissionAmount,
//       paidEarnings,
//       pendingEarnings,
//       lastPayoutDate: undefined, // Would come from payout tracking
//       nextPayoutDate: getNextPayoutDate(),
//     };
//   } catch (error) {
//     console.error("Affiliate earnings calculation failed:", error);
//     return null;
//   }
// }

// /**
//  * Process weekly affiliate payouts
//  */
// export async function processWeeklyAffiliatePayouts(): Promise<{
//   success: boolean;
//   payoutsProcessed: number;
//   totalPayoutAmount: number;
//   error?: string;
// }> {
//   try {
//     // Get current week
//     const weekStart = getStartOfWeek(new Date());

//     // Get all affiliates
//     const affiliates = await db.query.players.findMany();

//     let payoutsProcessed = 0;
//     let totalPayoutAmount = 0;

//     for (const affiliate of affiliates) {
//       const weeklyGGR = await calculateWeeklyAffiliateCommision(
//         affiliate.id,
//         weekStart
//       );

//       if (weeklyGGR && weeklyGGR.commissionAmount > 0) {
//         // Process payout (in production, this would credit affiliate's account)
//         console.log(
//           `Processing payout for affiliate ${affiliate.playername}: $${weeklyGGR.commissionAmount / 100}`
//         );

//         // Mark as paid out
//         weeklyGGR.paidOut = true;
//         weeklyGGR.payoutDate = new Date();

//         payoutsProcessed++;
//         totalPayoutAmount += weeklyGGR.commissionAmount;
//       }
//     }

//     return {
//       success: true,
//       payoutsProcessed,
//       totalPayoutAmount,
//     };
//   } catch (error) {
//     console.error("Weekly affiliate payout processing failed:", error);
//     return {
//       success: false,
//       payoutsProcessed: 0,
//       totalPayoutAmount: 0,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

// /**
//  * Get GGR statistics for reporting
//  */
// export async function getGGRStatistics(
//   startDate?: Date,
//   endDate?: Date
// ): Promise<{
//   totalGGR: number;
//   totalWagers: number;
//   totalWins: number;
//   averageGGR: number;
//   affiliateContributions: number;
//   period: {
//     start: Date;
//     end: Date;
//   };
// }> {
//   const periodStart = startDate || getStartOfWeek(new Date());
//   const periodEnd = endDate || getEndOfWeek(periodStart);

//   // In production, this would query actual GGR data
//   // For now, using affiliate logs as proxy
//   const affiliateContributions = await db.query.affiliateLogs.findMany({
//     where: and(
//       gte(affiliateLogs.createdAt, periodStart),
//       lte(affiliateLogs.createdAt, periodEnd)
//     ),
//   });

//   const totalWagers = affiliateContributions.reduce(
//     (sum, log) => sum + Number(log.betAmount),
//     0
//   );
//   const totalWins = affiliateContributions.reduce(
//     (sum, log) => sum + Number(log.totalReferralAmount),
//     0
//   );
//   const totalGGR = affiliateContributions.reduce(
//     (sum, log) => sum + Number(log.commissionWager),
//     0
//   );

//   const averageGGR =
//     affiliateContributions.length > 0
//       ? totalGGR / affiliateContributions.length
//       : 0;

//   return {
//     totalGGR,
//     totalWagers,
//     totalWins,
//     averageGGR,
//     affiliateContributions: affiliateContributions.length,
//     period: {
//       start: periodStart,
//       end: periodEnd,
//     },
//   };
// }

// /**
//  * Get affiliate performance metrics
//  */
// export async function getAffiliatePerformance(
//   affiliateId: string,
//   days: number = 30
// ): Promise<{
//   affiliateId: string;
//   periodDays: number;
//   totalReferrals: number;
//   activeReferrals: number;
//   totalGGR: number;
//   totalCommissions: number;
//   averageCommissionPerReferral: number;
// }> {
//   const periodStart = new Date();
//   periodStart.setDate(periodStart.getDate() - days);

//   // Get affiliate logs for the period
//   const affiliateContributions = await db.query.affiliateLogs.findMany({
//     where: and(
//       eq(affiliateLogs.invitorId, affiliateId),
//       gte(affiliateLogs.createdAt, periodStart)
//     ),
//   });

//   // Count unique referrals
//   const uniqueReferrals = new Set(
//     affiliateContributions.map((log) => log.childId)
//   );
//   const totalReferrals = uniqueReferrals.size;

//   // Count active referrals (those with recent activity)
//   const activeReferrals = affiliateContributions.filter(
//     (log) => Number(log.betAmount) > 0
//   ).length;

//   const totalGGR = affiliateContributions.reduce(
//     (sum, log) => sum + Number(log.commissionWager),
//     0
//   );
//   const totalCommissions = affiliateContributions.reduce(
//     (sum, log) => sum + Number(log.commissionAmount),
//     0
//   );
//   const averageCommissionPerReferral =
//     totalReferrals > 0 ? totalCommissions / totalReferrals : 0;

//   return {
//     affiliateId,
//     periodDays: days,
//     totalReferrals,
//     activeReferrals,
//     totalGGR,
//     totalCommissions,
//     averageCommissionPerReferral,
//   };
// }

// /**
//  * Helper function to get start of week (Monday)
//  */
// function getStartOfWeek(date: Date): Date {
//   const d = new Date(date);
//   const day = d.getDay();
//   const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
//   return new Date(d.setDate(diff));
// }

// /**
//  * Helper function to get end of week (Sunday)
//  */
// function getEndOfWeek(startOfWeek: Date): Date {
//   const endOfWeek = new Date(startOfWeek);
//   endOfWeek.setDate(startOfWeek.getDate() + 6);
//   endOfWeek.setHours(23, 59, 59, 999);
//   return endOfWeek;
// }

// /**
//  * Helper function to get next payout date (every Monday)
//  */
// function getNextPayoutDate(): Date {
//   const nextMonday = getStartOfWeek(new Date());
//   nextMonday.setDate(nextMonday.getDate() + 7); // Next Monday
//   return nextMonday;
// }

// /**
//  * Get GGR contribution for a specific bet
//  */
// export function calculateBetGGR(
//   wagerAmount: number,
//   winAmount: number
// ): number {
//   return wagerAmount - winAmount;
// }

// /**
//  * Get affiliate commission rate (should be configurable per affiliate)
//  */
// /**
//  * Dynamically fetches commission rates from the database.
//  * @returns {Promise<number[]>} An array of commission rates for Tier 0, Tier 1, etc.
//  */
// async function getAffiliateCommissionRate(currentAffiliateId): Promise<number> {
//   // Fetch the first available setting and its related commission configuration.
//   const settings = configurationManager.getConfiguration();

//   if (!settings.referralCommissionRate) {
//     console.error(
//       "⚠️ Commission rates are not configured in the database. No commissions will be processed."
//     );
//     return 0; //[]; // Return an empty array if no settings are found
//   }

//   // The rates are stored as percentages (e.g., 30 for 30%), so divide by 100.

//   // The order determines the tier: master -> Tier 0, affiliate -> Tier 1, etc.
//   const rates = settings.rates;

//   const commissionRates = [rates.master, rates.affiliate, rates.subaffiliate];
//   try {
//     // const commissionRates = await getCommissionRates();
//     // if (commissionRates.length === 0) {
//     //     return; // Stop if no commission rates are configured
//     // }

//     // let currentAffiliateId: string | null = contribution.affiliateId;
//     let tier = 0;
//     // Traverse up the affiliate hierarchy as long as there is a parent and a defined rate for the tier
//     let commissionRate = 0;
//     while (currentAffiliateId && tier < commissionRates.length) {
//       const affiliate = await db.query.players.findFirst({
//         where: eq(players.id, currentAffiliateId),
//       });

//       if (!affiliate) {
//         break; // Stop if the affiliate chain is broken
//       }

//       commissionRate = commissionRates[tier];
//       // const commissionAmount = Math.floor(ggrAmount * commissionRate);

//       // if (commissionAmount > 0) {
//       //     await db.insert(affiliateLogs).values({
//       //         id: `log_${crypto.randomUUID()}`,
//       //         invitorId: affiliate.id,
//       //         childId: contribution.userId,
//       //         referralCode: affiliate.referralCode,
//       //         currency: contribution.currency,
//       //         betAmount: contribution.wagerAmount,
//       //         commissionAmount: commissionAmount,
//       //         commissionWager: ggrAmount,
//       //         tier: tier,
//       //         createdAt: new Date(),
//       //         updatedAt: new Date(),
//       //     });
//       // }

//       // // Move to the parent affiliate for the next tier
//       // currentAffiliateId = affiliate.parentId;
//       tier++;
//     }
//     return commissionRate;
//   } catch (error) {
//     console.error("Failed to process affiliate commissions:", error);
//     return 0;
//   }
// }

// export const getReferralCodes = async (userId: string) => {
//   return await db
//     .select({
//       id: referralCodes.id,
//       code: referralCodes.code,
//       name: referralCodes.name,
//       commissionRate: referralCodes.commissionRate,
//       userId: referralCodes.userId,
//       createdAt: referralCodes.createdAt,
//       updatedAt: referralCodes.updatedAt,
//     })
//     .from(referralCodes)
//     .where(eq(referralCodes.userId, userId))
//     .leftJoin(users, eq(referralCodes.code, users.inviteCode))
//     .groupBy(referralCodes.id)
//     .orderBy(desc(referralCodes.createdAt))
//     .then((results) => {
//       return results.map((result) => ({
//         ...result,
//         referralCount: 0, // We'll compute this dynamically since user.inviteCode might not be indexed properly
//       }));
//     });
// };

// export const createReferralCode = async (data: {
//   name: string;
//   code: string;
//   userId: string;
//   commissionRate: number;
// }) => {
//   const result = await db
//     .insert(referralCodes)
//     .values({
//       id: nanoid(),
//       name: data.name,
//       code: data.code,
//       userId: data.userId,
//       commissionRate: data.commissionRate,
//       updatedAt: new Date(),
//     })
//     .returning();

//   return result[0];
// };

// export const getReferralCodeById = async (id: string) => {
//   return await db.query.referralCodes.findFirst({
//     where: eq(referralCodes.id, id),
//   });
// };

// export const getReferralCodeByCode = async (code: string) => {
//   return await db.query.referralCodes.findFirst({
//     where: eq(referralCodes.code, code),
//   });
// };

// export const deleteReferralCodeById = async (id: string) => {
//   const result = await db
//     .delete(referralCodes)
//     .where(eq(referralCodes.id, id))
//     .returning();
//   return result.length > 0;
// };

// export const getReferralCodesCount = async (userId: string) => {
//   const result = await db
//     .select({ value: count() })
//     .from(referralCodes)
//     .where(eq(referralCodes.userId, userId));
//   return result[0]?.value || 0;
// };

// // Helper function to get user by invitorId (used for friend count)
// export const getUserByInvitorId = async (invitorId: string) => {
//   return await db.query.user.findMany({
//     where: eq(users.invitorId, invitorId),
//   });
// };

// export const getAffiliateByReferralCode = async (referralCode: string) => {
//   return await db.query.players.findFirst({
//     where: eq(players.referralCode, referralCode),
//   });
// };

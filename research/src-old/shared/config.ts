import type { PlatformSetting } from "@/libs/database/schema";
import { dashboardConfig } from "./dashboard";

/**
 * Mock Configuration Manager
 * Provides default settings since the real one wasn't provided.
 */
class ConfigurationManager
{
  private settings: PlatformSetting;

  constructor()
  {
    // Load default settings
    this.settings = {
      id: "00e78117-692f-45df-958f-10a5855141d5",
      name: "Default Settings",
      default: true,
      referralCodeCount: 5,
      depositWrMultiplier: 1, // 1x deposit wagering
      bonusWrMultiplier: 30, // 30x bonus wagering
      freeSpinWrMultiplier: 30, // 30x free spin win wagering
      avgFreeSpinWinValue: 15, // 15 cents avg free spin win
      referralCommissionRate: 0.1,
      rates: { master: 0.1, affiliate: 0.7, subaffiliate: 0.3 },
      commission: { master: 0.3, affiliate: 0.2, subAffiliate: 0.1 },
      jackpotConfig: {
        minor: { rate: 0.01, seedAmount: 1000, maxAmount: 10000 },
        major: { rate: 0.005, seedAmount: 10000, maxAmount: 100000 },
        mega: { rate: 0.001, seedAmount: 100000, maxAmount: 1000000 },
      },
      vipConfig: {
        pointsPerDollar: 1,
        levelMultipliers: {},
        costSharingPercentage: 0,
        vipLevels: [],
        vipRanks: [],
      },
      wageringConfig: {
        defaultWageringMultiplier: 30,
        maxBonusBetPercentage: 0.1,
        bonusExpiryDays: 30,
      },
      systemLimits: {
        maxBetAmount: 100000,
        maxDailyLoss: 1000000,
        maxSessionLoss: 500000,
        minBetAmount: 10,
      },
      dashboard: dashboardConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  getConfiguration(): PlatformSetting
  {
    // In a real app, this might fetch from DB or cache
    return this.settings;
  }
}

export const configurationManager = new ConfigurationManager();

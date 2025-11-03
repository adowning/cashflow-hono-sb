import {
  addXpToUser,
  calculateXpForWagerAndWins,
} from "../../../modules/vip/vip.service";

export async function onBetCompleted(payload: any): Promise<number> {
  const { userId, wagerAmount } = payload;
  const vipCalculation = calculateXpForWagerAndWins(wagerAmount);
  try {
    await addXpToUser(userId, vipCalculation.totalPoints);
    return vipCalculation.totalPoints;
  } catch (error) {
    console.error("VIP update failed, continuing:", error);
    return 0;
  }
}

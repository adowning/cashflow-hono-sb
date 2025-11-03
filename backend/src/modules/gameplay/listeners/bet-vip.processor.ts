import { addXpToUser, calculateXpForWagerAndWins } from "../../../modules/vip/vip.service";
import { gameplayLogger, type LogContext } from "../gameplay-logging.service";

export async function onBetCompleted(payload: any): Promise<number> {
	const { userId, wagerAmount } = payload;
	const vipCalculation = calculateXpForWagerAndWins(wagerAmount);
	try {
		await addXpToUser(userId, vipCalculation.totalPoints);
		return vipCalculation.totalPoints;
	} catch (error) {
		gameplayLogger.error("VIP update failed, continuing:", error as LogContext);
		return 0;
	}
}

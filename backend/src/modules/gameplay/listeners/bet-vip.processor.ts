import { addXpToUser, calculateXpForWagerAndWins } from "../../../modules/vip/vip.service";
import { appLogger, createOperationContext, type LogContext } from "@/core/logger/app-logger";

export async function onBetCompleted(payload: any): Promise<number> {
	const { userId, wagerAmount } = payload;
	const vipCalculation = calculateXpForWagerAndWins(wagerAmount);
	try {
		await addXpToUser(userId, vipCalculation.totalPoints);
		return vipCalculation.totalPoints;
	} catch (error) {
		const context = createOperationContext({ domain: "vip", operation: "onBetCompleted", userId });
		appLogger.error("VIP update failed, continuing:", context, error as Error);
		return 0;
	}
}

import { processJackpotContribution } from "../../jackpots/jackpot.service";
import { appLogger, createOperationContext, type LogContext } from "@/core/logger/app-logger";

export async function onBetCompleted(payload: any): Promise<number> {
	const { gameId, wagerAmount, userId } = payload.betRequest;
	const context = createOperationContext({ domain: "jackpot", operation: "onBetCompleted", gameId, userId });
	try {
		const result = await processJackpotContribution(gameId, wagerAmount);
		return result.totalContribution;
	} catch (error) {
		appLogger.error("Jackpot contribution failed, continuing with zero contribution:", context, error as Error);
		return 0;
	}
}

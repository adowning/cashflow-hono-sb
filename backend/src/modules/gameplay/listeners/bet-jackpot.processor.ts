import { processJackpotContribution } from "../../jackpots/jackpot.service";
import { gameplayLogger, type LogContext } from "../gameplay-logging.service";

export async function onBetCompleted(payload: any): Promise<number> {
	const { gameId, wagerAmount } = payload.betRequest;
	try {
		const result = await processJackpotContribution(gameId, wagerAmount);
		return result.totalContribution;
	} catch (error) {
		gameplayLogger.error("Jackpot contribution failed, continuing with zero contribution:", error as LogContext);
		return 0;
	}
}

import { processJackpotContribution } from "../../jackpots/jackpot.service";

export async function onBetCompleted(payload: any): Promise<number> {
  const { gameId, wagerAmount } = payload.betRequest;
  try {
    const result = await processJackpotContribution(gameId, wagerAmount);
    return result.totalContribution;
  } catch (error) {
    console.error(
      "Jackpot contribution failed, continuing with zero contribution:",
      error
    );
    return 0;
  }
}

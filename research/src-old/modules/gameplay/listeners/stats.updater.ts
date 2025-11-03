import { findFirstGameNative, updateGameNative } from "@/libs/database/db";

export async function onBetCompleted(payload: any) {
  const { gameId, userId, wagerAmount, winAmount } = payload;
  try {
    const game = await findFirstGameNative(gameId);
    if (!game) {
      console.warn(`Game ${gameId} not found for statistics update.`);
      return;
    }

    let currentPlayers: string[] = [];
    try {
      if (game.distinctPlayers !== null && game.distinctPlayers !== undefined) {
        const parsedPlayers = Array.isArray(game.distinctPlayers)
          ? game.distinctPlayers
          : JSON.parse(JSON.stringify(game.distinctPlayers));
        currentPlayers = Array.isArray(parsedPlayers) ? parsedPlayers.filter(p => typeof p === 'string') : [];
      }
    } catch (error) {
      console.warn('Failed to parse distinctPlayers, using empty array:', error);
      currentPlayers = [];
    }

    const isNewPlayer = !currentPlayers.includes(userId);
    const newPlayersList = isNewPlayer ? [...currentPlayers, userId] : currentPlayers;

    const newTotalBets = (game.totalBets || 0) + 1;
    const newTotalWins = (game.totalWins || 0) + (winAmount > 0 ? 1 : 0);
    const newHitPercentage = newTotalBets > 0 ? (newTotalWins / newTotalBets) * 100 : 0;

    const newTotalBetAmount = (game.totalBetAmount || 0) + wagerAmount;
    const newTotalWonAmount = (game.totalWonAmount || 0) + winAmount;
    const newCurrentRtp = newTotalBetAmount > 0 ? (newTotalWonAmount / newTotalBetAmount) * 100 : 0;

    let totalMinutesPlayed: number;
    if (game.startedAt) {
      const startedAt = new Date(game.startedAt);
      const now = new Date();
      const timeDiffMs = now.getTime() - startedAt.getTime();
      totalMinutesPlayed = Math.max(0, Math.floor(timeDiffMs / (1000 * 60)));
      if (timeDiffMs < 0) {
        console.warn(`[totalMinutesPlayed] Game ${gameId} has startedAt in the future: ${startedAt.toISOString()}`);
      }
    } else {
      console.warn(`[totalMinutesPlayed] Game ${gameId} has null startedAt, using createdAt as fallback`);
      const fallbackStartedAt = game.createdAt ? new Date(game.createdAt) : new Date();
      const now = new Date();
      const timeDiffMs = now.getTime() - fallbackStartedAt.getTime();
      totalMinutesPlayed = Math.max(0, Math.floor(timeDiffMs / (1000 * 60)));
    }

    await updateGameNative(gameId, {
      totalBets: newTotalBets,
      totalWins: newTotalWins,
      hitPercentage: newHitPercentage,
      distinctPlayers: newPlayersList,
      totalPlayers: newPlayersList.length,
      totalBetAmount: newTotalBetAmount,
      totalWonAmount: newTotalWonAmount,
      currentRtp: newCurrentRtp,
      totalMinutesPlayed: totalMinutesPlayed,
    });
  } catch (error) {
    console.error(`Failed to update game ${gameId} statistics:`, error);
  }
}

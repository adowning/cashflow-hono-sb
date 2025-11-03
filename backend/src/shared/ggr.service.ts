/**
 * GGR (Gross Gaming Revenue) Service
 * Handles GGR calculations and logging
 */

import { logger } from "./logger";

export async function logGGRContribution(
	gameId: string,
	totalBetAmount: number,
	totalWonAmount: number,
	userId: string,
): Promise<void> {
	const ggr = totalBetAmount - totalWonAmount;

	try {
		// Log GGR contribution to analytics system
		logger.info({
			msg: "GGR contribution logged",
			gameId,
			userId,
			ggr,
			totalBetAmount,
			totalWonAmount,
		});

		// Here you would typically store this in a database or send to analytics
		// For now, just logging it
	} catch (error) {
		logger.error({
			msg: "Failed to log GGR contribution",
			error: error instanceof Error ? error.message : error,
			gameId,
			userId,
			ggr,
		});
		throw error;
	}
}

export interface GGRMetrics {
	totalBets: number;
	totalWins: number;
	ggr: number;
	timestamp: Date;
}

export function calculateGGR(totalBets: number, totalWins: number): number {
	return totalBets - totalWins;
}

export function calculateGGRPercentage(totalBets: number, totalWins: number): number {
	if (totalBets === 0) return 0;
	return ((totalBets - totalWins) / totalBets) * 100;
}

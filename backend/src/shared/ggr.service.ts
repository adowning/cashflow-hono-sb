/**
 * GGR (Gross Gaming Revenue) Service
 * Handles GGR calculations and logging
 */

import { appLogger, createOperationContext } from "@/core/logger/app-logger";

export async function logGGRContribution(
	gameId: string,
	totalBetAmount: number,
	totalWonAmount: number,
	userId: string,
): Promise<void> {
	const ggr = totalBetAmount - totalWonAmount;
  const context = createOperationContext({
    domain: 'ggr',
    operation: 'logGGRContribution',
    userId,
    gameId,
  });

	try {
		// Log GGR contribution to analytics system
		appLogger.info("GGR contribution logged", context, {
			ggr,
			totalBetAmount,
			totalWonAmount,
		});

		// Here you would typically store this in a database or send to analytics
		// For now, just logging it
	} catch (error) {
		appLogger.error("Failed to log GGR contribution", context, error as Error, {
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

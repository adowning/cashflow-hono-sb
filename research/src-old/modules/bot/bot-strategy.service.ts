// src/modules/gameplay/bot-strategy.service.ts

/**
 * Bot Strategy Service
 * Handles all decision-making logic for a bot, such as wager calculation,
 * game simulation, and game-changing decisions.
 */
import { db } from "@/libs/database/db";
import { gameTable, type Game } from "@/libs/database/schema";
import { configurationManager } from "@/shared/config";
import { eq } from "drizzle-orm";
import type { BalanceResult, BotConfig, RTPConfig } from "./bot.service";
import { GameOutcome } from "./core-bet.service";

/**
 * Get game limits for the current game
 */
export async function getGameLimits(
    gameId: string,
    botConfig: BotConfig
): Promise<{ minBet: number; maxBet: number }>
{
    if (!gameId) {
        throw new Error("No game selected");
    }

    try {
        const game = await db.query.gameTable.findFirst({
            where: eq(gameTable.id, gameId),
        });

        if (!game) {
            throw new Error(`Game not found: ${gameId}`);
        }

        const settings = configurationManager.getConfiguration();
        const systemLimits = settings.systemLimits as any;

        // Use game limits with fallback to bot config, then system config
        const minBet =
            game.minBet ?? botConfig.minWager ?? systemLimits?.minBetAmount ?? 100;
        const maxBet =
            game.maxBet ?? botConfig.maxWager ?? systemLimits?.maxBetAmount ?? 100000;

        return { minBet, maxBet };
    } catch (error) {
        console.error("Error getting game limits:", error);
        // Fallback to bot config
        return {
            minBet: botConfig.minWager,
            maxBet: botConfig.maxWager,
        };
    }
}

/**
 * Calculates a random wager amount based on game, config, and balance.
 */
export function getWager(
    botConfig: BotConfig,
    game: Game,
    balance: BalanceResult,
    gameLimits: { minBet: number; maxBet: number }
): number
{
    let validBets: number[] = [];
    if (game?.goldsvetData?.bet) {
        // Parse betting denominations from the bet string
        const betStrings = (game.goldsvetData.bet as string)
            .split(",")
            .map((betStr: string) => parseFloat(betStr.trim()));

        // Convert dollar values to cents format
        validBets = betStrings
            .map((betValue: number) => Math.round(betValue * 100))
            .filter((betInCents: number) => betInCents > 0);

        if (validBets.length < 2) {
            validBets = gameLimits.minBet ? [gameLimits.minBet] : [];
            if (gameLimits.maxBet) validBets.push(gameLimits.maxBet);
            for (let x = gameLimits.minBet; x <= gameLimits.maxBet; x++) {
                validBets.push(x);
            }
        }
    }

    let wagerAmount: number;

    if (validBets.length > 0) {
        // Game has specific denominations
        const validDenominationBets = validBets.filter((bet) =>
        {
            const passesMin = bet >= gameLimits.minBet;
            const passesMax = bet <= gameLimits.maxBet;
            const passesBalance = bet <= balance.totalBalance;
            return passesMin && passesMax && passesBalance;
        });

        if (validDenominationBets.length === 0) {
            // No valid denominations fit our criteria, use fallback
            wagerAmount = getCalculatedWager(botConfig, balance, gameLimits);
        } else {
            // Randomly select from valid denomination bets
            const randomIndex = Math.floor(Math.random() * validDenominationBets.length);
            wagerAmount = validDenominationBets[randomIndex]!;
        }
    } else {
        // Game has no specific denominations, use fallback calculation
        wagerAmount = getCalculatedWager(botConfig, balance, gameLimits);
    }

    // Final safety check: Ensure wager doesn't exceed bot's maxWager config
    if (wagerAmount > botConfig.maxWager) {
        wagerAmount = botConfig.maxWager;
    }

    // Final safety check: Ensure wager is at least minBet
    if (wagerAmount < gameLimits.minBet) {
        wagerAmount = gameLimits.minBet;
    }

    return wagerAmount;
}

/**
 * Fallback wager calculation
 */
function getCalculatedWager(
    botConfig: BotConfig,
    balance: BalanceResult,
    gameLimits: { minBet: number; maxBet: number }
): number
{
    // Respect the *game's* max bet and the *player's* balance
    const effectiveMaxGameBet = Math.min(
        gameLimits.maxBet,
        balance.totalBalance
    );

    // Respect the *bot's* configured max wager
    const effectiveMaxBotBet = Math.min(
        effectiveMaxGameBet,
        botConfig.maxWager
    );

    // Add randomness (e.g., bet between 70% and 100% of the max allowed)
    const randomizedMaxWager =
        effectiveMaxBotBet * (0.7 + Math.random() * 0.3);

    // Ensure the final wager is at least the minimum allowed
    const gameMinWager = Math.max(gameLimits.minBet, botConfig.minWager);
    return Math.max(gameMinWager, Math.floor(randomizedMaxWager));
}

/**
 * Simulates a game outcome based on a target RTP.
 */
export function getGameOutcome(
    wagerAmount: number,
    rtpConfig: RTPConfig
): GameOutcome
{
    // Adjust probabilities to match target RTP
    const adjustedConfig = adjustProbabilitiesForRTP(rtpConfig);
    const rand = Math.random();
    let winAmount = 0;

    const {
        lossProbability,
        smallWinProbability,
        mediumWinProbability,
        largeWinProbability,
        smallWinMultiplier,
        mediumWinMultiplier,
        largeWinMultiplier,
        jackpotMultiplier,
    } = adjustedConfig;

    // Define cumulative probabilities for each win tier
    const lossThreshold = lossProbability;
    const smallWinThreshold = lossThreshold + smallWinProbability;
    const mediumWinThreshold = smallWinThreshold + mediumWinProbability;
    const largeWinThreshold = mediumWinThreshold + largeWinProbability;
    // Jackpot threshold = 1.0 (remaining probability)

    if (rand < lossThreshold) {
        // Loss
        winAmount = 0;
    } else if (rand < smallWinThreshold) {
        // Small win
        const winFactor =
            smallWinMultiplier.min +
            Math.random() * (smallWinMultiplier.max - smallWinMultiplier.min);
        winAmount = Math.floor(wagerAmount * winFactor);
    } else if (rand < mediumWinThreshold) {
        // Medium win
        const winFactor =
            mediumWinMultiplier.min +
            Math.random() * (mediumWinMultiplier.max - mediumWinMultiplier.min);
        winAmount = Math.floor(wagerAmount * winFactor);
    } else if (rand < largeWinThreshold) {
        // Large win
        const winFactor =
            largeWinMultiplier.min +
            Math.random() * (largeWinMultiplier.max - largeWinMultiplier.min);
        winAmount = Math.floor(wagerAmount * winFactor);
    } else {
        // Jackpot win
        const winFactor =
            jackpotMultiplier.min +
            Math.random() * (jackpotMultiplier.max - jackpotMultiplier.min);
        winAmount = Math.floor(wagerAmount * winFactor);
    }

    return {
        winAmount,
        gameData: {
            // ... (you can keep the detailed gameData simulation here if needed)
        },
    };
}

/**
 * Decides if the bot should change its current game.
 */
export function shouldChangeGame(): boolean
{
    return Math.random() < 0.1; // 10% chance
}

/**
 * Calculate expected RTP based on current RTP configuration
 */
function calculateExpectedRTP(rtpConfig: RTPConfig): number
{
    const {
        lossProbability,
        smallWinProbability,
        mediumWinProbability,
        largeWinProbability,
        jackpotProbability,
        smallWinMultiplier,
        mediumWinMultiplier,
        largeWinMultiplier,
        jackpotMultiplier,
    } = rtpConfig;

    // Calculate average multipliers for each win tier
    const avgSmallWin = (smallWinMultiplier.min + smallWinMultiplier.max) / 2;
    const avgMediumWin = (mediumWinMultiplier.min + mediumWinMultiplier.max) / 2;
    const avgLargeWin = (largeWinMultiplier.min + largeWinMultiplier.max) / 2;
    const avgJackpotWin = (jackpotMultiplier.min + jackpotMultiplier.max) / 2;

    // Expected value = Σ(probability × payout)
    const expectedValue =
        lossProbability * 0 + // Loss contributes 0 to RTP
        smallWinProbability * avgSmallWin +
        mediumWinProbability * avgMediumWin +
        largeWinProbability * avgLargeWin +
        jackpotProbability * avgJackpotWin;

    return expectedValue * 100; // Convert to percentage
}

/**
 * Adjust probabilities to achieve target RTP
 */
function adjustProbabilitiesForRTP(rtpConfig: RTPConfig): RTPConfig
{
    const currentRTP = calculateExpectedRTP(rtpConfig);
    const targetRTP = rtpConfig.targetRTP;

    if (Math.abs(currentRTP - targetRTP) < 0.1) {
        return rtpConfig;
    }

    const adjusted = { ...rtpConfig };
    const rtpDifference = currentRTP - targetRTP;
    const adjustment = Math.min(Math.abs(rtpDifference) * 0.1, 0.05);

    if (rtpDifference > 0) {
        adjusted.lossProbability = Math.min(0.95, adjusted.lossProbability + adjustment);
    } else {
        adjusted.lossProbability = Math.max(0.50, adjusted.lossProbability - adjustment);
    }

    const remainingProbability = 1 - adjusted.lossProbability;
    const winProbabilities = [
        adjusted.smallWinProbability,
        adjusted.mediumWinProbability,
        adjusted.largeWinProbability,
        adjusted.jackpotProbability,
    ];

    const totalWinProb = winProbabilities.reduce((sum, prob) => sum + prob, 0);
    const scaleFactor = remainingProbability / totalWinProb;

    adjusted.smallWinProbability *= scaleFactor;
    adjusted.mediumWinProbability *= scaleFactor;
    adjusted.largeWinProbability *= scaleFactor;
    adjusted.jackpotProbability *= scaleFactor;

    return adjusted;
}
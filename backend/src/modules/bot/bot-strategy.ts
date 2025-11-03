/**
 * Bot Strategy Service
 * Handles all decision-making logic for a bot, such as wager calculation,
 * game simulation, and game-changing decisions.
 */
import { db } from "../../core/database/db";
import { gameTable, type Game } from "../../core/database/schema";
import { configurationManager } from "../../shared/config";
import { eq } from "drizzle-orm";
import type { BalanceResult, BotConfig, GameOutcome } from "./bot.service";

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
    if (game.goldsvetData && (game.goldsvetData as any).bet) {
        const betStrings = ((game.goldsvetData as any).bet as string)
            .split(",")
            .map((betStr: string) => parseFloat(betStr.trim()));

        validBets = betStrings
            .map((betValue: number) => Math.round(betValue * 100))
            .filter((betInCents: number) => betInCents > 0);
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
    return Math.max(gameLimits.minBet, Math.floor(randomizedMaxWager));
}

/**
 * Simulates a game outcome based on a target RTP (~85%).
 */
export function getGameOutcome(wagerAmount: number): GameOutcome
{
    const rand = Math.random();
    let winAmount = 0;

    // RTP Calculation: Weighted average should be ~0.85
    // 65% chance to lose (0.85x)
    // 20% chance to win 1.1x
    // 10% chance to win 1.5x
    // 4% chance to win 2x
    // 1% chance to win 5x

    if (rand < 0.65) {
        // Loss - win back 85% of wager (adds randomness to loss amounts)
        const lossFactor = 0.8 + Math.random() * 0.1; // Random between 0.8-0.9
        winAmount = Math.floor(wagerAmount * lossFactor);
    } else if (rand < 0.85) {
        // Small win - 1.1x payout
        const winFactor = 1.08 + Math.random() * 0.04; // Random between 1.08-1.12
        winAmount = Math.floor(wagerAmount * winFactor);
    } else if (rand < 0.95) {
        // Medium win - 1.5x payout
        const winFactor = 1.45 + Math.random() * 0.1; // Random between 1.45-1.55
        winAmount = Math.floor(wagerAmount * winFactor);
    } else if (rand < 0.99) {
        // Large win - 2x payout
        const winFactor = 1.95 + Math.random() * 0.1; // Random between 1.95-2.05
        winAmount = Math.floor(wagerAmount * winFactor);
    } else {
        // Jackpot win - 5x payout
        const winFactor = 4.8 + Math.random() * 0.4; // Random between 4.8-5.2
        winAmount = Math.floor(wagerAmount * winFactor);
    }

    return {
        winAmount,
        gameData: {},
    };
}

/**
 * Decides if the bot should change its current game.
 */
export function shouldChangeGame(): boolean
{
    return Math.random() < 0.1; // 10% chance
}
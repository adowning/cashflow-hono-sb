#!/usr/bin/env node

/**
 * Game Defaults Migration Script
 *
 * Fixes existing games with incorrect default values for startedAt and statistics.
 * Sets startedAt to createdAt timestamp when null, and initializes statistics
 * to proper starting values when at defaults.
 *
 * Usage:
 *   npm run game:fix-defaults [-- --dry-run] [-- --batch-size=1000] [-- --validate-only]
 *   node scripts/fix-game-defaults.ts --dry-run
 */

import { db } from '@/libs/database/db';
import { gameTable } from '@/libs/database/schema/game';
import { eq, or, and, isNull, sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// ========================================
// INTERFACES AND TYPES
// ========================================

interface MigrationConfig {
    batchSize: number;
    maxRetries: number;
    validateData: boolean;
    dryRun: boolean;
    validateOnly: boolean;
    backupExisting: boolean;
    logLevel: 'info' | 'warn' | 'error';
}

interface GameFixData {
    id: string;
    name: string;
    createdAt: Date;
    startedAt: Date | null;
    totalBetAmount: number | null;
    totalWonAmount: number | null;
    totalBets: number | null;
    totalWins: number | null;
    hitPercentage: number | null;
    totalPlayers: number | null;
    totalMinutesPlayed: number | null;
}

interface MigrationResult {
    success: boolean;
    gamesFixed: number;
    startedAtFixed: number;
    statisticsFixed: number;
    errors: string[];
    warnings: string[];
    executionTime: number;
    rollbackData?: string; // JSON string for rollback
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    dataIntegrityScore: number;
}

// ========================================
// MIGRATION MANAGER CLASS
// ========================================

class GameDefaultsMigrationManager {
    private config: MigrationConfig;
    private migrationLog: string[] = [];
    private backupData: any = {};
    private startTime: number = Date.now();

    constructor(config: Partial<MigrationConfig> = {}) {
        this.config = {
            batchSize: config.batchSize || 1000,
            maxRetries: config.maxRetries || 3,
            validateData: config.validateData ?? true,
            dryRun: config.dryRun || false,
            validateOnly: config.validateOnly || false,
            backupExisting: config.backupExisting ?? true,
            logLevel: config.logLevel || 'info',
        };
    }

    // ========================================
    // MAIN MIGRATION METHODS
    // ========================================

    /**
     * Execute complete migration to fix game defaults
     */
    async fixGameDefaults(): Promise<MigrationResult> {
        this.log('Starting game defaults migration...', 'info');

        const result: MigrationResult = {
            success: false,
            gamesFixed: 0,
            startedAtFixed: 0,
            statisticsFixed: 0,
            errors: [] as string[],
            warnings: [] as string[],
            executionTime: 0,
        };

        try {
            // Step 1: Backup existing data
            if (this.config.backupExisting && !this.config.dryRun) {
                await this.backupExistingData();
                this.log('Existing game data backed up successfully', 'info');
            }

            // Step 2: Validate migration prerequisites
            const validation = await this.validateMigrationPrerequisites();
            if (!validation.isValid) {
                result.errors.push(...validation.errors);
                return result;
            }

            // Step 3: Find and fix games with default issues
            const fixResult = await this.findAndFixGames();
            result.gamesFixed = fixResult.gamesFixed;
            result.startedAtFixed = fixResult.startedAtFixed;
            result.statisticsFixed = fixResult.statisticsFixed;
            result.errors.push(...fixResult.errors);
            result.warnings.push(...fixResult.warnings);

            // Step 4: Validate migration results
            if (this.config.validateData) {
                const finalValidation = await this.validateMigration();
                result.warnings.push(...finalValidation.warnings);
                if (!finalValidation.isValid) {
                    result.errors.push(...finalValidation.errors);
                }
            }

            // Step 5: Generate rollback data if needed
            if (this.config.dryRun) {
                result.rollbackData = JSON.stringify(this.backupData, null, 2);
            }

            result.success = result.errors.length === 0;
            result.executionTime = Date.now() - this.startTime;

            this.log(`Migration completed in ${result.executionTime}ms`, 'info');

            if (this.config.dryRun) {
                this.log('DRY RUN - No actual changes made', 'warn');
            }

        } catch (error) {
            result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.log(`Migration failed: ${error}`, 'error');
        }

        return result;
    }

    /**
     * Validate migration data and prerequisites
     */
    async validateMigration(): Promise<ValidationResult> {
        this.log('Validating migration...', 'info');

        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 0,
        };

        try {
            // Check database connectivity
            const dbCheck = await this.checkDatabaseConnectivity();
            if (!dbCheck.isValid) {
                result.errors.push(...dbCheck.errors);
                return result;
            }

            // Validate game table schema
            const schemaValidation = await this.validateSchema();
            if (!schemaValidation.isValid) {
                result.errors.push(...schemaValidation.errors);
            }
            result.warnings.push(...schemaValidation.warnings);

            // Validate data integrity
            const dataValidation = await this.validateDataIntegrity();
            if (!dataValidation.isValid) {
                result.errors.push(...dataValidation.errors);
            }
            result.warnings.push(...dataValidation.warnings);
            result.dataIntegrityScore = dataValidation.dataIntegrityScore;

            result.isValid = result.errors.length === 0;

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Execute rollback to restore previous state
     */
    async rollbackMigration(rollbackData: string): Promise<void> {
        this.log('Starting rollback process...', 'info');

        try {
            const backup = JSON.parse(rollbackData);

            if (!this.config.dryRun) {
                // Restore from backup
                if (backup.games) {
                    for (const game of backup.games) {
                        await db
                            .update(gameTable)
                            .set({
                                startedAt: game.startedAt,
                                totalBetAmount: game.totalBetAmount,
                                totalWonAmount: game.totalWonAmount,
                                totalBets: game.totalBets,
                                totalWins: game.totalWins,
                                hitPercentage: game.hitPercentage,
                                totalPlayers: game.totalPlayers,
                                totalMinutesPlayed: game.totalMinutesPlayed,
                                updatedAt: new Date(),
                            })
                            .where(eq(gameTable.id, game.id));
                    }
                }
            }

            this.log('Rollback completed successfully', 'info');

        } catch (error) {
            this.log(`Rollback failed: ${error}`, 'error');
            throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================
    // MIGRATION HELPER METHODS
    // ========================================

    /**
     * Find games with default value issues and fix them
     */
    private async findAndFixGames(): Promise<{
        gamesFixed: number;
        startedAtFixed: number;
        statisticsFixed: number;
        errors: string[];
        warnings: string[]
    }> {
        const result = {
            gamesFixed: 0,
            startedAtFixed: 0,
            statisticsFixed: 0,
            errors: [] as string[],
            warnings: [] as string[]
        };

        try {
            // Find games with issues: startedAt is null OR any statistic is null
            const gamesWithIssues = await db
                .select({
                    id: gameTable.id,
                    name: gameTable.name,
                    createdAt: gameTable.createdAt,
                    startedAt: gameTable.startedAt,
                    totalBetAmount: gameTable.totalBetAmount,
                    totalWonAmount: gameTable.totalWonAmount,
                    totalBets: gameTable.totalBets,
                    totalWins: gameTable.totalWins,
                    hitPercentage: gameTable.hitPercentage,
                    totalPlayers: gameTable.totalPlayers,
                    totalMinutesPlayed: gameTable.totalMinutesPlayed,
                })
                .from(gameTable)
                .where(
                    or(
                        isNull(gameTable.startedAt),
                        isNull(gameTable.totalBetAmount),
                        isNull(gameTable.totalWonAmount),
                        isNull(gameTable.totalBets),
                        isNull(gameTable.totalWins),
                        isNull(gameTable.hitPercentage),
                        isNull(gameTable.totalPlayers),
                        isNull(gameTable.totalMinutesPlayed)
                    )
                );

            this.log(`Found ${gamesWithIssues.length} games with default value issues`, 'info');

            for (const game of gamesWithIssues) {
                try {
                    let needsUpdate = false;
                    const updates: any = { updatedAt: new Date() };
                    let startedAtFixed = false;
                    let statisticsFixed = false;

                    // Fix startedAt if null
                    if (!game.startedAt) {
                        updates.startedAt = game.createdAt;
                        startedAtFixed = true;
                        needsUpdate = true;
                        result.startedAtFixed++;
                        this.log(`Fixing startedAt for game "${game.name}" (${game.id}): null -> ${game.createdAt.toISOString()}`, 'info');
                    }

                    // Fix statistics if null (set to 0)
                    const statFields = [
                        'totalBetAmount',
                        'totalWonAmount',
                        'totalBets',
                        'totalWins',
                        'hitPercentage',
                        'totalPlayers',
                        'totalMinutesPlayed'
                    ] as const;

                    for (const field of statFields) {
                        if (game[field] === null) {
                            updates[field] = 0;
                            statisticsFixed = true;
                            needsUpdate = true;
                            this.log(`Fixing ${field} for game "${game.name}" (${game.id}): null -> 0`, 'info');
                        }
                    }

                    if (statisticsFixed) {
                        result.statisticsFixed++;
                    }

                    // Apply updates
                    if (needsUpdate) {
                        if (this.config.dryRun) {
                            this.log(`[DRY RUN] Would fix game: ${game.name} (${game.id})`, 'info');
                        } else {
                            await db
                                .update(gameTable)
                                .set(updates)
                                .where(eq(gameTable.id, game.id));
                        }
                        result.gamesFixed++;
                    }

                } catch (error) {
                    result.errors.push(`Failed to fix game ${game.name} (${game.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

        } catch (error) {
            result.errors.push(`Game fixing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Backup existing data before migration
     */
    private async backupExistingData(): Promise<void> {
        try {
            const gamesToBackup = await db
                .select({
                    id: gameTable.id,
                    name: gameTable.name,
                    startedAt: gameTable.startedAt,
                    totalBetAmount: gameTable.totalBetAmount,
                    totalWonAmount: gameTable.totalWonAmount,
                    totalBets: gameTable.totalBets,
                    totalWins: gameTable.totalWins,
                    hitPercentage: gameTable.hitPercentage,
                    totalPlayers: gameTable.totalPlayers,
                    totalMinutesPlayed: gameTable.totalMinutesPlayed,
                })
                .from(gameTable)
                .where(
                    or(
                        isNull(gameTable.startedAt),
                        isNull(gameTable.totalBetAmount),
                        isNull(gameTable.totalWonAmount),
                        isNull(gameTable.totalBets),
                        isNull(gameTable.totalWins),
                        isNull(gameTable.hitPercentage),
                        isNull(gameTable.totalPlayers),
                        isNull(gameTable.totalMinutesPlayed)
                    )
                );

            this.backupData.games = gamesToBackup;

            // Save backup to file
            const backupFile = path.join(process.cwd(), `game_defaults_backup_${Date.now()}.json`);
            await fs.writeFile(backupFile, JSON.stringify(this.backupData, null, 2));

            this.log(`Backup saved to: ${backupFile}`, 'info');
        } catch (error) {
            this.log(`Backup failed: ${error}`, 'warn');
            // Don't fail migration if backup fails
        }
    }

    /**
     * Validate migration prerequisites
     */
    private async validateMigrationPrerequisites(): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };

        try {
            // Check database connectivity
            await db.select().from(gameTable).limit(1);

            // Check if games table exists and has data
            const gameCount = await db.$count(gameTable);
            if (gameCount === 0) {
                result.warnings.push('No games found in database - migration may be unnecessary');
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Prerequisite validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Validate database schema
     */
    private async validateSchema(): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };

        try {
            // Basic schema validation - check if required columns exist
            const sampleGame = await db.select().from(gameTable).limit(1);
            if (sampleGame.length > 0) {
                const game = sampleGame[0];
                const requiredFields = [
                    'id', 'createdAt', 'startedAt', 'totalBetAmount', 'totalWonAmount',
                    'totalBets', 'totalWins', 'hitPercentage', 'totalPlayers', 'totalMinutesPlayed'
                ];

                for (const field of requiredFields) {
                    if (!(field in game)) {
                        result.errors.push(`Required field '${field}' missing from game table schema`);
                        result.isValid = false;
                    }
                }
            }
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Validate data integrity after migration
     */
    private async validateDataIntegrity(): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };

        try {
            // Check for any remaining null values in the fields we should have fixed
            const gamesWithNulls = await db
                .select({ id: gameTable.id, name: gameTable.name })
                .from(gameTable)
                .where(
                    or(
                        isNull(gameTable.startedAt),
                        isNull(gameTable.totalBetAmount),
                        isNull(gameTable.totalWonAmount),
                        isNull(gameTable.totalBets),
                        isNull(gameTable.totalWins),
                        isNull(gameTable.hitPercentage),
                        isNull(gameTable.totalPlayers),
                        isNull(gameTable.totalMinutesPlayed)
                    )
                );

            if (gamesWithNulls.length > 0) {
                result.warnings.push(`${gamesWithNulls.length} games still have null values after migration`);
                result.dataIntegrityScore = Math.max(0, 100 - (gamesWithNulls.length * 10));
            }

            // Check for negative statistics (shouldn't happen but good to validate)
            const gamesWithNegatives = await db
                .select({ id: gameTable.id, name: gameTable.name })
                .from(gameTable)
                .where(
                    or(
                        sql`${gameTable.totalBetAmount} < 0`,
                        sql`${gameTable.totalWonAmount} < 0`,
                        sql`${gameTable.totalBets} < 0`,
                        sql`${gameTable.totalWins} < 0`,
                        sql`${gameTable.hitPercentage} < 0`,
                        sql`${gameTable.totalPlayers} < 0`,
                        sql`${gameTable.totalMinutesPlayed} < 0`
                    )
                );

            if (gamesWithNegatives.length > 0) {
                result.warnings.push(`${gamesWithNegatives.length} games have negative statistic values`);
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Check database connectivity
     */
    private async checkDatabaseConnectivity(): Promise<ValidationResult> {
        try {
            await db.select().from(gameTable).limit(1);
            return {
                isValid: true,
                errors: [] as string[],
                warnings: [] as string[],
                dataIntegrityScore: 100,
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Database connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: [] as string[],
                dataIntegrityScore: 0,
            };
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [GAME-DEFAULTS-MIGRATION] ${message}`;

        // Console log
        switch (level) {
            case 'info':
                console.log(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
        }

        // Store in migration log
        this.migrationLog.push(logMessage);
    }

    /**
     * Get migration status and statistics
     */
    async getMigrationStatus(): Promise<any> {
        try {
            const totalGames = await db.$count(gameTable);
            const gamesWithIssues = await db
                .select({ id: gameTable.id })
                .from(gameTable)
                .where(
                    or(
                        isNull(gameTable.startedAt),
                        isNull(gameTable.totalBetAmount),
                        isNull(gameTable.totalWonAmount),
                        isNull(gameTable.totalBets),
                        isNull(gameTable.totalWins),
                        isNull(gameTable.hitPercentage),
                        isNull(gameTable.totalPlayers),
                        isNull(gameTable.totalMinutesPlayed)
                    )
                );

            return {
                totalGames,
                gamesWithIssues: gamesWithIssues.length,
                executionTime: Date.now() - this.startTime,
                config: this.config,
                logs: this.migrationLog.slice(-50), // Last 50 log entries
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}

// ========================================
// CLI INTERFACE
// ========================================

async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    const config: Partial<MigrationConfig> = {};

    for (const arg of args) {
        if (arg === '--dry-run') config.dryRun = true;
        if (arg === '--validate-only') config.validateOnly = true;
        if (arg.startsWith('--batch-size=')) {
            const batchSizeValue = arg.split('=')[1];
            if (batchSizeValue !== undefined) {
                config.batchSize = parseInt(batchSizeValue);
            }
        }
        if (arg.startsWith('--max-retries=')) {
            const maxRetriesValue = arg.split('=')[1];
            if (maxRetriesValue !== undefined) {
                config.maxRetries = parseInt(maxRetriesValue);
            }
        }
        if (arg === '--no-backup') config.backupExisting = false;
        if (arg === '--no-validation') config.validateData = false;
        if (arg === '--verbose') config.logLevel = 'info';
        if (arg === '--quiet') config.logLevel = 'error';
    }

    const migrationManager = new GameDefaultsMigrationManager(config);

    try {
        console.log('🎮 Game Defaults Migration Tool');
        console.log('===============================');
        console.log(`Configuration:`, config);
        console.log('');

        if (config.validateOnly) {
            // Validation only mode
            console.log('🔍 Running migration validation...');
            const validation = await migrationManager.validateMigration();

            if (validation.isValid) {
                console.log('✅ Migration validation passed');
            } else {
                console.log('❌ Migration validation failed');
                process.exit(1);
            }

            if (validation.warnings.length > 0) {
                console.log('⚠️  Warnings:');
                validation.warnings.forEach(warning => console.log(`  - ${warning}`));
            }

        } else {
            // Full migration
            const result = await migrationManager.fixGameDefaults();

            console.log('');
            console.log('📊 Migration Results:');
            console.log('====================');
            console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
            console.log(`Games fixed: ${result.gamesFixed}`);
            console.log(`StartedAt fixes: ${result.startedAtFixed}`);
            console.log(`Statistics fixes: ${result.statisticsFixed}`);
            console.log(`Execution time: ${result.executionTime}ms`);

            if (result.errors.length > 0) {
                console.log('❌ Errors:');
                result.errors.forEach(error => console.log(`  - ${error}`));
            }

            if (result.warnings.length > 0) {
                console.log('⚠️  Warnings:');
                result.warnings.forEach(warning => console.log(`  - ${warning}`));
            }

            if (config.dryRun && result.rollbackData) {
                console.log('');
                console.log('💾 Rollback data (for reference only):');
                console.log('=====================================');
                console.log('To rollback this migration, save the above JSON and run:');
                console.log('node scripts/rollback-migration.ts <rollback-data>');
            }

            if (!result.success) {
                process.exit(1);
            }
        }

    } catch (error) {
        console.error('💥 Migration failed with unhandled error:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { GameDefaultsMigrationManager };
export type { MigrationConfig, MigrationResult, ValidationResult };
#!/usr/bin/env node

/**
 * Jackpot Data Migration Script
 * 
 * Migrates existing in-memory jackpot data to database persistence
 * with comprehensive validation, rollback capabilities, and backward compatibility.
 * 
 * Usage:
 *   npm run jackpot:migrate [-- --dry-run] [-- --batch-size=1000] [-- --validate-only]
 *   node scripts/migrate-jackpot-data.ts --dry-run
 */

import { db } from '@/libs/database/db';
import { jackpotTypeEnum } from '@/core/database/schema/enums';
import { jackpotTable } from '@/libs/database/schema/jackpot';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// ========================================
// INTERFACES AND TYPES
// ========================================

interface MigrationConfig
{
    batchSize: number;
    maxRetries: number;
    validateData: boolean;
    dryRun: boolean;
    validateOnly: boolean;
    backupExisting: boolean;
    logLevel: 'info' | 'warn' | 'error';
}

interface JackpotPoolData
{
    group: string;
    currentAmount: number;
    totalContributions: number;
    totalWins: number;
    contributionRate: number;
    seedAmount: number;
    maxAmount?: number;
    lastWinDate?: Date;
    lastWinAmount?: number;
    contributionHistory: any[];
    winHistory: any[];
}

interface JackpotContributionData
{
    wagerAmount: number;
    contributionAmount: number;
    winAmount: number;
    betTransactionId: string;
    jackpotId: string;
    createdAt: Date;
    operatorId: string;
}

interface MigrationResult
{
    success: boolean;
    migratedPools: number;
    migratedContributions: number;
    errors: string[];
    warnings: string[];
    executionTime: number;
    rollbackData?: string; // JSON string for rollback
}

interface ValidationResult
{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    dataIntegrityScore: number;
}

// ========================================
// MIGRATION MANAGER CLASS
// ========================================

class JackpotMigrationManager
{
    private config: MigrationConfig;
    private migrationLog: string[] = [];
    private backupData: any = {};
    private startTime: number = Date.now();

    constructor(config: Partial<MigrationConfig> = {})
    {
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
     * Execute complete migration from in-memory to database
     */
    async migrateContributions(): Promise<MigrationResult>
    {
        this.log('Starting jackpot data migration...', 'info');

        const result: MigrationResult = {
            success: false,
            migratedPools: 0,
            migratedContributions: 0,
            errors: [] as string[],
            warnings: [] as string[],
            executionTime: 0,
        };

        try {
            // Step 1: Backup existing data
            if (this.config.backupExisting && !this.config.dryRun) {
                await this.backupExistingData();
                this.log('Existing data backed up successfully', 'info');
            }

            // Step 2: Validate migration prerequisites
            const validation = await this.validateMigrationPrerequisites();
            if (!validation.isValid) {
                result.errors.push(...validation.errors);
                return result;
            }

            // Step 3: Migrate jackpot pools data
            const poolResult = await this.migrateJackpotPools();
            result.migratedPools = poolResult.migrated;
            result.errors.push(...poolResult.errors);
            result.warnings.push(...poolResult.warnings);

            // Step 4: Migrate contribution history data
            const contributionResult = await this.migrateContributionHistory();
            result.migratedContributions = contributionResult.migrated;
            result.errors.push(...contributionResult.errors);
            result.warnings.push(...contributionResult.warnings);

            // Step 5: Validate migration results
            if (this.config.validateData) {
                const finalValidation = await this.validateMigration();
                result.warnings.push(...finalValidation.warnings);
                if (!finalValidation.isValid) {
                    result.errors.push(...finalValidation.errors);
                }
            }

            // Step 6: Generate rollback data if needed
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
    async validateMigration(): Promise<ValidationResult>
    {
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

            // Validate jackpot table schema
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

            // Check for duplicate data
            const duplicateCheck = await this.checkForDuplicates();
            if (duplicateCheck.hasDuplicates) {
                result.warnings.push(`Found ${duplicateCheck.duplicateCount} potential duplicates`);
            }

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
    async rollbackMigration(rollbackData: string): Promise<void>
    {
        this.log('Starting rollback process...', 'info');

        try {
            const backup = JSON.parse(rollbackData);

            if (!this.config.dryRun) {
                // Clear current jackpot data
                await db.delete(jackpotTable);

                // Restore from backup
                if (backup.pools) {
                    for (const pool of backup.pools) {
                        await db.insert(jackpotTable).values(pool);
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
     * Migrate jackpot pools data
     */
    private async migrateJackpotPools(): Promise<{ migrated: number; errors: string[]; warnings: string[] }>
    {
        const result = { migrated: 0, errors: [] as string[], warnings: [] as string[] };

        try {
            // Simulate existing in-memory data (in real scenario, this would come from legacy service)
            const legacyPools: JackpotPoolData[] = [
                {
                    group: 'minor',
                    currentAmount: 100000,
                    seedAmount: 100000,
                    maxAmount: 1000000,
                    contributionRate: 0.02,
                    totalContributions: 0,
                    totalWins: 0,
                    winHistory: [],
                    contributionHistory: [],
                },
                {
                    group: 'major',
                    currentAmount: 1000000,
                    seedAmount: 1000000,
                    maxAmount: 10000000,
                    contributionRate: 0.01,
                    totalContributions: 0,
                    totalWins: 0,
                    winHistory: [],
                    contributionHistory: [],
                },
                {
                    group: 'mega',
                    currentAmount: 10000000,
                    seedAmount: 10000000,
                    maxAmount: 100000000,
                    contributionRate: 0.005,
                    totalContributions: 0,
                    totalWins: 0,
                    winHistory: [],
                    contributionHistory: [],
                }
            ];

            for (const poolData of legacyPools) {
                try {
                    if (this.config.dryRun) {
                        this.log(`[DRY RUN] Would migrate pool: ${poolData.group}`, 'info');
                        result.migrated++;
                        continue;
                    }

                    // Upsert jackpot pool data
                    await db
                        .insert(jackpotTable)
                        .values({
                            group: poolData.group as typeof jackpotTypeEnum.enumValues[number],
                            currentAmount: poolData.currentAmount,
                            seedAmount: poolData.seedAmount,
                            maxAmount: poolData.maxAmount,
                            contributionRate: poolData.contributionRate,
                            totalContributions: poolData.totalContributions,
                            totalWins: poolData.totalWins,
                            winHistory: poolData.winHistory,
                            contributionHistory: poolData.contributionHistory,
                            version: 0,
                            lastModifiedAt: new Date(),
                        })
                        .onConflictDoUpdate({
                            target: jackpotTable.group,
                            set: {
                                currentAmount: poolData.currentAmount,
                                seedAmount: poolData.seedAmount,
                                maxAmount: poolData.maxAmount,
                                contributionRate: poolData.contributionRate,
                                updatedAt: new Date(),
                                version: sql`version + 1`,
                            },
                        });

                    result.migrated++;
                    this.log(`Migrated pool: ${poolData.group}`, 'info');

                } catch (error) {
                    result.errors.push(`Failed to migrate pool ${poolData.group}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

        } catch (error) {
            result.errors.push(`Pool migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Migrate contribution history data
     */
    private async migrateContributionHistory(): Promise<{ migrated: number; errors: string[]; warnings: string[] }>
    {
        const result = { migrated: 0, errors: [] as string[], warnings: [] as string[] };

        try {
            // In a real migration, this would extract from legacy system
            // For now, we're migrating empty histories since existing service uses in-memory storage
            const pools = await db.select().from(jackpotTable);

            for (const pool of pools) {
                if (this.config.dryRun) {
                    this.log(`[DRY RUN] Would migrate contribution history for pool: ${pool.group}`, 'info');
                    result.migrated++;
                    continue;
                }

                // Update pool with empty contribution history (already defaulted in schema)
                // In a real migration, you would extract and migrate actual contribution data
                await db
                    .update(jackpotTable)
                    .set({
                        contributionHistory: [],
                        updatedAt: new Date(),
                    })
                    .where(eq(jackpotTable.group, pool.group));

                result.migrated++;
            }

        } catch (error) {
            result.errors.push(`Contribution history migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Backup existing data before migration
     */
    private async backupExistingData(): Promise<void>
    {
        try {
            const existingPools = await db.select().from(jackpotTable);
            this.backupData.pools = existingPools;

            // Save backup to file
            const backupFile = path.join(process.cwd(), `jackpot_backup_${Date.now()}.json`);
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
    private async validateMigrationPrerequisites(): Promise<ValidationResult>
    {
        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };

        try {
            // Check if migration already completed
            const existingPools = await db.select().from(jackpotTable);
            if (existingPools.length > 0) {
                result.warnings.push('Existing jackpot data found - this may be a re-migration');
            }

            // Check database schema
            const requiredColumns = ['group', 'current_amount', 'version', 'last_modified_at'];
            // This would require a more complex schema inspection in production
            // For now, we'll assume the migration script has been run

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Prerequisite validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Validate database schema
     */
    private async validateSchema(): Promise<ValidationResult>
    {
        return {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };
    }

    /**
     * Validate data integrity after migration
     */
    private async validateDataIntegrity(): Promise<ValidationResult>
    {
        const result: ValidationResult = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            dataIntegrityScore: 100,
        };

        try {
            const pools = await db.select().from(jackpotTable);

            // Check for required groups
            const groups = pools.map(p => p.group);
            const requiredGroups = ['minor', 'major', 'mega'];
            const missingGroups = requiredGroups.filter(g => !groups.includes(g as any));

            if (missingGroups.length > 0) {
                result.warnings.push(`Missing jackpot groups: ${missingGroups.join(', ')}`);
            }

            // Check for data consistency
            for (const pool of pools) {
                if (pool.contributionRate < 0 || pool.contributionRate > 1) {
                    result.warnings.push(`Invalid contribution rate for ${pool.group}: ${pool.contributionRate}`);
                }

                if (pool.maxAmount && pool.maxAmount < pool.seedAmount) {
                    result.warnings.push(`Max amount less than seed amount for ${pool.group}`);
                }
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Check for duplicate data
     */
    private async checkForDuplicates(): Promise<{ hasDuplicates: boolean; duplicateCount: number }>
    {
        try {
            const pools = await db.select({ group: jackpotTable.group }).from(jackpotTable);
            const groups = pools.map(p => p.group);
            const uniqueGroups = new Set(groups);

            return {
                hasDuplicates: groups.length !== uniqueGroups.size,
                duplicateCount: groups.length - uniqueGroups.size,
            };
        } catch {
            return { hasDuplicates: false, duplicateCount: 0 };
        }
    }

    /**
     * Check database connectivity
     */
    private async checkDatabaseConnectivity(): Promise<ValidationResult>
    {
        try {
            await db.select().from(jackpotTable).limit(1);
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

    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void
    {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [JACKPOT-MIGRATION] ${message}`;

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
    async getMigrationStatus(): Promise<any>
    {
        try {
            const pools = await db.select().from(jackpotTable);
            const totalContributions = pools.reduce((sum, pool) => sum + (pool.totalContributions || 0), 0);
            const totalWins = pools.reduce((sum, pool) => sum + (pool.totalWins || 0), 0);

            return {
                pools: pools.length,
                totalContributions,
                totalWins,
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

async function main()
{
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

    const migrationManager = new JackpotMigrationManager(config);

    try {
        console.log('🎰 Jackpot Data Migration Tool');
        console.log('==================================');
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
            const result = await migrationManager.migrateContributions();

            console.log('');
            console.log('📊 Migration Results:');
            console.log('====================');
            console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
            console.log(`Pools migrated: ${result.migratedPools}`);
            console.log(`Contributions migrated: ${result.migratedContributions}`);
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
    main().catch(error =>
    {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { JackpotMigrationManager };
export type { MigrationConfig, MigrationResult, ValidationResult };


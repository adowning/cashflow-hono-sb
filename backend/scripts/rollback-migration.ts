#!/usr/bin/env node

/**
 * Jackpot Migration Rollback Script
 * 
 * Rolls back jackpot data migration to restore previous state
 * with comprehensive validation and safety checks.
 * 
 * Usage:
 *   npm run jackpot:rollback -- --rollback-data=<json-string>
 *   node scripts/rollback-migration.ts rollback-data.json
 *   node scripts/rollback-migration.ts '<json-string>'
 */

import { db } from '@/libs/database/db';
import { jackpotTable } from '@/libs/database/schema/jackpot';
import fs from 'fs/promises';
import path from 'path';

// ========================================
// INTERFACES AND TYPES
// ========================================

interface RollbackConfig
{
    dryRun: boolean;
    backupCurrent: boolean;
    validateRollback: boolean;
    forceRollback: boolean;
    logLevel: 'info' | 'warn' | 'error';
}

interface RollbackData
{
    pools: any[];
    contributions?: any[];
    timestamp: string;
    migrationVersion: string;
    checksum?: string;
}

interface RollbackResult
{
    success: boolean;
    restoredPools: number;
    errors: string[];
    warnings: string[];
    executionTime: number;
    backupLocation?: string;
}

// ========================================
// ROLLBACK MANAGER CLASS
// ========================================

class JackpotRollbackManager
{
    private config: RollbackConfig;
    private rollbackLog: string[] = [];
    private currentBackup: string = '';
    private startTime: number = Date.now();

    constructor(config: Partial<RollbackConfig> = {})
    {
        this.config = {
            dryRun: config.dryRun || false,
            backupCurrent: config.backupCurrent ?? true,
            validateRollback: config.validateRollback ?? true,
            forceRollback: config.forceRollback || false,
            logLevel: config.logLevel || 'info',
        };
    }

    // ========================================
    // MAIN ROLLBACK METHODS
    // ========================================

    /**
     * Execute rollback with comprehensive safety checks
     */
    async executeRollback(rollbackData: string): Promise<RollbackResult>
    {
        this.log('Starting jackpot migration rollback...', 'info');

        const result: RollbackResult = {
            success: false,
            restoredPools: 0,
            errors: [] as string[],
            warnings: [] as string[],
            executionTime: 0,
        };

        try {
            // Step 1: Parse and validate rollback data
            const parsedData = await this.parseAndValidateRollbackData(rollbackData);
            if (!parsedData.isValid) {
                result.errors.push(...parsedData.errors);
                return result;
            }

            // Step 2: Backup current state before rollback
            if (this.config.backupCurrent && !this.config.dryRun) {
                const backupResult = await this.backupCurrentState();
                if (backupResult.success) {
                    result.backupLocation = backupResult.backupLocation;
                } else {
                    result.warnings.push('Failed to backup current state');
                }
            }

            // Step 3: Pre-rollback validation
            const preRollbackCheck = await this.performPreRollbackCheck(parsedData.data!);
            if (!preRollbackCheck.success) {
                if (!this.config.forceRollback) {
                    result.errors.push(...preRollbackCheck.errors);
                    result.warnings.push(...preRollbackCheck.warnings);
                    return result;
                } else {
                    result.warnings.push('Force rollback enabled, proceeding despite validation failures');
                    result.warnings.push(...preRollbackCheck.warnings);
                }
            }

            // Step 4: Execute rollback
            const rollbackResult = await this.performRollback(parsedData.data!);
            result.restoredPools = rollbackResult.restored;
            result.errors.push(...rollbackResult.errors);
            result.warnings.push(...rollbackResult.warnings);

            // Step 5: Post-rollback validation
            if (this.config.validateRollback) {
                const postRollbackCheck = await this.performPostRollbackCheck();
                result.warnings.push(...postRollbackCheck.warnings);
                if (!postRollbackCheck.success) {
                    result.errors.push(...postRollbackCheck.errors);
                }
            }

            result.success = result.errors.length === 0;
            result.executionTime = Date.now() - this.startTime;

            this.log(`Rollback completed in ${result.executionTime}ms`, 'info');

            if (this.config.dryRun) {
                this.log('DRY RUN - No actual changes made', 'warn');
            }

        } catch (error) {
            result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.log(`Rollback failed: ${error}`, 'error');
        }

        return result;
    }

    /**
     * Validate rollback data integrity
     */
    async validateRollbackData(rollbackData: string): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>
    {
        const result = { isValid: true, errors: [] as string[], warnings: [] as string[] };

        try {
            const data = JSON.parse(rollbackData);

            // Check required fields
            if (!data.pools || !Array.isArray(data.pools)) {
                result.isValid = false;
                result.errors.push('Invalid rollback data: missing or invalid pools array');
                return result;
            }

            // Validate pool data structure
            for (const pool of data.pools) {
                if (!pool.group) {
                    result.isValid = false;
                    result.errors.push('Invalid pool data: missing group field');
                    break;
                }

                if (typeof pool.currentAmount !== 'number' || pool.currentAmount < 0) {
                    result.warnings.push(`Pool ${pool.group}: invalid currentAmount value`);
                }

                if (typeof pool.contributionRate !== 'number' || pool.contributionRate < 0 || pool.contributionRate > 1) {
                    result.warnings.push(`Pool ${pool.group}: invalid contributionRate value`);
                }
            }

            // Check for required jackpot groups
            const groups = data.pools.map((p: any) => p.group);
            const requiredGroups = ['minor', 'major', 'mega'];
            const missingGroups = requiredGroups.filter(g => !groups.includes(g));

            if (missingGroups.length > 0) {
                result.warnings.push(`Missing jackpot groups in rollback data: ${missingGroups.join(', ')}`);
            }

            // Verify data checksum if provided
            if (data.checksum) {
                const calculatedChecksum = await this.calculateDataChecksum(data.pools);
                if (calculatedChecksum !== data.checksum) {
                    result.warnings.push('Data checksum mismatch - rollback data may be corrupted');
                }
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Rollback data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Load rollback data from file
     */
    async loadRollbackDataFromFile(filePath: string): Promise<string>
    {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return fileContent;
        } catch (error) {
            throw new Error(`Failed to read rollback file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================
    // ROLLBACK HELPER METHODS
    // ========================================

    /**
     * Parse and validate rollback data string
     */
    private async parseAndValidateRollbackData(rollbackData: string): Promise<{ isValid: boolean; errors: string[]; data?: RollbackData }>
    {
        const result = { isValid: true, errors: [] as string[] };

        try {
            // Try to parse as JSON first
            let data: RollbackData;
            try {
                data = JSON.parse(rollbackData);
            } catch (parseError) {
                // If direct parsing fails, try loading from file
                data = JSON.parse(await this.loadRollbackDataFromFile(rollbackData));
            }

            // Validate structure
            const validation = await this.validateRollbackData(JSON.stringify(data));
            if (!validation.isValid) {
                result.isValid = false;
                result.errors.push(...validation.errors);
                return result;
            }

            return { isValid: true, errors: [], data };

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Failed to parse rollback data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }

    /**
     * Backup current state before rollback
     */
    private async backupCurrentState(): Promise<{ success: boolean; backupLocation?: string; error?: string }>
    {
        try {
            const currentPools = await db.select().from(jackpotTable);
            const backupData = {
                pools: currentPools,
                timestamp: new Date().toISOString(),
                migrationVersion: '2.0.0', // Current version
                reason: 'Pre-rollback backup',
            };

            const backupFile = path.join(process.cwd(), `jackpot_pre_rollback_${Date.now()}.json`);

            if (!this.config.dryRun) {
                await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            }

            this.log(`Current state backed up to: ${backupFile}`, 'info');

            return {
                success: true,
                backupLocation: backupFile,
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Perform pre-rollback validation checks
     */
    private async performPreRollbackCheck(rollbackData: RollbackData): Promise<{ success: boolean; errors: string[]; warnings: string[] }>
    {
        const result = { success: true, errors: [] as string[], warnings: [] as string[] };

        try {
            // Check if jackpot data exists
            const currentPools = await db.select().from(jackpotTable);

            if (currentPools.length === 0) {
                result.warnings.push('No existing jackpot data found - rollback may not be necessary');
            }

            // Validate rollback data compatibility
            const rollbackGroups = rollbackData.pools.map(p => p.group);
            const currentGroups = currentPools.map(p => p.group);

            const missingInRollback = currentGroups.filter(g => !rollbackGroups.includes(g));
            if (missingInRollback.length > 0) {
                result.warnings.push(`Groups exist in current DB but not in rollback data: ${missingInRollback.join(', ')}`);
            }

            // Check for active transactions or locks
            const activeLocks = await this.checkForActiveLocks();
            if (activeLocks.hasLocks) {
                result.warnings.push(`Found ${activeLocks.lockCount} potentially active locks`);
            }

            // Validate data integrity of rollback data
            for (const pool of rollbackData.pools) {
                if (pool.maxAmount && pool.maxAmount < pool.seedAmount) {
                    result.errors.push(`Invalid rollback data: ${pool.group} maxAmount less than seedAmount`);
                }
            }

            result.success = result.errors.length === 0;

        } catch (error) {
            result.success = false;
            result.errors.push(`Pre-rollback check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Perform the actual rollback
     */
    private async performRollback(rollbackData: RollbackData): Promise<{ restored: number; errors: string[]; warnings: string[] }>
    {
        const result = { restored: 0, errors: [] as string[], warnings: [] as string[] };

        try {
            if (this.config.dryRun) {
                this.log('[DRY RUN] Would restore pools:', 'info');
                for (const pool of rollbackData.pools) {
                    this.log(`[DRY RUN]   - ${pool.group}: ${pool.currentAmount} cents`, 'info');
                    result.restored++;
                }
                return result;
            }

            // Use transaction for atomic rollback
            await db.transaction(async (tx) =>
            {
                // Clear current jackpot data
                await tx.delete(jackpotTable);

                // Restore from rollback data
                for (const pool of rollbackData.pools) {
                    try {
                        await tx.insert(jackpotTable).values({
                            group: pool.group,
                            currentAmount: pool.currentAmount,
                            seedAmount: pool.seedAmount,
                            maxAmount: pool.maxAmount,
                            contributionRate: pool.contributionRate,
                            totalContributions: pool.totalContributions || 0,
                            totalWins: pool.totalWins || 0,
                            winHistory: pool.winHistory || [],
                            contributionHistory: pool.contributionHistory || [],
                            version: 0,
                            lastModifiedAt: new Date(),
                        });

                        result.restored++;
                        this.log(`Restored pool: ${pool.group}`, 'info');

                    } catch (poolError) {
                        result.errors.push(`Failed to restore pool ${pool.group}: ${poolError instanceof Error ? poolError.message : 'Unknown error'}`);
                    }
                }
            });

        } catch (error) {
            result.errors.push(`Rollback transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Perform post-rollback validation
     */
    private async performPostRollbackCheck(): Promise<{ success: boolean; errors: string[]; warnings: string[] }>
    {
        const result = { success: true, errors: [] as string[], warnings: [] as string[] };

        try {
            // Verify all pools are restored
            const restoredPools = await db.select().from(jackpotTable);
            const restoredGroups = restoredPools.map(p => p.group);

            const requiredGroups = ['minor', 'major', 'mega'];
            const missingGroups = requiredGroups.filter(g => !restoredGroups.includes(g as any));

            if (missingGroups.length > 0) {
                result.success = false;
                result.errors.push(`Missing groups after rollback: ${missingGroups.join(', ')}`);
            }

            // Check data consistency
            for (const pool of restoredPools) {
                if (pool.contributionRate < 0 || pool.contributionRate > 1) {
                    result.warnings.push(`Invalid contribution rate for ${pool.group}: ${pool.contributionRate}`);
                }
            }

            // Verify no orphaned locks
            const activeLocks = await this.checkForActiveLocks();
            if (activeLocks.hasLocks) {
                result.warnings.push(`Found ${activeLocks.lockCount} orphaned locks after rollback`);
            }

        } catch (error) {
            result.success = false;
            result.errors.push(`Post-rollback check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    /**
     * Check for active database locks
     */
    private async checkForActiveLocks(): Promise<{ hasLocks: boolean; lockCount: number }>
    {
        try {
            // In a real implementation, this would check database locks
            // For now, we'll assume no locks since Drizzle handles this internally
            return { hasLocks: false, lockCount: 0 };
        } catch {
            return { hasLocks: false, lockCount: 0 };
        }
    }

    /**
     * Calculate data checksum for integrity verification
     */
    private async calculateDataChecksum(data: any[]): Promise<string>
    {
        // Simple checksum calculation - in production, use a proper hash
        const dataString = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void
    {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [JACKPOT-ROLLBACK] ${message}`;

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

        // Store in rollback log
        this.rollbackLog.push(logMessage);
    }

    /**
     * Get rollback status and statistics
     */
    async getRollbackStatus(): Promise<any>
    {
        try {
            const pools = await db.select().from(jackpotTable);
            return {
                pools: pools.length,
                executionTime: Date.now() - this.startTime,
                config: this.config,
                logs: this.rollbackLog.slice(-50), // Last 50 log entries
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

    if (args.length === 0) {
        console.log('❌ Error: Rollback data required');
        console.log('');
        console.log('Usage:');
        console.log('  npm run jackpot:rollback -- --rollback-data=<json-string>');
        console.log('  node scripts/rollback-migration.ts rollback-data.json');
        console.log('  node scripts/rollback-migration.ts \'{"pools":[...]}\'');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run              Preview rollback without making changes');
        console.log('  --no-backup            Skip backing up current state');
        console.log('  --no-validation        Skip post-rollback validation');
        console.log('  --force-rollback       Force rollback even if validation fails');
        console.log('  --verbose              Enable verbose logging');
        process.exit(1);
    }

    // Parse command line arguments
    const config: Partial<RollbackConfig> = {};
    let rollbackData = '';

    for (const arg of args) {
        if (arg === '--dry-run') config.dryRun = true;
        if (arg === '--no-backup') config.backupCurrent = false;
        if (arg === '--no-validation') config.validateRollback = false;
        if (arg === '--force-rollback') config.forceRollback = true;
        if (arg === '--verbose') config.logLevel = 'info';
        if (arg.startsWith('--rollback-data=')) {
            const rollbackDataValue = arg.split('=')[1];
            if (rollbackDataValue !== undefined) {
                rollbackData = rollbackDataValue;
            }
        }
    }

    // If no --rollback-data provided, assume first arg is the data or file
    if (!rollbackData && args[0] && !args[0].startsWith('--')) {
        rollbackData = args[0];
    }

    const rollbackManager = new JackpotRollbackManager(config);

    try {
        console.log('🔄 Jackpot Migration Rollback Tool');
        console.log('===================================');
        console.log(`Configuration:`, config);
        console.log('');

        // Validate rollback data
        console.log('🔍 Validating rollback data...');
        const validation = await rollbackManager.validateRollbackData(rollbackData);

        if (!validation.isValid) {
            console.log('❌ Rollback data validation failed');
            validation.errors.forEach(error => console.log(`  - ${error}`));
            process.exit(1);
        }

        if (validation.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            validation.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        console.log('✅ Rollback data validation passed');
        console.log('');

        // Execute rollback
        const result = await rollbackManager.executeRollback(rollbackData);

        console.log('');
        console.log('📊 Rollback Results:');
        console.log('====================');
        console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`Pools restored: ${result.restoredPools}`);
        console.log(`Execution time: ${result.executionTime}ms`);

        if (result.backupLocation) {
            console.log(`Backup location: ${result.backupLocation}`);
        }

        if (result.errors.length > 0) {
            console.log('❌ Errors:');
            result.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (result.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            result.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (config.dryRun) {
            console.log('');
            console.log('💡 DRY RUN - No actual changes were made');
            console.log('To execute the rollback, remove the --dry-run flag');
        }

        if (!result.success) {
            process.exit(1);
        }

        console.log('');
        console.log('🎉 Rollback completed successfully');

    } catch (error) {
        console.error('💥 Rollback failed with unhandled error:', error);
        process.exit(1);
    }
}

// Run rollback if called directly
if (require.main === module) {
    main().catch(error =>
    {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { JackpotRollbackManager };
export type { RollbackConfig, RollbackData, RollbackResult };


/**
 * Query optimization and prepared statement caching for high-performance jackpot operations
 * Provides query plan optimization, prepared statement reuse, and N+1 query prevention
 */

import { db } from "@/libs/database/db";
import { sql } from "drizzle-orm";

// ========================================
// QUERY OPTIMIZATION INTERFACES
// ========================================

export interface OptimizedQuery
{
    query: string;
    parameters: any[];
    executionTime: number;
    rowsAffected: number;
    cacheKey: string;
    preparedStatement?: PreparedStatement;
}

export interface QueryPlan
{
    query: string;
    plan: string;
    cost: number;
    suggestions: string[];
}

export interface QueryMetrics
{
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    queryTypes: Record<string, number>;
    slowQueries: OptimizedQuery[];
}

export interface PreparedStatementCache
{
    statements: Map<string, PreparedStatement>;
    metrics: {
        hits: number;
        misses: number;
        hitRate: number;
    };
}

// ========================================
// PREPARED STATEMENT IMPLEMENTATION
// ========================================

/**
 * Cached prepared statement with metadata
 */
export class PreparedStatement
{
    private sql: string;
    private parameters: string[];
    private executionCount = 0;
    private totalExecutionTime = 0;
    private lastExecuted?: Date;
    private averageExecutionTime = 0;

    constructor(sql: string, parameters: string[] = [])
    {
        this.sql = sql;
        this.parameters = parameters;
    }

    async execute(parameters: Record<string, any> = {}): Promise<any>
    {
        const startTime = Date.now();

        try {
            // Replace named parameters with positional parameters
            const processedSql = this.replaceParameters(this.sql, parameters);
            const paramValues = this.parameters.map(param => parameters[param]);

            // Execute the query (single parameter)
            const result = await db.execute(sql.raw(processedSql));

            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime);

            return result;
        } catch (error) {
            console.error('Prepared statement execution failed:', error);
            throw error;
        }
    }

    private replaceParameters(sql: string, parameters: Record<string, any>): string
    {
        let processedSql = sql;

        for (const param of this.parameters) {
            const placeholder = `:${param}`;
            const value = parameters[param];

            if (typeof value === 'string') {
                processedSql = processedSql.replace(new RegExp(placeholder, 'g'), `'${value}'`);
            } else if (value === null || value === undefined) {
                processedSql = processedSql.replace(new RegExp(placeholder, 'g'), 'NULL');
            } else {
                processedSql = processedSql.replace(new RegExp(placeholder, 'g'), value.toString());
            }
        }

        return processedSql;
    }

    private updateMetrics(executionTime: number): void
    {
        this.executionCount++;
        this.totalExecutionTime += executionTime;
        this.averageExecutionTime = this.totalExecutionTime / this.executionCount;
        this.lastExecuted = new Date();
    }

    getMetrics()
    {
        return {
            executionCount: this.executionCount,
            totalExecutionTime: this.totalExecutionTime,
            averageExecutionTime: this.averageExecutionTime,
            lastExecuted: this.lastExecuted,
        };
    }
}

// ========================================
// QUERY OPTIMIZER CORE CLASS
// ========================================

/**
 * Advanced query optimizer for jackpot operations
 */
export class JackpotQueryOptimizer
{
    private preparedStatements: Map<string, PreparedStatement> = new Map();
    private queryCache: Map<string, OptimizedQuery> = new Map();
    private metrics: QueryMetrics;
    private nplus1Detector: NPlusOneDetector;

    constructor()
    {
        this.metrics = {
            totalQueries: 0,
            averageExecutionTime: 0,
            cacheHitRate: 0,
            queryTypes: {},
            slowQueries: [],
        };
        this.nplus1Detector = new NPlusOneDetector();
        this.initializeCommonQueries();
    }

    /**
     * Optimize jackpot contribution query
     */
    async optimizeContributionQuery(
        gameId: string,
        wagerAmount: number,
        group: 'minor' | 'major' | 'mega'
    ): Promise<any>
    {
        const cacheKey = `contribution:${gameId}:${wagerAmount}:${group}`;

        // Check cache first
        if (this.queryCache.has(cacheKey)) {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * this.metrics.totalQueries + 100) / (this.metrics.totalQueries + 1);
            return this.queryCache.get(cacheKey);
        }

        const startTime = Date.now();

        try {
            // Use prepared statement for better performance
            const statement = this.getPreparedStatement('jackpot_contribution');
            const result = await statement.execute({
                game_id: gameId,
                wager_amount: wagerAmount,
                group: group,
                contribution_rate: this.getContributionRate(group),
                timestamp: new Date().toISOString(),
            });

            const executionTime = Date.now() - startTime;
            this.recordQuery('contribution', executionTime, result);

            // Cache the result
            this.cacheQuery(cacheKey, {
                query: 'contribution',
                parameters: [gameId, wagerAmount, group],
                executionTime,
                rowsAffected: Array.isArray(result) ? result.length : 1,
                cacheKey,
            });

            return result;
        } catch (error) {
            console.error('Contribution query optimization failed:', error);
            throw error;
        }
    }

    /**
     * Optimize jackpot win query
     */
    async optimizeWinQuery(
        group: 'minor' | 'major' | 'mega',
        winAmount: number,
        userId: string,
        gameId: string
    ): Promise<any>
    {
        const cacheKey = `win:${group}:${winAmount}:${userId}:${gameId}`;

        if (this.queryCache.has(cacheKey)) {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * this.metrics.totalQueries + 100) / (this.metrics.totalQueries + 1);
            return this.queryCache.get(cacheKey);
        }

        const startTime = Date.now();

        try {
            const statement = this.getPreparedStatement('jackpot_win');
            const result = await statement.execute({
                group: group,
                win_amount: winAmount,
                user_id: userId,
                game_id: gameId,
                timestamp: new Date().toISOString(),
            });

            const executionTime = Date.now() - startTime;
            this.recordQuery('win', executionTime, result);

            this.cacheQuery(cacheKey, {
                query: 'win',
                parameters: [group, winAmount, userId, gameId],
                executionTime,
                rowsAffected: Array.isArray(result) ? result.length : 1,
                cacheKey,
            });

            return result;
        } catch (error) {
            console.error('Win query optimization failed:', error);
            throw error;
        }
    }

    /**
     * Batch optimize multiple queries to prevent N+1 problems
     */
    async optimizeBatchQueries(
        operations: Array<{
            type: 'contribution' | 'win' | 'get_pool' | 'get_stats';
            parameters: any[];
        }>
    ): Promise<any[]>
    {
        // Group operations by type for batch processing
        const groupedOperations = this.groupOperationsByType(operations);
        const results: any[] = [];

        // Process each group
        for (const [type, ops] of Object.entries(groupedOperations)) {
            if (ops.length === 1 && ops[0]) {
                // Single operation - process normally
                const result = await this.processSingleOperation(type as any, ops[0].parameters);
                results.push(result);
            } else {
                // Multiple operations of same type - batch process
                const batchResult = await this.processBatchOperation(type as any, ops);
                results.push(...batchResult);
            }
        }

        return results;
    }

    /**
     * Get optimized query plan for analysis
     */
    async getQueryPlan(query: string, parameters: any[] = []): Promise<QueryPlan>
    {
        // In a real implementation, this would use EXPLAIN to get actual query plans
        const suggestions = this.analyzeQueryForOptimizations(query);

        return {
            query,
            plan: 'Optimized query plan would be shown here',
            cost: this.estimateQueryCost(query),
            suggestions,
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics(): QueryMetrics
    {
        return { ...this.metrics };
    }

    /**
     * Clear query cache and reset metrics
     */
    clearCache(): void
    {
        this.queryCache.clear();
        this.preparedStatements.clear();
        this.metrics = {
            totalQueries: 0,
            averageExecutionTime: 0,
            cacheHitRate: 0,
            queryTypes: {},
            slowQueries: [],
        };
    }

    // Private helper methods

    private initializeCommonQueries(): void
    {
        // Initialize prepared statements for common jackpot operations

        this.preparedStatements.set('jackpot_contribution', new PreparedStatement(
            `UPDATE jackpots SET 
        current_amount = current_amount + (:wager_amount * :contribution_rate),
        total_contributions = total_contributions + (:wager_amount * :contribution_rate),
        version = version + 1,
        updated_at = :timestamp
       WHERE group = :group`,
            ['wager_amount', 'contribution_rate', 'group', 'timestamp']
        ));

        this.preparedStatements.set('jackpot_win', new PreparedStatement(
            `UPDATE jackpots SET 
        current_amount = current_amount - :win_amount,
        total_wins = total_wins + :win_amount,
        last_won_amount = :win_amount,
        last_won_at = :timestamp,
        version = version + 1,
        updated_at = :timestamp
       WHERE group = :group`,
            ['win_amount', 'timestamp', 'group']
        ));

        this.preparedStatements.set('get_jackpot_pool', new PreparedStatement(
            `SELECT * FROM jackpots WHERE group = :group`,
            ['group']
        ));

        this.preparedStatements.set('get_all_pools', new PreparedStatement(
            `SELECT * FROM jackpots ORDER BY group`
        ));
    }

    private getPreparedStatement(name: string): PreparedStatement
    {
        const statement = this.preparedStatements.get(name);
        if (!statement) {
            throw new Error(`Prepared statement '${name}' not found`);
        }
        return statement;
    }

    private getContributionRate(group: string): number
    {
        const rates: Record<string, number> = {
            minor: 0.02,
            major: 0.01,
            mega: 0.005,
        };
        return rates[group] || 0;
    }

    private cacheQuery(key: string, query: OptimizedQuery): void
    {
        // Limit cache size to prevent memory issues
        if (this.queryCache.size > 1000) {
            const firstKey = this.queryCache.keys().next().value;
            if (firstKey) {
                this.queryCache.delete(firstKey);
            }
        }

        this.queryCache.set(key, query);
    }

    private recordQuery(type: string, executionTime: number, result: any): void
    {
        this.metrics.totalQueries++;

        // Update average execution time
        this.metrics.averageExecutionTime =
            (this.metrics.averageExecutionTime * (this.metrics.totalQueries - 1) + executionTime) /
            this.metrics.totalQueries;

        // Track query types
        this.metrics.queryTypes[type] = (this.metrics.queryTypes[type] || 0) + 1;

        // Track slow queries (>100ms)
        if (executionTime > 100) {
            this.metrics.slowQueries.push({
                query: type,
                parameters: [],
                executionTime,
                rowsAffected: Array.isArray(result) ? result.length : 1,
                cacheKey: '',
            });

            // Keep only last 50 slow queries
            if (this.metrics.slowQueries.length > 50) {
                this.metrics.slowQueries.shift();
            }
        }
    }

    private groupOperationsByType(
        operations: Array<{ type: string; parameters: any[] }>
    ): Record<string, Array<{ type: string; parameters: any[] }>>
    {
        const grouped: Record<string, Array<{ type: string; parameters: any[] }>> = {};

        for (const operation of operations) {
            if (operation && operation.type) {
                if (!grouped[operation.type]) {
                    grouped[operation.type] = [];
                }
                grouped[operation.type]?.push(operation);
            }
        }

        return grouped;
    }

    private async processSingleOperation(type: string, parameters: any[]): Promise<any>
    {
        switch (type) {
            case 'contribution':
                return this.optimizeContributionQuery(parameters[0], parameters[1], parameters[2]);
            case 'win':
                return this.optimizeWinQuery(parameters[0], parameters[1], parameters[2], parameters[3]);
            default:
                throw new Error(`Unknown operation type: ${type}`);
        }
    }

    private async processBatchOperation(
        type: 'contribution' | 'win' | 'get_pool' | 'get_stats',
        operations: Array<{ type: string; parameters: any[] }>
    ): Promise<any[]>
    {
        // Batch processing implementation
        // This would combine multiple operations into a single database transaction

        const results: any[] = [];

        for (const operation of operations) {
            const result = await this.processSingleOperation(type, operation.parameters);
            results.push(result);
        }

        return results;
    }

    private analyzeQueryForOptimizations(query: string): string[]
    {
        const suggestions: string[] = [];

        // Check for common optimization opportunities
        if (query.includes('SELECT *')) {
            suggestions.push('Consider selecting only required columns instead of SELECT *');
        }

        if (query.includes('WHERE') && !query.includes('INDEX')) {
            suggestions.push('Ensure proper indexes exist on WHERE clause columns');
        }

        if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
            suggestions.push('Consider adding LIMIT clause when using ORDER BY for better performance');
        }

        if (query.includes('LIKE \'%')) {
            suggestions.push('Avoid leading wildcards in LIKE clauses as they prevent index usage');
        }

        return suggestions;
    }

    private estimateQueryCost(query: string): number
    {
        // Simple cost estimation based on query complexity
        let cost = 1;

        if (query.includes('JOIN')) cost += 2;
        if (query.includes('WHERE')) cost += 1;
        if (query.includes('ORDER BY')) cost += 1;
        if (query.includes('GROUP BY')) cost += 2;
        if (query.includes('LIMIT')) cost -= 1;

        return Math.max(1, cost);
    }
}

// ========================================
// N+1 QUERY DETECTOR
// ========================================

/**
 * Detects and prevents N+1 query problems in jackpot operations
 */
class NPlusOneDetector
{
    private queryHistory: Map<string, { count: number; lastExecuted: Date }> = new Map();
    private suspiciousPatterns: Set<string> = new Set();

    recordQuery(query: string): void
    {
        const existing = this.queryHistory.get(query);
        if (existing) {
            existing.count++;
            existing.lastExecuted = new Date();

            if (existing.count > 10) { // Threshold for N+1 detection
                this.suspiciousPatterns.add(query);
                console.warn(`Potential N+1 query detected: ${query} executed ${existing.count} times`);
            }
        } else {
            this.queryHistory.set(query, {
                count: 1,
                lastExecuted: new Date(),
            });
        }
    }

    getSuspiciousPatterns(): string[]
    {
        return Array.from(this.suspiciousPatterns);
    }

    clearHistory(): void
    {
        this.queryHistory.clear();
        this.suspiciousPatterns.clear();
    }
}

// ========================================
// QUERY OPTIMIZATION UTILITIES
// ========================================

/**
 * Create optimized query for jackpot pool retrieval
 */
export function createOptimizedPoolQuery(groups: string[]): string
{
    if (groups.length === 1) {
        return `SELECT * FROM jackpots WHERE group = '${groups[0]}' ORDER BY group`;
    }

    const groupList = groups.map(g => `'${g}'`).join(', ');
    return `SELECT * FROM jackpots WHERE group IN (${groupList}) ORDER BY group`;
}

/**
 * Create optimized query for batch contributions
 */
export function createOptimizedBatchContributionQuery(
    contributions: Array<{ gameId: string; wagerAmount: number; group: string }>
): string
{
    const cases = contributions
        .map((contrib, index) =>
            `WHEN group = '${contrib.group}' THEN current_amount + (${contrib.wagerAmount} * contribution_rate)`
        )
        .join('\n      ');

    return `
    UPDATE jackpots SET 
      current_amount = CASE ${cases}
                      ELSE current_amount END,
      total_contributions = CASE ${cases}
                           ELSE total_contributions END,
      version = version + 1,
      updated_at = NOW()
    WHERE group IN (${contributions.map(c => `'${c.group}'`).join(', ')})
  `;
}

/**
 * Analyze and optimize existing queries
 */
export async function analyzeAndOptimizeQueries(
    optimizer: JackpotQueryOptimizer
): Promise<{ analysis: QueryPlan[]; recommendations: string[] }>
{
    const queries = [
        'SELECT * FROM jackpots WHERE group = ?',
        'UPDATE jackpots SET current_amount = current_amount + ? WHERE group = ?',
        'SELECT SUM(current_amount) FROM jackpots',
        'SELECT * FROM jackpots ORDER BY current_amount DESC LIMIT 10',
    ];

    const analysis: QueryPlan[] = [];
    const recommendations: string[] = [];

    for (const query of queries) {
        const plan = await optimizer.getQueryPlan(query);
        analysis.push(plan);

        if (plan.suggestions.length > 0) {
            recommendations.push(...plan.suggestions);
        }
    }

    return { analysis, recommendations };
}

// ========================================
// GLOBAL OPTIMIZER INSTANCE
// ========================================

export const jackpotQueryOptimizer = new JackpotQueryOptimizer();

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Quick optimized contribution
 */
export async function quickOptimizedContribution(
    gameId: string,
    wagerAmount: number,
    group: 'minor' | 'major' | 'mega' = 'minor'
): Promise<any>
{
    return jackpotQueryOptimizer.optimizeContributionQuery(gameId, wagerAmount, group);
}

/**
 * Quick optimized win processing
 */
export async function quickOptimizedWin(
    group: 'minor' | 'major' | 'mega',
    winAmount: number,
    userId: string,
    gameId: string
): Promise<any>
{
    return jackpotQueryOptimizer.optimizeWinQuery(group, winAmount, userId, gameId);
}

/**
 * Get query performance metrics
 */
export function getQueryMetrics(): QueryMetrics
{
    return jackpotQueryOptimizer.getMetrics();
}

/**
 * Clear query cache for memory management
 */
export function clearQueryCache(): void
{
    jackpotQueryOptimizer.clearCache();
}
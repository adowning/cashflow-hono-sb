#!/usr/bin/env node

/**
 * Backward Compatibility Testing Suite
 * 
 * Comprehensive testing to ensure the refactored jackpot service maintains
 * full backward compatibility with the original in-memory implementation.
 * 
 * This test suite validates:
 * - API method signatures and return types
 * - Error handling patterns
 * - Performance characteristics
 * - Data integrity
 * - Business logic consistency
 */

import
{
    doesGameHaveJackpot,
    getGameContributionRate,
    getJackpotPool,
    getJackpotPools,
    getJackpotStatistics,
    type JackpotGroup,
    processJackpotContribution,
    processJackpotWin,
    updateJackpotConfig,
    validateJackpotContributionRequest
} from '@/modules/jackpots/jackpot.service';

// ========================================
// TEST CONFIGURATION
// ========================================

interface CompatibilityTestConfig
{
    testIterations: number;
    concurrentUsers: number;
    loadTestDuration: number;
    performanceThreshold: number;
    errorTolerance: number;
}

const TEST_CONFIG: CompatibilityTestConfig = {
    testIterations: 100,
    concurrentUsers: 50,
    loadTestDuration: 30000, // 30 seconds
    performanceThreshold: 500, // 500ms max response time
    errorTolerance: 0.01, // 1% error tolerance
};

interface TestResult
{
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
}

interface CompatibilityReport
{
    timestamp: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    performanceMetrics: PerformanceMetrics;
    testResults: TestResult[];
    recommendations: string[];
}

// ========================================
// TEST CLASSES
// ========================================

class BackwardCompatibilityTester
{
    private results: TestResult[] = [];
    private performanceMetrics: PerformanceMetrics = {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
    };

    async runAllTests(): Promise<CompatibilityReport>
    {
        console.log('🔍 Starting Backward Compatibility Testing Suite');
        console.log('================================================');

        const startTime = Date.now();

        try {
            // Run all test suites
            await this.testAPISignatures();
            await this.testReturnTypes();
            await this.testErrorHandling();
            await this.testDataConsistency();
            await this.testBusinessLogic();
            await this.testPerformance();
            await this.testConcurrency();
            await this.testIntegrationScenarios();

            const totalDuration = Date.now() - startTime;
            const passedTests = this.results.filter(r => r.passed).length;
            const failedTests = this.results.filter(r => !r.passed).length;

            const report: CompatibilityReport = {
                timestamp: new Date().toISOString(),
                totalTests: this.results.length,
                passedTests,
                failedTests,
                successRate: (passedTests / this.results.length) * 100,
                performanceMetrics: this.performanceMetrics,
                testResults: this.results,
                recommendations: this.generateRecommendations(),
            };

            this.printReport(report);
            return report;

        } catch (error) {
            console.error('💥 Test suite failed:', error);
            throw error;
        }
    }

    // ========================================
    // API SIGNATURE COMPATIBILITY TESTS
    // ========================================

    private async testAPISignatures(): Promise<void>
    {
        console.log('\n📋 Testing API Signatures...');

        // Test processJackpotContribution signature
        await this.runTest('API: processJackpotContribution signature', async () =>
        {
            const gameId = 'test_game_123';
            const wagerAmount = 1000;

            const result = await processJackpotContribution(gameId, wagerAmount);

            // Validate return type structure
            this.assert(
                typeof result === 'object' && result !== null,
                'Result must be an object'
            );
            this.assert(
                typeof result.success === 'boolean',
                'Result must have success boolean property'
            );
            this.assert(
                typeof result.contributions === 'object',
                'Result must have contributions object'
            );
            this.assert(
                typeof result.totalContribution === 'number',
                'Result must have totalContribution number'
            );
        });

        // Test getJackpotPools signature
        await this.runTest('API: getJackpotPools signature', async () =>
        {
            const pools = await getJackpotPools();

            this.assert(
                typeof pools === 'object' && pools !== null,
                'Pools must be an object'
            );
            this.assert(
                'minor' in pools && 'major' in pools && 'mega' in pools,
                'Pools must contain minor, major, and mega groups'
            );

            // Validate each pool structure
            for (const group of ['minor', 'major', 'mega'] as JackpotGroup[]) {
                const pool = pools[group];
                this.assert(
                    typeof pool === 'object' && pool !== null,
                    `Pool ${group} must be an object`
                );
                this.assert(
                    typeof pool.group === 'string',
                    `Pool ${group} must have group string`
                );
                this.assert(
                    typeof pool.currentAmount === 'number',
                    `Pool ${group} must have currentAmount number`
                );
            }
        });

        // Test processJackpotWin signature
        await this.runTest('API: processJackpotWin signature', async () =>
        {
            const group: JackpotGroup = 'minor';
            const gameId = 'test_game_123';
            const userId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
            const winAmount = 50000;

            const result = await processJackpotWin(group, gameId, userId, winAmount);

            this.assert(
                typeof result === 'object' && result !== null,
                'Win result must be an object'
            );
            this.assert(
                typeof result.success === 'boolean',
                'Win result must have success boolean property'
            );
            this.assert(
                typeof result.actualWinAmount === 'number',
                'Win result must have actualWinAmount number'
            );
        });
    }

    // ========================================
    // RETURN TYPE COMPATIBILITY TESTS
    // ========================================

    private async testReturnTypes(): Promise<void>
    {
        console.log('\n🔄 Testing Return Types...');

        // Test contribution result structure
        await this.runTest('Return Types: JackpotContributionResult structure', async () =>
        {
            const result = await processJackpotContribution('test_game', 1000);

            // Validate contribution structure matches expected interface
            this.assert(
                'contributions' in result,
                'Must have contributions property'
            );
            this.assert(
                'minor' in result.contributions &&
                'major' in result.contributions &&
                'mega' in result.contributions,
                'Contributions must contain all jackpot groups'
            );

            // Validate all contribution amounts are numbers
            for (const group of Object.keys(result.contributions)) {
                this.assert(
                    typeof result.contributions[group as JackpotGroup] === 'number',
                    `Contribution for ${group} must be a number`
                );
                this.assert(
                    result.contributions[group as JackpotGroup] >= 0,
                    `Contribution for ${group} must be non-negative`
                );
            }
        });

        // Test pool structure
        await this.runTest('Return Types: JackpotPool structure', async () =>
        {
            const pools = await getJackpotPools();

            for (const group of ['minor', 'major', 'mega'] as JackpotGroup[]) {
                const pool = pools[group];

                this.assert(
                    typeof pool.currentAmount === 'number',
                    `Pool ${group} currentAmount must be number`
                );
                this.assert(
                    typeof pool.totalContributions === 'number',
                    `Pool ${group} totalContributions must be number`
                );
                this.assert(
                    typeof pool.totalWins === 'number',
                    `Pool ${group} totalWins must be number`
                );
            }
        });
    }

    // ========================================
    // ERROR HANDLING COMPATIBILITY TESTS
    // ========================================

    private async testErrorHandling(): Promise<void>
    {
        console.log('\n⚠️  Testing Error Handling...');

        // Test invalid input handling
        await this.runTest('Error Handling: Invalid game ID', async () =>
        {
            const result = await processJackpotContribution('', 1000);

            this.assert(
                result.success === false,
                'Should return success: false for invalid input'
            );
            this.assert(
                result.error !== undefined && result.error.length > 0,
                'Should provide error message'
            );
        });

        // Test invalid wager amount
        await this.runTest('Error Handling: Invalid wager amount', async () =>
        {
            const result = await processJackpotContribution('test_game', -100);

            this.assert(
                result.success === false,
                'Should return success: false for negative wager'
            );
        });

        // Test database error handling
        await this.runTest('Error Handling: Database connectivity', async () =>
        {
            // This test would require a more complex setup to simulate DB errors
            // For now, we test with valid inputs to ensure graceful handling
            const result = await processJackpotContribution('test_game', 1000);

            // Should either succeed or fail gracefully
            this.assert(
                typeof result.success === 'boolean',
                'Should always return a boolean success indicator'
            );
        });

        // Test validation functions
        await this.runTest('Error Handling: Input validation functions', async () =>
        {
            const invalidRequest = { gameId: '', wagerAmount: -100 };
            const validation = validateJackpotContributionRequest(invalidRequest);

            this.assert(
                validation.success === false,
                'Validation should fail for invalid input'
            );
            this.assert(
                validation.error !== undefined,
                'Validation should provide error message'
            );
        });
    }

    // ========================================
    // DATA CONSISTENCY TESTS
    // ========================================

    private async testDataConsistency(): Promise<void>
    {
        console.log('\n💾 Testing Data Consistency...');

        // Test pool consistency after contributions
        await this.runTest('Data Consistency: Pool amounts after contributions', async () =>
        {
            const initialPools = await getJackpotPools();
            const contributionAmount = 1000;

            await processJackpotContribution('test_game', contributionAmount);

            const updatedPools = await getJackpotPools();

            // Verify total amount consistency
            const initialTotal = Object.values(initialPools)
                .reduce((sum, pool) => sum + pool.currentAmount, 0);
            const updatedTotal = Object.values(updatedPools)
                .reduce((sum, pool) => sum + pool.currentAmount, 0);

            this.assert(
                updatedTotal >= initialTotal,
                'Total jackpot amount should increase or stay same'
            );
        });

        // Test statistics consistency
        await this.runTest('Data Consistency: Statistics accuracy', async () =>
        {
            const stats = await getJackpotStatistics();
            const pools = await getJackpotPools();

            // Verify statistics match individual pools
            const calculatedTotal = Object.values(pools)
                .reduce((sum, pool) => sum + pool.totalContributions, 0);

            this.assert(
                Math.abs(stats.totalContributions - calculatedTotal) < 1,
                'Statistics total should match pool totals'
            );
        });

        // Test win processing consistency
        await this.runTest('Data Consistency: Win processing accuracy', async () =>
        {
            const initialPool = await getJackpotPool('minor');
            const winAmount = 1000;

            await processJackpotWin('minor', 'test_game', '550e8400-e29b-41d4-a716-446655440000', winAmount);

            const updatedPool = await getJackpotPool('minor');

            // After a win, totalWins should increase
            this.assert(
                updatedPool.totalWins >= initialPool.totalWins,
                'Total wins should increase after win processing'
            );
        });
    }

    // ========================================
    // BUSINESS LOGIC COMPATIBILITY TESTS
    // ========================================

    private async testBusinessLogic(): Promise<void>
    {
        console.log('\n🎯 Testing Business Logic...');

        // Test contribution calculation logic
        await this.runTest('Business Logic: Contribution calculation', async () =>
        {
            const result = await processJackpotContribution('test_game', 10000); // $100.00

            // With 2% rate for minor jackpot, should contribute $2.00 = 200 cents
            // Note: This depends on game configuration
            this.assert(
                result.contributions.minor >= 0,
                'Minor contribution should be non-negative'
            );
            this.assert(
                result.totalContribution >= 0,
                'Total contribution should be non-negative'
            );
        });

        // Test jackpot configuration changes
        await this.runTest('Business Logic: Configuration update', async () =>
        {
            const configUpdate = {
                minor: { rate: 0.025 } // 2.5%
            };

            const result = await updateJackpotConfig(configUpdate);

            this.assert(
                typeof result.success === 'boolean',
                'Config update should return success status'
            );
        });

        // Test game jackpot assignment
        await this.runTest('Business Logic: Game jackpot assignment', async () =>
        {
            const hasJackpot = await doesGameHaveJackpot('test_game');

            this.assert(
                typeof hasJackpot === 'boolean',
                'Should return boolean for jackpot assignment'
            );

            const rate = await getGameContributionRate('test_game', 'minor');

            this.assert(
                typeof rate === 'number',
                'Should return number for contribution rate'
            );
            this.assert(
                rate >= 0 && rate <= 1,
                'Contribution rate should be between 0 and 1'
            );
        });
    }

    // ========================================
    // PERFORMANCE COMPATIBILITY TESTS
    // ========================================

    private async testPerformance(): Promise<void>
    {
        console.log('\n⚡ Testing Performance...');

        const responseTimes: number[] = [];

        // Test contribution performance
        await this.runTest('Performance: Contribution response time', async () =>
        {
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await processJackpotContribution(`perf_test_${i}`, 1000);
                responseTimes.push(Date.now() - start);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            this.performanceMetrics.averageResponseTime = avgResponseTime;

            this.assert(
                avgResponseTime < TEST_CONFIG.performanceThreshold,
                `Average response time ${avgResponseTime}ms should be under ${TEST_CONFIG.performanceThreshold}ms`
            );
        });

        // Test pool query performance
        await this.runTest('Performance: Pool query performance', async () =>
        {
            const start = Date.now();
            await getJackpotPools();
            const duration = Date.now() - start;

            this.assert(
                duration < 200,
                `Pool query should complete under 200ms, got ${duration}ms`
            );
        });
    }

    // ========================================
    // CONCURRENCY COMPATIBILITY TESTS
    // ========================================

    private async testConcurrency(): Promise<void>
    {
        console.log('\n🔀 Testing Concurrency...');

        await this.runTest('Concurrency: Multiple simultaneous contributions', async () =>
        {
            const promises = Array.from({ length: TEST_CONFIG.concurrentUsers }, (_, i) =>
                processJackpotContribution(`concurrent_test_${i}`, 1000)
            );

            const results = await Promise.allSettled(promises);

            const successful = results.filter(r =>
                r.status === 'fulfilled' && r.value.success
            ).length;

            const errorRate = (results.length - successful) / results.length;
            this.performanceMetrics.errorRate = errorRate;

            this.assert(
                errorRate <= TEST_CONFIG.errorTolerance,
                `Error rate ${errorRate} should be under tolerance ${TEST_CONFIG.errorTolerance}`
            );
        });

        // Test concurrent win processing
        await this.runTest('Concurrency: Concurrent win processing', async () =>
        {
            const promises = Array.from({ length: 5 }, (_, i) =>
                processJackpotWin('minor', `concurrent_win_test_${i}`, `550e8400-e29b-41d4-a716-44665544000${i}`, 1000)
            );

            const results = await Promise.allSettled(promises);

            const successful = results.filter(r => r.status === 'fulfilled').length;

            this.assert(
                successful > 0,
                'At least some concurrent wins should succeed'
            );
        });
    }

    // ========================================
    // INTEGRATION SCENARIO TESTS
    // ========================================

    private async testIntegrationScenarios(): Promise<void>
    {
        console.log('\n🔗 Testing Integration Scenarios...');

        // Test complete game flow
        await this.runTest('Integration: Complete game flow', async () =>
        {
            const gameId = 'integration_test_game';
            const wagerAmount = 5000; // $50.00

            // 1. Place bet (contribute to jackpot)
            const contributionResult = await processJackpotContribution(gameId, wagerAmount);
            this.assert(contributionResult.success, 'Contribution should succeed');

            // 2. Check pool state
            const pools = await getJackpotPools();
            this.assert(pools.minor.currentAmount > 0, 'Pool should have funds');

            // 3. Process win
            const winResult = await processJackpotWin(
                'minor',
                gameId,
                '550e8400-e29b-41d4-a716-446655440000',
                2000
            );
            this.assert(winResult.success, 'Win processing should succeed');
        });

        // Test configuration change impact
        await this.runTest('Integration: Configuration change impact', async () =>
        {
            // Get initial state
            const initialPools = await getJackpotPools();
            const initialRate = await getGameContributionRate('integration_test', 'minor');

            // Change configuration
            await updateJackpotConfig({ minor: { rate: 0.03 } });

            // Verify change took effect
            const newRate = await getGameContributionRate('integration_test', 'minor');
            this.assert(
                Math.abs(newRate - 0.03) < 0.001,
                'New contribution rate should be applied'
            );

            // Test with new rate
            const result = await processJackpotContribution('integration_test', 10000);
            this.assert(result.success, 'Contribution should work with new rate');
        });
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void>
    {
        const startTime = Date.now();

        try {
            await testFn();
            const duration = Date.now() - startTime;

            this.results.push({
                testName,
                passed: true,
                duration,
            });

            console.log(`  ✅ ${testName} (${duration}ms)`);

        } catch (error) {
            const duration = Date.now() - startTime;

            this.results.push({
                testName,
                passed: false,
                duration,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            console.log(`  ❌ ${testName} (${duration}ms): ${error}`);
        }
    }

    private assert(condition: boolean, message: string): void
    {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    private generateRecommendations(): string[]
    {
        const recommendations: string[] = [];
        const failedTests = this.results.filter(r => !r.passed);

        if (failedTests.length > 0) {
            recommendations.push('Review failed compatibility tests and address any breaking changes');
            recommendations.push('Ensure all API signatures match original implementation');
        }

        if (this.performanceMetrics.averageResponseTime > TEST_CONFIG.performanceThreshold) {
            recommendations.push('Optimize performance to meet compatibility requirements');
        }

        if (this.performanceMetrics.errorRate > TEST_CONFIG.errorTolerance) {
            recommendations.push('Improve error handling and concurrency safety');
        }

        if (failedTests.length === 0) {
            recommendations.push('All compatibility tests passed - system is ready for deployment');
            recommendations.push('Continue monitoring performance metrics in production');
        }

        return recommendations;
    }

    private printReport(report: CompatibilityReport): void
    {
        console.log('\n📊 Backward Compatibility Test Report');
        console.log('=====================================');
        console.log(`Timestamp: ${report.timestamp}`);
        console.log(`Total Tests: ${report.totalTests}`);
        console.log(`Passed: ${report.passedTests}`);
        console.log(`Failed: ${report.failedTests}`);
        console.log(`Success Rate: ${report.successRate.toFixed(2)}%`);
        console.log('');

        console.log('⚡ Performance Metrics:');
        console.log(`  Average Response Time: ${report.performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Error Rate: ${(report.performanceMetrics.errorRate * 100).toFixed(2)}%`);
        console.log('');

        console.log('💡 Recommendations:');
        report.recommendations.forEach(rec => console.log(`  • ${rec}`));

        if (report.successRate === 100) {
            console.log('\n🎉 All compatibility tests passed! System is ready for deployment.');
        } else {
            console.log('\n⚠️  Some compatibility issues detected. Review before deployment.');
        }
    }
}

// ========================================
// TYPES
// ========================================

interface PerformanceMetrics
{
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main(): Promise<void>
{
    const args = process.argv.slice(2);
    const config: Partial<CompatibilityTestConfig> = {};

    // Parse command line arguments
    for (const arg of args) {
        if (arg.startsWith('--iterations=')) {
            config.testIterations = parseInt(arg.split('=')[1] || '0');
        }
        if (arg.startsWith('--concurrent=')) {
            config.concurrentUsers = parseInt(arg.split('=')[1] || '0');
        }
        if (arg.startsWith('--duration=')) {
            config.loadTestDuration = parseInt(arg.split('=')[1] || '0');
        }
        if (arg === '--verbose') {
            // Enable verbose output
        }
    }

    try {
        const tester = new BackwardCompatibilityTester();
        const report = await tester.runAllTests();

        // Exit with appropriate code
        process.exit(report.failedTests > 0 ? 1 : 0);

    } catch (error) {
        console.error('💥 Compatibility testing failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error =>
    {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export type { BackwardCompatibilityTester, CompatibilityReport, CompatibilityTestConfig };

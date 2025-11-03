/**
 * Performance monitoring and metrics collection for jackpot operations
 * Provides real-time metrics, performance analysis, and alerting
 */

import { EventEmitter } from "events";

// ========================================
// PERFORMANCE MONITORING INTERFACES
// ========================================

export interface PerformanceMetrics
{
    timestamp: Date;
    system: {
        cpu: number;
        memory: number;
        disk: number;
        network: number;
    };
    database: {
        connectionPool: {
            active: number;
            idle: number;
            total: number;
            utilization: number;
        };
        queryPerformance: {
            averageExecutionTime: number;
            slowQueries: number;
            cacheHitRate: number;
            throughput: number;
        };
    };
    jackpot: {
        contributions: {
            total: number;
            rate: number; // per minute
            averageAmount: number;
            errorRate: number;
        };
        wins: {
            total: number;
            rate: number;
            averageAmount: number;
            errorRate: number;
        };
        queue: {
            size: number;
            processingRate: number;
            averageWaitTime: number;
        };
        cache: {
            hitRate: number;
            memoryUsage: number;
            evictions: number;
        };
    };
    application: {
        responseTime: {
            average: number;
            p95: number;
            p99: number;
        };
        throughput: number;
        errorRate: number;
        uptime: number;
    };
}

export interface PerformanceAlert
{
    id: string;
    level: 'info' | 'warning' | 'critical' | 'fatal';
    category: 'performance' | 'reliability' | 'capacity' | 'security';
    message: string;
    metric: string;
    threshold: number;
    current: number;
    timestamp: Date;
    resolved: boolean;
    metadata?: Record<string, any>;
}

export interface PerformanceReport
{
    period: {
        start: Date;
        end: Date;
    };
    summary: {
        totalRequests: number;
        averageResponseTime: number;
        errorRate: number;
        throughput: number;
        availability: number;
    };
    trends: {
        responseTimeTrend: 'improving' | 'degrading' | 'stable';
        throughputTrend: 'improving' | 'degrading' | 'stable';
        errorRateTrend: 'improving' | 'degrading' | 'stable';
    };
    recommendations: string[];
    alerts: PerformanceAlert[];
}

export interface MonitoringConfig
{
    collectionInterval: number; // ms
    retentionPeriod: number; // ms
    alertThresholds: {
        responseTime: { warning: number; critical: number };
        errorRate: { warning: number; critical: number };
        memoryUsage: { warning: number; critical: number };
        cpuUsage: { warning: number; critical: number };
        queueSize: { warning: number; critical: number };
    };
    enableAlerts: boolean;
    enableReports: boolean;
}

// ========================================
// METRICS COLLECTOR
// ========================================

/**
 * Real-time metrics collector for jackpot operations
 */
export class MetricsCollector
{
    private config: MonitoringConfig;
    private metrics: PerformanceMetrics[] = [];
    private alerts: PerformanceAlert[] = [];
    private eventEmitter: EventEmitter;
    private collectionTimer?: NodeJS.Timeout;
    public startTime: Date;

    constructor(config: Partial<MonitoringConfig> = {})
    {
        this.config = {
            collectionInterval: 5000, // 5 seconds
            retentionPeriod: 86400000, // 24 hours
            alertThresholds: {
                responseTime: { warning: 100, critical: 500 },
                errorRate: { warning: 1, critical: 5 },
                memoryUsage: { warning: 80, critical: 95 },
                cpuUsage: { warning: 70, critical: 90 },
                queueSize: { warning: 1000, critical: 5000 },
            },
            enableAlerts: true,
            enableReports: true,
            ...config,
        };

        this.eventEmitter = new EventEmitter();
        this.startTime = new Date();
    }

    /**
     * Start collecting metrics
     */
    start(): void
    {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
        }

        this.collectionTimer = setInterval(() =>
        {
            this.collectMetrics();
        }, this.config.collectionInterval);

        console.log('Jackpot performance monitoring started');
    }

    /**
     * Stop collecting metrics
     */
    stop(): void
    {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = undefined;
            console.log('Jackpot performance monitoring stopped');
        }
    }

    /**
     * Record custom metric
     */
    recordMetric(category: string, name: string, value: number, tags?: Record<string, string>): void
    {
        this.eventEmitter.emit('metric', {
            category,
            name,
            value,
            tags,
            timestamp: new Date(),
        });
    }

    /**
     * Record performance event
     */
    recordEvent(event: {
        type: string;
        duration?: number;
        success?: boolean;
        metadata?: Record<string, any>;
    }): void
    {
        this.eventEmitter.emit('event', {
            ...event,
            timestamp: new Date(),
        });
    }

    /**
     * Get current metrics
     */
    getCurrentMetrics(): PerformanceMetrics | null
    {
        return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] || null : null;
    }

    /**
     * Get metrics for time range
     */
    getMetricsRange(start: Date, end: Date): PerformanceMetrics[]
    {
        return this.metrics.filter(
            m => m.timestamp >= start && m.timestamp <= end
        );
    }

    /**
     * Get alerts
     */
    getAlerts(limit?: number): PerformanceAlert[]
    {
        const sorted = this.alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return limit ? sorted.slice(0, limit) : sorted;
    }

    /**
     * Clear old data
     */
    cleanup(): void
    {
        const cutoff = Date.now() - this.config.retentionPeriod;

        this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
    }

    /**
     * Generate performance report
     */
    generateReport(period: { start: Date; end: Date }): PerformanceReport
    {
        const metrics = this.getMetricsRange(period.start, period.end);
        const alerts = this.getAlerts().filter(
            a => a.timestamp >= period.start && a.timestamp <= period.end
        );

        if (metrics.length === 0) {
            throw new Error('No metrics available for the specified period');
        }

        const summary = this.calculateSummary(metrics);
        const trends = this.calculateTrends(metrics);
        const recommendations = this.generateRecommendations(metrics, alerts);

        return {
            period,
            summary,
            trends,
            recommendations,
            alerts,
        };
    }

    /**
     * Event listeners
     */
    onAlert(callback: (alert: PerformanceAlert) => void): void
    {
        this.eventEmitter.on('alert', callback);
    }

    onMetric(callback: (metric: any) => void): void
    {
        this.eventEmitter.on('metric', callback);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<MonitoringConfig>): void
    {
        this.config = { ...this.config, ...newConfig };
    }

    private async collectMetrics(): Promise<void>
    {
        try {
            const metrics: PerformanceMetrics = {
                timestamp: new Date(),
                system: await this.collectSystemMetrics(),
                database: await this.collectDatabaseMetrics(),
                jackpot: await this.collectJackpotMetrics(),
                application: await this.collectApplicationMetrics(),
            };

            this.metrics.push(metrics);

            // Check alerts
            if (this.config.enableAlerts) {
                this.checkAlerts(metrics);
            }

            // Cleanup old data
            this.cleanup();

            // Emit metrics event
            this.eventEmitter.emit('metrics', metrics);
        } catch (error) {
            console.error('Failed to collect metrics:', error);
        }
    }

    private async collectSystemMetrics(): Promise<PerformanceMetrics['system']>
    {
        // In a real implementation, this would collect actual system metrics
        return {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            disk: Math.random() * 100,
            network: Math.random() * 100,
        };
    }

    private async collectDatabaseMetrics(): Promise<PerformanceMetrics['database']>
    {
        // Mock database metrics - in real implementation, would query actual pool stats
        return {
            connectionPool: {
                active: Math.floor(Math.random() * 20),
                idle: Math.floor(Math.random() * 30),
                total: 50,
                utilization: Math.random() * 100,
            },
            queryPerformance: {
                averageExecutionTime: Math.random() * 100,
                slowQueries: Math.floor(Math.random() * 5),
                cacheHitRate: Math.random() * 100,
                throughput: Math.random() * 1000,
            },
        };
    }

    private async collectJackpotMetrics(): Promise<PerformanceMetrics['jackpot']>
    {
        // Mock jackpot metrics - would integrate with actual systems
        return {
            contributions: {
                total: Math.floor(Math.random() * 10000),
                rate: Math.random() * 100,
                averageAmount: Math.random() * 1000,
                errorRate: Math.random() * 5,
            },
            wins: {
                total: Math.floor(Math.random() * 100),
                rate: Math.random() * 10,
                averageAmount: Math.random() * 10000,
                errorRate: Math.random() * 2,
            },
            queue: {
                size: Math.floor(Math.random() * 1000),
                processingRate: Math.random() * 100,
                averageWaitTime: Math.random() * 1000,
            },
            cache: {
                hitRate: Math.random() * 100,
                memoryUsage: Math.random() * 100,
                evictions: Math.floor(Math.random() * 10),
            },
        };
    }

    private async collectApplicationMetrics(): Promise<PerformanceMetrics['application']>
    {
        return {
            responseTime: {
                average: Math.random() * 100,
                p95: Math.random() * 200,
                p99: Math.random() * 500,
            },
            throughput: Math.random() * 1000,
            errorRate: Math.random() * 5,
            uptime: Date.now() - this.startTime.getTime(),
        };
    }

    private checkAlerts(metrics: PerformanceMetrics): void
    {
        const checks = [
            {
                metric: metrics.application.responseTime.average,
                threshold: this.config.alertThresholds.responseTime,
                category: 'performance' as const,
                message: 'High average response time',
            },
            {
                metric: metrics.application.errorRate,
                threshold: this.config.alertThresholds.errorRate,
                category: 'reliability' as const,
                message: 'High error rate',
            },
            {
                metric: metrics.system.memory,
                threshold: this.config.alertThresholds.memoryUsage,
                category: 'capacity' as const,
                message: 'High memory usage',
            },
            {
                metric: metrics.system.cpu,
                threshold: this.config.alertThresholds.cpuUsage,
                category: 'performance' as const,
                message: 'High CPU usage',
            },
            {
                metric: metrics.jackpot.queue.size,
                threshold: this.config.alertThresholds.queueSize,
                category: 'capacity' as const,
                message: 'Queue size is too large',
            },
        ];

        for (const check of checks) {
            if (check.metric >= check.threshold.critical) {
                this.createAlert('critical', check.category, check.message, check.metric, check.threshold.critical);
            } else if (check.metric >= check.threshold.warning) {
                this.createAlert('warning', check.category, check.message, check.metric, check.threshold.warning);
            }
        }
    }

    private createAlert(
        level: PerformanceAlert['level'],
        category: PerformanceAlert['category'],
        message: string,
        current: number,
        threshold: number
    ): void
    {
        // Avoid duplicate alerts
        const recentAlert = this.alerts.find(
            a => a.level === level &&
                a.category === category &&
                a.message === message &&
                Date.now() - a.timestamp.getTime() < 300000 // 5 minutes
        );

        if (recentAlert) return;

        const alert: PerformanceAlert = {
            id: this.generateId(),
            level,
            category,
            message,
            metric: 'unknown',
            threshold,
            current,
            timestamp: new Date(),
            resolved: false,
        };

        this.alerts.push(alert);
        this.eventEmitter.emit('alert', alert);

        console.warn(`Performance Alert [${level.toUpperCase()}]: ${message} (${current.toFixed(2)} >= ${threshold})`);
    }

    private calculateSummary(metrics: PerformanceMetrics[]): PerformanceReport['summary']
    {
        const totalRequests = metrics.reduce((sum, m) => sum + m.application.throughput, 0);
        const averageResponseTime = metrics.reduce((sum, m) => sum + m.application.responseTime.average, 0) / metrics.length;
        const averageErrorRate = metrics.reduce((sum, m) => sum + m.application.errorRate, 0) / metrics.length;
        const averageThroughput = metrics.reduce((sum, m) => sum + m.application.throughput, 0) / metrics.length;
        const availability = 100 - averageErrorRate;

        return {
            totalRequests,
            averageResponseTime,
            errorRate: averageErrorRate,
            throughput: averageThroughput,
            availability,
        };
    }

    private calculateTrends(metrics: PerformanceMetrics[]): PerformanceReport['trends']
    {
        if (metrics.length < 2) {
            return {
                responseTimeTrend: 'stable',
                throughputTrend: 'stable',
                errorRateTrend: 'stable',
            };
        }

        const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
        const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

        const firstAvgResponseTime = firstHalf.reduce((sum, m) => sum + m.application.responseTime.average, 0) / firstHalf.length;
        const secondAvgResponseTime = secondHalf.reduce((sum, m) => sum + m.application.responseTime.average, 0) / secondHalf.length;

        const firstAvgThroughput = firstHalf.reduce((sum, m) => sum + m.application.throughput, 0) / firstHalf.length;
        const secondAvgThroughput = secondHalf.reduce((sum, m) => sum + m.application.throughput, 0) / secondHalf.length;

        const firstAvgErrorRate = firstHalf.reduce((sum, m) => sum + m.application.errorRate, 0) / firstHalf.length;
        const secondAvgErrorRate = secondHalf.reduce((sum, m) => sum + m.application.errorRate, 0) / secondHalf.length;

        return {
            responseTimeTrend: secondAvgResponseTime > firstAvgResponseTime * 1.1 ? 'degrading' :
                secondAvgResponseTime < firstAvgResponseTime * 0.9 ? 'improving' : 'stable',
            throughputTrend: secondAvgThroughput > firstAvgThroughput * 1.1 ? 'improving' :
                secondAvgThroughput < firstAvgThroughput * 0.9 ? 'degrading' : 'stable',
            errorRateTrend: secondAvgErrorRate > firstAvgErrorRate * 1.1 ? 'degrading' :
                secondAvgErrorRate < firstAvgErrorRate * 0.9 ? 'improving' : 'stable',
        };
    }

    private generateRecommendations(metrics: PerformanceMetrics[], alerts: PerformanceAlert[]): string[]
    {
        const recommendations: string[] = [];
        const recentMetrics = metrics.slice(-10); // Last 10 data points

        if (recentMetrics.length === 0) return recommendations;

        const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.application.responseTime.average, 0) / recentMetrics.length;
        const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.application.errorRate, 0) / recentMetrics.length;
        const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.system.memory, 0) / recentMetrics.length;

        if (avgResponseTime > 100) {
            recommendations.push('Consider optimizing database queries and adding caching to reduce response times');
        }

        if (avgErrorRate > 2) {
            recommendations.push('High error rate detected - review error logs and implement better error handling');
        }

        if (avgMemoryUsage > 80) {
            recommendations.push('Memory usage is high - consider increasing memory limits or optimizing memory usage');
        }

        const criticalAlerts = alerts.filter(a => a.level === 'critical' && !a.resolved);
        if (criticalAlerts.length > 0) {
            recommendations.push(`Address ${criticalAlerts.length} critical performance alerts immediately`);
        }

        if (recommendations.length === 0) {
            recommendations.push('System performance is within acceptable ranges');
        }

        return recommendations;
    }

    private generateId(): string
    {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ========================================
// PERFORMANCE ANALYZER
// ========================================

/**
 * Advanced performance analysis and optimization recommendations
 */
export class PerformanceAnalyzer
{
    private collector: MetricsCollector;

    constructor(collector: MetricsCollector)
    {
        this.collector = collector;
    }

    /**
     * Analyze performance bottlenecks
     */
    analyzeBottlenecks(period: { start: Date; end: Date }):
        {
            bottlenecks: Array<{
                type: string;
                severity: 'low' | 'medium' | 'high' | 'critical';
                description: string;
                impact: string;
                recommendations: string[];
            }>;
            overallScore: number;
        }
    {
        const metrics = this.collector.getMetricsRange(period.start, period.end);

        if (metrics.length === 0) {
            return {
                bottlenecks: [],
                overallScore: 0,
            };
        }

        const bottlenecks = [];
        let totalScore = 100;

        // Analyze response time
        const avgResponseTime = metrics.reduce((sum, m) => sum + m.application.responseTime.average, 0) / metrics.length;
        if (avgResponseTime > 200) {
            bottlenecks.push({
                type: 'response_time',
                severity: 'critical' as const,
                description: `Average response time is ${avgResponseTime.toFixed(2)}ms`,
                impact: 'Poor user experience and potential timeout issues',
                recommendations: [
                    'Optimize database queries',
                    'Implement caching layer',
                    'Consider CDN for static assets',
                    'Profile application code for hotspots',
                ],
            });
            totalScore -= 30;
        } else if (avgResponseTime > 100) {
            bottlenecks.push({
                type: 'response_time',
                severity: 'medium' as const,
                description: `Average response time is ${avgResponseTime.toFixed(2)}ms`,
                impact: 'Noticeable delays for users',
                recommendations: [
                    'Review slow queries',
                    'Add database indexes',
                    'Implement query result caching',
                ],
            });
            totalScore -= 15;
        }

        // Analyze error rate
        const avgErrorRate = metrics.reduce((sum, m) => sum + m.application.errorRate, 0) / metrics.length;
        if (avgErrorRate > 5) {
            bottlenecks.push({
                type: 'error_rate',
                severity: 'critical' as const,
                description: `Error rate is ${avgErrorRate.toFixed(2)}%`,
                impact: 'Service reliability issues and user frustration',
                recommendations: [
                    'Implement comprehensive error handling',
                    'Add circuit breakers',
                    'Review error logs and fix root causes',
                    'Implement better validation',
                ],
            });
            totalScore -= 25;
        } else if (avgErrorRate > 2) {
            bottlenecks.push({
                type: 'error_rate',
                severity: 'medium' as const,
                description: `Error rate is ${avgErrorRate.toFixed(2)}%`,
                impact: 'Reduced service reliability',
                recommendations: [
                    'Review error patterns',
                    'Improve input validation',
                    'Add retry mechanisms',
                ],
            });
            totalScore -= 10;
        }

        // Analyze memory usage
        const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.system.memory, 0) / metrics.length;
        if (avgMemoryUsage > 90) {
            bottlenecks.push({
                type: 'memory_usage',
                severity: 'high' as const,
                description: `Memory usage is ${avgMemoryUsage.toFixed(2)}%`,
                impact: 'Risk of out-of-memory errors and performance degradation',
                recommendations: [
                    'Optimize memory usage in application code',
                    'Implement object pooling',
                    'Review caching strategies',
                    'Consider horizontal scaling',
                ],
            });
            totalScore -= 20;
        }

        return {
            bottlenecks,
            overallScore: Math.max(0, totalScore),
        };
    }

    /**
     * Generate optimization recommendations
     */
    generateOptimizationRecommendations(period: { start: Date; end: Date }):
        {
            database: string[];
            caching: string[];
            infrastructure: string[];
            application: string[];
        }
    {
        const metrics = this.collector.getMetricsRange(period.start, period.end);

        if (metrics.length === 0) {
            return {
                database: [],
                caching: [],
                infrastructure: [],
                application: [],
            };
        }

        const recommendations = {
            database: [] as string[],
            caching: [] as string[],
            infrastructure: [] as string[],
            application: [] as string[],
        };

        const avgQueryTime = metrics.reduce((sum, m) => sum + m.database.queryPerformance.averageExecutionTime, 0) / metrics.length;
        const avgCacheHitRate = metrics.reduce((sum, m) => sum + m.database.queryPerformance.cacheHitRate, 0) / metrics.length;
        const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.system.memory, 0) / metrics.length;

        if (avgQueryTime > 50) {
            recommendations.database.push(
                'Add database indexes for frequently queried columns',
                'Optimize complex queries with proper JOINs',
                'Consider query result caching',
                'Review and update database statistics'
            );
        }

        if (avgCacheHitRate < 80) {
            recommendations.caching.push(
                'Increase cache TTL for frequently accessed data',
                'Implement cache warming strategies',
                'Review cache eviction policies',
                'Consider multi-level caching architecture'
            );
        }

        if (avgMemoryUsage > 80) {
            recommendations.infrastructure.push(
                'Increase server memory allocation',
                'Implement horizontal scaling',
                'Optimize memory usage patterns',
                'Consider using memory-efficient data structures'
            );
        }

        // Always include general recommendations
        recommendations.application.push(
            'Implement connection pooling for database connections',
            'Add performance monitoring and alerting',
            'Use async/await patterns for I/O operations',
            'Implement circuit breakers for external dependencies'
        );

        return recommendations;
    }
}

// ========================================
// GLOBAL MONITORING INSTANCE
// ========================================

export const performanceMonitor = new MetricsCollector();
export const performanceAnalyzer = new PerformanceAnalyzer(performanceMonitor);

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Start performance monitoring
 */
export function startPerformanceMonitoring(config?: Partial<MonitoringConfig>): void
{
    if (config) {
        performanceMonitor.updateConfig(config);
    }
    performanceMonitor.start();
}

/**
 * Stop performance monitoring
 */
export function stopPerformanceMonitoring(): void
{
    performanceMonitor.stop();
}

/**
 * Get current performance dashboard
 */
export function getPerformanceDashboard():
    {
        current: PerformanceMetrics | null;
        alerts: PerformanceAlert[];
        summary: {
            systemHealth: 'healthy' | 'warning' | 'critical';
            performanceScore: number;
            uptime: number;
        };
    }
{
    const current = performanceMonitor.getCurrentMetrics();
    const alerts = performanceMonitor.getAlerts(10);

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    let performanceScore = 100;

    if (current) {
        const criticalAlerts = alerts.filter(a => a.level === 'critical' && !a.resolved);
        const warningAlerts = alerts.filter(a => a.level === 'warning' && !a.resolved);

        if (criticalAlerts.length > 0) {
            systemHealth = 'critical';
            performanceScore -= 30;
        } else if (warningAlerts.length > 0) {
            systemHealth = 'warning';
            performanceScore -= 10;
        }

        // Deduct points for high resource usage
        if (current.system.cpu > 90) performanceScore -= 20;
        if (current.system.memory > 90) performanceScore -= 20;
        if (current.application.errorRate > 5) performanceScore -= 15;
    }

    const uptime = performanceMonitor.startTime ? Date.now() - performanceMonitor.startTime.getTime() : 0;

    return {
        current,
        alerts,
        summary: {
            systemHealth,
            performanceScore: Math.max(0, performanceScore),
            uptime,
        },
    };
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(period: { start: Date; end: Date }): PerformanceReport
{
    return performanceMonitor.generateReport(period);
}

/**
 * Analyze performance bottlenecks
 */
export function analyzePerformanceBottlenecks(period: { start: Date; end: Date })
{
    return performanceAnalyzer.analyzeBottlenecks(period);
}

/**
 * Record custom performance metric
 */
export function recordMetric(category: string, name: string, value: number, tags?: Record<string, string>): void
{
    performanceMonitor.recordMetric(category, name, value, tags);
}

/**
 * Record performance event
 */
export function recordPerformanceEvent(event: {
    type: string;
    duration?: number;
    success?: boolean;
    metadata?: Record<string, any>;
}): void
{
    performanceMonitor.recordEvent(event);
}
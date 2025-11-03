# Jackpot Service Monitoring and Health Check Guide

## Overview

This guide provides comprehensive monitoring strategies, health check implementations, and alerting configurations for the jackpot service. It covers real-time monitoring, performance metrics, alerting systems, and operational dashboards to ensure optimal system health and performance.

## Health Check Endpoints

### Service Health Endpoint

```typescript
// GET /health
// Returns overall service health status

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    jackpotService: HealthCheck;
    cache: HealthCheck;
    externalServices: HealthCheck;
  };
  metrics: HealthMetrics;
}

interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: string;
  details?: any;
  error?: string;
}

// Example Response
{
  "status": "healthy",
  "timestamp": "2025-11-01T04:56:00.000Z",
  "uptime": 86400,
  "version": "2.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 45,
      "lastCheck": "2025-11-01T04:55:55.000Z",
      "details": {
        "connectionPool": {
          "total": 20,
          "active": 5,
          "idle": 15,
          "waiting": 0
        }
      }
    },
    "jackpotService": {
      "status": "up",
      "responseTime": 12,
      "lastCheck": "2025-11-01T04:55:58.000Z",
      "details": {
        "lastContribution": "2025-11-01T04:55:45.000Z",
        "activePools": 3
      }
    },
    "cache": {
      "status": "up",
      "responseTime": 3,
      "lastCheck": "2025-11-01T04:55:59.000Z",
      "details": {
        "hitRate": 0.95,
        "memoryUsage": "45MB"
      }
    },
    "externalServices": {
      "status": "up",
      "responseTime": 150,
      "lastCheck": "2025-11-01T04:55:50.000Z",
      "details": {
        "services": {
          "paymentGateway": "up",
          "userService": "up",
          "gameEngine": "up"
        }
      }
    }
  },
  "metrics": {
    "requestsPerSecond": 25.5,
    "averageResponseTime": 85,
    "errorRate": 0.02,
    "activeUsers": 150
  }
}
```

### Database Health Check

```typescript
// GET /health/database
// Returns detailed database health information

interface DatabaseHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connection: {
    status: 'connected' | 'disconnected' | 'timeout';
    responseTime: number;
    poolStats: {
      total: number;
      active: number;
      idle: number;
      waiting: number;
      max: number;
    };
  };
  performance: {
    queryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  integrity: {
    jackpotTableAccessible: boolean;
    constraintViolations: number;
    lastBackup: string;
  };
  alerts: DatabaseAlert[];
}

interface DatabaseAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Implementation
import { db } from '@/libs/database/db';
import { jackpotTable } from '@/libs/database/schema/jackpot';
import { sql } from 'drizzle-orm';

export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    // Get connection pool stats
    const poolStats = await getConnectionPoolStats();
    
    // Check jackpot table accessibility
    const jackpotCheck = await db.select().from(jackpotTable).limit(1);
    
    // Performance metrics
    const performanceMetrics = await getDatabasePerformanceMetrics();
    
    const status = determineDatabaseStatus(responseTime, poolStats, performanceMetrics);
    
    return {
      status,
      connection: {
        status: responseTime < 5000 ? 'connected' : 'timeout',
        responseTime,
        poolStats,
      },
      performance: performanceMetrics,
      integrity: {
        jackpotTableAccessible: jackpotCheck.length >= 0,
        constraintViolations: 0, // Would implement actual check
        lastBackup: await getLastBackupTime(),
      },
      alerts: generateDatabaseAlerts(poolStats, performanceMetrics),
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      connection: {
        status: 'disconnected',
        responseTime: Date.now() - startTime,
        poolStats: { total: 0, active: 0, idle: 0, waiting: 0, max: 0 },
      },
      performance: { queryTime: 0, slowQueries: 0, cacheHitRate: 0 },
      integrity: {
        jackpotTableAccessible: false,
        constraintViolations: 0,
        lastBackup: '',
      },
      alerts: [{
        severity: 'critical',
        message: `Database health check failed: ${error}`,
        timestamp: new Date().toISOString(),
        resolved: false,
      }],
    };
  }
}
```

### Jackpot Service Health Check

```typescript
// GET /health/jackpot
// Returns jackpot-specific health information

interface JackpotHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pools: {
    minor: PoolHealth;
    major: PoolHealth;
    mega: PoolHealth;
  };
  operations: {
    contributions: OperationHealth;
    wins: OperationHealth;
  };
  performance: {
    averageResponseTime: number;
    throughputPerSecond: number;
    errorRate: number;
  };
  lastActivity: {
    lastContribution: string;
    lastWin: string;
    lastConfigChange: string;
  };
}

interface PoolHealth {
  status: 'active' | 'inactive' | 'error';
  currentAmount: number;
  totalContributions: number;
  totalWins: number;
  lastUpdate: string;
  version: number;
}

interface OperationHealth {
  status: 'operational' | 'degraded' | 'down';
  successRate: number;
  averageTime: number;
  lastOperation: string;
  queueSize?: number;
}

// Implementation
export async function getJackpotHealth(): Promise<JackpotHealthResponse> {
  try {
    const pools = await getJackpotPools();
    const performanceMetrics = await getJackpotPerformanceMetrics();
    const operationStats = await getOperationStatistics();
    
    const poolHealth: Record<string, PoolHealth> = {};
    
    for (const [group, pool] of Object.entries(pools)) {
      poolHealth[group] = {
        status: pool.currentAmount >= 0 ? 'active' : 'error',
        currentAmount: pool.currentAmount,
        totalContributions: pool.totalContributions,
        totalWins: pool.totalWins,
        lastUpdate: new Date().toISOString(),
        version: 0, // Would implement version tracking
      };
    }
    
    return {
      status: determineJackpotStatus(poolHealth, performanceMetrics),
      pools: poolHealth,
      operations: operationStats,
      performance: performanceMetrics,
      lastActivity: await getLastActivityTimes(),
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      pools: {
        minor: { status: 'error', currentAmount: 0, totalContributions: 0, totalWins: 0, lastUpdate: '', version: 0 },
        major: { status: 'error', currentAmount: 0, totalContributions: 0, totalWins: 0, lastUpdate: '', version: 0 },
        mega: { status: 'error', currentAmount: 0, totalContributions: 0, totalWins: 0, lastUpdate: '', version: 0 },
      },
      operations: {
        contributions: { status: 'down', successRate: 0, averageTime: 0, lastOperation: '' },
        wins: { status: 'down', successRate: 0, averageTime: 0, lastOperation: '' },
      },
      performance: { averageResponseTime: 0, throughputPerSecond: 0, errorRate: 1.0 },
      lastActivity: { lastContribution: '', lastWin: '', lastConfigChange: '' },
    };
  }
}
```

## Real-Time Monitoring

### Performance Metrics Collector

```typescript
interface MetricCollector {
  record(value: number, tags?: Record<string, string>): void;
  getValue(): number;
  getHistory(): MetricPoint[];
  reset(): void;
}

interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

class JackpotMetricsCollector {
  private metrics = new Map<string, MetricCollector>();
  private historySize = 1000;
  
  constructor() {
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    // Response time metrics
    this.metrics.set('response_time_contribution', new ResponseTimeMetric());
    this.metrics.set('response_time_win', new ResponseTimeMetric());
    this.metrics.set('response_time_pool_query', new ResponseTimeMetric());
    
    // Throughput metrics
    this.metrics.set('contributions_per_second', new ThroughputMetric());
    this.metrics.set('wins_per_minute', new ThroughputMetric());
    
    // Business metrics
    this.metrics.set('total_jackpot_amount', new GaugeMetric());
    this.metrics.set('active_users', new GaugeMetric());
    
    // Error metrics
    this.metrics.set('error_rate', new ErrorRateMetric());
    this.metrics.set('timeout_rate', new ErrorRateMetric());
    
    // System metrics
    this.metrics.set('database_connections', new GaugeMetric());
    this.metrics.set('memory_usage', new GaugeMetric());
    this.metrics.set('cpu_usage', new GaugeMetric());
  }
  
  recordContribution(duration: number, success: boolean): void {
    this.metrics.get('response_time_contribution')!.record(duration);
    this.metrics.get('contributions_per_second')!.increment();
    
    if (!success) {
      this.metrics.get('error_rate')!.increment();
    }
  }
  
  recordWinProcessing(duration: number, success: boolean): void {
    this.metrics.get('response_time_win')!.record(duration);
    this.metrics.get('wins_per_minute')!.increment();
    
    if (!success) {
      this.metrics.get('error_rate')!.increment();
    }
  }
  
  recordPoolQuery(duration: number): void {
    this.metrics.get('response_time_pool_query')!.record(duration);
  }
  
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.get('memory_usage')!.set(memUsage.heapUsed / 1024 / 1024); // MB
    
    // CPU usage would require system monitoring
    // this.metrics.get('cpu_usage')!.set(getCpuUsage());
    
    // Database connections would come from connection pool
    // this.metrics.get('database_connections')!.set(getConnectionCount());
  }
  
  getMetricsSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    
    for (const [name, collector] of this.metrics) {
      snapshot[name] = {
        current: collector.getValue(),
        history: collector.getHistory().slice(-100), // Last 100 points
      };
    }
    
    return snapshot;
  }
  
  // Specific metric getters
  getResponseTimeMetrics(): ResponseTimeMetrics {
    return {
      contribution: {
        average: this.metrics.get('response_time_contribution')!.getValue(),
        p50: this.metrics.get('response_time_contribution')!.getPercentile(50),
        p95: this.metrics.get('response_time_contribution')!.getPercentile(95),
        p99: this.metrics.get('response_time_contribution')!.getPercentile(99),
      },
      win: {
        average: this.metrics.get('response_time_win')!.getValue(),
        p50: this.metrics.get('response_time_win')!.getPercentile(50),
        p95: this.metrics.get('response_time_win')!.getPercentile(95),
        p99: this.metrics.get('response_time_win')!.getPercentile(99),
      },
      poolQuery: {
        average: this.metrics.get('response_time_pool_query')!.getValue(),
        p50: this.metrics.get('response_time_pool_query')!.getPercentile(50),
        p95: this.metrics.get('response_time_pool_query')!.getPercentile(95),
        p99: this.metrics.get('response_time_pool_query')!.getPercentile(99),
      },
    };
  }
  
  getThroughputMetrics(): ThroughputMetrics {
    return {
      contributionsPerSecond: this.metrics.get('contributions_per_second')!.getRate(),
      winsPerMinute: this.metrics.get('wins_per_minute')!.getRate(),
    };
  }
  
  getErrorMetrics(): ErrorMetrics {
    return {
      errorRate: this.metrics.get('error_rate')!.getRate(),
      timeoutRate: this.metrics.get('timeout_rate')!.getRate(),
    };
  }
}
```

### Metrics Endpoint

```typescript
// GET /metrics
// Returns comprehensive system metrics

interface MetricsResponse {
  timestamp: string;
  uptime: number;
  response_times: ResponseTimeMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
  resources: ResourceMetrics;
  business: BusinessMetrics;
}

interface ResponseTimeMetrics {
  contribution: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  win: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  poolQuery: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

interface ThroughputMetrics {
  contributionsPerSecond: number;
  winsPerMinute: number;
  totalRequests: number;
}

interface ErrorMetrics {
  errorRate: number;
  timeoutRate: number;
  totalErrors: number;
  errorTypes: Record<string, number>;
}

interface ResourceMetrics {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  databaseConnections: number;
  cacheHitRate: number;
}

interface BusinessMetrics {
  totalJackpotAmount: number;
  activeUsers: number;
  jackpotGrowthRate: number;
  dailyContributions: number;
}

// Implementation
export async function getMetrics(): Promise<MetricsResponse> {
  const metrics = new JackpotMetricsCollector();
  
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    response_times: metrics.getResponseTimeMetrics(),
    throughput: metrics.getThroughputMetrics(),
    errors: metrics.getErrorMetrics(),
    resources: await getResourceMetrics(),
    business: await getBusinessMetrics(),
  };
}

async function getResourceMetrics(): Promise<ResourceMetrics> {
  const memUsage = process.memoryUsage();
  
  return {
    memoryUsageMB: memUsage.heapUsed / 1024 / 1024,
    cpuUsagePercent: await getCpuUsage(),
    databaseConnections: await getActiveConnectionCount(),
    cacheHitRate: await getCacheHitRate(),
  };
}

async function getBusinessMetrics(): Promise<BusinessMetrics> {
  const pools = await getJackpotPools();
  const totalAmount = Object.values(pools)
    .reduce((sum, pool) => sum + pool.currentAmount, 0);
  
  return {
    totalJackpotAmount: totalAmount,
    activeUsers: await getActiveUserCount(),
    jackpotGrowthRate: await calculateGrowthRate(),
    dailyContributions: await getDailyContributionCount(),
  };
}
```

## Alerting System

### Alert Manager

```typescript
interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown: number; // seconds
  channels: AlertChannel[];
}

interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number; // seconds
}

interface AlertChannel {
  type: 'email' | 'slack' | 'pagerduty' | 'webhook';
  config: Record<string, any>;
}

interface Alert {
  id: string;
  ruleId: string;
  name: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata: Record<string, any>;
}

class JackpotAlertManager {
  private rules: AlertRule[] = [];
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private lastCheck = new Map<string, number>();
  
  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }
  
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Jackpot service response time is elevated',
        condition: {
          metric: 'response_time_contribution_average',
          operator: 'gt',
          threshold: 500, // 500ms
          duration: 60, // 1 minute
        },
        severity: 'warning',
        enabled: true,
        cooldown: 300, // 5 minutes
        channels: [
          { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK_URL } },
          { type: 'email', config: { to: 'ops@example.com' } },
        ],
      },
      {
        id: 'service_down',
        name: 'Service Unavailable',
        description: 'Jackpot service is not responding',
        condition: {
          metric: 'service_health',
          operator: 'eq',
          threshold: 0, // 0 = down
          duration: 30, // 30 seconds
        },
        severity: 'critical',
        enabled: true,
        cooldown: 60,
        channels: [
          { type: 'pagerduty', config: { serviceKey: process.env.PAGERDUTY_KEY } },
          { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK_URL } },
          { type: 'email', config: { to: 'oncall@example.com' } },
        ],
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate has exceeded acceptable threshold',
        condition: {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 0.05, // 5%
          duration: 120, // 2 minutes
        },
        severity: 'warning',
        enabled: true,
        cooldown: 600,
        channels: [
          { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK_URL } },
        ],
      },
      {
        id: 'database_connection_issues',
        name: 'Database Connection Problems',
        description: 'Database connection issues detected',
        condition: {
          metric: 'database_response_time',
          operator: 'gt',
          threshold: 2000, // 2 seconds
          duration: 60,
        },
        severity: 'critical',
        enabled: true,
        cooldown: 120,
        channels: [
          { type: 'pagerduty', config: { serviceKey: process.env.PAGERDUTY_KEY } },
          { type: 'email', config: { to: 'dba@example.com' } },
        ],
      },
      {
        id: 'low_jackpot_amounts',
        name: 'Low Jackpot Amounts',
        description: 'Jackpot amounts have fallen below minimum threshold',
        condition: {
          metric: 'total_jackpot_amount',
          operator: 'lt',
          threshold: 100000, // $1000
          duration: 300, // 5 minutes
        },
        severity: 'info',
        enabled: true,
        cooldown: 1800,
        channels: [
          { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK_URL } },
        ],
      },
    ];
  }
  
  private startMonitoring(): void {
    // Check alerts every 30 seconds
    setInterval(() => {
      this.checkAlerts();
    }, 30000);
  }
  
  private async checkAlerts(): Promise<void> {
    const metrics = await this.collectCurrentMetrics();
    
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      try {
        const triggered = await this.evaluateRule(rule, metrics);
        
        if (triggered) {
          await this.triggerAlert(rule, metrics);
        } else {
          await this.resolveAlert(rule.id);
        }
        
      } catch (error) {
        console.error(`Error checking alert rule ${rule.id}:`, error);
      }
    }
  }
  
  private async evaluateRule(rule: AlertRule, metrics: Record<string, number>): Promise<boolean> {
    const value = metrics[rule.condition.metric];
    if (value === undefined) return false;
    
    const { operator, threshold, duration } = rule.condition;
    
    let conditionMet = false;
    switch (operator) {
      case 'gt':
        conditionMet = value > threshold;
        break;
      case 'lt':
        conditionMet = value < threshold;
        break;
      case 'eq':
        conditionMet = value === threshold;
        break;
      case 'ne':
        conditionMet = value !== threshold;
        break;
    }
    
    if (conditionMet) {
      const lastTrigger = this.lastCheck.get(rule.id) || 0;
      const now = Date.now();
      
      if (now - lastTrigger > rule.cooldown * 1000) {
        this.lastCheck.set(rule.id, now);
        return true;
      }
    }
    
    return false;
  }
  
  private async triggerAlert(rule: AlertRule, metrics: Record<string, number>): Promise<void> {
    const alertId = rule.id;
    
    // Don't trigger duplicate alerts
    if (this.activeAlerts.has(alertId)) {
      return;
    }
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      message: this.generateAlertMessage(rule, metrics),
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata: {
        currentValue: metrics[rule.condition.metric],
        threshold: rule.condition.threshold,
        duration: rule.condition.duration,
      },
    };
    
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    
    // Send notifications
    for (const channel of rule.channels) {
      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        console.error(`Failed to send alert notification:`, error);
      }
    }
    
    console.log(`🚨 Alert triggered: ${rule.name} - ${alert.message}`);
  }
  
  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;
    
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    
    this.activeAlerts.delete(ruleId);
    this.lastCheck.delete(ruleId);
    
    console.log(`✅ Alert resolved: ${alert.name}`);
  }
  
  private generateAlertMessage(rule: AlertRule, metrics: Record<string, number>): string {
    const value = metrics[rule.condition.metric];
    const threshold = rule.condition.threshold;
    
    switch (rule.severity) {
      case 'critical':
        return `CRITICAL: ${rule.description}. Current value: ${value}, threshold: ${threshold}`;
      case 'warning':
        return `WARNING: ${rule.description}. Current value: ${value}, threshold: ${threshold}`;
      default:
        return `INFO: ${rule.description}. Current value: ${value}, threshold: ${threshold}`;
    }
  }
  
  private async sendNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(channel.config, alert);
        break;
      case 'email':
        await this.sendEmailNotification(channel.config, alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(channel.config, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel.config, alert);
        break;
    }
  }
  
  private async collectCurrentMetrics(): Promise<Record<string, number>> {
    const response = await fetch('http://localhost:3000/metrics');
    const metrics = await response.json();
    
    return {
      service_health: metrics.status === 'healthy' ? 1 : 0,
      response_time_contribution_average: metrics.response_times.contribution.average,
      response_time_win_average: metrics.response_times.win.average,
      response_time_pool_query_average: metrics.response_times.poolQuery.average,
      error_rate: metrics.errors.errorRate,
      database_response_time: await this.measureDatabaseResponseTime(),
      total_jackpot_amount: metrics.business.totalJackpotAmount,
    };
  }
  
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }
}
```

### Alert History Endpoint

```typescript
// GET /alerts
// Returns current alerts and alert history

interface AlertsResponse {
  active: Alert[];
  history: Alert[];
  rules: AlertRule[];
  summary: {
    totalActive: number;
    critical: number;
    warning: number;
    info: number;
  };
}

// Implementation
export async function getAlerts(limit: number = 100): Promise<AlertsResponse> {
  const alertManager = getAlertManagerInstance();
  
  return {
    active: alertManager.getActiveAlerts(),
    history: alertManager.getAlertHistory(limit),
    rules: alertManager.getRules(),
    summary: {
      totalActive: alertManager.getActiveAlerts().length,
      critical: alertManager.getActiveAlerts().filter(a => a.severity === 'critical').length,
      warning: alertManager.getActiveAlerts().filter(a => a.severity === 'warning').length,
      info: alertManager.getActiveAlerts().filter(a => a.severity === 'info').length,
    },
  };
}
```

## Monitoring Dashboards

### Real-Time Dashboard Implementation

```typescript
// Real-time monitoring dashboard data
interface DashboardData {
  overview: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    activeUsers: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  performance: {
    responseTimes: ResponseTimeMetrics;
    throughput: ThroughputMetrics;
    trends: TrendData[];
  };
  business: {
    totalJackpotAmount: number;
    dailyGrowth: number;
    topGames: GameStats[];
    userActivity: UserActivityStats;
  };
  system: {
    resources: ResourceMetrics;
    database: DatabaseMetrics;
    cache: CacheMetrics;
  };
  alerts: {
    active: Alert[];
    recent: Alert[];
  };
}

class JackpotDashboard {
  async getDashboardData(): Promise<DashboardData> {
    const [health, metrics, business, system, alerts] = await Promise.all([
      this.getServiceHealth(),
      this.getDetailedMetrics(),
      this.getBusinessMetrics(),
      this.getSystemMetrics(),
      this.getAlerts(),
    ]);
    
    return {
      overview: {
        status: health.status,
        uptime: process.uptime(),
        activeUsers: system.activeUsers,
        requestsPerSecond: metrics.throughput.contributionsPerSecond,
        errorRate: metrics.errors.errorRate,
      },
      performance: {
        responseTimes: metrics.response_times,
        throughput: metrics.throughput,
        trends: await this.getTrendData(),
      },
      business: {
        totalJackpotAmount: business.totalJackpotAmount,
        dailyGrowth: business.dailyGrowth,
        topGames: business.topGames,
        userActivity: business.userActivity,
      },
      system: {
        resources: system.resources,
        database: system.database,
        cache: system.cache,
      },
      alerts: {
        active: alerts.active,
        recent: alerts.history.slice(-10),
      },
    };
  }
  
  private async getTrendData(): Promise<TrendData[]> {
    // Generate trend data for charts
    const now = Date.now();
    const points = [];
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // Hourly data
      points.push({
        timestamp,
        responseTime: Math.random() * 200 + 50, // Mock data
        throughput: Math.random() * 50 + 10,
        errorRate: Math.random() * 0.05,
        jackpotAmount: Math.random() * 10000 + 50000,
      });
    }
    
    return points;
  }
}
```

### Dashboard Endpoints

```typescript
// GET /dashboard
// Returns comprehensive dashboard data
export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const dashboard = new JackpotDashboard();
    const data = await dashboard.getDashboardData();
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET /dashboard/realtime
// Returns real-time updates for WebSocket clients
export async function getRealtimeUpdates(): Promise<WebSocketMessage> {
  const dashboard = new JackpotDashboard();
  const data = await dashboard.getDashboardData();
  
  return {
    type: 'dashboard_update',
    data,
    timestamp: new Date().toISOString(),
  };
}
```

## Log Monitoring

### Structured Logging

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  operation: string;
  correlationId: string;
  userId?: string;
  gameId?: string;
  duration?: number;
  metadata: Record<string, any>;
  message: string;
}

class JackpotLogger {
  private serviceName = 'jackpot-service';
  
  logContribution(
    action: 'START' | 'SUCCESS' | 'ERROR',
    gameId: string,
    wagerAmount: number,
    result: JackpotContributionResult,
    correlationId: string,
    duration?: number
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: action === 'ERROR' ? 'error' : 'info',
      service: this.serviceName,
      operation: 'jackpot_contribution',
      correlationId,
      gameId,
      duration,
      metadata: {
        action,
        wagerAmount,
        contributionAmount: result.totalContribution,
        contributions: result.contributions,
        success: result.success,
      },
      message: `Jackpot contribution ${action.toLowerCase()}: ${result.totalContribution} cents`,
    };
    
    this.writeLog(logEntry);
  }
  
  logWin(
    action: 'START' | 'SUCCESS' | 'ERROR',
    group: JackpotGroup,
    gameId: string,
    userId: string,
    winAmount: number,
    result: JackpotWinResult,
    correlationId: string,
    duration?: number
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: action === 'ERROR' ? 'error' : 'info',
      service: this.serviceName,
      operation: 'jackpot_win',
      correlationId,
      userId,
      gameId,
      duration,
      metadata: {
        action,
        group,
        winAmount,
        actualWinAmount: result.actualWinAmount,
        remainingAmount: result.remainingAmount,
        success: result.success,
      },
      message: `Jackpot win ${action.toLowerCase()}: ${result.actualWinAmount} cents to ${userId}`,
    };
    
    this.writeLog(logEntry);
  }
  
  logConfigurationChange(
    changes: Record<string, any>,
    userId: string,
    correlationId: string
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      service: this.serviceName,
      operation: 'config_change',
      correlationId,
      userId,
      metadata: {
        changes,
        action: 'configuration_update',
      },
      message: `Configuration updated by ${userId}`,
    };
    
    this.writeLog(logEntry);
  }
  
  private writeLog(entry: LogEntry): void {
    // Write to structured logging system (e.g., Winston, Pino)
    console.log(JSON.stringify(entry));
    
    // Send to log aggregation service
    this.sendToLogAggregation(entry);
  }
  
  private async sendToLogAggregation(entry: LogEntry): Promise<void> {
    // Implementation would send to ELK stack, CloudWatch, etc.
    // For now, just a placeholder
  }
}
```

## Health Check Automation

### Kubernetes Health Checks

```yaml
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jackpot-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: jackpot-service
  template:
    metadata:
      labels:
        app: jackpot-service
    spec:
      containers:
      - name: jackpot-service
        image: jackpot-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        # Health check configuration
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
          
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Docker Health Checks

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies and build application
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

## Monitoring Best Practices

### Key Performance Indicators (KPIs)

1. **Response Time SLAs**
   - Contribution processing: < 100ms (P95)
   - Win processing: < 150ms (P95)
   - Pool queries: < 50ms (P95)

2. **Availability Targets**
   - Service uptime: 99.9%
   - Database availability: 99.95%
   - Cache availability: 99%

3. **Error Rate Thresholds**
   - Application errors: < 0.1%
   - Database errors: < 0.05%
   - Timeout rate: < 0.01%

4. **Business Metrics**
   - Daily jackpot contributions: Monitor trends
   - Jackpot growth rate: Ensure positive growth
   - User engagement: Track active users

### Alert Strategy

1. **Immediate Alerts (Critical)**
   - Service unavailability
   - Database connectivity loss
   - Error rate > 5%
   - Response time > 1000ms

2. **Warning Alerts**
   - Response time > 500ms
   - Error rate > 1%
   - Database response time > 2000ms
   - Memory usage > 85%

3. **Info Alerts**
   - Configuration changes
   - Deployment events
   - Performance threshold breaches
   - Scheduled maintenance

### Monitoring Infrastructure

1. **Metrics Collection**
   - Prometheus for metrics storage
   - Grafana for visualization
   - Custom exporters for application metrics

2. **Log Aggregation**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Fluentd for log collection
   - Structured logging with correlation IDs

3. **Alerting System**
   - Prometheus Alertmanager
   - PagerDuty for critical alerts
   - Slack/Email for warnings and info

4. **Distributed Tracing**
   - Jaeger for request tracing
   - OpenTelemetry for instrumentation
   - Performance bottleneck identification

### Dashboard Recommendations

1. **Executive Dashboard**
   - High-level business metrics
   - Service health status
   - Key performance indicators
   - Alert summary

2. **Operations Dashboard**
   - Real-time performance metrics
   - System resource usage
   - Error rates and types
   - Database performance

3. **Development Dashboard**
   - Detailed application metrics
   - Debug information
   - Code performance profiling
   - Development-specific alerts

## Contact and Escalation

### Monitoring Contacts

| Role | Responsibility | Contact |
|------|---------------|---------|
| On-Call Engineer | Critical alerts and incidents | +1-555-0123 |
| DevOps Team | Infrastructure and deployment | devops@example.com |
| Database Team | Database performance and issues | dba@example.com |
| Development Team | Application bugs and features | dev-team@example.com |

### Escalation Matrix

1. **Level 1**: Automated alerts to on-call engineer (0-15 minutes)
2. **Level 2**: Manual escalation to team lead (15-60 minutes)
3. **Level 3**: Management escalation for major incidents (1-4 hours)
4. **Level 4**: Executive notification for critical business impact (4+ hours)

---

*This monitoring guide should be regularly reviewed and updated based on operational experience and changing requirements. Regular monitoring reviews ensure continued system reliability and performance.*
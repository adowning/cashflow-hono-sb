# Jackpot Service Operational Runbook

## Overview

This operational runbook provides comprehensive procedures for deploying, monitoring, maintaining, and troubleshooting the jackpot service in production environments. It covers routine operations, incident response, performance optimization, and system health management.

## Service Overview

### Service Information

| Property | Value |
|----------|-------|
| Service Name | Jackpot Service |
| Version | 2.0.0 |
| Database | PostgreSQL 13+ |
| Dependencies | Drizzle ORM, Connection Pool |
| Ports | Application: 3000, Health: 3001 |
| SLA | 99.9% uptime, < 100ms response time |

### Service Dependencies

```mermaid
graph TD
    A[Jackpot Service] --> B[PostgreSQL Database]
    A --> C[Connection Pool]
    A --> D[Cache Layer]
    A --> E[Monitoring System]
    B --> F[Database Backup]
    C --> G[Connection Monitoring]
    D --> H[Cache Health Check]
    E --> I[Alerting System]
```

## Deployment Procedures

### Standard Deployment

#### Pre-Deployment Checklist

- [ ] **Code Review**: All changes reviewed and approved
- [ ] **Testing**: Unit, integration, and performance tests passing
- [ ] **Database**: Migration scripts tested and approved
- [ ] **Monitoring**: Dashboard and alerting configured
- [ ] **Backup**: Latest backup completed successfully
- [ ] **Rollback Plan**: Rollback procedures tested and documented
- [ ] **Team Notification**: Operations team notified of deployment

#### Deployment Steps

```bash
#!/bin/bash
# Standard Deployment Script

echo "Starting jackpot service deployment..."

# 1. Pre-deployment validation
echo "Running pre-deployment checks..."
npm run health:check
npm run db:migrate:dry-run
npm run test:smoke

# 2. Create backup
echo "Creating pre-deployment backup..."
npm run backup:create

# 3. Apply database migrations
echo "Applying database migrations..."
npm run db:migrate

# 4. Deploy application
echo "Deploying application..."
pm2 deploy production

# 5. Post-deployment validation
echo "Running post-deployment validation..."
npm run health:check
npm run test:post-deploy

# 6. Enable monitoring
echo "Enabling monitoring and alerts..."
npm run monitoring:enable

echo "Deployment completed successfully!"
```

#### Post-Deployment Validation

```bash
# Validate service health
curl -f http://localhost:3001/health

# Test jackpot endpoints
curl -X GET http://localhost:3000/api/jackpot/pools
curl -X POST http://localhost:3000/api/jackpot/contribute \
  -H "Content-Type: application/json" \
  -d '{"gameId": "test", "wagerAmount": 1000}'

# Check database connectivity
npm run db:health-check

# Monitor logs for errors
tail -f logs/application.log | grep -i error
```

### Blue-Green Deployment

#### Blue-Green Setup

```bash
#!/bin/bash
# Blue-Green Deployment Script

# Deploy to inactive environment (green)
echo "Deploying to green environment..."
pm2 deploy green

# Run validation tests
npm run test:blue-green
npm run test:load -- --target=green

# Switch traffic to green
echo "Switching traffic to green environment..."
pm2 switch green

# Validate traffic switch
curl -f http://localhost:3001/health

# Keep blue as backup for 24 hours
echo "Blue environment kept as backup for 24 hours"
pm2 save blue  # Keep blue running as backup
```

#### Rollback from Blue-Green

```bash
# If issues detected, switch back to blue
echo "Rolling back to blue environment..."
pm2 switch blue

# Verify rollback
curl -f http://localhost:3001/health

# Clean up green environment
pm2 delete green
```

## Monitoring and Alerting

### Key Metrics

#### Performance Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (Contribution) | < 100ms | > 200ms | > 500ms |
| Response Time (Win Processing) | < 150ms | > 300ms | > 1000ms |
| Response Time (Pool Query) | < 50ms | > 100ms | > 250ms |
| Database Connection Pool | 70-90% | > 95% | Connection exhausted |
| Error Rate | < 0.1% | > 0.5% | > 1% |
| Throughput | > 1000 ops/min | < 500 ops/min | < 100 ops/min |

#### Business Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Total Jackpot Contributions | Sum of all contributions per hour | < 50% of baseline |
| Jackpot Wins | Number of wins per day | > 3x baseline |
| Pool Growth Rate | Rate of pool growth | < 0% for 1 hour |
| Configuration Changes | Number of config updates | > 5 per hour |

#### System Health Metrics

| Metric | Description | Warning | Critical |
|--------|-------------|---------|----------|
| CPU Usage | Application CPU usage | > 80% | > 95% |
| Memory Usage | Application memory usage | > 85% | > 95% |
| Database Connections | Active database connections | > 80% pool | > 95% pool |
| Disk Space | Database disk space | < 10GB free | < 1GB free |
| Network Latency | Database response time | > 50ms | > 100ms |

### Monitoring Commands

#### Health Check Commands

```bash
# Service health check
curl -s http://localhost:3001/health | jq '.'

# Database health check
curl -s http://localhost:3001/health/database | jq '.'

# Performance metrics
curl -s http://localhost:3001/metrics | jq '.'

# Jackpot service specific
curl -s http://localhost:3001/health/jackpot | jq '.'
```

#### Real-time Monitoring

```bash
# Monitor service logs
tail -f logs/application.log | grep -E "(ERROR|WARN|jackpot)"

# Monitor database performance
psql -h localhost -U username -d database_name -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%jackpot%'
ORDER BY total_time DESC 
LIMIT 5;"

# Monitor connection pool
psql -h localhost -U username -d database_name -c "
SELECT 
    state,
    count(*) as connection_count
FROM pg_stat_activity 
WHERE application_name LIKE '%jackpot%'
GROUP BY state;"

# Monitor system resources
htop
iostat -x 1
```

### Alert Configuration

#### PagerDuty Integration

```yaml
# pagerduty.yml - Alert escalation rules
escalation_rules:
  - escalation_delay: 5  # minutes
    targets:
      - oncall_engineer
  
  - escalation_delay: 15
    targets:
      - team_lead
  
  - escalation_delay: 30
      - engineering_manager

alert_rules:
  - name: "Jackpot Service Down"
    condition: "service_health == 'unhealthy'"
    severity: "critical"
    escalation_level: 1
  
  - name: "High Error Rate"
    condition: "error_rate > 1%"
    severity: "warning"
    escalation_level: 1
  
  - name: "Database Connection Issues"
    condition: "db_connections > 95%"
    severity: "critical"
    escalation_level: 1
  
  - name: "Performance Degradation"
    condition: "response_time > 500ms"
    severity: "warning"
    escalation_level: 1
```

#### Email Alerts

```bash
# Configure email alerts for non-critical issues
echo "jackpot.alerts@example.com" >> /etc/mail/alerts.conf

# Test email alerts
echo "Test alert from jackpot service" | mail -s "Test Alert" jackpot.alerts@example.com
```

## Routine Maintenance

### Daily Maintenance Tasks

#### Morning Health Check (09:00 UTC)

```bash
#!/bin/bash
# Daily Health Check Script

echo "=== Daily Jackpot Service Health Check ==="
echo "Date: $(date)"
echo ""

# Service status
echo "1. Service Status:"
pm2 status jackpot-service
echo ""

# Database connectivity
echo "2. Database Connectivity:"
curl -f http://localhost:3001/health/database
echo ""

# Recent error logs
echo "3. Recent Errors (last 24h):"
grep -c "$(date -d '24 hours ago' '+%Y-%m-%d')" logs/application.log
echo ""

# Performance summary
echo "4. Performance Summary:"
curl -s http://localhost:3001/metrics | jq '.response_times.avg'
echo ""

# Database size
echo "5. Database Size:"
psql -h localhost -U username -d database_name -c "
SELECT 
    pg_size_pretty(pg_database_size('database_name')) as size;"
echo ""

echo "=== Health Check Complete ==="
```

#### Performance Monitoring (Every 4 hours)

```bash
#!/bin/bash
# Performance Monitoring Script

# Check response times
response_time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/jackpot/pools)
echo "Average response time: ${response_time}s"

# Check database performance
db_time=$(psql -h localhost -U username -d database_name -t -c "
SELECT avg(total_time) FROM pg_stat_statements 
WHERE query LIKE '%jackpot%' AND calls > 0;")
echo "Database average query time: ${db_time}ms"

# Check error rate
error_count=$(grep -c "$(date '+%Y-%m-%d %H:')" logs/application.log | grep ERROR)
total_requests=$(curl -s http://localhost:3000/metrics | jq '.total_requests')
error_rate=$(echo "scale=4; $error_count * 100 / $total_requests" | bc)
echo "Current error rate: ${error_rate}%"
```

### Weekly Maintenance Tasks

#### Weekend Maintenance Window (Sunday 02:00-04:00 UTC)

```bash
#!/bin/bash
# Weekly Maintenance Script

echo "Starting weekly maintenance..."

# 1. Database maintenance
echo "Running database maintenance..."
psql -h localhost -U username -d database_name -c "VACUUM ANALYZE jackpots;"
psql -h localhost -U username -d database_name -c "REINDEX TABLE jackpots;"

# 2. Log rotation
echo "Rotating logs..."
logrotate /etc/logrotate.d/jackpot-service

# 3. Cleanup old backups
echo "Cleaning up old backups..."
find /backups/jackpot -name "*.sql" -mtime +30 -delete

# 4. Performance analysis
echo "Generating performance report..."
npm run performance:report

# 5. Security audit
echo "Running security audit..."
npm run security:audit

echo "Weekly maintenance completed"
```

#### Performance Tuning Review (Weekly)

```bash
#!/bin/bash
# Performance Analysis Script

echo "=== Weekly Performance Analysis ==="

# Query performance analysis
psql -h localhost -U username -d database_name -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE query LIKE '%jackpot%'
ORDER BY total_time DESC 
LIMIT 10;"

# Index usage analysis
psql -h localhost -U username -d database_name -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' AND tablename = 'jackpots'
ORDER BY idx_scan DESC;"

# Connection pool analysis
echo "Connection pool statistics:"
psql -h localhost -U username -d database_name -c "
SELECT 
    state,
    count(*) as connections,
    max(now() - state_change) as max_idle_time
FROM pg_stat_activity 
WHERE application_name LIKE '%jackpot%'
GROUP BY state;"

echo "=== Analysis Complete ==="
```

### Monthly Maintenance Tasks

#### Capacity Planning Review

```bash
#!/bin/bash
# Monthly Capacity Planning Script

echo "=== Monthly Capacity Planning Report ==="

# Database growth analysis
psql -h localhost -U username -d database_name -c "
SELECT 
    date_trunc('month', created_at) as month,
    COUNT(*) as jackpot_records,
    pg_size_pretty(pg_total_relation_size('jackpots')) as table_size
FROM jackpots 
GROUP BY month 
ORDER BY month DESC;"

# Performance trend analysis
echo "Performance trends over last month:"
curl -s http://localhost:3000/metrics?period=30d | jq '{
  avg_response_time: .response_times.avg,
  p95_response_time: .response_times.p95,
  total_requests: .total_requests,
  error_rate: .error_rate
}'"

# Resource utilization trends
echo "Resource utilization trends:"
psql -h localhost -U username -d database_name -c "
SELECT 
    date_trunc('day', stat_timestamp) as day,
    avg(cpu_usage) as avg_cpu,
    avg(memory_usage) as avg_memory,
    avg(connection_count) as avg_connections
FROM system_metrics 
WHERE stat_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY day 
ORDER BY day;"

echo "=== Capacity Planning Complete ==="
```

## Incident Response

### Incident Classification

#### Severity Levels

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| **P1 - Critical** | Service down, data loss risk | 15 minutes | Immediate |
| **P2 - High** | Major functionality impaired | 1 hour | 2 hours |
| **P3 - Medium** | Minor functionality issues | 4 hours | 24 hours |
| **P4 - Low** | Non-urgent issues | 24 hours | 72 hours |

#### P1 Critical Incidents

**Examples:**
- Complete service unavailability
- Database corruption
- Data loss or integrity issues
- Security breaches
- Performance degradation > 1000ms

**Response Procedure:**

```bash
# 1. Immediate assessment (0-15 minutes)
echo "P1 Incident Response Activated"
curl -f http://localhost:3001/health || echo "Service DOWN"
pm2 status || echo "Process manager DOWN"

# 2. Emergency diagnostics
npm run diagnostics:emergency

# 3. Immediate containment
pm2 stop jackpot-service  # If service is causing issues

# 4. Activate incident commander
echo "P1 Incident - Activating incident commander"
# Send alerts, create incident channel, etc.

# 5. Begin communication
# - Notify stakeholders
# - Update status page
# - Log incident details
```

### Common Incident Scenarios

#### Service Not Responding

**Symptoms:**
- 500/502/503 errors
- Connection timeouts
- Health check failures

**Diagnosis:**
```bash
# Check service status
pm2 status
systemctl status jackpot-service

# Check logs
tail -100 logs/application.log | grep ERROR

# Check system resources
htop
df -h
free -m

# Check database connectivity
psql -h localhost -U username -d database_name -c "SELECT 1;"
```

**Resolution:**
```bash
# Restart service
pm2 restart jackpot-service

# If database issues, restart database
systemctl restart postgresql

# Clear connection pools if needed
pm2 restart jackpot-service --update-env

# Monitor recovery
watch -n 5 'curl -s http://localhost:3001/health | jq .status'
```

#### Database Performance Issues

**Symptoms:**
- Slow response times
- Connection pool exhaustion
- Query timeouts

**Diagnosis:**
```bash
# Check active connections
psql -h localhost -U username -d database_name -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';"

# Check slow queries
psql -h localhost -U username -d database_name -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements 
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;"

# Check locks
psql -h localhost -U username -d database_name -c "
SELECT 
    locktype,
    mode,
    granted,
    count(*)
FROM pg_locks 
GROUP BY locktype, mode, granted;"
```

**Resolution:**
```bash
# Kill long-running queries
psql -h localhost -U username -d database_name -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"

# Restart connection pool
pm2 restart jackpot-service

# Analyze and optimize slow queries
npm run performance:analyze

# If needed, restart database
systemctl restart postgresql
```

#### High Memory Usage

**Symptoms:**
- Out of memory errors
- System slowdowns
- Process crashes

**Diagnosis:**
```bash
# Check memory usage
free -h
ps aux | grep jackpot

# Check for memory leaks
pm2 logs jackpot-service --lines 100

# Check database memory
psql -h localhost -U username -d database_name -c "
SELECT 
    name,
    setting,
    unit
FROM pg_settings 
WHERE name IN ('shared_buffers', 'work_mem', 'maintenance_work_mem');"
```

**Resolution:**
```bash
# Restart application to clear memory
pm2 restart jackpot-service

# Adjust memory limits
pm2 start jackpot-service --max-memory-restart 1G

# Tune database memory settings if needed
# Edit postgresql.conf and restart

# Monitor memory usage
watch -n 10 'free -h'
```

## Backup and Recovery

### Backup Strategy

#### Database Backups

```bash
#!/bin/bash
# Database Backup Script

BACKUP_DIR="/backups/jackpot/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h localhost -U username -d database_name \
  --format=custom \
  --compress=9 \
  --verbose \
  --file=$BACKUP_DIR/jackpot_full_backup_$(date +%Y%m%d_%H%M%S).dump

# Schema-only backup
pg_dump -h localhost -U username -d database_name \
  --schema-only \
  --file=$BACKUP_DIR/jackpot_schema_$(date +%Y%m%d_%H%M%S).sql

# Data-only backup
pg_dump -h localhost -U username -d database_name \
  --data-only \
  --file=$BACKUP_DIR/jackpot_data_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list $BACKUP_DIR/jackpot_full_backup_*.dump > /dev/null
if [ $? -eq 0 ]; then
    echo "Backup verification successful"
    # Upload to offsite storage
    aws s3 cp $BACKUP_DIR s3://backups-jackpot/$(date +%Y-%m-%d)/ --recursive
else
    echo "Backup verification failed!"
    exit 1
fi
```

#### Application Backups

```bash
#!/bin/bash
# Application Backup Script

BACKUP_DIR="/backups/application/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Backup configuration files
cp -r /etc/jackpot-service $BACKUP_DIR/config/
cp -r /var/log/jackpot-service $BACKUP_DIR/logs/

# Backup application code
tar -czf $BACKUP_DIR/code_$(date +%Y%m%d_%H%M%S).tar.gz /opt/jackpot-service/

# Backup environment variables
env | grep JACKPOT > $BACKUP_DIR/environment_$(date +%Y%m%d_%H%M%S).txt

# Backup SSL certificates
cp -r /etc/ssl/jackpot $BACKUP_DIR/ssl/

echo "Application backup completed: $BACKUP_DIR"
```

### Recovery Procedures

#### Database Recovery

```bash
#!/bin/bash
# Database Recovery Script

BACKUP_FILE=$1
TARGET_DB="database_name_recovery"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "Starting database recovery from: $BACKUP_FILE"

# Create recovery database
psql -h localhost -U username -d postgres -c "CREATE DATABASE $TARGET_DB;"

# Restore from backup
pg_restore -h localhost -U username -d $TARGET_DB \
  --verbose \
  --clean \
  --if-exists \
  $BACKUP_FILE

# Verify recovery
echo "Verifying recovery..."
psql -h localhost -U username -d $TARGET_DB -c "
SELECT 
    COUNT(*) as jackpot_records,
    COUNT(DISTINCT group) as jackpot_groups
FROM jackpots;"

# Test application with recovery database
export DATABASE_URL="postgresql://username:password@localhost:5432/$TARGET_DB"
npm run test:smoke

echo "Database recovery completed"
```

#### Application Recovery

```bash
#!/bin/bash
# Application Recovery Script

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory>"
    exit 1
fi

echo "Starting application recovery from: $BACKUP_DIR"

# Stop services
pm2 stop jackpot-service

# Restore configuration
cp -r $BACKUP_DIR/config/* /etc/jackpot-service/

# Restore environment
source $BACKUP_DIR/environment_*.txt

# Restore SSL certificates
cp -r $BACKUP_DIR/ssl/* /etc/ssl/jackpot/

# Restore application code
tar -xzf $BACKUP_DIR/code_*.tar.gz -C /

# Restart services
pm2 start jackpot-service

# Verify recovery
curl -f http://localhost:3001/health

echo "Application recovery completed"
```

## Performance Optimization

### Performance Tuning

#### Database Optimization

```sql
-- Analyze and optimize table statistics
ANALYZE jackpots;

-- Update table statistics
VACUUM ANALYZE jackpots;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' AND tablename = 'jackpots'
ORDER BY idx_scan DESC;

-- Identify unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
    AND tablename = 'jackpots' 
    AND idx_scan = 0
ORDER BY indexname;
```

#### Connection Pool Tuning

```javascript
// Optimal connection pool configuration
const db = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings
  min: 2,                    // Minimum connections
  max: 20,                   // Maximum connections
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
  
  // Jackpot-specific optimizations
  application_name: 'jackpot-service',
  
  // Health check
  allowExitOnIdle: false,
});
```

#### Query Optimization

```javascript
// Optimized jackpot queries
const optimizedQueries = {
  // Batch pool retrieval
  getAllPools: `
    SELECT 
      group,
      current_amount,
      total_contributions,
      total_wins,
      last_won_amount,
      last_won_at,
      version
    FROM jackpots 
    WHERE group IN ('minor', 'major', 'mega')
    ORDER BY group
  `,
  
  // Optimized contribution
  contributeBatch: `
    UPDATE jackpots SET 
      current_amount = CASE 
        WHEN group = $1 THEN current_amount + $2
        WHEN group = $3 THEN current_amount + $4
        WHEN group = $5 THEN current_amount + $6
        ELSE current_amount
      END,
      total_contributions = CASE 
        WHEN group = $1 THEN total_contributions + $2
        WHEN group = $3 THEN total_contributions + $4
        WHEN group = $5 THEN total_contributions + $6
        ELSE total_contributions
      END,
      version = version + 1,
      updated_at = NOW()
    WHERE group IN ($1, $3, $5)
    RETURNING group, current_amount, version
  `
};
```

### Monitoring Performance

#### Performance Dashboard

```bash
# Create performance monitoring script
cat > /usr/local/bin/jackpot-performance-monitor.sh << 'EOF'
#!/bin/bash

echo "=== Jackpot Service Performance Report ==="
echo "Generated at: $(date)"
echo ""

# Response time monitoring
echo "Response Times:"
for endpoint in "/api/jackpot/pools" "/api/jackpot/contribute" "/api/jackpot/statistics"; do
    time=$(curl -s -o /dev/null -w "%{time_total}" "http://localhost:3000$endpoint")
    echo "  $endpoint: ${time}s"
done
echo ""

# Database performance
echo "Database Performance:"
psql -h localhost -U username -d database_name -t -c "
SELECT 
    'Avg Query Time: ' || ROUND(AVG(mean_time), 2) || 'ms',
    'Total Queries: ' || SUM(calls),
    'Slow Queries (>100ms): ' || SUM(CASE WHEN mean_time > 100 THEN 1 ELSE 0 END)
FROM pg_stat_statements 
WHERE query LIKE '%jackpot%';"

# Connection pool status
echo ""
echo "Connection Pool Status:"
psql -h localhost -U username -d database_name -t -c "
SELECT 
    'Active: ' || COUNT(*) as connections
FROM pg_stat_activity 
WHERE state = 'active' AND application_name LIKE '%jackpot%';"

# System resources
echo ""
echo "System Resources:"
echo "  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "  Memory Usage: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')"
echo "  Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"

echo ""
echo "=== Performance Report Complete ==="
EOF

chmod +x /usr/local/bin/jackpot-performance-monitor.sh
```

## Troubleshooting

### Common Issues and Solutions

#### Service Won't Start

**Symptoms:**
- Process fails to start
- Permission errors
- Configuration issues

**Solutions:**
```bash
# Check permissions
ls -la /opt/jackpot-service/
chown -R jackpot:jackpot /opt/jackpot-service/

# Check configuration
npm run config:validate

# Check logs
tail -f logs/Startup.log

# Test database connectivity
npm run db:test-connection
```

#### High Memory Usage

**Symptoms:**
- Out of memory errors
- System slow
- Process crashes

**Solutions:**
```bash
# Monitor memory usage
ps aux | grep jackpot
top -p $(pgrep -f jackpot)

# Clear application cache
pm2 flush jackpot-service

# Restart with memory limits
pm2 start jackpot-service --max-memory-restart 512M

# Monitor for memory leaks
npm run memory:profile
```

#### Database Connection Issues

**Symptoms:**
- Connection timeouts
- Pool exhaustion
- Authentication failures

**Solutions:**
```bash
# Test database connectivity
pg_isready -h localhost -p 5432 -U username

# Check connection pool status
npm run db:pool-status

# Restart database if needed
systemctl restart postgresql

# Check connection limits
psql -h localhost -U username -d database_name -c "
SELECT setting FROM pg_settings WHERE name = 'max_connections';"

# Clear connection pool
pm2 restart jackpot-service
```

## Contact Information

### Emergency Contacts

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| On-Call Engineer | John Doe | +1-555-0123 | oncall@example.com |
| Team Lead | Jane Smith | +1-555-0124 | teamlead@example.com |
| DevOps Manager | Bob Wilson | +1-555-0125 | devops@example.com |
| Database Admin | Alice Johnson | +1-555-0126 | dba@example.com |

### Escalation Matrix

1. **Level 1**: On-Call Engineer (0-15 minutes)
2. **Level 2**: Team Lead (15-60 minutes)
3. **Level 3**: DevOps Manager (1-4 hours)
4. **Level 4**: Engineering Director (4+ hours)

### External Resources

- **Status Page**: https://status.example.com
- **Monitoring Dashboard**: https://monitoring.example.com/jackpot
- **Log Aggregation**: https://logs.example.com/jackpot
- **Performance Metrics**: https://metrics.example.com/jackpot

---

*This operational runbook should be kept up-to-date and reviewed quarterly. All team members should be familiar with these procedures.*
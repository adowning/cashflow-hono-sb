# Jackpot Service Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the original in-memory jackpot implementation to the new database-backed system. The migration maintains full backward compatibility and includes comprehensive validation and rollback procedures.

## Pre-Migration Checklist

### ✅ Prerequisites

- [ ] **Database Access**: Ensure you have database connectivity and appropriate permissions
- [ ] **Backup Strategy**: Verify backup procedures for rollback capability
- [ ] **Environment Setup**: Confirm development, staging, and production environments
- [ ] **Team Coordination**: Notify relevant teams about the migration window
- [ ] **Monitoring Setup**: Configure performance monitoring and alerting
- [ ] **Testing Environment**: Verify testing environment reflects production configuration

### 📋 Environment Requirements

| Component | Version | Status |
|-----------|---------|--------|
| Node.js | >= 18.0 | Required |
| TypeScript | >= 5.0 | Required |
| Drizzle ORM | Latest | Required |
| PostgreSQL | >= 13 | Required |
| Database Migration Tools | Latest | Optional |

### 🔒 Permissions Required

- **Database User**: SELECT, INSERT, UPDATE, DELETE on jackpot tables
- **File System**: Write access for backup files and logs
- **Application**: Deployment and restart permissions

## Migration Process

### Phase 1: Pre-Migration Setup

#### Step 1: Create Migration Backup

```bash
# Create a complete backup before starting
pg_dump -h localhost -U username -d database_name > pre_migration_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list pre_migration_backup.sql | head -20
```

#### Step 2: Apply Database Schema Migration

```bash
# Apply the schema migration
psql -h localhost -U username -d database_name -f migrations/20241101_add_jackpot_enhancements.sql

# Verify migration was successful
psql -h localhost -U username -d database_name -c "SELECT group, current_amount, version FROM jackpots ORDER BY group;"
```

#### Step 3: Validate Database Schema

```bash
# Run schema validation
npm run jackpot:validate -- --schema-only

# Expected output:
# ✅ Database schema validation passed
# ✅ All required columns present
# ✅ Indexes created successfully
# ✅ Constraints applied correctly
```

### Phase 2: Application Deployment

#### Step 1: Deploy New Application Code

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Deploy to environment (adjust for your deployment strategy)
npm run deploy:production
```

#### Step 2: Update Environment Configuration

```bash
# Update environment variables if needed
export JACKPOT_MIGRATION_ENABLED=true
export JACKPOT_DATABASE_BACKUP=true
export JACKPOT_VALIDATION_ENABLED=true

# Restart application
pm2 restart all
# OR
systemctl restart application
```

### Phase 3: Data Migration

#### Step 1: Validate Migration Prerequisites

```bash
# Run comprehensive validation
npm run jackpot:migrate -- --validate-only

# Expected output:
# 🔍 Running migration validation...
# ✅ Database connectivity verified
# ✅ Schema validation passed
# ✅ Data integrity check passed
# ✅ Backup verification completed
```

#### Step 2: Execute Dry Run Migration

```bash
# Run migration in dry-run mode to preview changes
npm run jackpot:migrate -- --dry-run --batch-size=100

# Expected output:
# 🎰 Jackpot Data Migration Tool
# ===================================
# Configuration: { dryRun: true, batchSize: 100, validateData: true, ... }
# 
# Starting jackpot data migration...
# [DRY RUN] Would migrate pool: minor
# [DRY RUN] Would migrate pool: major  
# [DRY RUN] Would migrate pool: mega
# 
# 📊 Migration Results:
# ====================
# Status: ✅ Success
# Pools migrated: 3
# Contributions migrated: 0
# Execution time: 125ms
# 
# 💾 Rollback data (for reference only):
# ======================================
# [JSON rollback data would be displayed here]
```

#### Step 3: Execute Full Migration

```bash
# Execute the actual migration
npm run jackpot:migrate -- --batch-size=1000

# Monitor migration progress
tail -f logs/jackpot-migration.log
```

**Expected Output:**
```
🎰 Jackpot Data Migration Tool
===================================
Starting jackpot data migration...
[2025-11-01T04:47:00.000Z] [JACKPOT-MIGRATION] Starting jackpot data migration...
[2025-11-01T04:47:00.001Z] [JACKPOT-MIGRATION] Existing data backed up successfully
[2025-11-01T04:47:00.002Z] [JACKPOT-MIGRATION] Validating migration prerequisites...
[2025-11-01T04:47:00.003Z] [JACKPOT-MIGRATION] Migrating pool: minor
[2025-11-01T04:47:00.004Z] [JACKPOT-MIGRATION] Migrating pool: major
[2025-11-01T04:47:00.005Z] [JACKPOT-MIGRATION] Migrating pool: mega
[2025-11-01T04:47:00.006Z] [JACKPOT-MIGRATION] Migration completed in 6ms

📊 Migration Results:
====================
Status: ✅ Success
Pools migrated: 3
Contributions migrated: 0
Execution time: 6ms

✅ Migration validation passed
🎉 Migration completed successfully!
```

### Phase 4: Post-Migration Validation

#### Step 1: Validate Migration Results

```bash
# Run comprehensive post-migration validation
npm run jackpot:validate

# Verify database state
psql -h localhost -U username -d database_name -c "
SELECT 
    group,
    current_amount,
    seed_amount,
    max_amount,
    contribution_rate,
    total_contributions,
    total_wins,
    version
FROM jackpots 
ORDER BY group;"
```

#### Step 2: Test Application Functionality

```bash
# Run integration tests
npm run test:integration

# Run specific jackpot tests
npm run test:unit -- --testPathPattern=jackpot

# Test jackpot endpoints manually
curl -X GET "http://localhost:3000/api/jackpot/pools"
curl -X POST "http://localhost:3000/api/jackpot/contribute" \
  -H "Content-Type: application/json" \
  -d '{"gameId": "test_game", "wagerAmount": 1000}'
```

#### Step 3: Performance Testing

```bash
# Run performance benchmarks
npm run test:performance

# Test high-frequency contributions
node test-jackpot-performance-optimizations.ts

# Expected: < 100ms response times for contributions
```

## Rollback Procedures

### Immediate Rollback (Emergency)

If issues are detected immediately after migration:

```bash
# Stop application to prevent further database changes
pm2 stop all
# OR
systemctl stop application

# Execute immediate rollback
npm run jackpot:rollback -- --rollback-data='{"pools":[...]}' --force-rollback

# Restart application
pm2 start all
# OR  
systemctl start application
```

### Planned Rollback

For planned rollback with more time for preparation:

```bash
# Generate rollback data from backup
node scripts/generate-rollback-data.ts --backup-file=jackpot_backup_20251101.sql

# Execute rollback with validation
npm run jackpot:rollback -- --rollback-data-file=rollback-data.json --validate-rollback

# Verify rollback success
npm run jackpot:validate
```

### Rollback Validation

After rollback, verify:

```bash
# Check database state
psql -h localhost -U username -d database_name -c "
SELECT 
    group,
    current_amount,
    version
FROM jackpots 
ORDER BY group;"

# Test application functionality
npm run test:smoke

# Verify no data corruption
psql -h localhost -U username -d database_name -c "
SELECT COUNT(*) as total_records 
FROM information_schema.tables 
WHERE table_name = 'jackpots';"
```

## Environment-Specific Instructions

### Development Environment

1. **Quick Setup**: Use local PostgreSQL instance
2. **Migration**: Simplified validation process
3. **Testing**: Full test suite execution
4. **Rollback**: Local database restore from backup

```bash
# Development migration
npm run jackpot:migrate -- --dry-run --verbose
npm run jackpot:migrate
npm run test:integration
```

### Staging Environment

1. **Production-Like Setup**: Mirror production configuration
2. **Full Validation**: Comprehensive testing and validation
3. **Load Testing**: Performance validation under load
4. **Rollback Testing**: Full rollback procedure validation

```bash
# Staging migration with production-like settings
npm run jackpot:migrate -- --batch-size=500 --validate-data --backup-existing
npm run test:load
npm run test:rollback
```

### Production Environment

1. **Maintenance Window**: Schedule during low-traffic period
2. **Blue-Green Deployment**: Minimize service interruption
3. **Enhanced Monitoring**: Real-time monitoring and alerting
4. **Immediate Rollback Capability**: Quick rollback procedures

```bash
# Production migration with maximum safety
npm run jackpot:migrate -- --batch-size=100 --validate-data --backup-existing --no-validation
npm run jackpot:validate
systemctl restart application
```

## Troubleshooting Migration Issues

### Common Issues and Solutions

#### Database Connection Errors

**Symptoms:**
```
❌ Database connectivity failed: connection refused
```

**Solutions:**
```bash
# Check database service status
systemctl status postgresql

# Verify connection parameters
pg_isready -h localhost -p 5432 -U username

# Test manual connection
psql -h localhost -U username -d database_name -c "SELECT version();"
```

#### Schema Migration Failures

**Symptoms:**
```
ERROR: relation "jackpots" already exists
```

**Solutions:**
```bash
# Check existing schema
psql -h localhost -U username -d database_name -c "\d jackpots"

# Backup and drop existing table if safe to do so
pg_dump -h localhost -U username -d database_name > backup.sql
DROP TABLE jackpots CASCADE;
# Re-run migration
```

#### Data Validation Errors

**Symptoms:**
```
❌ Migration validation failed: data integrity violation
```

**Solutions:**
```bash
# Check for data inconsistencies
psql -h localhost -U username -d database_name -c "
SELECT * FROM jackpots 
WHERE current_amount < 0 OR contribution_rate < 0 OR contribution_rate > 1;"

# Fix data issues manually
UPDATE jackpots SET contribution_rate = 0.02 WHERE contribution_rate > 1;
```

#### Performance Issues During Migration

**Symptoms:**
```
⚠️ High database load detected during migration
```

**Solutions:**
```bash
# Reduce batch size
npm run jackpot:migrate -- --batch-size=50 --max-retries=5

# Enable connection pooling
export JACKPOT_CONNECTION_POOL_SIZE=5

# Monitor database performance
psql -h localhost -U username -d database_name -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;"
```

### Emergency Procedures

#### Complete System Failure

If the entire system fails:

```bash
# 1. Stop all applications immediately
pm2 stop all

# 2. Restore from pre-migration backup
pg_restore -h localhost -U username -d database_name pre_migration_backup.sql

# 3. Redeploy previous application version
git checkout previous-version-tag
npm run build
pm2 start all

# 4. Verify system functionality
curl -f http://localhost:3000/health
```

#### Partial Migration Issues

If some components fail but others succeed:

```bash
# 1. Identify failing components
npm run jackpot:validate -- --detailed

# 2. Run targeted rollback for specific issues
npm run jackpot:rollback -- --rollback-data='{"pools":[...]}' --validate-only

# 3. Re-run specific migration steps
npm run jackpot:migrate -- --validate-only
npm run jackpot:migrate -- --step=contributions
```

## Post-Migration Monitoring

### Health Check Endpoints

After migration, monitor these health indicators:

```bash
# Database connectivity
curl http://localhost:3000/api/health/database

# Jackpot service health
curl http://localhost:3000/api/health/jackpot

# Performance metrics
curl http://localhost:3000/api/metrics/jackpot
```

### Key Performance Indicators

Monitor these KPIs post-migration:

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Contribution Response Time | < 100ms | > 500ms |
| Win Processing Time | < 150ms | > 1000ms |
| Database Connection Pool | 80% available | < 20% available |
| Error Rate | < 0.1% | > 1% |
| Migration Success Rate | 100% | < 95% |

### Monitoring Commands

```bash
# Real-time monitoring
watch -n 5 'curl -s http://localhost:3000/api/health/jackpot | jq .'

# Performance monitoring
tail -f logs/application.log | grep -i jackpot

# Database performance
psql -h localhost -U username -d database_name -c "
SELECT 
    group,
    current_amount,
    version,
    last_modified_at
FROM jackpots 
ORDER BY last_modified_at DESC;"
```

## Success Criteria

### ✅ Migration Success Indicators

1. **Schema Migration**: All database objects created successfully
2. **Data Migration**: All jackpot pools migrated without errors
3. **Application Deployment**: New version deployed without issues
4. **Functional Testing**: All jackpot operations working correctly
5. **Performance Testing**: Response times within acceptable ranges
6. **Integration Testing**: No breaking changes with other systems
7. **Monitoring Setup**: All monitoring and alerting functional

### 📊 Validation Checklist

- [ ] Database schema matches expected structure
- [ ] All jackpot groups present (minor, major, mega)
- [ ] Contribution rates correctly preserved
- [ ] Seed and maximum amounts maintained
- [ ] Version control fields initialized
- [ ] Indexes created and functional
- [ ] Application error-free startup
- [ ] API endpoints responding correctly
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Monitoring alerts configured
- [ ] Backup procedures verified

## Contact and Support

### Escalation Procedures

1. **Level 1**: Application logs and error messages
2. **Level 2**: Database diagnostics and query analysis
3. **Level 3**: Infrastructure and network issues
4. **Level 4**: Complete system rollback and investigation

### Key Contacts

- **DevOps Team**: Infrastructure and deployment issues
- **Database Team**: Schema and data-related problems
- **Development Team**: Application and business logic issues
- **Security Team**: Security and compliance concerns

### Support Resources

- **Documentation**: `/docs/jackpot/` directory
- **Logs**: `/logs/jackpot-migration.log`
- **Metrics**: Monitoring dashboard links
- **Backup Location**: `/backups/jackpot-migration/`

---

*This migration guide is updated based on real-world deployment experiences and should be reviewed before each migration attempt.*
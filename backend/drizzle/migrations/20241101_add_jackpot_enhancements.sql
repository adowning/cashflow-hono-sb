-- Jackpot Service Database Schema Enhancements
-- Migration: Add jackpot enhancements for production deployment
-- Date: 2025-11-01
-- Description: Add concurrency control fields, indexes, and performance optimizations

BEGIN;

-- Add concurrency control fields to jackpots table
ALTER TABLE jackpots 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS lock_holder TEXT,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ(3);

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_group ON jackpots (group);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_version ON jackpots (version);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_last_modified ON jackpots (last_modified_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_group_version ON jackpots (group, version);

-- Add unique constraint on jackpot group (ensure only one pool per group)
ALTER TABLE jackpots 
ADD CONSTRAINT IF NOT EXISTS jackpots_group_unique UNIQUE (group);

-- Create partial indexes for active jackpots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_active_groups 
ON jackpots (group) 
WHERE current_amount > 0;

-- Create index for contribution history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_contribution_history 
ON jackpots USING gin (contribution_history);

-- Create index for win history queries  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpots_win_history 
ON jackpots USING gin (win_history);

-- Add check constraints for data integrity
ALTER TABLE jackpots 
ADD CONSTRAINT IF NOT EXISTS jackpots_amounts_positive 
CHECK (current_amount >= 0 AND seed_amount >= 0 AND (max_amount IS NULL OR max_amount >= 0)),
ADD CONSTRAINT IF NOT EXISTS jackpots_contribution_rate_valid 
CHECK (contribution_rate >= 0 AND contribution_rate <= 1),
ADD CONSTRAINT IF NOT EXISTS jackpots_max_amount_valid 
CHECK (max_amount IS NULL OR max_amount >= seed_amount);

-- Add comment for documentation
COMMENT ON COLUMN jackpots.version IS 'Optimistic locking version for concurrent updates';
COMMENT ON COLUMN jackpots.lock_holder IS 'Operation ID holding current lock (debugging purposes)';
COMMENT ON COLUMN jackpots.last_modified_at IS 'Timestamp of last modification for timestamp-based locking';

-- Update existing records to have initial version 0
UPDATE jackpots SET version = 0 WHERE version IS NULL;
UPDATE jackpots SET last_modified_at = COALESCE(updated_at, created_at, NOW()) WHERE last_modified_at IS NULL;

-- Ensure all jackpot groups exist with proper defaults
INSERT INTO jackpots (group, current_amount, seed_amount, max_amount, contribution_rate, total_contributions, total_wins, win_history, contribution_history, version, last_modified_at)
SELECT 
  'minor' as group,
  100000 as current_amount,
  100000 as seed_amount,
  1000000 as max_amount,
  0.02 as contribution_rate,
  0 as total_contributions,
  0 as total_wins,
  '[]'::jsonb as win_history,
  '[]'::jsonb as contribution_history,
  0 as version,
  NOW() as last_modified_at
WHERE NOT EXISTS (SELECT 1 FROM jackpots WHERE group = 'minor');

INSERT INTO jackpots (group, current_amount, seed_amount, max_amount, contribution_rate, total_contributions, total_wins, win_history, contribution_history, version, last_modified_at)
SELECT 
  'major' as group,
  1000000 as current_amount,
  1000000 as seed_amount,
  10000000 as max_amount,
  0.01 as contribution_rate,
  0 as total_contributions,
  0 as total_wins,
  '[]'::jsonb as win_history,
  '[]'::jsonb as contribution_history,
  0 as version,
  NOW() as last_modified_at
WHERE NOT EXISTS (SELECT 1 FROM jackpots WHERE group = 'major');

INSERT INTO jackpots (group, current_amount, seed_amount, max_amount, contribution_rate, total_contributions, total_wins, win_history, contribution_history, version, last_modified_at)
SELECT 
  'mega' as group,
  10000000 as current_amount,
  10000000 as seed_amount,
  100000000 as max_amount,
  0.005 as contribution_rate,
  0 as total_contributions,
  0 as total_wins,
  '[]'::jsonb as win_history,
  '[]'::jsonb as contribution_history,
  0 as version,
  NOW() as last_modified_at
WHERE NOT EXISTS (SELECT 1 FROM jackpots WHERE group = 'mega');

COMMIT;

-- Verification queries
SELECT 
  'Migration completed successfully' as status,
  COUNT(*) as jackpot_groups_found,
  array_agg(group ORDER BY group) as groups
FROM jackpots;

-- Display migration summary
DO $$
BEGIN
  RAISE NOTICE '=== Jackpot Migration Summary ===';
  RAISE NOTICE 'Schema enhancements added successfully';
  RAISE NOTICE 'Indexes created for performance optimization';
  RAISE NOTICE 'Data integrity constraints added';
  RAISE NOTICE 'Initial jackpot groups initialized';
  RAISE NOTICE 'Concurrency control fields added';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run validation script: npm run jackpot:validate';
  RAISE NOTICE '2. Test system functionality';
  RAISE NOTICE '3. Monitor performance metrics';
END $$;
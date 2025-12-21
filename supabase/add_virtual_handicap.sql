-- Migration: Add virtual_handicap column to rounds table
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD VIRTUAL_HANDICAP COLUMN
-- ============================================

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS virtual_handicap FLOAT;

-- Add comment
COMMENT ON COLUMN rounds.virtual_handicap IS 'Virtual Handicap for this round. HV = Handicap Index - (Stableford Points - 36) for 18 holes';

-- ============================================
-- 2. CREATE INDEX FOR FASTER QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rounds_virtual_handicap ON rounds(virtual_handicap) WHERE virtual_handicap IS NOT NULL;

-- ============================================
-- NOTE: After running this migration, use the
-- /users/owner/backfill-virtual-handicap endpoint
-- to calculate HV for all existing rounds
-- ============================================

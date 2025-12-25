-- Migration: Add handicap_history table
-- This table tracks the evolution of a user's Handicap Index over time

-- ============================================
-- HANDICAP HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS handicap_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handicap_index DECIMAL(4, 1) NOT NULL CHECK (handicap_index >= -10 AND handicap_index <= 54),
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_handicap_history_user_date
  ON handicap_history(user_id, effective_date DESC);

-- Enable RLS
ALTER TABLE handicap_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own handicap history
CREATE POLICY "Users can view own handicap history" ON handicap_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own handicap history
CREATE POLICY "Users can insert own handicap history" ON handicap_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own handicap history
CREATE POLICY "Users can update own handicap history" ON handicap_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own handicap history
CREATE POLICY "Users can delete own handicap history" ON handicap_history
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update related data when handicap changes
CREATE TRIGGER update_handicap_history_updated_at
  BEFORE UPDATE ON handicap_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

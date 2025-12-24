-- Round Templates (Plantillas de Partida)
-- Run this in the Supabase SQL Editor

-- ============================================
-- ROUND_TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS round_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Round configuration
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_name TEXT,
  course_length TEXT CHECK (course_length IN ('18', 'front9', 'back9')),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('stableford', 'stroke', 'sindicato', 'team', 'matchplay')),
  use_handicap BOOLEAN DEFAULT true,
  handicap_percentage INTEGER DEFAULT 100 CHECK (handicap_percentage IN (75, 100)),
  sindicato_points JSONB,        -- Array of integers [4, 2, 1, 0]
  team_mode TEXT CHECK (team_mode IS NULL OR team_mode IN ('bestBall', 'goodBadBall')),
  best_ball_points INTEGER,
  worst_ball_points INTEGER,
  -- Player template (saved player IDs to auto-add)
  player_ids JSONB DEFAULT '[]', -- Array of saved_player UUIDs
  -- Default tee for players not in saved_players
  default_tee TEXT,
  -- Metadata
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE round_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own templates
CREATE POLICY "Users can view own templates" ON round_templates
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own templates
CREATE POLICY "Users can insert own templates" ON round_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON round_templates
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON round_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Owner can see all templates
CREATE POLICY "Owner can view all templates" ON round_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_round_templates_user_id ON round_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_round_templates_is_favorite ON round_templates(is_favorite);

-- Trigger for updated_at
CREATE TRIGGER update_round_templates_updated_at
  BEFORE UPDATE ON round_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

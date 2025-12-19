-- Golf Shot Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Extends Supabase Auth users with additional profile data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role, status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    'user',
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  holes INTEGER NOT NULL CHECK (holes IN (9, 18)),
  par INTEGER NOT NULL CHECK (par >= 27 AND par <= 80),
  tees JSONB NOT NULL,           -- Array of {name, slope, rating}
  holes_data JSONB NOT NULL,     -- Array of {number, par, handicap, distance}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read courses
CREATE POLICY "Authenticated users can read courses" ON courses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert courses
CREATE POLICY "Admins can insert courses" ON courses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update courses
CREATE POLICY "Admins can update courses" ON courses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete courses
CREATE POLICY "Admins can delete courses" ON courses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROUNDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  od_id BIGINT NOT NULL,
  od_user_id UUID NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_name TEXT NOT NULL,
  round_date DATE NOT NULL,
  course_length TEXT NOT NULL CHECK (course_length IN ('18', 'front9', 'back9')),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('stableford', 'stroke', 'sindicato', 'team')),
  use_handicap BOOLEAN DEFAULT true,
  handicap_percentage INTEGER DEFAULT 100 CHECK (handicap_percentage IN (75, 100)),
  sindicato_points JSONB,        -- Array of integers [4, 2, 1, 0]
  team_mode TEXT CHECK (team_mode IS NULL OR team_mode IN ('bestBall', 'goodBadBall')),
  best_ball_points INTEGER,
  worst_ball_points INTEGER,
  current_hole INTEGER DEFAULT 1 CHECK (current_hole >= 1 AND current_hole <= 18),
  completed_holes JSONB DEFAULT '[]',
  players JSONB NOT NULL,        -- Array of Player objects with scores
  is_finished BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rounds
CREATE POLICY "Users can view own rounds" ON rounds
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own rounds
CREATE POLICY "Users can insert own rounds" ON rounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own rounds
CREATE POLICY "Users can update own rounds" ON rounds
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own rounds
CREATE POLICY "Users can delete own rounds" ON rounds
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all rounds
CREATE POLICY "Admins can view all rounds" ON rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rounds_user_id ON rounds(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_round_date ON rounds(round_date DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_is_finished ON rounds(is_finished);

-- Trigger for updated_at
CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA - GOLF COURSES
-- ============================================
-- Uncomment and run this to seed initial courses

/*
INSERT INTO courses (name, holes, par, tees, holes_data) VALUES
(
  'Club de Campo Villa de Madrid (Negro)',
  18,
  71,
  '[{"name": "Blancas", "slope": 135, "rating": 72.5}, {"name": "Amarillas", "slope": 132, "rating": 71.0}, {"name": "Azules", "slope": 128, "rating": 69.5}, {"name": "Rojas", "slope": 125, "rating": 68.0}]'::jsonb,
  '[{"number": 1, "par": 4, "handicap": 7, "distance": 375}, {"number": 2, "par": 4, "handicap": 11, "distance": 345}, {"number": 3, "par": 3, "handicap": 17, "distance": 165}, {"number": 4, "par": 5, "handicap": 1, "distance": 495}, {"number": 5, "par": 4, "handicap": 9, "distance": 380}, {"number": 6, "par": 4, "handicap": 5, "distance": 390}, {"number": 7, "par": 3, "handicap": 15, "distance": 175}, {"number": 8, "par": 4, "handicap": 13, "distance": 340}, {"number": 9, "par": 4, "handicap": 3, "distance": 405}, {"number": 10, "par": 4, "handicap": 8, "distance": 365}, {"number": 11, "par": 3, "handicap": 16, "distance": 155}, {"number": 12, "par": 5, "handicap": 2, "distance": 510}, {"number": 13, "par": 4, "handicap": 10, "distance": 370}, {"number": 14, "par": 4, "handicap": 6, "distance": 385}, {"number": 15, "par": 3, "handicap": 18, "distance": 145}, {"number": 16, "par": 5, "handicap": 4, "distance": 485}, {"number": 17, "par": 4, "handicap": 12, "distance": 350}, {"number": 18, "par": 4, "handicap": 14, "distance": 360}]'::jsonb
),
(
  'Real Club de Golf El Prat (Rosa)',
  18,
  72,
  '[{"name": "Blancas", "slope": 138, "rating": 73.5}, {"name": "Amarillas", "slope": 134, "rating": 71.8}, {"name": "Rojas", "slope": 126, "rating": 68.2}]'::jsonb,
  '[{"number": 1, "par": 4, "handicap": 9, "distance": 365}, {"number": 2, "par": 5, "handicap": 5, "distance": 505}, {"number": 3, "par": 3, "handicap": 17, "distance": 160}, {"number": 4, "par": 4, "handicap": 1, "distance": 420}, {"number": 5, "par": 4, "handicap": 11, "distance": 355}, {"number": 6, "par": 4, "handicap": 7, "distance": 385}, {"number": 7, "par": 3, "handicap": 15, "distance": 180}, {"number": 8, "par": 5, "handicap": 3, "distance": 520}, {"number": 9, "par": 4, "handicap": 13, "distance": 370}, {"number": 10, "par": 4, "handicap": 10, "distance": 375}, {"number": 11, "par": 4, "handicap": 2, "distance": 410}, {"number": 12, "par": 3, "handicap": 18, "distance": 150}, {"number": 13, "par": 5, "handicap": 6, "distance": 495}, {"number": 14, "par": 4, "handicap": 8, "distance": 380}, {"number": 15, "par": 4, "handicap": 4, "distance": 395}, {"number": 16, "par": 3, "handicap": 16, "distance": 170}, {"number": 17, "par": 5, "handicap": 12, "distance": 485}, {"number": 18, "par": 4, "handicap": 14, "distance": 360}]'::jsonb
),
(
  'Las Lomas Bosque',
  18,
  72,
  '[{"name": "Negras", "slope": 135, "rating": 73.0}, {"name": "Blancas", "slope": 132, "rating": 71.5}, {"name": "Amarillas", "slope": 128, "rating": 69.8}, {"name": "Azules", "slope": 126, "rating": 68.5}, {"name": "Rojas", "slope": 123, "rating": 67.0}]'::jsonb,
  '[{"number": 1, "par": 4, "handicap": 5, "distance": 380}, {"number": 2, "par": 3, "handicap": 15, "distance": 165}, {"number": 3, "par": 5, "handicap": 1, "distance": 510}, {"number": 4, "par": 4, "handicap": 9, "distance": 360}, {"number": 5, "par": 4, "handicap": 7, "distance": 375}, {"number": 6, "par": 3, "handicap": 17, "distance": 155}, {"number": 7, "par": 5, "handicap": 3, "distance": 495}, {"number": 8, "par": 4, "handicap": 11, "distance": 350}, {"number": 9, "par": 4, "handicap": 13, "distance": 365}, {"number": 10, "par": 4, "handicap": 6, "distance": 385}, {"number": 11, "par": 3, "handicap": 16, "distance": 170}, {"number": 12, "par": 5, "handicap": 2, "distance": 520}, {"number": 13, "par": 4, "handicap": 10, "distance": 355}, {"number": 14, "par": 4, "handicap": 4, "distance": 400}, {"number": 15, "par": 3, "handicap": 18, "distance": 145}, {"number": 16, "par": 5, "handicap": 8, "distance": 480}, {"number": 17, "par": 4, "handicap": 12, "distance": 370}, {"number": 18, "par": 4, "handicap": 14, "distance": 345}]'::jsonb
),
(
  'La Faisanera',
  18,
  71,
  '[{"name": "Amarillas", "slope": 125, "rating": 69.5}]'::jsonb,
  '[{"number": 1, "par": 4, "handicap": 11, "distance": 340}, {"number": 2, "par": 4, "handicap": 3, "distance": 385}, {"number": 3, "par": 3, "handicap": 17, "distance": 150}, {"number": 4, "par": 5, "handicap": 7, "distance": 470}, {"number": 5, "par": 4, "handicap": 1, "distance": 395}, {"number": 6, "par": 4, "handicap": 9, "distance": 355}, {"number": 7, "par": 3, "handicap": 15, "distance": 165}, {"number": 8, "par": 4, "handicap": 5, "distance": 375}, {"number": 9, "par": 5, "handicap": 13, "distance": 455}, {"number": 10, "par": 4, "handicap": 10, "distance": 350}, {"number": 11, "par": 3, "handicap": 18, "distance": 140}, {"number": 12, "par": 4, "handicap": 2, "distance": 390}, {"number": 13, "par": 4, "handicap": 8, "distance": 365}, {"number": 14, "par": 5, "handicap": 6, "distance": 485}, {"number": 15, "par": 3, "handicap": 16, "distance": 155}, {"number": 16, "par": 4, "handicap": 4, "distance": 380}, {"number": 17, "par": 4, "handicap": 12, "distance": 345}, {"number": 18, "par": 4, "handicap": 14, "distance": 335}]'::jsonb
);
*/

-- Migration: Add owner role, permissions, and user-player linking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. UPDATE PROFILES TABLE
-- ============================================

-- Add 'owner' to role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'owner'));

-- Add permissions column (JSONB for flexibility)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- Add linked_player_id to link user account to their player profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_player_id UUID REFERENCES saved_players(id) ON DELETE SET NULL;

-- ============================================
-- 2. UPDATE RLS POLICIES FOR PROFILES
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Recreate policies including owner role
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    -- Regular users can only update display_name, linked_player_id
    -- Cannot change their own role, status, or permissions
    auth.uid() = id AND (
      role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
      status = (SELECT status FROM profiles WHERE id = auth.uid()) AND
      permissions = (SELECT permissions FROM profiles WHERE id = auth.uid())
    )
  );

-- Owners can do everything
CREATE POLICY "Owners can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Owners can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Admins can view and update (but not change to owner)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Admins cannot promote to owner or modify owner accounts
    role != 'owner' AND
    NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = profiles.id AND role = 'owner'
    )
  );

-- ============================================
-- 3. UPDATE RLS POLICIES FOR ROUNDS
-- ============================================

-- Drop existing admin policy
DROP POLICY IF EXISTS "Admins can view all rounds" ON rounds;

-- Owner can view ALL rounds from all users
CREATE POLICY "Owner can view all rounds" ON rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Owner can update any round
CREATE POLICY "Owner can update all rounds" ON rounds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Owner can delete any round
CREATE POLICY "Owner can delete all rounds" ON rounds
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================
-- 4. UPDATE RLS POLICIES FOR COURSES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- Owner and users with permission can insert courses
CREATE POLICY "Users with permission can insert courses" ON courses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (
        role = 'owner' OR
        role = 'admin' OR
        permissions ? 'courses.create'
      )
    )
  );

-- Owner and users with permission can update courses
CREATE POLICY "Users with permission can update courses" ON courses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (
        role = 'owner' OR
        role = 'admin' OR
        permissions ? 'courses.edit'
      )
    )
  );

-- Only owner and admins can delete courses
CREATE POLICY "Admins can delete courses" ON courses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- 5. ADD PERMISSION PRESETS FUNCTION
-- ============================================

-- Helper function to get default permissions for a role preset
CREATE OR REPLACE FUNCTION get_permission_preset(preset_name TEXT)
RETURNS JSONB AS $$
BEGIN
  CASE preset_name
    WHEN 'full' THEN
      RETURN '["rounds.create", "rounds.import", "courses.create", "courses.edit", "players.manage"]'::jsonb;
    WHEN 'basic' THEN
      RETURN '["rounds.create", "rounds.import", "players.manage"]'::jsonb;
    WHEN 'restricted' THEN
      RETURN '["players.manage"]'::jsonb;
    ELSE
      RETURN '[]'::jsonb;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 6. CREATE INDEX FOR PERMISSIONS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_permissions ON profiles USING GIN(permissions);

-- ============================================
-- 7. COMMENT THE NEW COLUMNS
-- ============================================

COMMENT ON COLUMN profiles.role IS 'User role: user, admin, or owner';
COMMENT ON COLUMN profiles.permissions IS 'Array of permission strings: rounds.create, rounds.import, courses.create, courses.edit, players.manage';
COMMENT ON COLUMN profiles.linked_player_id IS 'Links this user account to their saved_player profile for stats and shared rounds';

-- ============================================
-- NOTE: After running this migration, you need to:
-- 1. Set your user account as owner:
--    UPDATE profiles SET role = 'owner' WHERE id = 'your-user-id';
-- ============================================

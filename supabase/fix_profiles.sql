-- Fix: Crear perfil para usuario existente si no existe
INSERT INTO profiles (id, display_name, role, status)
SELECT
  '203ee45f-b097-48bb-aba4-8bd85eb536e4',
  NULL,
  'user',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE id = '203ee45f-b097-48bb-aba4-8bd85eb536e4'
);

-- Fix: Agregar policy para INSERT en profiles (faltaba)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix: Permitir que el service_role pueda hacer todo
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Service role full access" ON profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

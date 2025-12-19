-- 1. Verificar que la tabla existe y crearla si no
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar el perfil del usuario actual
INSERT INTO profiles (id, display_name, role, status)
VALUES ('203ee45f-b097-48bb-aba4-8bd85eb536e4', NULL, 'user', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Deshabilitar RLS temporalmente para debug
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

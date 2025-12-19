-- Deshabilitar RLS para rounds (temporalmente para desarrollo)
ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;

-- Verificar
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('profiles', 'courses', 'rounds');

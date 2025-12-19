-- Verificar si hay campos insertados
SELECT * FROM courses;

-- Si no ves resultados, el problema es RLS
-- Deshabilitar RLS temporalmente para courses
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;

-- Verificar de nuevo
SELECT name FROM courses;

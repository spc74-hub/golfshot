-- Eliminar duplicados manteniendo solo uno de cada campo
DELETE FROM courses a
USING courses b
WHERE a.id > b.id
AND a.name = b.name;

-- Verificar resultado
SELECT id, name FROM courses ORDER BY name;

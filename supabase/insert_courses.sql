-- Insertar campos de golf iniciales
-- Ejecuta esto en Supabase SQL Editor

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
)
ON CONFLICT DO NOTHING;

# GolfShot — Backlog

## Prioridad Alta
- [ ] **Panel Admin** — Implementar dashboard de administración (actualmente placeholder). Incluir gestión de campos y estadísticas de uso
- [ ] **Tests backend** — Añadir tests unitarios y de integración para endpoints críticos (rounds, stats, OCR)
- [ ] **Tests frontend** — Añadir tests de componentes principales (RoundPlay, RoundSetup, Stats)

## Prioridad Media
- [ ] **Búsqueda externa de campos** — Completar integración con golfcourseapi.com (actualmente parcial, solo búsqueda sin importación completa de datos de hoyos)
- [ ] **Notificaciones de partida compartida** — Notificar al owner cuando un colaborador se une o edita scores
- [ ] **Modo offline** — Mejorar soporte offline del PWA para registrar scores sin conexión y sincronizar al reconectar
- [ ] **Exportar partidas** — Permitir exportar historial de partidas a CSV/PDF
- [ ] **Cálculo automático de handicap** — Implementar cálculo del Handicap Index oficial según las últimas 20 partidas (actualmente es registro manual)
- [ ] **Validación de scores** — Añadir validaciones de golpes mínimos/máximos por hoyo para prevenir errores de entrada
- [ ] **Mejora de OCR** — Mejorar extracción de datos borrosos o formatos no estándar de tarjetas

## Prioridad Baja / Futuro
- [ ] **Fotos por hoyo** — Permitir adjuntar fotos a cada hoyo de la partida
- [ ] **Mapa del campo** — Vista visual del layout del campo con hoyos
- [ ] **Ranking entre jugadores** — Tabla de clasificación entre jugadores habituales
- [ ] **Historial de edición** — Registro de cambios en scores de partidas compartidas
- [ ] **Internacionalización** — Soporte multi-idioma (actualmente solo español)
- [ ] **Dark/Light mode** — Toggle de tema (actualmente solo dark)
- [ ] **Perfil de usuario** — Página dedicada de perfil con avatar, bio y configuración
- [ ] **Recuperación de contraseña** — Flujo de "olvidé mi contraseña" con email

## Bugs Conocidos
- [ ] **Stableford duplicado en History** — La función calculateStablefordPoints está duplicada en History.tsx en vez de usar la de calculations.ts
- [ ] **Register response format** — El register busca `data.session.access_token` pero el backend devuelve `data.access_token` directamente (funciona pero hay inconsistencia)
- [ ] **Admin routes placeholder** — Las rutas `/admin`, `/admin/users` y `/admin/courses` son solo placeholders sin funcionalidad
- [ ] **README desactualizado** — El README.md aún referencia Supabase como backend, pero se migró a PostgreSQL + SQLAlchemy self-hosted

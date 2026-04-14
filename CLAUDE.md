# GolfShot — App PWA para seguimiento de partidas de golf

## Overview

GolfShot es una Progressive Web App (PWA) para registrar y hacer seguimiento de partidas de golf. Permite crear partidas en múltiples modalidades de juego (Stableford, Stroke Play, Sindicato, Equipos, Match Play), gestionar jugadores y campos, importar tarjetas históricas mediante OCR con IA, y consultar estadísticas detalladas de rendimiento.

Destinada a golfistas amateur que quieren llevar un registro digital de sus partidas, handicaps y evolución.

## Architecture

- **Frontend**: React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS 4 + shadcn/ui (Radix)
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy async + asyncpg
- **Base de datos**: PostgreSQL 16 (container compartido `spcapps-postgres`)
- **Auth**: JWT (python-jose) + bcrypt, tokens con 7 días de expiración
- **IA/OCR**: Anthropic Claude Sonnet 4 Vision para extracción de datos de tarjetas
- **PWA**: vite-plugin-pwa con Service Worker y caché offline
- **State management**: React Query (TanStack Query v5) + Context API
- **Charts**: Recharts v3
- **Dominio**: golfshot.spcapps.com
- **Repo**: spc74-hub/golfshot

```
golfshot-migration/
├── frontend/          # React PWA (puerto 5174 dev, nginx en Docker)
├── backend/           # FastAPI (puerto 8000)
├── supabase/          # SQL legacy (migración original desde Supabase)
└── docker-compose.yml # Servicios para VPS
```

## Features

### Partidas (Rounds)
- Crear partidas con 1-4 jugadores
- Modalidades: Stableford, Stroke Play, Sindicato, Equipos (Best Ball / Good-Bad Ball), Match Play
- Registro hoyo a hoyo de golpes y putts
- Cálculo automático de HDJ (Handicap de Juego): `HDJ = (HI × slope) / 113`
- Handicap al 100% o 75% (diferencia para Match Play)
- Puntos Stableford automáticos con código de colores (Eagle→naranja, Birdie→rojo, Par→azul, Bogey→verde)
- Indicador GIR (Green in Regulation) por hoyo
- Handicap Virtual (HV) por partida: `HV = HI - (Stableford - 36)`
- Partidas compartidas con código de 6 caracteres (colaboradores pueden editar scores)
- Marcar partidas como finalizadas

### Importación OCR
- Importar partidas históricas desde foto de tarjeta de score
- Importar campos desde foto de tarjeta del campo
- Soporte clipboard paste y upload de imagen
- Detección automática de front9/back9/18 hoyos
- Cálculo de HDJ desde puntos Stableford

### Campos (Courses)
- CRUD completo de campos de golf
- Múltiples tees por campo (Blancas, Amarillas, Rojas, Azules, Negras) con slope y rating
- Datos de 18 hoyos: par, handicap, distancia por tee
- Marcar campos como favoritos
- 4 campos españoles precargados (migración seed)
- Búsqueda en API externa de campos (golfcourseapi.com)

### Jugadores (Players)
- Gestión de jugadores guardados con índice de handicap y tee preferido
- Vincular perfil de usuario a un jugador guardado
- Owner puede ver y gestionar todos los jugadores

### Plantillas (Templates)
- Crear plantillas de partida predefinidas (campo, modalidad, jugadores, configuración)
- Marcar plantillas como favoritas
- Inicio rápido desde plantilla en el Dashboard

### Estadísticas (Stats)
- Media de golpes por tipo de hoyo (par 3/4/5)
- Media de golpes y putts para 9 y 18 hoyos
- Puntos Stableford promedio
- HVP (Handicap Virtual Promedio) por periodo (mes, trimestre, año, total)
- Mejor ronda (9 y 18 hoyos) con fecha y campo
- Distribución de resultados (eagles, birdies, pars, bogeys, dobles, triples+)
- GIR% (Green in Regulation)
- Target strokes y strokes gap (diferencia real vs esperado)
- Gráfico de evolución del HV con filtros por campo y hoyos
- Filtrado por periodo (1m, 3m, 6m, 1y, all), año, campo, longitud
- Comparación entre periodos
- Historial de Handicap Index con registro manual de cambios

### Historial (History)
- Listado de partidas con agrupación mensual
- Detalle de cada partida: golpes, Stableford, HDJ por jugador
- Colores por resultado vs par
- Acceso a tarjeta completa (RoundCard)

### Dashboard (Home)
- Partidas activas (en progreso) con acceso directo
- Inicio rápido desde plantillas favoritas
- Unirse a partida compartida por código
- Resumen de stats (HVP, golpes, putts, partidas del mes)
- Accesos rápidos a Campos, Jugadores, Historial, Stats

### Panel Owner
- Estadísticas globales (usuarios, partidas, campos)
- Gestión de usuarios: ver todos, cambiar rol, permisos, bloquear, eliminar, reset password
- Vincular usuario a jugador guardado
- Listado de todas las partidas del sistema

### Auth y Permisos
- Registro/login con email y password
- Roles: user, admin, owner
- Permisos granulares: rounds.create, rounds.import, courses.create, courses.edit, players.manage
- Onboarding dialog para nuevos usuarios

## Database Schema

### Profile
`id` (UUID PK), `email` (unique), `hashed_password`, `display_name`, `role` (user/admin/owner), `status` (active/disabled/blocked), `permissions` (JSON[]), `linked_player_id` (FK SavedPlayer), `created_at`, `updated_at`

### Course
`id` (UUID PK), `name`, `holes` (9/18), `par`, `tees` (JSON[{name, slope, rating}]), `holes_data` (JSON[{number, par, handicap, distance}]), `is_favorite`, `created_at`, `updated_at`

### Round
`id` (UUID PK), `user_id` (FK Profile), `course_id` (FK Course), `course_name`, `round_date`, `course_length` (18/front9/back9), `game_mode` (stableford/stroke/sindicato/team/matchplay), `use_handicap`, `handicap_percentage` (100/75), `sindicato_points` (JSON[]), `team_mode`, `best_ball_points`, `worst_ball_points`, `current_hole`, `completed_holes` (JSON[]), `players` (JSON[{id, name, handicap, tee, team, scores}]), `is_finished`, `is_imported`, `virtual_handicap`, `share_code` (6 chars unique), `collaborators` (JSON[user_ids]), `created_at`, `updated_at`

### SavedPlayer
`id` (UUID PK), `user_id` (FK Profile), `name`, `handicap_index` (0-54), `preferred_tee`, `created_at`, `updated_at`

### RoundTemplate
`id` (UUID PK), `user_id` (FK Profile), `name`, `course_id`, `course_name`, `course_length`, `game_mode`, `use_handicap`, `handicap_percentage`, `sindicato_points`, `team_mode`, `best_ball_points`, `worst_ball_points`, `player_ids` (JSON[]), `default_tee`, `is_favorite`, `created_at`, `updated_at`

### HandicapHistory
`id` (UUID PK), `user_id` (FK Profile), `handicap_index`, `effective_date`, `notes`, `created_at`

## API Endpoints

### Auth (`/auth`)
- `POST /register` — Registro
- `POST /login` — Login, devuelve JWT
- `POST /logout` — Logout
- `GET /me` — Perfil del usuario actual

### Users (`/users`)
- `PATCH /me` — Actualizar perfil propio
- `GET /me/stats` — Estadísticas del usuario
- `GET /me/stats/filtered` — Stats con filtros (periodo, año, campo)
- `GET /me/stats/compare` — Comparar stats entre periodos
- `GET /` — Listar usuarios (admin)
- `PATCH /{id}` — Actualizar usuario
- `DELETE /{id}` — Eliminar usuario (owner)
- `PATCH /{id}/block` — Bloquear/desbloquear (owner)
- `PATCH /{id}/reset-password` — Reset password (owner)
- `GET /owner/users` — Usuarios con stats (owner)
- `GET /owner/rounds` — Todas las partidas (owner)
- `PATCH /owner/users/{id}/permissions` — Permisos (owner)
- `GET /owner/stats` — Stats globales (owner)

### Courses (`/courses`)
- `GET /` — Listar campos
- `POST /` — Crear campo (admin)
- `GET /{id}` — Detalle campo
- `PUT /{id}` — Actualizar campo
- `DELETE /{id}` — Eliminar campo
- `GET /{id}/rounds-count` — Contar partidas del campo
- `GET /{id}/rounds` — Partidas del usuario en el campo
- `POST /migrate` — Seed de 4 campos iniciales (admin)
- `POST /from-image/extract` — Extraer campo desde imagen OCR
- `POST /from-image/save` — Guardar campo extraído

### Rounds (`/rounds`)
- `GET /` — Listar partidas del usuario (propias + compartidas)
- `POST /` — Crear partida
- `GET /{id}` — Detalle partida
- `PUT /{id}` — Actualizar partida (owner o colaborador)
- `DELETE /{id}` — Eliminar partida (owner)
- `PATCH /{id}/finish` — Finalizar partida
- `POST /import/extract` — Extraer partida desde imagen OCR
- `POST /import/save` — Guardar partida importada
- `POST /join` — Unirse a partida compartida por código

### Players (`/players`)
- `GET /` — Listar jugadores guardados
- `POST /` — Crear jugador
- `GET /{id}` — Detalle jugador
- `PUT /{id}` — Actualizar jugador
- `DELETE /{id}` — Eliminar jugador

### Templates (`/templates`)
- `GET /` — Listar plantillas
- `POST /` — Crear plantilla
- `GET /{id}` — Detalle plantilla
- `PUT /{id}` — Actualizar plantilla
- `DELETE /{id}` — Eliminar plantilla
- `PATCH /{id}/favorite` — Toggle favorita

### Handicap History (`/handicap-history`)
- `GET /` — Historial de handicap
- `GET /current` — Handicap actual
- `GET /at-date/{date}` — Handicap en fecha específica
- `POST /` — Crear entrada
- `PUT /{id}` — Actualizar entrada
- `DELETE /{id}` — Eliminar entrada

### Admin (`/admin`)
- `GET /stats` — Estadísticas globales (admin+)

## Auth

- **Método**: JWT Bearer tokens en header `Authorization`
- **Hashing**: bcrypt via passlib
- **Tokens**: HS256, expiración 7 días
- **Storage**: `localStorage.access_token` en el frontend
- **Roles**: user < admin < owner (jerarquía acumulativa)
- **Permisos**: Array JSON en el perfil, verificados con `require_permission()` o `has_permission()`
- **Protección de rutas**: `ProtectedRoute` component con props `requireAdmin` y `requireOwner`

## Deployment

- **VPS**: Hostinger (72.62.26.203) con Docker
- **Dominio**: golfshot.spcapps.com (Cloudflare Tunnel)
- **Contenedores**:
  - `golfshot-backend`: Python 3.12 + uvicorn (puerto 8000)
  - `golfshot-frontend`: Node 20 build → nginx (puerto 80)
  - `spcapps-postgres`: PostgreSQL 16 compartido (red `spcapps-network`)
- **API URL**: `https://golfshot.spcapps.com/api` (proxy nginx)
- **Auto-deploy**: webhook en GitHub → pull + build + restart
- **Infra**: repo `spc74-hub/spcapps-infra`, path `/opt/spcapps-infra/projects/golfshot/`

## Key Files

| Fichero | Descripción |
|---------|-------------|
| `backend/app/main.py` | App FastAPI, CORS, routers |
| `backend/app/models/db_models.py` | Modelos SQLAlchemy (Profile, Course, Round, etc.) |
| `backend/app/models/schemas.py` | Schemas Pydantic (request/response) |
| `backend/app/routers/rounds.py` | CRUD partidas, HDJ, HV, compartir |
| `backend/app/routers/users.py` | Usuarios, stats, owner panel |
| `backend/app/routers/courses.py` | CRUD campos, OCR import, seed |
| `backend/app/services/scorecard_ocr.py` | OCR de tarjeta de campo (Claude Vision) |
| `backend/app/services/round_ocr.py` | OCR de tarjeta de score (Claude Vision) |
| `backend/app/auth.py` | JWT + bcrypt helpers |
| `backend/app/dependencies.py` | Auth dependencies, permisos |
| `frontend/src/App.tsx` | Rutas y providers |
| `frontend/src/lib/calculations.ts` | Cálculos golf (Stableford, HDJ, Match Play) |
| `frontend/src/lib/api.ts` | Cliente API con transformaciones snake→camel |
| `frontend/src/context/AuthContext.tsx` | Auth state, login/logout/register |
| `frontend/src/pages/RoundPlay.tsx` | Pantalla de juego hoyo a hoyo |

## Backlog

Ver [docs/BACKLOG.md](docs/BACKLOG.md) para el detalle completo de tareas pendientes.

Resumen: panel admin sin implementar, búsqueda externa de campos incompleta, mejoras de UX en móvil, y posible migración a cálculo automático de handicap oficial.

## Conventions

- Commits en inglés, documentación y comunicación en español
- Backend: snake_case. Frontend: camelCase. Transformación en `api.ts`
- Componentes UI: shadcn/ui (Radix) con Tailwind
- State: React Query para server state, Context para auth
- Hooks custom por entidad: `useRounds`, `useCourses`, `usePlayers`, `useTemplates`, `useStats`, `useHandicapHistory`
- Variables de entorno: `.env` en backend y frontend (no commitear)
- When making changes, update this CLAUDE.md
- Al completar items del backlog, marcarlos en docs/BACKLOG.md y documentar en docs/CHANGELOG.md

Ver docs/ para documentación detallada:
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — Guía funcional del usuario
- [docs/PROCESSES.md](docs/PROCESSES.md) — Flujos de negocio con diagramas
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Historial de cambios
- [docs/BACKLOG.md](docs/BACKLOG.md) — Tareas pendientes

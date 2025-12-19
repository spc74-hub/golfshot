# Golf Shot

Aplicacion PWA para el seguimiento de partidas de golf.

## Caracteristicas

- **Registro de partidas**: Stableford, Stroke Play, Sindicato, Equipos
- **Multiples jugadores**: Hasta 4 jugadores por partida
- **Handicap**: Calculo automatico de puntos Stableford con handicap
- **Importacion de campos**: Sube una foto de la tarjeta y extrae los datos con IA
- **PWA**: Instala la app en tu iPhone como acceso directo
- **Colores de resultado**: Eagle (naranja), Birdie (rojo), Par (azul), Bogey (verde), etc.

## Stack Tecnologico

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python)
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticacion**: Supabase Auth
- **IA**: Claude Vision para OCR de tarjetas
- **PWA**: vite-plugin-pwa con Service Worker

## Estructura del Proyecto

```
golfshot/
├── frontend/          # React + Vite PWA
├── backend/           # FastAPI server
└── supabase/          # SQL schema
```

## Configuracion Inicial

### 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. Copia las credenciales desde **Settings > API**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configurar Frontend

```bash
cd frontend

# Copiar archivo de entorno
cp .env.example .env

# Editar .env con tus credenciales
# VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
# VITE_SUPABASE_ANON_KEY=tu-anon-key
# VITE_API_URL=http://localhost:8000

# Instalar dependencias
npm install

# Generar iconos PWA
node scripts/generate-icons.js

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estara disponible en `http://localhost:5174`

### 3. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
source venv/bin/activate  # Mac/Linux

# Instalar dependencias
pip install -r requirements.txt

# Copiar archivo de entorno
cp .env.example .env

# Editar .env con tus credenciales
# SUPABASE_URL=https://tu-proyecto.supabase.co
# SUPABASE_ANON_KEY=tu-anon-key
# SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
# ANTHROPIC_API_KEY=tu-api-key  # Para OCR de tarjetas

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

El backend estara disponible en `http://localhost:8000`
Documentacion API en `http://localhost:8000/docs`

## Instalar como PWA en iPhone

1. Abre la app en Safari
2. Toca el icono de compartir (cuadrado con flecha)
3. Selecciona "Añadir a pantalla de inicio"
4. El icono de Golf Shot aparecera en tu pantalla

## Comandos Utiles

### Frontend
```bash
npm run dev      # Desarrollo
npm run build    # Build produccion
npm run preview  # Preview del build
```

### Backend
```bash
uvicorn app.main:app --reload  # Desarrollo
uvicorn app.main:app           # Produccion
```

## Crear Usuario Admin

1. Registra un usuario normalmente
2. En Supabase SQL Editor, ejecuta:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';
```

## Paginas

- `/` - Home con partidas activas y recientes
- `/login` - Inicio de sesion
- `/register` - Registro
- `/round/setup` - Configurar nueva partida
- `/round/play` - Jugar partida activa
- `/round/card` - Ver tarjeta completa
- `/history` - Historial de partidas
- `/courses` - Gestionar campos de golf
- `/admin` - Panel de administracion

## Licencia

MIT

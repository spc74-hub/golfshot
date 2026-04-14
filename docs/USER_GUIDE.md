# GolfShot — Guía del Usuario

## Introducción

GolfShot es una app web progresiva (PWA) para registrar tus partidas de golf. Puedes instalarla en tu móvil como una app nativa desde el navegador.

### Instalación en iPhone/iPad
1. Abre `golfshot.spcapps.com` en Safari
2. Toca el icono de compartir (cuadrado con flecha)
3. Selecciona "Añadir a pantalla de inicio"
4. El icono de Golf Shot aparecerá en tu pantalla

### Registro y Login
1. Entra en la app y pulsa "Crear cuenta"
2. Introduce email, contraseña (mínimo 6 caracteres) y nombre para mostrar
3. Se crea tu cuenta y entras directamente al Dashboard

---

## Dashboard (Inicio)

La pantalla principal muestra:

### Partidas en Curso
- Si tienes partidas sin finalizar, aparecen arriba con botón "Continuar"
- Muestra campo, fecha, hoyo actual y golpes acumulados

### Inicio Rápido
- **Nueva Partida**: acceso directo a configurar una partida nueva
- **Plantillas favoritas**: si tienes plantillas marcadas como favoritas, aparecen como botones de inicio rápido que crean la partida directamente con la configuración predefinida

### Unirse a Partida
- Campo de texto para introducir un código de 6 caracteres
- Permite unirte como colaborador a una partida compartida por otro usuario

### Resumen de Estadísticas
- HVP (Handicap Virtual Promedio) general y del mes
- Media de golpes (9 y 18 hoyos)
- Media de putts
- Partidas del mes

### Accesos Rápidos
- Tarjetas con enlaces a Campos, Jugadores, Historial y Estadísticas

---

## Nueva Partida (Round Setup)

### Paso 1: Seleccionar Campo
- Elige un campo de la lista desplegable (los favoritos aparecen primero)
- Si el campo no existe, puedes crearlo manualmente o importarlo desde una foto de la tarjeta del campo
- Opción de buscar campos en la API externa

### Paso 2: Configurar Partida
- **Fecha**: fecha de la partida (por defecto hoy)
- **Hoyos**: 18 hoyos, Primeros 9 (front9) o Últimos 9 (back9)
- **Modalidad de juego**:
  - **Stableford**: puntuación por puntos Stableford con handicap
  - **Stroke Play**: solo golpes brutos
  - **Sindicato**: competición por puntos entre jugadores (configurable: 4-2-1-0 por defecto)
  - **Equipos**: dos equipos (A y B) con Best Ball o Good/Bad Ball
  - **Match Play**: enfrentamiento 1v1 hoyo a hoyo
- **Handicap**: activar/desactivar uso de handicap
- **Porcentaje**: 100% (normal) o 75% (Match Play — calcula diferencia entre jugadores)

### Paso 3: Añadir Jugadores
- Selecciona jugadores guardados de tu lista o crea nuevos
- Para cada jugador:
  - **Nombre** (obligatorio)
  - **Índice de Handicap** (0-54, por defecto 24.0)
  - **Tee** (seleccionar de los tees del campo elegido)
  - **Equipo** (A o B, solo en modo Equipos)
- El HDJ (Handicap de Juego) se calcula automáticamente: `HDJ = (HI × slope del tee) / 113`
- En modo 75%, se calcula la diferencia: el jugador con menor HDJ juega a 0, los demás reciben el 75% de la diferencia

### Paso 4: Usar Plantilla (opcional)
- Si seleccionas una plantilla, se pre-rellenan campo, modalidad, jugadores y configuración
- Puedes modificar cualquier valor antes de empezar

### Crear Partida
- Pulsa "Iniciar Partida" para crear y empezar a jugar

---

## Jugar Partida (Round Play)

### Navegación por Hoyos
- Arriba se muestra el hoyo actual con su par, handicap y distancia
- Botones de navegación para ir al hoyo anterior/siguiente
- Indicador de hoyos completados

### Registro de Scores
- Para cada jugador en el hoyo actual:
  - **Golpes**: selector numérico (+/-)
  - **Putts**: selector numérico (+/-)
- Los puntos Stableford se calculan automáticamente
- Color del resultado según diferencia con el par:
  - 🟠 Eagle o mejor
  - 🔴 Birdie
  - 🔵 Par
  - 🟢 Bogey
  - ⚪ Doble bogey
  - ⚫ Triple bogey o peor

### Indicador GIR
- Se muestra si el jugador alcanzó el green en regulación (golpes al green ≤ par - 2)

### Resumen en Curso
- Total de golpes acumulados
- Puntos Stableford acumulados (según modalidad)
- En Match Play: marcador UP/DN/AS (All Square)
- En Sindicato: puntos por jugador
- En Equipos: puntos por equipo

### Compartir Partida
- Botón para activar/desactivar compartir
- Al activar, se genera un código de 6 caracteres
- Otros usuarios pueden unirse con ese código desde su Dashboard
- Los colaboradores pueden ver y editar los scores en tiempo real

### Finalizar Partida
- Pulsa "Finalizar" cuando completes todos los hoyos
- Se calcula el Handicap Virtual (HV) de la partida
- La partida pasa al historial como finalizada

---

## Tarjeta de Partida (Round Card)

Vista de la tarjeta completa de la partida:
- Tabla con todos los hoyos, par, handicap
- Para cada jugador: golpes, putts y puntos Stableford por hoyo
- Totales: OUT (hoyos 1-9), IN (hoyos 10-18), TOTAL
- Colores de resultado por hoyo
- HDJ y HV del jugador principal

---

## Historial

### Vista General
- Partidas ordenadas por fecha, agrupadas por mes
- Cada partida muestra: campo, fecha, modalidad, golpes totales, puntos Stableford, HDJ
- Badge de color según modalidad (Stableford, Stroke, Sindicato, Team, Match Play)
- Indicador de partida importada vs jugada en la app

### Acciones por Partida
- **Ver tarjeta**: abre la tarjeta completa (RoundCard)
- **Continuar**: si la partida no está finalizada, permite retomarla
- **Eliminar**: elimina la partida (solo el propietario)

### Detalles por Jugador
- Al expandir una partida: golpes, Stableford, HDJ por cada jugador
- Puntos Sindicato o resultado Match Play si corresponde

---

## Importar Partida

Permite importar partidas históricas desde una foto de la tarjeta de score:

1. **Subir imagen**: arrastra, pega desde clipboard o selecciona archivo (JPEG/PNG/WebP, máx 10MB)
2. **Seleccionar hoyos**: 18, Primeros 9 o Últimos 9
3. **Extraer datos**: la IA (Claude Vision) analiza la imagen y extrae:
   - Nombre del campo
   - Nombre del jugador e índice de handicap
   - Golpes y putts por hoyo
   - Fecha de la partida
4. **Revisar y editar**: puedes corregir cualquier dato extraído antes de guardar
5. **Guardar**: se crea la partida como importada y finalizada

---

## Campos

### Lista de Campos
- Todos los campos disponibles, con favoritos primero
- Nombre, nº de hoyos, par total, tees disponibles
- Botón de favorito (estrella)

### Detalle del Campo
- Información completa: tees con slope y rating
- Tabla de hoyos: par, handicap, distancia por tee
- Partidas jugadas en este campo (del usuario actual)

### Crear Campo
Tres formas:
1. **Manual**: rellenar nombre, hoyos, par, tees y datos de cada hoyo
2. **Desde imagen**: subir foto de la tarjeta del campo → OCR extrae los datos
3. **Búsqueda externa**: buscar en la API golfcourseapi.com (limitado)

### Editar/Eliminar Campo
- Editar cualquier dato del campo
- Al eliminar, se avisa si hay partidas asociadas

---

## Jugadores

### Lista de Jugadores
- Jugadores guardados con nombre, índice de handicap y tee preferido
- El owner puede ver jugadores de todos los usuarios

### Crear/Editar Jugador
- **Nombre** (obligatorio)
- **Índice de Handicap** (0-54, por defecto 24.0, acepta decimales)
- **Tee preferido** (opcional)

### Vincular a Usuario
- Desde el perfil o el panel Owner, se puede vincular un jugador guardado a una cuenta de usuario
- Esto permite que el sistema use el handicap del jugador vinculado en las estadísticas

---

## Plantillas de Partida

### Lista de Plantillas
- Plantillas guardadas con nombre, campo, modalidad y jugadores
- Favoritas aparecen primero y se muestran en el Dashboard

### Crear/Editar Plantilla
- **Nombre** (obligatorio)
- **Campo** (opcional — pre-seleccionado al crear partida)
- **Hoyos**: 18, front9, back9
- **Modalidad**: Stableford, Stroke, Sindicato, Equipos, Match Play
- **Configuración de handicap**: activar, porcentaje
- **Jugadores**: seleccionar de la lista de jugadores guardados
- **Tee por defecto**: se aplica a todos los jugadores de la plantilla

### Usar Plantilla
- Desde el Dashboard (inicio rápido) o desde la pantalla de Nueva Partida
- Se pre-rellenan todos los campos configurados

---

## Estadísticas

### Panel General
- Resumen con las métricas principales del usuario
- HVP general y por periodo (mes, trimestre, año)
- Desviación del HVP respecto al handicap oficial

### Métricas de Golpes
- Media de golpes por tipo de hoyo (par 3, par 4, par 5)
- Media de golpes para 9 y 18 hoyos
- Target strokes (golpes esperados según handicap) y gap

### Putting
- Media de putts por ronda (9 y 18 hoyos)

### Mejores Rondas
- Mejor ronda de 18 hoyos (golpes, fecha, campo)
- Mejor ronda de 9 hoyos (golpes, fecha, campo)

### Distribución de Resultados
- Porcentaje de eagles+, birdies, pars, bogeys, dobles, triples+
- GIR% (Green in Regulation)

### Gráfico de Evolución HV
- Gráfico de línea con la evolución del Handicap Virtual por partida
- Filtros por campo y longitud de hoyos
- Puntos coloreados según comparación con el handicap oficial
- Línea de referencia con el HVP promedio

### Filtros
- Periodo: último mes, 3 meses, 6 meses, año, todo
- Año específico
- Campo específico
- Longitud de hoyos (9 o 18)

### Comparación de Periodos
- Compara estadísticas entre el periodo actual y el anterior
- Muestra diferencias (mejora en verde, empeoramiento en rojo)

### Historial de Handicap
- Registro manual de cambios en el Índice de Handicap oficial
- Tabla con fecha, valor y notas
- Crear, editar y eliminar entradas

---

## Panel Owner

Accesible solo para usuarios con rol "owner":

### Estadísticas Globales
- Total de usuarios, partidas, campos, jugadores
- Desglose de usuarios por rol
- Partidas del mes

### Gestión de Usuarios
- Tabla con todos los usuarios: email, nombre, rol, estado, partidas
- Acciones por usuario:
  - **Cambiar rol**: user, admin, owner
  - **Gestionar permisos**: rounds.create, rounds.import, courses.create, courses.edit, players.manage
  - **Vincular a jugador**: asociar a un jugador guardado
  - **Bloquear/Desbloquear**: impide el acceso del usuario
  - **Eliminar**: elimina el usuario y sus datos
  - **Reset password**: establece nueva contraseña

### Listado de Partidas
- Todas las partidas del sistema con usuario, campo, fecha, modalidad, estado

---

## Navegación

### Móvil (barra inferior)
- **Inicio**: Dashboard
- **Nueva**: crear partida
- **Historial**: lista de partidas
- **Stats**: estadísticas
- **Owner/Admin**: panel de gestión (según rol)

### Desktop (header)
- Logo "Golf Shot" → Dashboard
- Link Owner/Admin (según rol)
- Nombre de usuario
- Botón "Salir"

### Rutas
| Ruta | Página |
|------|--------|
| `/` | Dashboard |
| `/login` | Login |
| `/register` | Registro |
| `/round/setup` | Configurar partida |
| `/round/play` | Jugar partida |
| `/round/card` | Tarjeta de partida |
| `/round/import` | Importar partida |
| `/history` | Historial |
| `/courses` | Campos |
| `/players` | Jugadores |
| `/templates` | Plantillas |
| `/stats` | Estadísticas |
| `/owner` | Panel Owner |
| `/admin` | Panel Admin (placeholder) |

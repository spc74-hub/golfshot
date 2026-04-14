# GolfShot — Flujos de Negocio

## 1. Registro y Autenticación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Introduce email + password
    F->>B: POST /auth/register
    B->>DB: Verificar email único
    alt Email ya existe
        B-->>F: 409 Conflict
        F-->>U: Error "Email ya registrado"
    else Email disponible
        B->>DB: Crear Profile (role=user, status=active)
        B->>B: Generar JWT (7 días)
        B-->>F: 200 {access_token, user}
        F->>F: Guardar token en localStorage
        F-->>U: Redirigir a Dashboard
        F->>U: Mostrar Onboarding Dialog
    end
```

## 2. Crear y Jugar una Partida

```mermaid
flowchart TD
    A[Dashboard] --> B{¿Usar plantilla?}
    B -->|Sí| C[Cargar config de plantilla]
    B -->|No| D[Round Setup manual]
    C --> D
    D --> E[Seleccionar campo]
    E --> F[Configurar: fecha, hoyos, modalidad]
    F --> G[Añadir jugadores con handicap y tee]
    G --> H[Calcular HDJ por jugador]
    H --> I[POST /rounds/ - Crear partida]
    I --> J[Round Play - Hoyo 1]

    J --> K[Registrar golpes y putts]
    K --> L[Calcular Stableford automático]
    L --> M{¿Siguiente hoyo?}
    M -->|Sí| N[Avanzar hoyo]
    N --> K
    M -->|No| O[Finalizar partida]
    O --> P[Calcular HV = HI - Stableford - 36]
    P --> Q[PATCH /rounds/id/finish]
    Q --> R[Partida en Historial]
```

## 3. Cálculo del Handicap de Juego (HDJ)

```mermaid
flowchart TD
    A[Handicap Index del jugador] --> B[Slope del tee seleccionado]
    B --> C["HDJ = (HI × Slope) / 113"]
    C --> D{¿Porcentaje 75%?}
    D -->|No| E["HDJ final = round(HDJ)"]
    D -->|Sí - Match Play| F[Buscar HDJ mínimo entre jugadores]
    F --> G["Diferencia = HDJ_jugador - HDJ_mínimo"]
    G --> H["Golpes ventaja = round(diferencia × 0.75)"]
    H --> I["HDJ efectivo = golpes ventaja"]
```

## 4. Cálculo de Puntos Stableford

```mermaid
flowchart TD
    A[Golpes brutos en hoyo] --> B[Calcular golpes recibidos]
    B --> C["base = floor(HDJ / 18)"]
    C --> D["resto = HDJ % 18"]
    D --> E{"¿Handicap hoyo <= resto?"}
    E -->|Sí| F["Golpes recibidos = base + 1"]
    E -->|No| G["Golpes recibidos = base"]
    F --> H["Score neto = golpes - recibidos"]
    G --> H
    H --> I["Diferencia = neto - par"]
    I --> J{Diferencia}
    J -->|"≤ -3"| K["5 pts - Albatross+"]
    J -->|"-2"| L["4 pts - Eagle"]
    J -->|"-1"| M["3 pts - Birdie"]
    J -->|"0"| N["2 pts - Par"]
    J -->|"+1"| O["1 pt - Bogey"]
    J -->|"≥ +2"| P["0 pts - Doble+"]
```

## 5. Importación OCR de Partida

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant AI as Claude Vision

    U->>F: Sube foto de tarjeta de score
    F->>F: Convertir a Base64
    U->>F: Selecciona hoyos (18/front9/back9)
    F->>B: POST /rounds/import/extract {image, media_type}
    B->>AI: Enviar imagen + prompt de extracción
    AI-->>B: JSON con datos extraídos
    B->>B: Validar y normalizar datos
    B-->>F: Datos de la partida extraída

    F-->>U: Mostrar datos para revisión
    U->>F: Corregir datos si necesario
    U->>F: Confirmar y guardar
    F->>B: POST /rounds/import/save {datos corregidos}
    B->>B: Calcular HDJ si hay slope disponible
    B->>B: Crear Round (is_imported=true, is_finished=true)
    B->>B: Calcular HV
    B-->>F: Round creado
    F-->>U: Redirigir a Historial
```

## 6. Importación OCR de Campo

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant AI as Claude Vision

    U->>F: Sube foto de tarjeta del campo
    F->>B: POST /courses/from-image/extract {image, media_type}
    B->>AI: Enviar imagen + prompt de extracción
    AI-->>B: JSON con datos del campo
    B->>B: Validar pares (3/4/5), handicaps (1-18), slopes, ratings
    B->>B: Completar hoyos faltantes con valores por defecto
    B-->>F: Datos del campo extraído

    F-->>U: Mostrar datos para revisión
    U->>F: Editar nombre, tees, hoyos si necesario
    U->>F: Confirmar y guardar
    F->>B: POST /courses/from-image/save {datos}
    B->>DB: Verificar nombre no duplicado
    B->>DB: Crear Course
    B-->>F: Course creado
```

## 7. Compartir Partida

```mermaid
sequenceDiagram
    actor O as Owner
    actor C as Colaborador
    participant F as Frontend
    participant B as Backend

    O->>F: Activar compartir en partida
    F->>B: PUT /rounds/{id} {shareEnabled: true}
    B->>B: Generar código 6 caracteres (alfanumérico)
    B-->>F: Round con share_code
    F-->>O: Mostrar código para compartir

    O->>C: Comunicar código (WhatsApp, voz, etc.)

    C->>F: Introducir código en Dashboard
    F->>B: POST /rounds/join {shareCode}
    B->>DB: Buscar round por share_code
    B->>DB: Añadir user_id a collaborators[]
    B-->>F: {round_id, message}
    F-->>C: Redirigir a Round Play

    Note over O,C: Ambos pueden editar scores
    Note over O,C: Owner puede desactivar sharing (borra código y collaborators)
```

## 8. Cálculo de Estadísticas

```mermaid
flowchart TD
    A[GET /users/me/stats/filtered] --> B[Obtener partidas finalizadas del usuario]
    B --> C[Aplicar filtros: periodo, año, campo, longitud]
    C --> D[Separar partidas 9h y 18h]

    D --> E[Calcular medias de golpes]
    D --> F[Calcular medias de putts]
    D --> G[Calcular Stableford promedio]
    D --> H[Calcular HVP por periodo]
    D --> I[Buscar mejores rondas]
    D --> J[Calcular distribución de resultados]
    D --> K[Calcular GIR%]

    H --> L[Buscar HI histórico en cada fecha de partida]
    L --> M["HV = HI_en_fecha - (Stableford - 36)"]
    M --> N[Promediar HV por periodo]

    E & F & G & N & I & J & K --> O[UserStatsExtended]
    O --> P[Añadir target strokes y strokes gap]
    P --> Q[Respuesta con todas las métricas]
```

## 9. Match Play

```mermaid
flowchart TD
    A[Partida Match Play - 2 jugadores] --> B[Calcular diferencia de HDJ]
    B --> C["Jugador con menor HDJ = base (0 golpes)"]
    C --> D["Otro jugador = 75% de la diferencia"]

    D --> E[Por cada hoyo completado]
    E --> F[Calcular score neto de cada jugador]
    F --> G{¿Quién gana el hoyo?}
    G -->|J1 menor| H[J1 +1]
    G -->|J2 menor| I[J2 +1]
    G -->|Empate| J[Halved]

    H & I & J --> K[Acumular marcador]
    K --> L{"¿Ventaja > hoyos restantes?"}
    L -->|Sí| M["Partido decidido (ej: 3&2)"]
    L -->|No| N[Continuar al siguiente hoyo]
    N --> E
```

## 10. Flujo de Autenticación JWT

```mermaid
flowchart TD
    A[Request HTTP] --> B{¿Tiene header Authorization?}
    B -->|No| C[401 Unauthorized]
    B -->|Sí| D[Extraer Bearer token]
    D --> E[Decodificar JWT]
    E --> F{¿Token válido?}
    F -->|No - expirado/inválido| G[401 Unauthorized]
    F -->|Sí| H[Extraer user_id del payload]
    H --> I[Buscar Profile en DB]
    I --> J{¿Usuario existe?}
    J -->|No| K[401 User not found]
    J -->|Sí| L{¿Status activo?}
    L -->|disabled| M[403 Account disabled]
    L -->|blocked| N[403 Account blocked]
    L -->|active| O{¿Requiere rol/permiso?}
    O -->|Sí| P{¿Cumple requisito?}
    P -->|No| Q[403 Forbidden]
    P -->|Sí| R[✓ Procesar request]
    O -->|No| R
```

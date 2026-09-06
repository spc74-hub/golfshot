# Changelog

## 2026-09-06
- **fix(auth):** cuando la **sesión de Cloudflare Access caduca a media partida**, Access responde a cada llamada a `/api` con un 302 a su pantalla de login: la petición no llega al backend y el navegador la tumba por CORS al seguir el redirect a otro dominio. La app mostraba el genérico "Error al guardar. Por favor, intenta de nuevo." y en el servidor no quedaba ni rastro del intento. Ahora el cliente hace las llamadas con `redirect: "manual"`, reconoce ese redirect y dice **"Tu sesión ha caducado"** con un botón **Reconectar** que recarga (única forma de renovar Access). Un fallo de red se distingue también y se anuncia como "Sin conexión".
- **fix(partidas):** un guardado fallido ya **no pierde el hoyo**. Los golpes y putts sin confirmar se guardan en el móvil (`localStorage`) según los tecleas y se restauran al volver a entrar en la partida, con el hoyo marcado como pendiente de guardar. Pensado para el campo, donde la cobertura va y viene.
- **fix(partidas):** una partida de **9 últimos** abría siempre en el **hoyo 1** — que ni siquiera forma parte de la vuelta — y había que pulsar "Siguiente" para llegar al 10. El backend ya guardaba bien `current_hole = 10`, pero la pantalla de juego arrancaba con un `1` fijo y nunca leía el hoyo guardado de la partida. Ahora empieza en el hoyo que toca (y al retomar una partida, en el hoyo donde la dejaste).
- **fix(partidas):** los puntos por posición del Sindicato ya no dejan un **0 pegado delante** al borrarlos: el campo puede quedarse vacío mientras escribes y, al enfocarlo, se selecciona el valor entero.
- **change(sindicato):** el reparto por defecto pasa de **4-2-1-0** a **3-2-1-0**, que es la convención más habitual (con 3 jugadores, 3-2-1). No afecta a ninguna partida existente: todas las partidas de sindicato guardan su propio reparto.
- **fix(partidas):** "Guardar en mis jugadores" no daba **ninguna señal** de haber guardado (el botón solo desaparecía) y, si la llamada fallaba, el error iba solo a la consola. Ahora se muestra "Guardado en mis jugadores" con un check cuando el jugador está en la lista, y el motivo del error si falla. Esto hacía creer que no se guardaba nada: en realidad se guardaba, pero con los valores que hubiera en ese momento en el formulario — si luego cambiabas handicap o nombre, esos cambios no llegaban al jugador guardado.
- **feat(rondas):** un hoyo ya grabado queda **bloqueado** (golpes y putts en solo lectura) para no tocarlo sin querer al pasar por él. El estado pasa a mostrar "Hoyo guardado (bloqueado)" con candado y aparece un botón **Reabrir hoyo** que desbloquea la edición; al volver a guardar se bloquea de nuevo, igual que al cambiar de hoyo.

## 2026-08-29
- **fix(pwa):** el icono no aparecia al añadir la app a la pantalla de inicio **en iPad** (en iPhone si). Solo se declaraba `apple-touch-icon` de 180x180: el iPhone encuentra su tamaño exacto, pero el iPad busca 152x152 (retina) o 167x167 (Pro) y no habia ninguno, ni el fallback `/apple-touch-icon.png` en la raiz. Sin candidato valido, Safari pone una captura de la pagina. Añadidos los dos tamaños que faltaban y el fallback de raiz.

## 2026-08-12 — El JWKS de Cloudflare ya no se cachea para siempre
- **fix(auth):** las claves públicas de Cloudflare se descargaban una vez al arrancar el proceso y no se refrescaban nunca. Cloudflare **las rota**, y al rotar el auto-login dejaba de funcionar sin que nadie tocara nada: pasabas el OTP y GolfShot te pedía usuario y contraseña. El 2026-08-12 les pasó a nueve apps **el mismo día**, lo que despistaba mucho porque parecía caché del móvil. Ahora la caché caduca a la hora y, ante un fallo de verificación, se reintenta **una vez** con las claves recién descargadas — así una rotación se absorbe al instante. Un assertion realmente inválido sigue fallando las dos veces y devuelve 401. Arreglado desde el chat de infra por ser el mismo defecto en toda la flota; contexto en `spcapps-infra/docs/PATTERNS.md` → "El JWKS tiene que caducar".

## 2026-06-23 — Auto-login con Cloudflare Access (sin segundo login)
- **feat(auth):** nuevo endpoint `POST /auth/cf-access` que canjea una identidad ya validada por **Cloudflare Access** por un JWT de GolfShot, **sin contraseña**. Valida el JWT firmado `Cf-Access-Jwt-Assertion` contra las claves del equipo (`spcapps.cloudflareaccess.com`, JWKS cacheado) y comprueba el `aud` de esta app (`cf_access_aud`). GolfShot va entera tras Access (sin bypass).
- **feat(frontend):** el `AuthContext` intenta el auto-login de Cloudflare al cargar si no hay token; si Access ya te autenticó, entras directo (sin el segundo login). Si no, cae al login normal.
- **chore:** nueva config `cf_access_team_domain` / `cf_access_aud` (esta última por env en el VPS).

## 2026-05-24
- **feat:** Tarjeta de partida muestra ahora dos filas adicionales: **Net** (puntos Stableford netos por hoyo) y **Round** (acumulado de Stableford), tanto en front 9 como back 9
- **feat:** Selector de fecha en "Nueva Partida" — por defecto hoy, pero editable para registrar partidas pasadas. No permite fechas futuras
- **feat:** HDJ ahora usa la fórmula oficial WHS `HI × Slope/113 + (Rating − Par)` — antes solo aplicaba `HI × Slope/113` (sin el ajuste por Rating-Par), lo que daba diferencias de ±1‑2 golpes respecto al cálculo de la RFEG
- **feat:** HDJ correcto para partidas de 9 hoyos — antes se usaba el HDJ de 18 hoyos completos, ahora se aplica la fórmula `(HI/2) × Slope/113 + (Rating/2 − Par_9)` y los golpes se distribuyen sobre 9 (no 18)
- **feat:** Distribución de strokes-received en 9 hoyos correcta — los handicaps de los 9 hoyos jugados se renumeran 1..9 por dificultad relativa para que los golpes recaigan en los hoyos más duros del recorrido jugado
- **feat:** El HDJ propuesto al añadir jugador se recalcula automáticamente al cambiar campo o longitud de partida (el usuario puede seguir editando manualmente para tees combinados de torneo)

## 2026-05-17
- **feat:** Permitir registrar putts con valor 0 (chip-in o golpe metido desde fuera del green) — arreglo del fallback `||` que trataba 0 como falsy
- **feat:** Reabrir partida finalizada para editarla — nuevo endpoint `PATCH /rounds/{id}/reopen` y botón en Historial con confirmación
- **feat:** Botón "Reabrir" también disponible en la vista de Tarjeta de partida (RoundCard)

## 2026-04-14
- **docs:** Generación completa de documentación del proyecto (CLAUDE.md, USER_GUIDE, PROCESSES, CHANGELOG, BACKLOG)

## 2025-07-14
- **fix:** Corregir operador JSONB @> para filtro de collaborators — cast a tipo JSONB

## 2025-07-13
- **fix:** Corregir parsing de cors_origins — usar str en vez de list[str] en config

## 2025-07-12
- **feat:** Migración completa de Supabase a PostgreSQL self-hosted con SQLAlchemy async
- **feat:** Despliegue en VPS con Docker (docker-compose, Dockerfiles, nginx)
- **fix:** Corregir errores TypeScript en AuthContext tras migración

## 2025-07-08
- **fix:** Eliminar funciones legacy no usadas para fix del build
- **fix:** Separar guardado y navegación en RoundPlay para prevenir pérdida de datos
- **fix:** Mostrar golpes del owner en tooltip del gráfico HV en vez del primer jugador

## 2025-07-07
- **fix:** Corregir visualización del resultado final de Match Play
- **fix:** Corregir almacenamiento de HDJ y cálculo de HV para Match Play
- **feat:** Implementar cálculo correcto de 75% diferencia de handicap para Match Play

## 2025-07-05
- **feat:** Cambiar filtros de stats a fechas calendario absolutas
- **feat:** Añadir filtrado completo de estadísticas y tracking de historial de handicap

## 2025-07-03
- **feat:** Añadir línea de referencia HV promedio al gráfico
- **feat:** Añadir filtros de campo y hoyos al gráfico de evolución HV
- **feat:** Añadir golpes al tooltip del gráfico HV
- **fix:** Corregir colores de puntos basados en comparación con Handicap Index
- **feat:** Añadir puntos coloreados al gráfico de evolución HV
- **feat:** Añadir gráfico de evolución HV a la página de Stats

## 2025-07-01
- **feat:** Rediseñar Home como Dashboard con inicio rápido y resumen de stats

## 2025-06-30
- **feat:** Añadir plantillas de partida (Plantillas de Partida) — CRUD completo
- **fix:** Mejorar input decimal para campos de handicap

## 2025-06-28
- **feat:** Permitir al owner ver y gestionar todos los jugadores
- **fix:** Mover endpoint /me antes de /{user_id} para resolver conflicto de rutas
- **fix:** Corregir cálculo de Stableford y HV para partidas legacy

## 2025-06-27
- **feat:** Añadir funcionalidad de bloquear/eliminar usuario en Owner Panel
- **feat:** Añadir HDJ (Handicap de Juego) al detalle de partida en Historial
- **feat:** Añadir golpes y puntos Stableford al resumen de partida en Historial
- **feat:** Separar estadísticas de golpes para partidas de 9 y 18 hoyos

## 2025-06-26
- **feat:** Añadir agrupación mensual en Historial y estadísticas de distribución de scores
- **feat:** Añadir endpoint de backfill y UI para Handicap Virtual histórico
- **feat:** Añadir Handicap Virtual (HV) por partida y mejorar cálculo de HVP

## 2025-06-25
- **feat:** Añadir enlace Owner/Admin al header de desktop
- **feat:** Añadir partidas compartidas con sincronización en tiempo real
- **feat:** Añadir rol owner, sistema de permisos, y fix cálculo HVP
- **feat:** Añadir HVP (Handicap Virtual Promedio) con desviación del handicap del usuario

## 2025-06-23
- **feat:** Mejorar manejo de stats para partidas de 9 hoyos
- **fix:** Preservar números de hoyo y detectar back9 en importación OCR
- **fix:** Corregir cálculo de HDJ para partidas de 9 hoyos
- **feat:** Añadir indicador GIR (Green in Regulation) a la vista de scorecard

## 2025-06-22
- **feat:** Añadir lista de partidas al detalle del campo y matching inteligente de nombres
- **feat:** Extraer putts y calcular HDJ desde puntos Stableford en importación

## 2025-06-21
- **feat:** Gestión completa de campos con favoritos, edición y avisos de eliminación
- **feat:** Mejorar importación de partidas con matching de campo y detección de back9
- **fix:** Recalcular HDJ en runtime para partidas legacy con valor 0
- **fix:** Corregir cálculos de HDJ, puntos por hoyo y diferencia de golpes

## 2025-06-20
- **feat:** Mejoras UI/UX para visualización de partidas y stats
- **feat:** Añadir modo Match Play, página de Stats y mejoras de handicap
- **feat:** Añadir gestión de jugadores y mejorar input de handicap

## 2025-06-19
- **feat:** Añadir soporte clipboard paste para importación de partidas
- **feat:** Añadir importación de partidas históricas desde fotos de tarjeta
- **feat:** Mostrar puntos Stableford junto a puntos Sindicato

## 2025-06-18
- **feat:** Añadir configuración de despliegue en Railway
- **feat:** Commit inicial — Golf Shot PWA

# Changelog

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

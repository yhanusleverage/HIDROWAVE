# i18n UI Copy — HydroWave Frontend

**Repo:** `HIDROWAVE-main`  
**Fecha inicio:** 2026-09-04  
**Estrategia:** **C** — primero catálogo, luego migración por fases  
**Alcance:** todo el frontend UI (~180 archivos), multi-semana  

## Documentos

| Doc | Contenido |
|------|-----------|
| [TAXONOMY.md](./TAXONOMY.md) | Categorías de copy (nav, page, section, …) |
| [MIGRATION_PHASES.md](./MIGRATION_PHASES.md) | Orden de dominios y criterios de done |
| [UI_COPY_CATALOG_AUTOMACAO.md](./UI_COPY_CATALOG_AUTOMACAO.md) | Inventario Automação (fase 0 + fase 2) |
| [PROPOSED_KEYS_RULE_MODAL.md](./PROPOSED_KEYS_RULE_MODAL.md) | Keys propuestas `automacao.ruleModal.*` |

## Estado actual

Ya existe i18n parcial en:

- [`src/lib/translations/app/`](../../src/lib/translations/app/) — `pt-BR` / `en` / `es` + `types.ts`
- [`support/`](../../src/lib/translations/support/), [`processos/`](../../src/lib/translations/processos/), [`docs/`](../../src/lib/translations/docs/)

**Bien cubierto:** sidebar, config, common/loading, pages titles, onboarding, `automacao.tabs`, `automacao.procedures`, **`ruleModal` / `scriptEditor` / `ruleCard` / `page` (fases 2a–2d)**.

**Mayor gap restante:** detalle de tablas/métricas EC-pH, `water-level-display.ts`, Calibragem/Dispositivos (fases 4–5).

Fase 3 (headers/toggles/toasts EC·pH·diluição·nível): **parcial Done**.

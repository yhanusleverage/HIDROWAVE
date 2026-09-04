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

**Bien cubierto:** sidebar, config, common/loading, pages titles, onboarding, `automacao.tabs`, `automacao.procedures` (tipagem / builder).

**Mayor gap:** Motor de decisão (`CreateRuleModal`, `SequentialScriptEditor`, `RuleCard`, toasts/manual Atlas en `AutomacaoPageClient`), `ScheduleEditor`, tab Schedules.

## Reglas

1. Misma **key** en pt-BR / en / es.
2. **No** i18n de IDs técnicos (`fn_circulation`, MAC, MQTT fields).
3. Preferir keys compartidas en `automacao.common.*` cuando el texto se repite (Cancelar, Remover, Ativo…).
4. Un PR = un dominio o un modal; no mezclar con firmware ESP.

## Próximo paso de código (fase migración 2a)

Tras aceptar el catálogo: añadir bloque `automacao.ruleModal` (+ `automacao.common` / `instr`) a `types.ts` y cables en `CreateRuleModal.tsx`.

# Fases de migración i18n — HIDROWAVE-main

## Fase 0 — Catálogo (en curso)

- [x] Taxonomía
- [x] Catálogo Automação (ver [UI_COPY_CATALOG_AUTOMACAO.md](./UI_COPY_CATALOG_AUTOMACAO.md))
- [ ] Catálogo Calibragem / Dispositivos / Dashboard / EC-pH panels (siguiente inventario)
- [ ] Catálogo Config + leftovers

## Fase 1 — `common` + `sidebar` + `pages` (bajo riesgo)

Auditar literales que aún no usan `t.common` / `t.sidebar` / `t.pages`. Completar gaps menores.

**Done:** grep de strings PT en layout/sidebar ≈ 0 literales de menú.

## Fase 2 — Automação / Motor (prioridad producto)

Orden de PRs:

| PR | Scope |
|----|--------|
| 2a | `automacao.common` + `automacao.ruleModal` + cable `CreateRuleModal` |
| 2b | Reusar keys en `SequentialScriptEditor` + `automacao.instr` |
| 2c | `RuleCard` + JSON preview común |
| 2d | `AutomacaoPageClient` motor / Atlas manual / toasts CRUD |
| 2e | `ScheduleEditor` + `tabs.schedules` |

**Done por PR:** pt-BR/en/es completos; modal/página usable en los 3 idiomas; sin literales PT en ese archivo (salvo comentarios).

## Fase 3 — Auto EC / Auto pH / Diluição / Nível

Extraer copy hardcodeada de `AutoEcControllerPanel`, `PhControllerPanel`, `EcDilutionSection`, `WaterLevelSection` → keys `automacao.ec` / `ph` / `dilution` / `water` (o módulos dedicados).

## Fase 4 — Calibragem + Dispositivos

## Fase 5 — Config / Dashboard / Onboarding leftovers

## Fase 6 — Docs / Processos / Support / Quem somos

Ya tienen namespaces propios; auditar gaps y unificar tono.

---

## Criterio global de cierre

1. Catálogo actualizado (ningún string UI nuevo sin key o ticket).
2. Locale switch pt-BR ↔ en ↔ es sin literales PT obvios en pantallas principales.
3. IDs técnicos siguen en código, no en translations.

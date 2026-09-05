# Fases de migración i18n — HIDROWAVE-main

## Fase 0 — Catálogo (en curso)

- [x] Taxonomía
- [x] Catálogo Automação (ver [UI_COPY_CATALOG_AUTOMACAO.md](./UI_COPY_CATALOG_AUTOMACAO.md))
- [x] Inventario Calibragem / Dispositivos (Fase 4a cableada; catálogo MD opcional)
- [ ] Catálogo Config + leftovers

## Fase 1 — `common` + `sidebar` + `pages` (bajo riesgo)

Auditar literales que aún no usan `t.common` / `t.sidebar` / `t.pages`. Completar gaps menores.

**Done:** grep de strings PT en layout/sidebar ≈ 0 literales de menú.

## Fase 2 — Automação / Motor (prioridad producto)

Orden de PRs:

| PR | Scope | Estado |
|----|--------|--------|
| 2a | `automacao.common` + `automacao.ruleModal` + `instr` + cable `CreateRuleModal` | **Done** |
| 2b | Reusar keys en `SequentialScriptEditor` + `automacao.scriptEditor` | **Done** |
| 2c | `RuleCard` + JSON preview común | **Done** |
| 2d | `AutomacaoPageClient` motor / Atlas / toasts / timer panel | **Done** |
| 2e | `ScheduleEditor` + `tabs.schedules` | **Done** |

**Done por PR:** pt-BR/en/es completos; modal/página usable en los 3 idiomas; sin literales PT en ese archivo (salvo comentarios / logs).

## Fase 3 — Auto EC / Auto pH / Diluição / Nível

- [x] Keys `automacao.ec` / `ph` / `dilution` / `water` (headers, toggles, toasts principales)
- [x] Cable parcial: AutoEcControllerPanel, PhControllerPanel, EcDilutionSection, WaterLevelOperationalSummary, LevelTankSchematic
- [x] **3b** métricas status + tabla nutrición EC + params hidro/ciclo + Objetivo/Actuação/Cadência pH
- [x] **3c** `water-level-display` (labels via `water`), leftovers diluição (Atlas count, Enviando, empty relays, last dilution)
- [x] **3d** acordeones ayuda + modales debug EC/pH (+ copyJson común)
- [x] **Fase 3 cerrada** para superficies Auto EC / pH / diluição / nível (copy larga residual en tooltips/toasts secundarios OK)

## Fase 4 — Calibragem + Dispositivos

- [x] **4a** namespaces `calibragem` + `dispositivos` (pt-BR/en/es)
- [x] Cable: `calibragem/page.tsx` + `EcPumpCalibrationSection` (tab Vazão)
- [x] Cable: `dispositivos/page.tsx` + `device-status.ts` (labels opcionales)
- [x] **4b** `PhCalibrationSection` + `PumpPrimeHoldControl` + `PumpQuantitySection`
- [x] **4c** `DeviceControlPanel` (`dispositivos.panel`)
- [x] **Fase 4 cerrada** (Calibragem + Dispositivos superficies principales)

## Fase 5 — Config / Dashboard / Onboarding leftovers

- [x] Config (`t.config`) — ya cableado
- [x] Onboarding (`t.onboarding`) — ya cableado
- [x] **5a** Dashboard shell: `dashboard/page.tsx` + Sensors + Charts + `SensorCard` (`t.dashboard` + `common`)
- [x] **5b** Auto EC/pH cards + `AutoControlStatusMetrics` + CropCalendar chrome (`dashboard.auto` / `dashboard.crop`)
- [ ] **5b′** CropCalendar modal/CRUD/toasts (opcional)
- [ ] **5c** Home marketing (`app/page.tsx`) + metadata/`lang` dinámico

## Fase 6 — Docs / Processos / Support / Quem somos

Ya tienen namespaces propios; auditar gaps y unificar tono.

---

## Criterio global de cierre

1. Catálogo actualizado (ningún string UI nuevo sin key o ticket).
2. Locale switch pt-BR ↔ en ↔ es sin literales PT obvios en pantallas principales.
3. IDs técnicos siguen en código, no en translations.

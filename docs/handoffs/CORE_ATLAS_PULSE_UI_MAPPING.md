# Checklist UI/docs — Core · Atlas · Pulse

**Estado:** implementación UI comercial **completa** · **12/jul/2026**  
**Fuente comercial:** [MODULE_NAMING_PRODUCT_LINE.md](./MODULE_NAMING_PRODUCT_LINE.md)

---

## Glosario (UI comercial)

| Técnico (MQTT/API — no renombrar) | Comercial | Subtítulo |
|-----------------------------------|-----------|-----------|
| `master` | **HydroWave Core** | Controlador central |
| `slave` / `relay_node` | **HydroWave Atlas** | Relés e válvulas |
| `doser` | **HydroWave Pulse** | Módulo dosador pH/EC |

**Reglas**
- Nunca “Master” / “Slave” en copy comercial.
- Atlas siempre con prefijo **HydroWave**.
- Core / Atlas / Pulse = cajas de hardware, no menús de la app.

---

## Fuera de alcance (no mapear a Core/Atlas/Pulse)

| Tipo | Ejemplos |
|------|----------|
| Nav | Dashboard, Automação, Dispositivos, Calibragem, Processos, Fundamentos, Planos, Quem somos, Support |
| Funciones | Auto EC, Auto pH, Telemetria, Ciclo de cultivo, Metrics |
| Capas P1–P4 | Tanque / Nutrientes / Balance / Ritmo (otro naming) |
| API / DB / MQTT | `relay_master`, `relay_slaves`, `/api/esp-now/slave-*`, topics `slave` |

---

## Prioridad 1 — UI operativa

| Estado | Archivo | Copy actual → destino |
|--------|---------|------------------------|
| [x] | `src/app/automacao/AutomacaoPageClient.tsx` | ESP32 Master → Core; Slaves ESP-NOW → Atlas |
| [x] | `src/components/DeviceControlPanel.tsx` | Tab “Slaves ESP-NOW” → “HydroWave Atlas”; “ESP32 Master” → “HydroWave Core” |
| [x] | `src/components/automacao/EspNowSlaveNamesPanel.tsx` | slave → Atlas |
| [x] | `src/components/SlaveRelaySelect.tsx` | ESP-NOW Slave → HydroWave Atlas |
| [x] | `src/components/automacao/HydraulicRelaySetupPanel.tsx` | master/slave → Core/Atlas |
| [x] | `src/components/rule-procedure/ProcedureStepEditor.tsx` | Master / Slave → Core / Atlas |
| [x] | `src/components/automacao/ProcedureBuilderPanel.tsx` | “dispositivo master” → Core |
| [x] | `src/components/grow-cycle/GrowCycleTimelinePanel.tsx` | “dispositivo master” → Core |
| [x] | `src/components/CreateRuleModal.tsx` | ESP-SLAVE / relé slave → Atlas |
| [x] | `src/app/dispositivos/page.tsx` | toasts slave → Atlas |
| [x] | `src/components/device-control/deviceControlTabs.ts` | labels de tabs si muestran Slave |
| [x] | `src/components/instruction-editors/*` (If/While/RelayAction) | labels Master/Slave visibles |

## Prioridad 2 — Docs / i18n de usuario

| Estado | Archivo | Notas |
|--------|---------|-------|
| [x] | `src/lib/translations/support/pt-BR.ts` | master + slaves → Core + Atlas |
| [x] | `src/lib/translations/support/es.ts` | igual |
| [x] | `src/lib/translations/support/en.ts` | igual |
| [x] | `src/app/informacao/page.tsx` | FAQ “master online” → Core |
| [x] | `src/app/planos/page.tsx` | “1 master ESP32” → “1 HydroWave Core” |
| [x] | `src/lib/translations/processos/{pt-BR,es,en}.ts` | Revisado |

## Prioridad 3 — Presentación

| Estado | Archivo | Acción |
|--------|---------|--------|
| [x] | `src/lib/content/quem-somos.ts` | Bloque **Core · Atlas · Pulse** + teaser |
| [x] | `src/components/QuemSomosContent.tsx` | Sección `#linha-produto` |
| [x] | `src/components/QuemSomosTeaser.tsx` | Enlace a `#linha-produto` |

## Pulse (dosaje) — mapeo suave

| Estado | Copy actual | Destino |
|--------|-------------|---------|
| [x] | Mapa de relés dosificadores (0–7) | “Relés dosificadores do **Core**” |
| [ ] | Módulo dosador dedicado (SKU) | **HydroWave Pulse** (cuando exista caja física) |
| [x] | “bomba peristáltica” (calibragem) | Mantener; “Pulse” solo si es la SKU |

Archivos relacionados: `DoserRelayMapPanel.tsx`, `DoserRelaySelect.tsx`, `calibragem/page.tsx`, paneles Auto EC/pH.

---

## Fase 2 — implementación (hecha)

1. [x] `src/lib/product-line-names.ts` (displayName + subtitle + technicalId).
2. [x] Claves i18n `modules.core` / `modules.atlas` / `modules.pulse`.
3. [x] Checklist Prioridad 1 → 2 → 3 (strings visibles).
4. [x] No tocar MQTT/API/tablas.

---

## Conteo aproximado de menciones en `src/` (referencia)

Muchas coincidencias son **código interno** (`relay_master`, hooks, APIs). Solo se tocó **strings de UI/docs**. IDs técnicos `master`/`slave` en selects/API se mantienen.

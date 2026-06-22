# Handoff — Auto pH E2E (resumen)

**Fecha:** jun/2026 · **Device ref:** `ESP32_HIDRO_269844`  
**Estado código:** implementado en repo · **Estado prod:** seguir índice serial S01→S08

---

## Punto de entrada operativo

**Ejecutar en orden:** [`docs/handoffs/ph/00_INDICE_SERIAL.md`](handoffs/ph/00_INDICE_SERIAL.md)

No duplicar pasos aquí — cada gate (SQL, NVS boot, calibragem, bridge, bancada) está en S01–S08.

---

## Objetivo (1 pantalla)

| Capa | Responsabilidad |
|------|-----------------|
| **PV** | pH → `hydro_measurements` (HTTPS y/o MQTT telemetry) |
| **SP / config** | `ph_config_view` + RPC `activate_auto_ph` |
| **Calibragem** | `ml_per_ph_unit_acid/base` → `/calibragem` |
| **CO** | Correcciones → `ph_dosages` (evento inmutable) |
| **Estado máquina** | `relay_master.ph_operation_*` |
| **Ganios K** | PATCH HTTPS post-dosaje |
| **UI** | `usePhOperationState` + `PhDosageDetail` en `/automacao` |

Transporte dosajes/estado: MQTT-first (`ph_dose`, `ph_operation`) + HTTPS fallback.

---

## Relacionado

| Doc | Uso |
|-----|-----|
| [Coherencia UI + modo dev (14/06)](HANDOFF_AUTO_PH_COHERENCIA_14JUN2026.md) | Síntomas `--`, gates 4–9, levantamiento por capa |
| [Auto EC E2E](HANDOFF_ULTIMA_DOSAGEM_E2E.md) | Sendero EC independiente |
| [S09 EC↔pH](handoffs/ph/S09_EC_PH_COORDENACAO.md) | Poll config vs dosaje; interlock G5 |
| [Estabilidad online UI](HANDOFF_DEVICE_ONLINE_STABILITY.md) | Fix falso offline (paralelo) |
| [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md) | Scripts SQL + Realtime |

---

## Archivos clave (referencia rápida)

| Pieza | Ruta |
|-------|------|
| Control adaptativo | `ESP-HIDROWAVE-main/include/AdaptivePHController.h` |
| Ciclo + dosagem | `ESP-HIDROWAVE-main/src/HydroControl.cpp` |
| Poll + MQTT sync | `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp` |
| Bridge | `ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js` |
| UI badges | `src/hooks/usePhOperationState.ts` |
| Calibragem | `src/components/PhCalibrationSection.tsx` |
| Dominio UI pH | `src/lib/ph-control-display.ts` |
| Panel Auto pH | `src/components/PhControllerPanel.tsx` |
| QC pH display | `src/lib/realtime/hydro-ph.ts` `resolvePhForDisplay` |
| **Registo relés** | `src/lib/relay-allocation.ts` + `useRelayAllocation` + `DoserRelaySelect` |

---

## Matriz de relés dosificadores (0–7)

Registo **derivado** (sem tabela nova): `ph_config_view` + `ec_config_view.nutrients` + `relay_master` (runtime).

| Owner | Origem | Oculta em |
|-------|--------|----------|
| `ec_nutrient` | `ec_config_view.nutrients[].relay` (ml/L ≥ 0,1) | pH+, pH−, outros nutrientes |
| `ph_up` / `ph_down` | `ph_config_view` | EC, outro relé pH |
| `runtime_active` | `doser_relay_states` / `doser_relay_has_timers` | todos os selects |
| `decision_rule` | `decision_rules.instructions` (relay_action master) | fase 2+ |
| `manual` | `relay_commands` pending/executing | fase 2+ |
| `calibragem` | UI `/calibragem` durante teste | fase 2+ |

**UI:** relés ocupados **não aparecem** no `<select>` (exceção: valor atual com aviso de conflito).  
**API:** `POST /api/ph-controller/config` e `POST /api/ec-controller/config` validam cruzamento pH↔EC (`code: RELAY_CONFLICT` em 400).  
**Cliente:** pre-validação espelhada antes do POST — [`controller-config-api.ts`](../src/lib/controller-config-api.ts) + [`relay-allocation.ts`](../src/lib/relay-allocation.ts). Erros via `parseConfigApiError` (nunca toast `{}` vazio).  
**Ordem save recomendada:** guardar **pH** (relés pH+/pH−) → depois **EC** (nutrientes), ou usar `DoserRelaySelect` sem conflitos. Após save OK, `useRelayAllocation.refresh()`.  
**Debug:** `_debug.relay_allocation` nos modais Debug Vista Previa (pH e EC).

**Migración SQL:** se save EC falhar por coluna `tolerance`, executar [`scripts/ADD_EC_TOLERANCE_RPC.sql`](../scripts/ADD_EC_TOLERANCE_RPC.sql).

---

## Coordinación EC

Detalle completo: [S09_EC_PH_COORDENACAO.md](handoffs/ph/S09_EC_PH_COORDENACAO.md)

| Tema | Comportamiento hoy |
|------|-------------------|
| **Poll config** | GET `ph_config_view` / `ec_config_view` cada **30 s** — independiente de ciclos dosificadores |
| **Interlock dosaje** | Con `PH_PROTOTYPE_RELAX_GUARDS=0`: pH no dosifica si EC secuencial activo (`currentState != IDLE`) |
| **Batch EC→pH→recirc** | **No implementado** — ciclos EC y pH son máquinas separadas; batch es plan futuro |

Auto EC **OFF**: pH sigue su `auto_enabled` en `ph_config_view`. Identificación serial/UI: S09.

---

## Matriz de dominios UI

El operador trabaja en **pH**; el firmware adaptativo trabaja en **H⁺** (`ErroH`, `K`, `Dose`).

| Superficie | Fórmula |
|------------|---------|
| **Operador (visível)** | `u(t) = A × V × s_L × |e|`, `τ = u(t) / q` |
| **Firmware (colapsado H⁺)** | `Dose = A × |ErroH| / K` |

| Superficie | Dominio | Campos en filas |
|------------|---------|-----------------|
| **Status do Controle** | pH | PV, SP, banda morta, `e = \|pH − SP\|`, zona, direção, última dosagem |
| **Equação (visível)** | pH | V, s_L, q, e, A, u previsto, τ — paridad con Auto EC |
| **Equação (colapsável H⁺)** | H⁺ | ErroH, K, dose firmware |
| **Badges** | Estado máquina | `relay_master.ph_operation_*` — **independiente del PV** |

**Preview operador:** `u = A × |e| × s` con `s = V × s_L` (equivalente a la fórmula del encabezado).  
**Debug JSON:** `equation_operator`, `equation_pulse`, `s_L_ml_per_L_per_ph`, `s_total_ml_per_ph_unit`.

### PV inválido vs badges activos

| Síntoma UI | Causa | Acción |
|------------|-------|--------|
| Badges OK, campos pH `--` | Sin lectura en `hydro_measurements` (null) | Banner "Aguardando primeira leitura" |
| Valores numéricos raros (ej. `2e-39`) | Sensor sin calibrar / ruido | **UI muestra el valor** (paridad EC); firmware acepta pH finito en prototipo |

### QC: UI vs firmware (prototipo)

| Capa | Regla |
|------|-------|
| UI display (`resolvePhForDisplay`) | Cualquier pH **finito** parseado — igual que EC |
| UI preview bloqueo | Solo `no_pv` (NaN/Inf) y `within_band` — sin filtro 3–11 |
| Firmware (`isPlausiblePhReading`) | Cualquier pH **finito** si `PH_PROTOTYPE_RELAX_GUARDS=1` (default repo) |
| Producción | `PH_PROTOTYPE_RELAX_GUARDS=0` en `Config.h` → rango 3–11 + interlocks EC/consecutivo |

### k mostrado en UI

- **Aprendido:** `k_acid` / `k_base` de `ph_config_view` (PATCH post-dosaje).
- **Seed:** calibragem `ml/unid` si aún no hay ganio aprendido.

---


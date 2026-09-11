# Modelo: Registro de bombas dosadoras (sin romper el sistema)

## Objetivo de producto

| Hoy (problema) | Destino |
|----------------|---------|
| Caudal “vive” dentro de Auto EC (`nutrients[].flowRate`) y Auto pH (`flow_rate_ph_*`) | **Calibragem** es el origen de verdad del caudal |
| Una bomba solo “existe” si está en la receta EC/pH | Las **6 peristálticas** se calibran libres y se **usan** donde haga falta |
| Listas de dosificación mezclan 8 relés Core | UI de dosificación muestra **solo 0–5** (hardware peristáltico real) |

**No se puede romper:** firmware, Auto EC/pH, merge de nutrientes, reglas con `duration_seconds` / `dosage_ml`, vistas `ec_config_view` / `ph_config_view`.

---

## Hardware vs software

| Concepto | Rango | Nota |
|----------|-------|------|
| Relés dosificadores Master (PCF) | **0–7** (`DOSER_RELAY_COUNT = 8`) | Siguen existiendo en Core / allocation |
| Bombas peristálticas de producto | **0–5** (`HMI_PUMP_COUNT = 6`) | Las que calibrar / dosar en ml por ahora |
| Relés 6–7 | Ocultos en **listas de dosificación** | No borrar del firmware; reservados / no producto |

---

## Dos capas (contrato lógico)

```
┌─────────────────────────────────────────────────────────┐
│  CAPA A — Registro de bomba (Calibragem)                │
│  relayIndex 0–5, name, flowRateMlPerSec (> 0 = lista) │
│  Origen de verdad del caudal                            │
└──────────────────────────┬──────────────────────────────┘
                           │ lee
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 Auto EC (receta)     Auto pH (roles)      Reglas / Schedules
 ml/L, active         ph_up / ph_down      dose ml → seconds
 (elige bomba)        (elige bomba)        (elige bomba)
```

### Capa A — Registro (`DosingPumpSlot`)

- `relayIndex: 0..5`
- `name: string`
- `flowRateMlPerSec: number | null` — `null` / ≤0 = sin calibrar
- `source: 'ec_nutrient' | 'ph_up' | 'ph_down' | 'orphan_calibrated'` (cómo se leyó hoy)

### Capa B — Uso (no guarda caudal)

| Consumidor | Qué guarda | Qué **no** guarda |
|------------|------------|------------------|
| Auto EC `nutrients[]` | name, relay, mlPerLiter, active | idealmente no “posee” el caudal (hoy aún lo embebe) |
| Auto pH | `relay_ph_up/down`, setpoints, ganhos | caudal (hoy aún columnas `flow_rate_ph_*`) |
| Regla / Schedule | `relay` + `dosage_ml` o `duration_seconds` | flowRate (se deriva al editar) |

---

## Persistencia actual (fase 0 — no tocar shape)

Seguimos leyendo/escribiendo lo que ya existe:

1. **EC:** `GET/POST /api/ec-controller/config` → `ec_config_view.nutrients[].flowRate`
2. **pH:** `GET/POST /api/ph-controller/config` → `ph_config_view.flow_rate_ph_up/down` + `relay_ph_*`

Código de fachada (solo lectura unificada):

- `src/lib/dosing-pump-registry/` — tipos + `readLegacyDosingPumpRegistry`
- `src/lib/dosing-pump-options.ts` — opciones UI (reglas) sobre ese registro

**Nueva tabla / JSON dedicado: NO en fase 0.** Primero el modelo y el adaptador.

---

## Fases (migración segura)

### Fase 0 — Modelar (esta entrega)

- [x] Documento de contrato
- [x] Tipos + constantes (`PERISTALTIC_RELAY_*`)
- [x] Adaptador de **lectura** desde configs legacy
- [ ] Sin cambiar writers de Calibragem / Auto EC / Auto pH

### Fase 1 — Listas de producto (bajo riesgo)

- [x] Calibragem Vazão: **siempre 6 slots 0–5** (libres incluidos)
- Filtrar UI de **dosificación en ml** a relés **0–5**
- Relés 6–7 siguen en allocation / acionamento, pero no en “bombas dosadoras”

### Fase 2 — Calibragem como UX de registro

- Lista fija de 6 bombas (aunque no estén en Auto EC)
- Guardar caudal **sigue** yendo a `nutrients[].flowRate` (ghost nutrient con `mlPerLiter: 0` si hace falta — ya existe `upsertPumpFlowRate`) o a pH columns si el slot es el de ácido/base
- Auto EC solo **elige** bombas ya presentes en el registro

### Fase 3 — Desacoplar storage (opcional, después)

- Store dedicado `device_dosing_pumps` **o** bloque `dosing_pumps[]` en config
- Escritura dual temporal → cutover → Auto EC deja de ser dueño del caudal
- Solo con plan de firmware/MQTT alineado

---

## Reglas de no-regresión

1. **Auto EC save** debe seguir haciendo `mergeNutrientFlowRates` hasta fase 3.
2. **Auto pH save** debe seguir round-trip de `flow_rate_ph_*` hasta que deje de poseerlos.
3. Reglas: ml solo si `flowRate > 0`; si no, segundos (comportamiento actual).
4. No cambiar índices firmware (0-based web = índice relé).
5. No force-hide 6–7 en **todas** las UIs de relé (Atlas / hidráulica / manual) — solo en contexto **dosificación peristáltica**.

---

## Mapa de archivos

| Rol | Path |
|-----|------|
| Modelo / fases | este doc |
| Paradigma reglas ml | `docs/i18n/RULES_DOSE_ML_PARADIGM.md` |
| Cálculos | `src/lib/pump-calibration.ts` |
| Allocation 0–7 | `src/lib/relay-allocation.ts` |
| Registro (nuevo) | `src/lib/dosing-pump-registry/*` |
| Opciones reglas | `src/lib/dosing-pump-options.ts` |
| Writers calibragem | `EcPumpCalibrationSection`, `PhCalibrationSection` |

---

## Decisión de producto (acordada)

> Configurar las bombas en **Calibragem** y usarlas en Auto EC, Auto pH, reglas, schedules u otra config — sin que Auto EC/pH sean la única puerta de entrada.
>
> Por ahora: **6 peristálticas visibles**; relés dosificadores 7–8 (índices 6–7) **ocultos en listas de dosificación**, sin romper el Core de 8 relés.

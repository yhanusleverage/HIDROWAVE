# S03 — Control adaptativo: dominio H

**Prerequisito:** [S02](S02_FIRMWARE_NVS_BOOT.md) flash OK  
**Duración estimada:** 15 min (lectura + referencia bancada)  
**Siguiente:** [S04_FLUJO_POLL_CONFIG.md](S04_FLUJO_POLL_CONFIG.md)

---

## Objetivo

Entender la ingeniería de control antes de operar Auto pH en bancada. Código: [`AdaptivePHController.h`](../../../../ESP-HIDROWAVE-main/include/AdaptivePHController.h).

---

## Convenciones

| Símbolo | Definición |
|---------|------------|
| `H` | `10^(-pH)` — dominio linealizado |
| `ErroH` | `H_medido - H_setpoint` |
| `K` | Ganho aprendido (ácido `k_acid`, base `k_base`) |

### Selección de camino

| ErroH | Significado | Bomba |
|-------|-------------|-------|
| > 0 | pH bajo vs SP | Base (pH+, path `PH_PATH_BASE`) |
| < 0 | pH alto vs SP | Ácido (pH−, path `PH_PATH_ACID`) |
| dentro tolerancia | OK | Sin dosaje |

---

## Ley de dosagem

```
DoseIdeal_ml = |ErroH| / K
DoseReal_ml  = A × DoseIdeal_ml     (A = aggressiveness, 0.05–1.0)
duration_sec = DoseReal_ml / flow_rate_ml_s
```

Límites: `max_dose_ml_per_cycle`, `max_pulse_seconds`, `max_consecutive_corrections`.

---

## Commissioning (primeros ciclos)

- Primeros **3 ciclos** (`validLearningCycles < 3`): `A = 0.3` (conservador).
- Seeds K desde calibragem: `seedKFromMlPerPhUnit(SP, ml_acid, ml_base)` — ver S06.

---

## Aprendizaje post-recirc (lazo cerrado)

Tras **recirculación completa** (`finishPhRecirculation`), con PV2 medido:

1. `updateGainAfterDose(hBefore, hAfter, ml, gain_alpha)` — EMA de K
2. Si aprendizaje OK: `saveToNVS` (`ph_k_acid`, `ph_k_base`, `ph_k_cycles`)
3. Callback `handlePhGainLearned` → HTTPS PATCH `ph_config_view` (`k_acid`, `k_base`)
4. UI lee K en próximo poll

**No** se hace PATCH de K en `ph_dose` (relay OFF): ahí solo histórico `ph_dosages`.

### Roles (no mezclar)

| Parámetro | Rol |
|-----------|-----|
| **K** | Modelo planta — aprende post-recirc |
| **A** (`aggressiveness`) | Escala `DoseReal = A × |ErroH|/K` por ciclo |
| **alpha** (`gain_alpha`) | Velocidad EMA del aprendizaje de K |
| **tau** (`tempo_recirculacao`) | Dead-time antes de PV2 |

### EC (contraste)

EC usa `k = base_dose/total_ml` + `Kp` **fijos** — sin `updateGainAfterDose`. K_ec adaptativo = backlog futuro.

### Dev vs prod

En prototipo (`PH_PROTOTYPE_RELAX_GUARDS=1`): guards de rango pH y hardware **abiertos** a propósito para debug. Solo `minDeltaPh ≥ 0.03` activo para saltar aprendizaje sin movimiento observable.

---

## Protecciones

| Protección | Comportamiento |
|------------|----------------|
| Lectura pH | `isPlausiblePhReading`: cualquier pH **finito** (prototipo; `PH_PROTOTYPE_RELAX_GUARDS=1` en `Config.h`) |
| EC secuencial activo | `currentState != IDLE` → no `checkAutoPH` (desactivado en prototipo) |
| DecisionEngine | Regla `ph_low_control` bloqueada si `auto_ph_active` |
| Config inválida remota | Poll desactiva auto solo en producción (`PH_PROTOTYPE_RELAX_GUARDS=0`) |

**Producción:** compilar con `PH_PROTOTYPE_RELAX_GUARDS 0` para restaurar rango 3–11, interlock EC, límite consecutivo y auto-off por config inválida.

---

## Verificar (gate)

Checklist mental antes de S04–S08:

- [ ] Entiendo ErroH y por qué base vs ácido
- [ ] Calibragem (S06) alimenta seeds K, no sustituye aprendizaje
- [ ] K en Supabase es espejo **post-recirc** (PATCH tras aprendizaje), no en `ph_dose`

---

## Siguiente

[S04 — Poll config Supabase](S04_FLUJO_POLL_CONFIG.md)

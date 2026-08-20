# Sendero dilución + matriz L1–L4

**12/jul/2026**

## Fronteras de hardware (Core)

| Pieza | Rol |
|-------|-----|
| Relés Core PCF 0–7 | Solo dosaje proporcional (bombas pH/EC) |
| GPIO digital YFB5 | Pulsos → `totalLiters()` (volumen A→B) |
| Relés Atlas | Actúan dreno / reposición (agua) |

## Fase 1 — litros

- Métrica: `totalLiters()` desde `reset()` al inicio del **dreno**.
- MQTT live: `dilution_target_l` / `dilution_progress_l` → DB `ec_dilution_*_l`.
- Evento final: `ec_dilution` → `volume_measured_l` (= drenado).
- UI: Automação + Dashboard Auto EC (`progress / target L`).

**Reposición (`diluting_filling`):**
- Criterio de fin: **nivel alto** (L1 / `isTankHighCapacitive`).
- **No** cierra por tiempo ni por YFB5 1:1.
- Bancada con `HIDRO_SIMULATE_WATER_LEVELS=1`: tras `DILUTION_FILL_SIM_HIGH_MS` (5 s) simula HIGH para E2E.
- Sin stall de “no flow” en dreno (válvula → flujo es secuencia).
- Sin timeout de aborto en fill: espera nivel alto.

**Después de reposición:**
- **Siempre** `recirculating` (`tempo_recirculacao`, default 60 s si config=0) → luego `idle`.

Estados en `relay_master.ec_operation_state`:
`diluting_draining` → `diluting_filling` → `recirculating` → `idle`


## Contrato MQTT (sin cambio de nombres)

```
ec_operation: dilution_target_l, dilution_progress_l, ec_operation_state
ec_dilution:  volume_target_l, volume_measured_l
```

Bridge renombra a `ec_dilution_*_l` en `relay_master` y opcionalmente inserta `hydro_flow_readings`.

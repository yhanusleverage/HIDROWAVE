# Dónde se muestran los litros A→B (YFB5)

**12/jul/2026** · Volumen procedural (no L/min de dashboard)

## Modelo

El fluxómetro cuenta **litros del tramo A→B** en un procedimiento (dreno / reposición / dilución).  
`L/min` solo es interno (stall). Métrica de producto: `progress_l / target_l`.

## Dónde se muestra (UI)

| Lugar | Qué | Fuente |
|-------|-----|--------|
| **Automação → Diluição EC** ([EcDilutionSection](../../src/components/EcDilutionSection.tsx)) | **Principal:** barra `X.X / Y.Y L` mientras drena/reponte | `relay_master.ec_dilution_progress_l` / `ec_dilution_target_l` vía `useEcDilutionState` |
| **Dashboard → Auto EC** ([EcAutoStatusCard](../../src/components/EcAutoStatusCard.tsx)) | **Espejo:** mismo progreso cuando hay dilución activa | mismo hook / mismas columnas |
| Automação → última diluição | Histórico del ciclo cerrado | `ec_dilution_events.volume_measured_l` |
| Calib | Pulsos/L (factor) | `flowmeter_pulses_per_liter` |

## Pipeline

```
YFB5 → WaterFlowSensor.totalLiters()
     → firmware dilution_progress_l / dilution_target_l
     → MQTT hidrowave/{id}/ec_operation
     → bridge PATCH relay_master
     → UI (Realtime + poll)
```

## Escala 1..N

- Hoy: 1 sensor (slot 0, rol `dilution`).
- Tabla `hydro_flow_readings`: snapshots de sesión (session_l, target_l) para historial / N sensores.
- `HIDRO_SIMULATE_WATER_LEVELS=1` se mantiene hasta embarcar PCF de niveles.

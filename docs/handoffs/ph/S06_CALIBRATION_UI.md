# S06 — Calibragem química pH (UI)

**Prerequisito:** [S05](S05_FLUJO_CICLO_ADAPTATIVO.md) entendido  
**Duración estimada:** 10 min  
**Siguiente:** [S07_BRIDGE_MQTT.md](S07_BRIDGE_MQTT.md)

**Obligatorio** antes de activar Auto pH en `/automacao`.

---

## Ejecutar

1. Ir a **`/calibragem`**
2. Seleccionar master (**online**)
3. Pestaña **Calibragem química pH**
4. Completar:
   - **pH+ (base):** `ml_per_ph_unit_base`, caudal bomba pH+
   - **pH− (ácido):** `ml_per_ph_unit_acid`, caudal bomba pH−
   - Volumen del tanque (si aplica)
5. **Guardar** → PATCH `ph_config_view`

Componente: [`src/components/PhCalibrationSection.tsx`](../../../src/components/PhCalibrationSection.tsx)

---

## Verificar (gate)

**Supabase:**

```sql
SELECT ml_per_ph_unit_acid, ml_per_ph_unit_base,
       flow_rate_ph_up, flow_rate_ph_down, relay_ph_up, relay_ph_down
FROM ph_config_view WHERE device_id = 'ESP32_HIDRO_269844';
```

**Firmware:** próximo poll S04 aplica `setPhPumpConfig` → seeds K si `validLearningCycles == 0`.

**UI:** `/automacao` → resumen calibragem read-only + link `/calibragem`.

---

## No activar Auto pH si

- `ml_per_ph_unit_*` en 0 o vacíos
- Relés pH+ / pH− no asignados
- Sensor pH fuera 4–9 de forma persistente

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| PATCH 403 | RLS / sesión JWT |
| ESP no lee valores | Esperar poll o reducir `intervalo_auto_ph` temporalmente |
| Seeds K incorrectos | Re-guardar calibragem + `reset_k_gains` en view |

Runbook legacy: [`scripts/CALIBRAGEM_PH_CHECKLIST.md`](../../../scripts/CALIBRAGEM_PH_CHECKLIST.md)

---

## Siguiente

[S07 — Bridge MQTT](S07_BRIDGE_MQTT.md)

# Calibragem química pH — checklist (antes de Auto pH)

> **Handoff serial:** ver [`docs/handoffs/ph/S06_CALIBRATION_UI.md`](../docs/handoffs/ph/S06_CALIBRATION_UI.md)

**Obligatorio** antes de activar Auto pH en `/automacao`. Sin calibragem, los seeds K y ml/ciclo serán incorrectos.

## Pasos en UI

1. Ir a **`/calibragem`**
2. Seleccionar el master (debe estar **online**)
3. Pestaña **Calibragem química pH**
4. Completar:
   - **pH+ (base):** `ml_per_ph_unit_base`, caudal bomba pH+
   - **pH− (ácido):** `ml_per_ph_unit_acid`, caudal bomba pH−
   - Volumen del tanque (si aplica en config)
5. **Guardar** → PATCH `ph_config_view`

## Verificación

- Supabase: `SELECT ml_per_ph_unit_acid, ml_per_ph_unit_base, flow_rate_ph_up, flow_rate_ph_down FROM ph_config_view WHERE device_id = 'ESP32_HIDRO_XXXXXX';`
- Serial ESP (próximo poll): confirma lectura de config pH
- Panel `/automacao` → resumen calibragem read-only + link `/calibragem`

## No activar Auto pH si

- Valores ml/unid en 0 o vacíos
- Relés pH+ / pH− no asignados en config
- Sensor pH fuera de rango 4–9 de forma persistente

Índice serial: [`docs/handoffs/ph/00_INDICE_SERIAL.md`](../docs/handoffs/ph/00_INDICE_SERIAL.md)

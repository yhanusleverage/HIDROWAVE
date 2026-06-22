# Bancada Auto pH — checklist firmware + UI

> **Handoff serial:** ver [`docs/handoffs/ph/S08_BANCADA_KPI.md`](../docs/handoffs/ph/S08_BANCADA_KPI.md)

Prerequisitos: SQL prod OK ([`RUN_PH_PROD_MIGRATIONS.md`](RUN_PH_PROD_MIGRATIONS.md)), bridge desplegado ([`DEPLOY_BRIDGE_PH_LIGHTSAIL.md`](../../ESP-HIDROWAVE-main/scripts/DEPLOY_BRIDGE_PH_LIGHTSAIL.md)), calibragem hecha en `/calibragem`.

## Flash firmware

1. PlatformIO: build + upload `ESP-HIDROWAVE-main` (ENABLE_MQTT según `platformio.ini`).
2. Monitor serial — esperado con broker OK:
   - `[MQTT] ph_operation ...`
   - `[MQTT] ph_dose ...` (tras corrección)

## Activar Auto pH

1. `/calibragem` → ml/unid pH+ y pH− guardados.
2. `/automacao` → panel pH → RPC activar / toggle auto.
3. ESP poll `ph_config_view` — serial confirma config.

## KPI UI (`/automacao`)

| KPI | Criterio |
|-----|----------|
| Badges | Dosando / Recirculación / Próxima verificación pH |
| PhDosageDetail | Actualiza < 3 s tras dosaje |
| pH PV | `resolvePhForDisplay` — no muestra basura fuera 4–9 |

## Tras tests MQTT manuales

Ejecutar [`reset-ph-operation.sql`](reset-ph-operation.sql) en Supabase.

Índice serial: [`docs/handoffs/ph/00_INDICE_SERIAL.md`](../docs/handoffs/ph/00_INDICE_SERIAL.md)

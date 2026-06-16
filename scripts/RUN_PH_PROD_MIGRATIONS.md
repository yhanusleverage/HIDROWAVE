# Auto pH — orden de migraciones Supabase (prod)

> **Handoff serial:** ver [`docs/handoffs/ph/S01_SUPABASE_SCHEMA.md`](../docs/handoffs/ph/S01_SUPABASE_SCHEMA.md)

Ejecutar **en el SQL Editor** de Supabase, **un archivo por vez**, en este orden:

| # | Script | Obligatorio |
|---|--------|-------------|
| 1 | [`CREATE_PH_CONFIG_VIEW.sql`](CREATE_PH_CONFIG_VIEW.sql) | Si la view no existe |
| 2 | [`ADD_PH_CONTROLLER_COLUMNS.sql`](ADD_PH_CONTROLLER_COLUMNS.sql) | Sí |
| 3 | [`MIGRATE_PH_ADAPTIVE.sql`](MIGRATE_PH_ADAPTIVE.sql) | Sí |
| 4 | [`MIGRATE_PH_CALIBRATION.sql`](MIGRATE_PH_CALIBRATION.sql) | Sí |
| 5 | [`CREATE_RPC_ACTIVATE_AUTO_PH.sql`](CREATE_RPC_ACTIVATE_AUTO_PH.sql) | Sí |
| 6 | [`ENABLE_REALTIME_REPLICATION.sql`](ENABLE_REALTIME_REPLICATION.sql) | Sí (`ph_dosages`) |

## Verificación

```bash
cd HIDROWAVE-main
node scripts/verify-e2e-schema.js
```

SQL adicional: [`VERIFICAR_PH_DOSAGES_E2E.sql`](VERIFICAR_PH_DOSAGES_E2E.sql)

## Siguiente

Ver [`docs/HANDOFF_AUTO_PH_E2E.md`](../docs/HANDOFF_AUTO_PH_E2E.md) — Fases B (calibragem) → E (bancada).

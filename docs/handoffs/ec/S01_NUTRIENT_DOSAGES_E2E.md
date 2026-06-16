# S01 — Auto EC / nutrient_dosages E2E

**Fecha:** Jun 16 2026  
**Device:** `ESP32_HIDRO_269844`  
**Estado:** Pipeline OK en prod

---

## Flujo

```
ESP emitNutrientDoseEvent
  → MQTT hidrowave/{id}/dose
  → bridge upsert nutrient_dosages
  → UI useLastDosage (SUM último sequence_id)

Backup (solo si MQTT falla):
  → ESP HTTPS POST nutrient_dosages
```

---

## Infra

| Componente | Ubicación |
|------------|-----------|
| Bridge | Lightsail `ubuntu@99.79.36.220` → `/opt/hidrowave-bridge` |
| Supabase | `bzqhhcmekhhnwzioppai.supabase.co` |
| Tablas | `nutrient_dosages`, `ph_dosages` (RLS off / UNRESTRICTED) |

### Logs bridge

```bash
sudo journalctl -u hidrowave-bridge -f
sudo systemctl restart hidrowave-bridge
```

---

## SQL (orden)

1. [`CRIAR_TABELA_NUTRIENT_DOSAGES.sql`](../../../scripts/CRIAR_TABELA_NUTRIENT_DOSAGES.sql)
2. [`NUTRIENT_DOSAGES_DEDUP_INDEX.sql`](../../../scripts/NUTRIENT_DOSAGES_DEDUP_INDEX.sql)
3. [`FIX_NUTRIENT_DOSAGES_RLS.sql`](../../../scripts/FIX_NUTRIENT_DOSAGES_RLS.sql) — si bridge falla con RLS
4. [`ENABLE_REALTIME_REPLICATION.sql`](../../../scripts/ENABLE_REALTIME_REPLICATION.sql) — UI en vivo

---

## Verificación

### Node (desde `HIDROWAVE-main/`)

```bash
npm run verify:nutrient-dosages
```

### SQL

[`VERIFICAR_NUTRIENT_DOSAGES_E2E.sql`](../../../scripts/VERIFICAR_NUTRIENT_DOSAGES_E2E.sql)

---

## Firmware (fixes Jun 16)

| Fix | Archivo |
|-----|---------|
| Backup HTTPS solo si MQTT falla | `HydroSystemCore::handleNutrientDoseEvent` |
| WDT no fatal: 409, SSL OOM (HTTP ≤0) | `NetworkWatchdog.h`, `SupabaseClient.cpp` |
| Pausar polls/sync durante dosing/recirc | `HydroSystemCore::loop` |
| EC=0 no dosar | `HydroControl::checkAutoEC` + `SensorSanitize.h` |
| Telemetría sin basura / sin air_temp simulado | `MqttClient.cpp`, `HydroSystemCore.cpp` |

**Tras cambios:** flashear ESP32.

---

## Logs esperados (OK)

**Bridge:**

```
[bridge] INSERT nutrient_dosages ESP32_HIDRO_269844 CAGE 0.93ml seq=...
```

**Serial (MQTT OK, sin backup redundante):**

```
[MQTT] dose CAGE 0.93 ml relé 7
```

**Serial (solo si bridge ya insertó y hubo fallback duplicado):**

```
ℹ️ [DOSAGEM] INSERT duplicado — bridge já persistiu
```

---

## Problemas conocidos

- **Sensores RS485/pH desconectados** → EC=0, pH basura. Validar hardware antes de Auto EC/pH.
- **Reboot mid-dose** (histórico): causado por backup HTTPS + WDT; mitigado en firmware arriba.

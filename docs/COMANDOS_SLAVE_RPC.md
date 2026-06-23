# Comandos slave ESP-NOW — RPC crítica en Supabase

**Resumen en una frase:** los comandos a relés **slave** usan la misma tabla `relay_commands`, pero otra RPC distinta (`get_and_lock_slave_commands`). Sin desplegar el script SQL correcto en Supabase, los comandos quedan en `pending` para siempre aunque la UI y el firmware funcionen.

**Script obligatorio:** [`scripts/PRODUCTION_RPC_GET_AND_LOCK_SLAVE.sql`](../scripts/PRODUCTION_RPC_GET_AND_LOCK_SLAVE.sql)

**Caso validado (jun 2026):** master `ESP32_HIDRO_1A575C`, slave MAC `14:33:5C:38:BF:60`.

---

## Master vs slave

| | Master (relé local del ESP) | Slave (ESP-NOW) |
|---|---|---|
| `target_device_id` | vacío `''` | MAC del slave (ej. `14:33:5C:38:BF:60`) |
| RPC en Supabase | `get_and_lock_master_commands` | `get_and_lock_slave_commands` |
| Script SQL | `PRODUCTION_RPC_GET_AND_LOCK_MASTER.sql` | **`PRODUCTION_RPC_GET_AND_LOCK_SLAVE.sql`** |
| Serial ESP | `[RPC MASTER]` | `[RPC SLAVE]` |

**Importante:** no existe la tabla `relay_commands_slave` en prod. Docs antiguos que la mencionan están obsoletos.

```mermaid
flowchart LR
  UI[UI_toggle_slave] --> INSERT["INSERT relay_commands\n target_device_id=MAC"]
  INSERT --> RPC["get_and_lock_slave_commands\n SCRIPT SQL OBLIGATORIO"]
  RPC --> ESP["Master poll HTTPS o MQTT"]
  ESP --> ESPNOW[ESP-NOW al slave]
  ESPNOW --> ACK["status completed"]
```

---

## Paso 1 — Desplegar la RPC (obligatorio)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Abrir en el repo: `HIDROWAVE-main/scripts/PRODUCTION_RPC_GET_AND_LOCK_SLAVE.sql`
3. Copiar **TODO** el archivo (desde `DROP FUNCTION` hasta `GRANT EXECUTE`)
4. Pegar y pulsar **Run** → debe salir **Success**

**No vale:**
- Pegar solo el fragmento `WHERE rc.device_id = ...`
- Ejecutar solo `SELECT * FROM get_and_lock_slave_commands(...)` sin haber hecho el deploy antes (eso solo invoca el stub que ya existe)

---

## Paso 2 — Probar en Supabase

```sql
SELECT * FROM get_and_lock_slave_commands('ESP32_HIDRO_1A575C', 5, 30);
```

Debe devolver filas si hay `pending` con `target_device_id` no vacío. Esas filas pasan a `sent`.

Confirmar:

```sql
SELECT id, status, sent_at, completed_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND target_device_id <> ''
ORDER BY created_at DESC
LIMIT 10;
```

---

## Paso 3 — Confirmar en serial del ESP (opcional)

Solo después del Paso 1–2. No hace falta escribir comandos manuales en el serial.

Esperar ~60 s (poll HTTPS) o hacer toggle ON/OFF en `/automacao`:

```text
[RPC SLAVE] Array recebido: N comandos
📡 [ESP-NOW] Comando para slave: 14:33:5C:38:BF:60
✅ [ACK] relay_commands id=XXX → completed
```

---

## Diagnóstico A / B / C

Ejecutar en Supabase **antes** de cambiar nada si sospechas stub:

```sql
-- A) ¿Qué función está desplegada?
SELECT proname, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'get_and_lock_slave_commands';

-- B) ¿Hay pending slave para este master?
SELECT id, device_id, status, relay_number, action,
       target_device_id, length(trim(target_device_id)) AS mac_len,
       created_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND status = 'pending'
ORDER BY created_at ASC;

-- C) Simular el filtro exacto de la RPC prod (sin lock)
SELECT id, relay_number, action, target_device_id
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND status = 'pending'
  AND target_device_id IS NOT NULL
  AND target_device_id <> '';
```

| Resultado | Interpretación |
|-----------|----------------|
| **A** solo `RETURN;` o cuerpo vacío | Stub confirmado — ejecutar Paso 1 |
| **B** tiene filas pero **C** vacío | `target_device_id` vacío o `device_id` distinto |
| **C** tiene filas pero RPC devuelve `[]` | Función desactualizada — ejecutar Paso 1 |

---

## Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `[RPC SLAVE] Array recebido: 0` con pending visible | RPC stub en Supabase | Deploy completo del `.sql` |
| Syntax error at `WHERE` | Pegaste solo un fragmento | Archivo SQL completo |
| `SELECT * FROM get_and_lock_slave_commands` sin deploy | Invoca función vieja | Paso 1 primero |
| Docs mencionan `relay_commands_slave` | Documentación legacy | Usar este doc + `relay_commands` |

---

## Verificación automatizada

```powershell
cd HIDROWAVE-main
$env:VERIFY_DEVICE_ID='ESP32_HIDRO_1A575C'
node scripts/verify-relay-rpc.js
```

El script prueba RPC master **y** slave.

---

## Si quedan stuck en `sent`

```sql
UPDATE relay_commands
SET status = 'pending', sent_at = NULL, error_message = NULL
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND status = 'sent'
  AND target_device_id <> '';
```

O: `node scripts/cleanup-relay-stuck.js --ids=131,132,133`

---

## Relacionado

| Recurso | Uso |
|---------|-----|
| [HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md](HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md) | Comandos master + contexto general |
| [MQTT_COMANDOS_RAPIDOS_SLAVES.md](MQTT_COMANDOS_RAPIDOS_SLAVES.md) | MQTT acelera latencia (&lt;2s); RPC sigue siendo prerrequisito |
| [RAILWAY_MQTT_ENV.md](RAILWAY_MQTT_ENV.md) | Variables MQTT en Railway |
| `ESP-HIDROWAVE-main/src/SupabaseClient.cpp` | Poll `[RPC SLAVE]` + ACK `completed` |
| `scripts/PRODUCTION_DEPLOY_README.sql` | Orden de deploy prod |

# Checklist — remate Auto EC (5% restante)

**Device:** `ESP32_HIDRO_269844` · **Post-cierre MQTT dose (16/jun)**

Ejecutar en bancada con sensores válidos conectados.

---

## 1. Verificación automatizada

```bash
cd HIDROWAVE-main
npm run verify:nutrient-dosages
npm run verify:ph-dosages
```

Ambos deben terminar en `E2E OK`.

---

## 2. Soak 24h

| Monitoreo | Criterio | Comando / dónde |
|-----------|----------|-----------------|
| `reboot_count` estable | No sube >2 en 24h | Serial `[MQTT] heartbeat reboot=N` |
| Heap | >80 KB mínimo | heartbeat `heap=` |
| Duplicados dose | 1 nutriente = 1 fila por `sequence_id` | SQL §3 abajo |
| Badges UI | idle tras recirc | `/automacao` |

---

## 3. Test fallback HTTPS (sin broker)

1. En Lightsail: `sudo systemctl stop hidrowave-bridge` (o parar Mosquitto).
2. Activar Auto EC; forzar un ciclo con sensor EC válido (TDS ≥ 50 µS/cm).
3. Serial esperado:

```
[MQTT] dose publish failed
💾 [DOSAGEM] INSERT nutrient_dosages (HTTPS fallback): ...
```

4. Verificar fila en Supabase:

```sql
SELECT * FROM nutrient_dosages
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC LIMIT 3;
```

5. Restaurar bridge: `sudo systemctl start hidrowave-bridge`.

---

## 4. Telemetría válida antes de Auto EC/pH

| Síntoma | Acción |
|---------|--------|
| `EC: 0`, pH basura en serial | Conectar sondas; mantener `auto_enabled=false` hasta PV plausible |
| `environment_data insert failed` | Normal con `air_temp` inválido; no bloquea dose |

Ver [HANDOFF_ULTIMA_DOSAGEM_E2E.md §12](../docs/HANDOFF_ULTIMA_DOSAGEM_E2E.md).

---

## 5. SQL anti-duplicados

```sql
SELECT sequence_id, nutrient_name, COUNT(*) AS n
FROM nutrient_dosages
WHERE device_id = 'ESP32_HIDRO_269844'
  AND created_at > now() - interval '24 hours'
GROUP BY sequence_id, nutrient_name
HAVING COUNT(*) > 1;
```

Resultado esperado: **0 filas**.

---

## Cierre

- [ ] `verify:nutrient-dosages` OK
- [ ] Soak 24h sin reboots anómalos
- [ ] Fallback HTTPS verificado una vez
- [ ] Sensores conectados en operación normal

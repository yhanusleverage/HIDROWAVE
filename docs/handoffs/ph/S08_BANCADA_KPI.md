# S08 — Bancada KPI (cierre Auto pH)

**Prerequisito:** [S07](S07_BRIDGE_MQTT.md) gate `test:pub:ph-dose` OK  
**Duración estimada:** 30–60 min  
**Siguiente:** operación continua — mantener [`00_INDICE_SERIAL.md`](00_INDICE_SERIAL.md) como referencia

---

## Ejecutar

### Flash firmware

1. PlatformIO: build + upload `ESP-HIDROWAVE-main` (`ENABLE_MQTT` según `platformio.ini`).
2. Monitor serial — con broker OK:
   - `[MQTT] ph_operation ...`
   - `[MQTT] ph_dose ...` (tras corrección)

### Activar Auto pH

1. S06 calibragem guardada.
2. `/automacao` → panel pH → RPC activar / toggle auto.
3. Poll confirma config en serial.

### KPI UI (`/automacao`)

| KPI | Criterio |
|-----|----------|
| Latencia INSERT | < 5 s tras OFF relé (MQTT o HTTPS) |
| Badges | Dosando / Recirculación / Próxima verificación pH — actualizan **< 3 s** |
| `PhDosageDetail` | Actualiza tras corrección (Realtime `ph_dosages`) |
| ml UI vs serial | \|UI − firmware\| < 0.05 ml |
| Badge recirc | Visible ~`tempo_recirculacao` s post-dosaje |
| pH PV | `resolvePhForDisplay` — no basura fuera 4–9 |
| Interlock | Con `PH_PROTOTYPE_RELAX_GUARDS=0`: sin dosagem pH inválido / EC secuencial activo |

Hooks: [`usePhOperationState.ts`](../../../src/hooks/usePhOperationState.ts), [`PhDosageDetail.tsx`](../../../src/components/PhDosageDetail.tsx)

---

## Verificar (gate final)

- [ ] Ciclo completo: check → dose → recirc → INSERT → badge idle
- [ ] K en Supabase actualizado post-dosaje
- [ ] Tras tests MQTT manuales: [`reset-ph-operation.sql`](../../../scripts/reset-ph-operation.sql)

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| Badge stuck dosing | Heartbeat 12s/30s + reset SQL |
| UI offline falso | [`HANDOFF_DEVICE_ONLINE_STABILITY.md`](../../HANDOFF_DEVICE_ONLINE_STABILITY.md) |
| ml diverge | Revisar calibragem S06 + flow rates |

Runbook legacy: [`scripts/BANCADA_AUTO_PH_CHECKLIST.md`](../../../scripts/BANCADA_AUTO_PH_CHECKLIST.md)

---

## Cierre

Auto pH E2E operativo cuando todos los gates S01–S08 pasan. Resumen arquitectura: [`HANDOFF_AUTO_PH_E2E.md`](../../HANDOFF_AUTO_PH_E2E.md).

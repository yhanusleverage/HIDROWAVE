# S04 — Flujo poll config pH (Supabase)

**Prerequisito:** [S03](S03_CONTROL_DOMINIO_H.md) leído  
**Duración estimada:** 10 min  
**Siguiente:** [S05_FLUJO_CICLO_ADAPTATIVO.md](S05_FLUJO_CICLO_ADAPTATIVO.md)

---

## Ejecutar

Espejo procedural de [`FLUJO_PROCEDURAL_EC_CONFIG.md`](../../../../ESP-HIDROWAVE-main/FLUJO_PROCEDURAL_EC_CONFIG.md) para pH.

### Fase 1 — Trigger (`HydroSystemCore::loop`)

- Intervalo poll GET: **30 s fijo** (`PH_CONFIG_POLL_MS`) — paridad con EC.
- **No** usa `intervalo_auto_ph` para el poll (ese campo controla solo `checkAutoPH`).
- Código: `src/HydroSystemCore.cpp` ~397–404.

```cpp
static const unsigned long PH_CONFIG_POLL_MS = 30000UL;
if (now - lastPHConfigCheck >= PH_CONFIG_POLL_MS) {
    Serial.println("⏰ [PH CONFIG] Poll 30s — GET ph_config_view");
    checkPHConfigFromSupabase();
}
```

Coordinación EC↔pH: ver [S09_EC_PH_COORDENACAO.md](S09_EC_PH_COORDENACAO.md).

### Fase 2 — Validaciones

- `supabaseConnected`, `hasEnoughMemoryForHTTPS()`, `supabase.isReady()`.
- Si falla → salir sin cambiar RAM.

### Fase 3 — GET `ph_config_view`

- `SupabaseClient::getPHConfigFromSupabase` → endpoint `ph_config_view?device_id=eq.{id}`.
- Serial error: `❌ [PH_CONFIG] GET HTTP {code}`.

### Fase 4 — Apply (`checkPHConfigFromSupabase`)

| Campo remoto | Setter firmware | NVS |
|--------------|-----------------|-----|
| `ph_setpoint` | `setPHSetpoint(..., false)` | no (poll) |
| `ph_tolerance` | `setPHTolerance` | no |
| relays + flows + ml/unid | `setPhPumpConfig` | no |
| adaptativo | `setPhAdaptiveConfig` | no |
| `reset_k_gains` | `resetPhLearnedGains()` + PATCH K | sí K en NVS |
| `intervalo_auto_ph` | `setAutoPHInterval(..., false)` | no |
| `auto_enabled` | `setAutoPHEnabled(..., false)` | no |
| `tempo_recirculacao` | `setPhRecirculacaoSeconds` | no |

**Config inválida** (`isValid == false`):
- **Producción** (`PH_PROTOTYPE_RELAX_GUARDS=0`): desactiva auto pH + `syncPhOperationStateToSupabase()` → idle.
- **Prototipo** (`PH_PROTOTYPE_RELAX_GUARDS=1`, default repo): mantiene auto — serial `⚠️ [PH CONFIG] Config inválida — prototipo: auto pH mantido`.

---

## Verificar (gate)

1. Cambiar SP en UI `/automacao` → guardar en Supabase.
2. Esperar ≤ **30 s** con WiFi (poll fijo; no depende de `intervalo_auto_ph`).
3. Serial: `⏰ [PH CONFIG] Poll 30s — GET ph_config_view`; SP aplicado en RAM de inmediato.
4. Dosaje efectivo: en próximo ciclo `checkAutoPH` (intervalo `intervalo_auto_ph`).
5. `reset_k_gains=true` en view → serial muestra reset K + PATCH.

SQL:

```sql
SELECT ph_setpoint, auto_enabled, intervalo_auto_ph, ml_per_ph_unit_acid, ml_per_ph_unit_base
FROM ph_config_view WHERE device_id = 'ESP32_HIDRO_269844';
```

---

## Serial esperado

```
⏰ [PH CONFIG] Poll 30s — GET ph_config_view
❌ [PH_CONFIG] GET HTTP 404    -- solo si view/device mal configurado
🧪 === CONTROLE ADAPTATIVO pH (domínio H) ===   -- tras checkAutoPH + auto ON
```

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| Poll nunca corre | WiFi/Supabase desconectado |
| Auto se apaga solo | Config inválida o fila vacía en view |
| ml/unid en 0 | Completar S06 calibragem |

---

## Siguiente

[S05 — Ciclo adaptativo](S05_FLUJO_CICLO_ADAPTATIVO.md)

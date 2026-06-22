# S02 — Firmware NVS + boot pH

**Prerequisito:** [S01](S01_SUPABASE_SCHEMA.md) gate `SCHEMA OK`  
**Duración estimada:** 20 min + flash  
**Siguiente:** [S03_CONTROL_DOMINIO_H.md](S03_CONTROL_DOMINIO_H.md)

---

## Ejecutar

1. Build + flash `ESP-HIDROWAVE-main` (PlatformIO).
2. Confirmar en serial al boot:

```
╔════════════════════════════════════════════════════╗
║   📂 CARREGANDO PH_CONFIG DO NVS                    ║
╚════════════════════════════════════════════════════╝
```

3. Código: `HydroControl::loadPHControllerConfig()` en [`HydroControl.cpp`](../../../../ESP-HIDROWAVE-main/src/HydroControl.cpp), llamado desde `begin()` **antes** de `adaptivePhController.loadFromNVS()`.

### Claves NVS (boot)

| Clave | Carga boot | Guarda |
|-------|------------|--------|
| `ph_setpoint` | sí | `setPHSetpoint(..., true)` |
| `ph_autoEnabled` | sí | `setAutoPHEnabled(..., true)` |
| `ph_interval` | sí | `setAutoPHInterval(..., true)` |
| `ph_k_acid`, `ph_k_base`, `ph_k_cycles` | `AdaptivePHController::loadFromNVS` | post-dosaje |
| relays, flows, ml/unid | **no** — solo poll Supabase | ver S04 |

### Paridad EC

EC usa `loadECControllerConfig()` al boot; pH ahora tiene equivalente mínimo para SP/auto/intervalo.

---

## Verificar (gate)

**Test A — boot con WiFi (normal):**

- Serial muestra valores NVS cargados.
- Tras poll Supabase (`intervalo_auto_ph`), config remota sobrescribe RAM.

**Test B — boot sin WiFi (opcional):**

- Desconectar WiFi o bloquear SSID.
- Reboot: SP / auto / interval deben venir de NVS, no defaults 6.0 / false / 300.

**Test C — persistencia:**

1. Activar auto pH desde UI (guarda NVS vía setter con `saveToNVS=true` en uso local).
2. Reboot: `auto_enabled` reflejado en serial.

---

## Serial esperado

```
📊 Valores carregados do NVS (PH):
   • ph_setpoint:      6.00
   • auto_enabled:     false
   • intervalo_auto_ph: 300 segundos
✅ PH_CONFIG carregado e aplicado com sucesso
```

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| No aparece banner PH NVS | Flash build antiguo — reflejar S02 |
| Siempre defaults 6.0/300 | NVS vacío — normal primera vez; configurar y guardar |
| K gains raros | `ph_k_cycles=0` → seed desde ml/unid tras poll S06 |

---

## Siguiente

[S03 — Dominio H (lectura)](S03_CONTROL_DOMINIO_H.md)

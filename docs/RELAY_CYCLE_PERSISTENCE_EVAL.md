# Evaluación — Persistencia de ciclo para fotoperíodo

**Fecha:** 28 ago 2026  
**Contexto:** Ciclos ON/OFF (`mode: cycle`) viven solo en RAM del slave (`cycleStates[]`). Tras reboot o corte de luz el ciclo se pierde; la luz puede quedar ON u OFF fijo.

---

## Opciones comparadas

| Criterio | NVS slave (recomendado) | Columnas Supabase | Schedule UI (circadian) |
|----------|-------------------------|-------------------|-------------------------|
| Funciona sin WiFi | Sí | No | Parcial (requiere device online) |
| Sobrevive Ctrl+R UI | N/A (hardware) | Solo muestra config, no ejecuta | Sí (config en reglas) |
| Sobrevive blackout | Parcial* | No | No |
| Complejidad | Media (firmware) | Baja (schema) + firmware igual | Alta (DecisionEngine) |
| Precisión fotoperíodo | Buena con RTC | N/A | Buena con NTP |

\* Parcial: NVS con `phaseRemainingSeconds` relativo restaura la fase al boot, pero no cuenta tiempo durante apagado sin RTC.

---

## Recomendación: NVS namespace `relay_cycles`

**Archivo:** `ESP-HIDROWAVE-main/src/RelayCommandBox.cpp`

### Struct propuesto (v1)

```cpp
struct PersistentCycleEntry {
    uint8_t active;              // 1 = ciclo activo
    uint8_t phaseOn;             // 1 = fase ON, 0 = OFF
    uint32_t onSeconds;
    uint32_t offSeconds;
    uint32_t phaseRemainingSeconds;  // relativo al boot
    uint8_t padding[2];
} __attribute__((packed));

struct PersistentCycleData {
    uint8_t version;             // 1
    PersistentCycleEntry relays[8];
    uint8_t checksum;
} __attribute__((packed));
```

### Cuándo guardar

- `startCycle()` → escribir entrada activa con `phaseRemainingSeconds = onSeconds`
- `checkCycles()` cada transición de fase → actualizar `phaseOn` y `phaseRemainingSeconds`
- `stopCycle()` → marcar `active = 0`

### Cuándo cargar

- `RelayCommandBox::begin()` después de `loadPersistentStates()`
- Si `active == 1`: restaurar pin según `phaseOn`, rearmar timer con `phaseRemainingSeconds`

### Por qué `phaseRemainingSeconds` y no `millis()`

El NVS actual de timers usa `timerEndTime = startTime + duration*1000` con `millis()`. Tras reboot, `millis()` reinicia en 0 y el cálculo de remaining es incorrecto si hubo apagado prolongado.

Guardar **segundos restantes de la fase actual** al momento del save y restaurar esa cantidad al boot es determinista para el caso “reboot rápido”. Para blackout largo, solo RTC/NTP da precisión de fotoperíodo.

---

## Supabase (complementario, no sustituto)

Si se quiere que la UI muestre config de ciclo tras Ctrl+R **sin reconfigurar**, añadir columnas opcionales a `relay_slaves`:

```sql
-- Futuro: no implementado aún
ALTER TABLE relay_slaves ADD COLUMN IF NOT EXISTS relay_cycle_on_s integer[];
ALTER TABLE relay_slaves ADD COLUMN IF NOT EXISTS relay_cycle_off_s integer[];
ALTER TABLE relay_slaves ADD COLUMN IF NOT EXISTS relay_cycle_active boolean[];
```

La UI escribiría estas columnas al pulsar “Iniciar ciclo”; el bridge **no** las usaría para ejecutar — solo display. La ejecución sigue en el Atlas vía NVS.

---

## Fotoperíodo crítico (12/12 h)

Para indoor con restricción legal de luz:

1. **Corto plazo:** flash slave con NVS cycle + validar 12h/12h en bancada
2. **Medio plazo:** RTC DS3231 o sync NTP periódico en slave para corregir drift tras blackout
3. **Largo plazo:** regla circadiana en `DecisionEngine` como backup si ESP-NOW falla

---

## Estado

| Item | Estado |
|------|--------|
| Evaluación NVS vs Supabase | Completo |
| Implementación NVS `relay_cycles` | Pendiente (siguiente sprint firmware) |
| Migración SQL Supabase display-only | Pendiente |
| RTC/NTP en slave | Pendiente |

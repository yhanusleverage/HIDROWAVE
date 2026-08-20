# 06 — Top 5 cambios estructurales priorizados

Sin big-bang rewrite. Orden = ROI esperado sobre P y HH futuras.  
Re-priorizar tras las **2 semanas** de [01_P_BASELINE](01_P_BASELINE.md).

| # | Cambio | Capas | P que mejora | Esfuerzo HH aprox. | Dependencia |
|---|--------|-------|--------------|--------------------|-------------|
| **1** | Baseline P operativo (medir, no refactor) | Ingeniería | todos (visibilidad) | 8–16 | ninguna |
| **2** | Endurecer path CommandRelay (INSERT → MQTT → ACK → UI) + métrica p95 | Cloud + Firmware + UI | **P1**, P7 | 24–40 | contrato v1 |
| **3** | Adapters cloud fuera del lazo (F1 bounded contexts) | Firmware | **P3**, **P6**, P4 | 40–80 | #1 estable |
| **4** | Una verdad de frescura hydro (bridge throttle + UI live-only) | Cloud + UI | **P2** | 16–32 | contrato telemetry |
| **5** | Cola eventos control→cloud (F2) bajo carga dosagem/operation | Firmware | **P3**, P1 bajo carga | 32–60 | #3 |

## Detalle

### 1. Baseline P
- Llenar `p-baseline-log.csv` 10+ días.
- Review semanal 15 min.
- **No** mezclar con rewrite.

### 2. Path CommandRelay
- Instrumentar timestamps end-to-end (created → published → ack → completed).
- Bancada master + 1 slave.
- Alinear UX pending/error con DoD UI.

### 3. Adapters F1
- Extraer publish/sync de `HydroSystemCore` sin cambiar comportamiento.
- Checklist: `HydroControl` sin nuevos includes cloud.
- Ver [03_FIRMWARE_BOUNDED_CONTEXTS](03_FIRMWARE_BOUNDED_CONTEXTS.md).

### 4. Frescura hydro
- Confirmar intervalo MQTT vs expectativa UI (&lt; 15–60 s).
- Evitar insert duplicado HTTPS+MQTT.
- Dashboard: single subscription / merge live.

### 5. Cola F2
- Ring buffer de dose/operation events.
- HTTPS largo fuera del tick de control.
- Soak 24 h (P3).

## Explicitamente NO (ahora)

- Reescribir Next.js o PlatformIO “limpio”.
- Microservicios / monorepo multi-package.
- Contador FP formal como proyecto.
- Nuevas páginas marketing (J7 freeze).

## Seguimiento

Tras cada ítem 2–5: re-medir P afectados 3 días y actualizar estado en [00_INDICE](00_INDICE.md).

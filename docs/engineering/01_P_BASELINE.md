# 01 — Indicadores P (orden de magnitud)

Baseline obligatorio **2 semanas** antes de refactors estructurales.  
Registro: [`p-baseline-log.csv`](p-baseline-log.csv) — una fila por día hábil (mín. 10 puntos).

## Tablero P

| ID | Indicador | Definición operativa | Cómo medir hoy | Meta inicial | Umbral rojo |
|----|-----------|----------------------|----------------|--------------|-------------|
| **P1** | Latencia comando | `t_ack − t_insert` en `relay_commands` (o ACK MQTT) | UI: pulsar relé → timestamp `completed_at` / `command_ack`; serial + broker | p95 **&lt; 3 s** master; slave ESP-NOW **&lt; 5 s** | p95 &gt; 8 s |
| **P2** | Frescura telemetría | Edad `created_at` de última fila hydro con PV válido | Dashboard + `isHydroRowFresh` (`HYDRO_LIVE_MAX_AGE_MS` = 5 min online) | PV vivo **&lt; 15 s** ideal; **&lt; 60 s** aceptable MVP | &gt; 5 min (offline UI) |
| **P3** | Estabilidad firmware | Crashes / WDT / brownout en 24 h bancada | Serial log + uptime; soak checklist MQTT | **0 crash / 24 h** | ≥1 crash / 24 h |
| **P4** | Heap / flash | `heap_free` en heartbeat; flash used build | MQTT `heartbeat.heap_free`; `pio run` size | margen flash **&gt; 20%**; heap min estable | heap &lt; 40 KB recurrente |
| **P5** | HH por dominio | Horas reales / feature cerrada | Timebox sprint por carpeta/dominio | −20% HH/feature en 1 trimestre vs semana 1–2 | sube 2 sprints seguidos |
| **P6** | Deuda acoplamiento | # PRs que tocan `HydroSystemCore.cpp` **y** `HydroControl.cpp` juntos | `git log --stat` / review checklist | tendencia **bajando** | &gt;50% PRs firmware tocan ambos |
| **P7** | Bug escape | Bugs reportados en prod / release | Issues etiquetados `prod` | tendencia bajando | spike post-release |

## Protocolo de las 2 semanas (sin código grande)

### Semana 1 — Instrumentar y observar

1. Llenar CSV diario (P1–P4 mínimo).
2. 3 pruebas de comando por día: 1 master local, 1 slave ESP-NOW, 1 peristáltico si hay bancada.
3. Anotar `heap_free` del heartbeat a la misma hora (mañana / noche).
4. No mergear refactors de núcleo; solo fixes de crash/blocker.

### Semana 2 — Confirmar cuello

1. Comparar p50/p95 de P1 master vs slave.
2. Correlacionar P2 con intervalo MQTT (`MQTT_TELEMETRY_INTERVAL_MS` = 30 s en `Config.h`).
3. Marcar el **peor P en rojo** → ese es el primer ítem del [Top 5](06_CAMBIOS_ESTRUCTURALES_TOP5.md).
4. Congelar escopo horizontal según [04_BACKLOG](04_BACKLOG_JOBS_USUARIO.md) hasta P1 y P3 verdes.

## Fórmulas rápidas

```
P1_ms = completed_at_ms - created_at_ms   // relay_commands
P2_ms = now_ms - hydro_measurements.created_at_ms
P4_margin_flash = 1 - (app_size / partition_app_size)
```

## Constantes ya en código (referencia)

| Constante | Valor | Archivo |
|-----------|-------|---------|
| `ONLINE_THRESHOLD_MINUTES` | 5 | `src/lib/realtime/device-status.ts` |
| `HYDRO_LIVE_MAX_AGE_MS` | 5 min | `src/lib/realtime/hydro-freshness.ts` |
| `MQTT_TELEMETRY_INTERVAL_MS` | 30000 | `ESP-HIDROWAVE-main/include/Config.h` |
| `MQTT_HEARTBEAT_INTERVAL_MS` | 60000 | idem |
| `CRITICAL_COMMAND_TIMEOUT` | 5000 | idem |

## Review semanal (Eng Manager)

- 15 min: mirar CSV + 1 gráfico mental p95 P1 / min heap.
- Decisión: ¿seguir midiendo, atacar P rojo, o desbloquear un job de usuario?
- Actualizar estado en [00_INDICE](00_INDICE.md).

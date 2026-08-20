# 04 — Backlog por jobs de usuario

Roadmap de **escopo** reordenado: no por páginas nuevas, sino por **trabajo del operador**.  
Hasta **P1 (latencia) y P3 (estabilidad) verdes**, los dominios en FREEZE no reciben HH de feature (solo bugs blockers).

## 1. Jobs prioritarios

| Prioridad | Job | Pregunta del usuario | Superficie actual | Capas involucradas | Estado backlog |
|-----------|-----|----------------------|-------------------|--------------------|----------------|
| **J1** | Monitorear | “¿Está vivo el cultivo? ¿pH/EC/nivel frescos?” | `/dashboard`, charts, freshness | Firmware telemetry + bridge + UI realtime | **ACTIVO** — atado a P2 |
| **J2** | Actuar | “Enciendo/apago bomba o slave ya” | `/dispositivos`, relés | CommandRelay MQTT + ESP-NOW | **ACTIVO** — atado a P1 |
| **J3** | Controlar lazo | “Auto EC / Auto pH / dilución confiables” | dashboard EC/pH, calibragem | BC_Control + cloud sync | **ACTIVO** — atado a P3 |
| **J4** | Automatizar | “Reglas y procedimientos sin sorpresas” | `/automacao`, procedures | DecisionEngine + ScriptRunner + UI | **ACTIVO condicional** — tras P1/P3 |
| **J5** | Cultivar en el tiempo | “Plan semanal / grow-cycle” | timeline cultivo, ciclos | grow-cycle APIs + rules | **LIMITADO** — no expandir dominio |
| **J6** | Configurar / onboarding | “Registro device, calibración, hidráulica” | `/configuracao`, `/calibragem` | NVS + UI | **MANTENER** — solo gaps bloqueantes |
| **J7** | Entender producto | Docs, planos, quem-somos | marketing + support | Frontend only | **FREEZE** |

## 2. Dominios FREEZE (hasta P1 ∩ P3 verdes)

| Dominio | Rutas / áreas | Motivo |
|---------|---------------|--------|
| Marketing / marca | `/`, `/quem-somos`, `/planos`, design-system visual | No mejora P de campo |
| Docs i18n expansión | `/support`, `/fundamentos`, nuevas locales | HH sin ROI de estabilidad |
| Nuevas páginas procesos | features net-new fuera de J1–J4 | Expande superficie sin contrato |
| Experimentos UI no críticos | collages, polish no ligado a frescura/comando | Diferir |

**Excepción:** fix de seguridad, RLS, o bug que rompe J1–J3 en prod.

## 3. Orden de ataque de HH (sprints)

```text
Sprint N:    Medir P + fixes P3 crash
Sprint N+1:  P1 CommandRelay (master + slave ACK)
Sprint N+2:  P2 frescura (intervalo + bridge + UI single source)
Sprint N+3:  J3 lazo EC/pH (sin features UI nuevas)
Sprint N+4+: J4 automatizar solo si P1/P3 verdes
```

## 4. Budget HH sugerido por sprint (equipo pequeño)

| Bucket | % HH | Notas |
|--------|------|-------|
| Estabilidad / P | 40% | Crash, heap, latencia |
| Job activo (J1–J3) | 40% | Una mejora medible por sprint |
| Deuda estructural F0/F1 | 15% | Adapters, no rewrite |
| FREEZE / otro | 5% | Solo blockers |

## 5. Criterio para descongelar J5/J7

- P1 p95 master &lt; 3 s y slave &lt; 5 s (7 días).
- P3 = 0 crash/24h en bancada (7 días).
- Contrato v1 sin cambios breaking pendientes.
- Eng Manager aprueba en review semanal P.

## 6. Anti-patrones de escopo

- Abrir feature en 3 capas el mismo sprint sin dueño de job.
- Nueva API route “para una pantalla” sin mapear a caso de uso del [contrato](02_CONTRATO_DISPOSITIVO.md).
- Crecer `HydroSystemCore` / `HydroControl` para un job J7.

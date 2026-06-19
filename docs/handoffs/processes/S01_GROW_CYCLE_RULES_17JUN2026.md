# S01 — Schedules, Rules y Auto EC/pH — Grow Cycle (17/jun/2026)

**Fecha:** 17 jun 2026  
**Prerequisito:** lectura rápida de [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) (capas eventos vs métricas)  
**Duración estimada:** 30–45 min  
**Tipo:** handoff dev — mapeo Aurora/Nuravine → HIDROWAVE + roadmap mínimo  
**Siguiente:** bancada §10; luego [ph/S09_EC_PH_COORDINACAO.md](../ph/S09_EC_PH_COORDINACAO.md) si hay changeout con Auto EC/pH ON

**Índice serial:** [00_INDICE_SERIAL.md](00_INDICE_SERIAL.md)

**Device ref:** `ESP32_HIDRO_269844` · **17/jun/2026**

---

## 1. Resumen ejecutivo

### Veredicto de diseño

El modelo **schedules + rules + Auto EC/pH** de guías tipo Aurora/Nuravine es **moderadamente sensato**, no excesivo, si se respeta la separación que HIDROWAVE ya documenta en `/processos`:

| Capa | Qué hace | Cuándo actúa |
|------|----------|--------------|
| **P1** Tanque | Fill, Drain, Changeout | Eventos discretos (día 0, changeout semanal, drain total) |
| **P2** Auto EC | Bucle cerrado continuo | Entre changeouts; corrige consumo diario |
| **P3** Auto pH | Bucle cerrado continuo | Paralelo a P2 (interlock G5 en producción) |
| **P4** TIME | Circulación, UC Roots | Pulso periódico independiente del PV |

La guía Aurora refleja restricciones físicas reales: priming de bomba, no secar el drenaje, undershoot en primera dosis, estabilización entre pasos.

### Principio de simplicidad (acordado)

- **Auto EC y Auto pH permanecen ON** durante el ciclo de cultivo.
- Las reglas P1 solo manipulan **hidráulica** (válvulas, bombas, delays).
- La corrección química la hacen los bucles P2/P3 solos.
- **Roadmap:** interlock firmware que pause dosaje P2/P3 mientras un script P1 está activo (Fase 2).

### Dónde sería “demasiado”

Replicar Aurora al pie de la letra en HIDROWAVE hoy:

- UI de schedule multi-semana (12 semanas)
- Tipo de acción monolítico “Fill and Dose” o “Sensor Valve”
- Togglear Auto EC/pH en cada regla vía RPC

Eso añade superficie sin valor mientras el Decision Engine ESP32 esté ~35% implementado.

---

## 2. Modelo P1–P4 — convivencia

```mermaid
flowchart TB
  subgraph p1 [P1 Tanque priority 80-100]
    InitialFill[INITIAL_FILL]
    Changeout[CHANGEOUT_Wn]
    DrainFull[DRAIN_FULL]
  end
  subgraph p2p3 [P2/P3 Bucles cerrados]
    AutoEC[Auto EC]
    AutoPH[Auto pH]
  end
  subgraph p4 [P4 TIME priority 20-40]
    SchedCirc[SCHEDULE_circulacion]
  end
  InitialFill -->|"post-fill estable"| AutoEC
  InitialFill --> AutoPH
  Changeout -->|"drain+fill script"| p1
  DrainFull -->|"OFF Auto manual"| p2p3
  SchedCirc -.->|"paralelo"| p2p3
```

**Regla de oro:** `tempo_recirculacao` de Auto EC/pH es dead-time **post-dosis** (homogeneización). La bomba de circulación 24/7 es regla **TIME P4** separada — no confundir (ver `/processos/agendamentos`).

**Decisión operativa (17/jun/2026):** por ahora se mantiene así — `tempo_recirculacao` **no enciende** relé de bomba; solo espera N segundos en firmware. La circulación física la controla exclusivamente **P4** (`SCHEDULE_*` → slave vía ESP-NOW). Ver §9 Fase 4 para la mejora futura **obligatoria**.

---

## 3. Mapeo Aurora/Nuravine → HIDROWAVE

### Tabla de términos

| Concepto Aurora | HIDROWAVE hoy | Notas |
|-----------------|---------------|-------|
| Timer 8–9 am | `circadian_cycle` o condición `time_interval` | Ventana de una hora = trigger único diario |
| Linked Action | `chained_events[]` en `rule_json.script` | `trigger_on: success \| failure`, `delay_ms` |
| Sensor Valve | `WHILE` + condición nivel + `relay_action` válvula | **No hay tipo Sensor Valve** en código |
| Fill and Dose | Script secuencial P1 (`priority` 80+) | Sin acción monolítica; dosaje inicial manual o Auto EC post-fill |
| Mix After Fill | Instrucción `delay` post-fill | Esperar homogeneización antes de confiar en EC/pH |
| Schedule 12 semanas | Patrón operativo doc (no UI) | Reglas por `rule_id` + triggers circadianos |
| Turn on circulation pump | `relay_action` ON o `switch` | Relé bomba circulación |
| Activate Auto EC/pH | RPC manual hoy | `activate_auto_ec` / `activate_auto_ph` — ver §7 |

```mermaid
flowchart TB
  subgraph aurora [Conceptos Aurora]
    Timer8am[Timer 8-9am]
    LinkedAction[Linked Action]
    SensorValve[Sensor Valve]
    FillDose[Fill and Dose]
    Schedule12w[Schedule 12 semanas]
  end
  subgraph hw [HIDROWAVE hoy]
    Circadian[circadian_cycle o time_interval]
    ChainedEvents[chained_events]
    WhileLevel["WHILE level + relay_action"]
    ScriptP1[Script secuencial P1]
    SchedP4[SCHEDULE_* P4]
    AutoECPH[Auto EC/pH manual ON]
  end
  Timer8am --> Circadian
  LinkedAction --> ChainedEvents
  SensorValve --> WhileLevel
  FillDose --> ScriptP1
  Schedule12w --> SchedP4
  FillDose -.->|"no mide EC en fill"| AutoECPH
```

### Archivos clave en código

| Área | Archivo |
|------|---------|
| UI scripts | `src/components/SequentialScriptEditor.tsx`, `CreateRuleModal.tsx` |
| Validación | `src/lib/validate-decision-rule.ts` |
| Schedules relé | `src/components/DeviceControlPanel.tsx`, `src/app/api/automation/rules/route.ts` |
| Auto EC | `src/app/automacao/AutomacaoPageClient.tsx`, RPC `activate_auto_ec` |
| Auto pH | `src/components/PhControllerPanel.tsx`, RPC `activate_auto_ph` |
| Docs UI P1–P4 | `src/lib/translations/processos/es.ts` |
| Prioridad numérica | `src/lib/translations/support/es.ts` → `priority-numeric` |

---

## 4. JSON de ejemplo por regla

> **Placeholders:** sustituir `DEVICE_ID`, `SLAVE_MAC`, `relay_number` y sensores según instalación. Los números de relé son ejemplos.

### 4.1 Initial Fill and Dose — `INITIAL_FILL` (priority 90)

Equivalente a la regla “Initial Fill and Dose” Aurora: trigger 8–9 am, priming >20%, circulación ON, fill 80%, mix delay.

**Paso A — Priming (Linked Action / Sensor Valve Aurora):**

```json
{
  "device_id": "DEVICE_ID",
  "rule_id": "INITIAL_FILL_PRIME",
  "rule_name": "Initial Fill — Prime Circulation",
  "priority": 90,
  "enabled": true,
  "rule_json": {
    "script": {
      "instructions": [
        {
          "type": "relay_action",
          "relay_number": 3,
          "action": "on",
          "target": "slave",
          "slave_mac": "SLAVE_MAC",
          "comment": "Fill Valve — start open"
        },
        {
          "type": "while",
          "condition": { "sensor": "water_level", "operator": ">", "value": "baixo" },
          "body": [],
          "max_duration_ms": 600000,
          "comment": "Stop when level > 20% OR 10 min timeout"
        },
        {
          "type": "relay_action",
          "relay_number": 3,
          "action": "on",
          "comment": "Finish open (valve stays open)"
        }
      ],
      "loop_interval_ms": 5000,
      "max_iterations": 1,
      "cooldown": 3600,
      "max_executions_per_hour": 1
    }
  }
}
```

**Paso B — Circulation ON (Linked Action pump):**

```json
{
  "rule_id": "INITIAL_FILL_CIRC_ON",
  "rule_name": "Initial Fill — Circulation ON",
  "priority": 88,
  "rule_json": {
    "script": {
      "instructions": [
        {
          "type": "relay_action",
          "relay_number": 7,
          "action": "on",
          "comment": "Circulation Pump"
        }
      ],
      "loop_interval_ms": 1000,
      "max_iterations": 1
    }
  }
}
```

**Paso C — Fill to 80% + mix delay (Fill and Dose — sin medir EC en fase fill):**

```json
{
  "rule_id": "INITIAL_FILL_DOSE",
  "rule_name": "Initial Fill and Dose",
  "priority": 90,
  "rule_json": {
    "script": {
      "instructions": [
        {
          "type": "relay_action",
          "relay_number": 3,
          "action": "on",
          "comment": "Fill Valve start open"
        },
        {
          "type": "while",
          "condition": { "sensor": "level_1", "operator": "<", "value": 80 },
          "body": [],
          "max_duration_ms": 1200000,
          "comment": "Fill until 80% OR 20 min"
        },
        {
          "type": "relay_action",
          "relay_number": 3,
          "action": "off",
          "comment": "Fill Valve finish closed"
        },
        {
          "type": "delay",
          "duration_ms": 300000,
          "comment": "Mix after fill — 5 min (ajustar a cycle size / tempo_recirculacao)"
        }
      ],
      "loop_interval_ms": 5000,
      "max_iterations": 1,
      "chained_events": [
        {
          "target_rule_id": "INITIAL_FILL_CIRC_ON",
          "trigger_on": "success",
          "delay_ms": 0
        }
      ]
    }
  }
}
```

**Nota crítica:** Aurora Fill and Dose **no mide EC durante el fill**. Tras `delay` de mezcla, el operador activa Auto EC/pH (hoy manual) o deja que P2/P3 corrijan undershoot. Ver [S09_EC_PH_COORDINACAO.md](../ph/S09_EC_PH_COORDINACAO.md).

**Dosaje inicial de nutrientes (Hypo, A, B, pH Down):** no hay acción “FillAndDose” con bombas en script. Opciones hoy:

1. Undershoot intencional + Auto EC/pH post-fill (recomendado).
2. Secuencia manual de `relay_action` por bomba dosificadora (fuera de scope Aurora automático).

### 4.2 Drain Rule — `DRAIN_FULL` (priority 95)

```json
{
  "rule_id": "DRAIN_FULL",
  "rule_name": "Drain Rule",
  "priority": 95,
  "enabled": true,
  "rule_json": {
    "script": {
      "instructions": [
        {
          "type": "relay_action",
          "relay_number": 7,
          "action": "off",
          "comment": "Step 2 — Stop circulation pump"
        },
        {
          "type": "relay_action",
          "relay_number": 8,
          "action": "on",
          "comment": "Step 3 — Start drain pump"
        },
        {
          "type": "relay_action",
          "relay_number": 4,
          "action": "on",
          "comment": "Step 4 — Drain valve open"
        },
        {
          "type": "while",
          "condition": { "sensor": "level_4", "operator": "!=", "value": "vazio" },
          "body": [],
          "max_duration_ms": 900000,
          "comment": "Drain until <5% (level_4 vacío) OR 15 min"
        },
        { "type": "delay", "duration_ms": 60000, "comment": "Step 5 — Extra drain 1 min" },
        {
          "type": "relay_action",
          "relay_number": 8,
          "action": "off",
          "comment": "Step 6 — Drain pump OFF"
        },
        { "type": "delay", "duration_ms": 60000, "comment": "Step 7 — Level stabilize 1 min" },
        {
          "type": "switch",
          "relay_number": 8,
          "on_duration_ms": 60000,
          "off_duration_ms": 0,
          "comment": "Step 8 — Final drain ON 1 min then OFF"
        },
        {
          "type": "relay_action",
          "relay_number": 4,
          "action": "off",
          "comment": "Step 9 — Close drain valve"
        }
      ],
      "loop_interval_ms": 3000,
      "max_iterations": 1,
      "cooldown": 3600,
      "max_executions_per_hour": 1
    }
  }
}
```

**Trigger 8–9 am:** añadir regla compuesta con `conditions` sensor horario o `circadian_cycle` que habilite/dispare este script (según capacidad del executor en bancada).

### 4.3 Changeout Rule — `CHANGEOUT_W01_W02` (priority 85)

```json
{
  "rule_id": "CHANGEOUT_W01_W02",
  "rule_name": "Week 1 to Week 2 Changeout",
  "priority": 85,
  "enabled": true,
  "rule_json": {
    "script": {
      "instructions": [
        {
          "type": "relay_action",
          "relay_number": 8,
          "action": "on",
          "comment": "Drain pump ON — partial drain"
        },
        {
          "type": "relay_action",
          "relay_number": 4,
          "action": "on",
          "comment": "Drain valve open"
        },
        {
          "type": "while",
          "condition": { "sensor": "water_level", "operator": "<=", "value": "medio" },
          "body": [],
          "max_duration_ms": 1200000,
          "comment": "Until 50% (medio) OR 20 min"
        },
        {
          "type": "relay_action",
          "relay_number": 8,
          "action": "off",
          "comment": "Drain pump OFF — ready for fill"
        }
      ],
      "loop_interval_ms": 5000,
      "max_iterations": 1,
      "chained_events": [
        {
          "target_rule_id": "INITIAL_FILL_DOSE",
          "trigger_on": "success",
          "delay_ms": 5000,
          "comment": "Step 6 — chain to Fill and Dose rule"
        }
      ]
    }
  }
}
```

Convención naming: `CHANGEOUT_W{n}_W{n+1}` para tracking semanal.

### 4.4 Schedule circulación P4 — `SCHEDULE_*` (priority 25)

Creado desde **Dispositivos → Schedule** (`DeviceControlPanel`):

```json
{
  "rule_id": "SCHEDULE_SLAVEMAC_RELAY7",
  "rule_name": "Circulation 15min every 2h",
  "priority": 25,
  "enabled": true,
  "interval_between_executions": 7200,
  "rule_json": {
    "conditions": [
      { "sensor": "time_interval", "operator": "==", "value": 7200 }
    ],
    "actions": [
      {
        "relay_id": 7,
        "relay_name": "Circulation Pump",
        "duration": 900,
        "target_device": "SLAVE_MAC"
      }
    ]
  }
}
```

> **Gap schema:** el POST de schedule usa `relay_id`/`target_device`; el tipo `DecisionRule` oficial usa `relay_ids[]`/`slave_mac_address`. Normalizar en executor o migración futura.

---

## 5. Matriz de prioridad numérica

Cuando varias `decision_rules` compiten, el ESP32 ordena por `priority` DESC (mayor gana). Auto EC/pH **no usan** esta columna — corren en `HydroControl.cpp`.

| `rule_id` sugerido | Priority | Capa | Notas |
|--------------------|----------|------|-------|
| `DRAIN_FULL` | 95 | P1 | Seguridad — máxima prioridad tanque |
| `INITIAL_FILL`, `INITIAL_FILL_DOSE` | 90 | P1 | Primera carga |
| `INITIAL_FILL_PRIME`, `INITIAL_FILL_CIRC_ON` | 88–90 | P1 | Sub-pasos encadenados |
| `CHANGEOUT_W*_W*` | 85 | P1 | Changeout semanal |
| Scripts operacionales (mezcla forzada) | 50–79 | — | Entre tanque y TIME |
| `SCHEDULE_*` circulación | 20–40 | P4 | No competir con P1 |
| Luz UV, aireador | 0–19 | P4 | Auxiliar |

Referencia UI: `src/lib/translations/support/es.ts` → sección `priority-numeric`.

---

## 6. Flujo semanal tipo (sin UI calendario 12 semanas)

Patrón operativo para ciclo de 12 semanas (84 días) — **documentación**, no feature:

| Día | Acción | Regla / mecanismo |
|-----|--------|-------------------|
| 0 | Initial Fill and Dose | `INITIAL_FILL_*` — trigger circadian 8 am |
| 0 post-fill | Activar Auto EC + Auto pH | Manual RPC (hoy) |
| 1–6 | Mantenimiento | P2/P3 ON; P4 circulación |
| 7 | Changeout W1→W2 | `CHANGEOUT_W01_W02` |
| 14, 21, … | Changeouts siguientes | `CHANGEOUT_W02_W03`, etc. |
| 84 | Drain total fin ciclo | `DRAIN_FULL`; desactivar Auto EC/pH manual |

```mermaid
sequenceDiagram
  participant Sched as Regla P1 Changeout
  participant Hyd as Script hidraulico
  participant EC as Auto EC P2
  participant PH as Auto pH P3
  participant Time as SCHEDULE circulacion P4

  Note over EC,PH: ON todo el ciclo salvo pausa manual en P1
  Sched->>Hyd: trigger circadian 8am
  Hyd->>Hyd: drain 50% WHILE level
  Hyd->>Hyd: fill 80% + delay mix
  Note over EC,PH: post-fill EC/pH corrigen undershoot
  Time->>Time: circulacion cada 2h independiente
```

**Setpoints por semana:** tabla manual del operador (fuera de scope BD). Ajustar `ec_setpoint` / `ph_setpoint` en `/automacao` al inicio de cada fase vegetativa/flip si aplica.

---

## 7. Coordinación Auto EC/pH

### Hoy (manual)

| Acción | Mecanismo | Archivo |
|--------|-----------|---------|
| Activar Auto EC | RPC `activate_auto_ec` + `auto_enabled=true` | `AutomacaoPageClient.tsx` |
| Activar Auto pH | RPC `activate_auto_ph` | `PhControllerPanel.tsx` |
| Desactivar | Update `auto_enabled=false` en views | idem |
| Reglas → Auto EC/pH | **No existe** | — |

**Cuándo activar tras Initial Fill:**

1. Nivel estable (fill completado + válvula cerrada).
2. Delay de mezcla completado (`Mix After Fill`).
3. Badges EC/pH en `idle` (sin recirc activa de dosaje previo).
4. Entonces: Salvar parámetros → Ativar Auto EC → Ativar Auto pH.

**Durante script P1 activo (17/jun/2026):** firmware aplica hold automático si `priority >= 80` — ya no es obligatorio desactivar Auto EC/pH manualmente. Workaround manual sigue válido en firmware antiguo sin flash.

### Poll vs dosaje

Config remota (poll 30 s) es **independiente** del ciclo dosificador. Ver [S09_EC_PH_COORDINACAO.md](../ph/S09_EC_PH_COORDINACAO.md).

### Mutex existente

- **G5 (producción):** pH bloqueado mientras EC secuencial activo (`PH_PROTOTYPE_RELAX_GUARDS=0`).
- **ph_low_control:** regla legacy firmware saltada si `auto_ph_active` (`DecisionEngine.cpp`).

### Mutex faltante (roadmap Fase 2) — **implementado 17/jun/2026**

Ver §9 Fase 2 y §13. `isAutoDosingPausedByInterlock()` en firmware.

---

## 8. Gaps y riesgos

| Capacidad | Estado | Riesgo |
|-----------|--------|--------|
| Stack P1–P4 conceptual | ✅ Docs UI | — |
| Scripts WHILE/IF/delay/relay | ✅ UI + JSON | Executor ESP32 parcial |
| `chained_events` | ✅ UI persiste | Executor encadenamiento parcial |
| `SCHEDULE_*` | ✅ POST API | Sin upsert; sin reload UI |
| Auto EC/pH desde reglas | ❌ | Operación manual |
| Templates Fill/Drain/Changeout | ❌ | Editor libre — errores operador |
| “Sensor Valve” | ❌ | Patrón WHILE documentado aquí |
| Schedule 12 semanas UI | ❌ | Patrón doc §6 |
| `toggleRule` enabled | ❌ No persiste | `AutomacaoPageClient.tsx` |
| Interlock P1 → P2/P3 | ✅ Hold firmware | `HydroControl.cpp` — 17/jun/2026 |
| `water_level_ok` en Auto EC/pH | ✅ Implementado | `isAutoDosingPausedByInterlock()` |
| Schema schedule vs DecisionRule | ⚠️ | `relay_id` vs `relay_ids[]` |
| Recirc post-dosis → bomba slave | ✅ Fase 4 + RelayCoordinator | Mutex P4 vs recirc §10.5 |
| Verdad relés distribuidos | Fragmentada (master / slave / UI) | **RelayCoordinator** Fase 5 | `RelayCoordinator.cpp` |

**Advertencia obligatoria:** Decision Engine secuencial en ESP32 **~35%** ([HANDOFF_CHECKPOINT_JUN2026.md](../../HANDOFF_CHECKPOINT_JUN2026.md)). Validar **toda** secuencia Drain/Changeout en bancada antes de producción crítica.

---

## 9. Roadmap mínimo (simplicidad primero)

### Fase 0 — Solo documentación ✅

Este handoff S01. Sin código nuevo.

### Fase 1 — Operación manual documentada

Procedimiento operativo (sin features):

1. Configurar Auto EC + Auto pH **una vez** al inicio del ciclo (setpoints en `/automacao`).
2. Crear 3 familias de scripts P1 con `rule_id` fijos: `INITIAL_FILL_*`, `CHANGEOUT_W*_W*`, `DRAIN_FULL`.
3. Encadenar Changeout → Fill vía `chained_events` (ver §4.3).
4. Tras Initial Fill: activar Auto EC/pH cuando nivel estable (§7).
5. ~~Durante P1 activo: desactivar temporalmente Auto EC/pH~~ — sustituido por hold firmware (Fase 2).

### Fase 2 — Interlock firmware (simple, alto valor) — **implementado 17/jun/2026**

En [`ESP-HIDROWAVE-main/src/HydroControl.cpp`](../../../ESP-HIDROWAVE-main/src/HydroControl.cpp):

- `isAutoDosingPausedByInterlock()` — pausa si `!tankLevelOk` **o** hold P1 activo.
- `holdAutoDosingForTankScript(ms)` — extendido por comandos `rule` con `priority >= 80` ([`HydroSystemCore::processRuleCommand`](../../../ESP-HIDROWAVE-main/src/HydroSystemCore.cpp)) y reglas locales ([`DecisionEngine::evaluateAllRules`](../../../ESP-HIDROWAVE-main/src/DecisionEngine.cpp)).
- `checkAutoEC()` / `checkAutoPH()` hacen `return` temprano si el interlock está activo (log cada 60 s en serial).

Constantes: [`Config.h`](../../../ESP-HIDROWAVE-main/include/Config.h) — `TANK_SCRIPT_PRIORITY_THRESHOLD` (80), holds mín/default/buffer.

**Serial esperado:**

```
🔒 [INTERLOCK P1] Auto EC/pH pausados ~120 s (script tanque priority >= 80)
⚠️ [AUTO EC] Pausado — script tanque P1 activo
⚠️ [AUTO PH] Pausado — nível de água baixo (water_level_ok=false)
```

Criterio cumplido: Auto EC/pH pueden permanecer `auto_enabled=true`; no hace falta togglear RPC en cada changeout.

### Fase 3 — chained_events → activar controladores (opcional)

Solo si Fase 2 no basta para el flujo post-fill automático.

Extensión mínima — **no** nuevo tipo de acción en UI:

```json
{
  "target_rule_id": "ACTIVATE_CONTROLLERS",
  "trigger_on": "success",
  "delay_ms": 300000,
  "side_effect": "rpc:activate_auto_ec,activate_auto_ph"
}
```

- Una regla fantasma `ACTIVATE_CONTROLLERS` reutilizable.
- RPC desde frontend executor o Supabase Edge — **no** desde ESP32.
- Máximo 1 regla, no RPC por cada changeout.

### Fase 4 — Recirculación física post-dosis (futuro, **obligatorio**)

**Estado hoy:** Auto EC y Auto pH entran en estado `RECIRCULATING` tras dosar y cuentan `tempo_recirculacao` segundos **sin mandar ningún relé**. La UI muestra badge «Recirculando…» desde `relay_master.ec_operation_*` / `ph_operation_*` — es **espera lógica**, no confirmación de bomba ON. La bomba de circulación real solo la acciona **P4** (`SCHEDULE_*` → `relay_commands` → `trustedSlaves` → ESP-NOW → `relay_slaves`).

**Por qué hay que cambiarlo:** Aurora/Nuravine asumen mezcla activa tras cada dosis. Con dead-time puro, el operador depende de que P4 ya tenga la bomba en marcha o de mezcla pasiva — insuficiente para undershoot post-fill y para ciclos sin schedule P4 superpuesto.

**Objetivo Fase 4:** al entrar en `RECIRCULATING` (EC o pH), el master **enciende** el relé de circulación configurado (típicamente slave relay 6/7) vía `MasterSlaveManager::sendRelayCommandToSlave` + `getAllTrustedSlaves()`; al expirar el timer, **apaga** el relé. Coordinar con P4 para no pelear ON/OFF (prioridad o mutex de «dueño» del relé circulación).

```mermaid
sequenceDiagram
  participant HC as HydroControl
  participant MSM as MasterSlaveManager
  participant Slave as Slave circulacion
  participant P4 as SCHEDULE P4

  Note over HC: Hoy Fase 0-3
  HC->>HC: RECIRCULATING timer solo

  Note over HC,Slave: Fase 4 objetivo
  HC->>MSM: ON relay circ slave MAC
  MSM->>Slave: ESP-NOW
  Slave-->>MSM: ACK
  HC->>HC: esperar tempo_recirculacao
  HC->>MSM: OFF relay circ
  Note over P4: Mutex con P4 si schedule activo
```

**Archivos a tocar (referencia futura):**

| Área | Archivo |
|------|---------|
| Máquina estados EC/pH recirc | [`HydroControl.cpp`](../../../ESP-HIDROWAVE-main/src/HydroControl.cpp) — `RECIRCULATING`, `PH_RECIRCULATING` |
| Envío slave | [`HydroSystemCore.cpp`](../../../ESP-HIDROWAVE-main/src/HydroSystemCore.cpp) — reutilizar patrón `processManualCommand` / ESP-NOW |
| Lista slaves | [`MasterSlaveManager`](../../../ESP-HIDROWAVE-main/src/MasterSlaveManager.cpp) — `getAllTrustedSlaves()` |
| Config relé circ | NVS/Supabase — nuevo campo ej. `circulation_slave_mac` + `circulation_relay_id` (o reutilizar allocation doc) |
| UI estado | [`useEcOperationState`](../../src/hooks/useEcOperationState.ts), [`usePhOperationState`](../../src/hooks/usePhOperationState.ts) — opcional: distinguir «recirc timer» vs «bomba ON confirmada» |
| Mutex P4 | [`relay-allocation.ts`](../../src/lib/relay-allocation.ts), reglas `SCHEDULE_*` priority 20–40 |

**Criterios de aceptación Fase 4:**

1. Tras dosaje Auto EC o pH, bomba circulación slave ON dentro de &lt; 2 s (ACK ESP-NOW o timeout documentado).
2. Al fin de `tempo_recirculacao`, bomba OFF salvo que P4 tenga pulso activo (no apagar si P4 «posee» el relé).
3. Badge UI coherente: recirc post-dosis no confundirse con pulso P4 independiente (§10.5).
4. Bancada §10.5 ampliada: verificar ON/OFF físico en slave durante recirc Auto EC/pH.

**Scope mínimo:** no unificar Auto EC + pH en un solo comando de circulación en v1 — puede ser el mismo relé con refcount o «último timer gana»; documentar en implementación.

**Estado implementación:** Fase 4 en firmware vía `RelayCoordinator::startPostDoseRecirc` / `endPostDoseRecirc` (requiere NVS `circ_slave_mac` + `circ_relay_id`).

### Fase 5 — RelayCoordinator (Actuator Arbiter) — **implementado**

**Problema:** `trustedSlaves` hoy es directorio + cache + transporte ESP-NOW. Auto EC/pH, P4 y comandos manuales actuaban por caminos distintos sin árbitro único ni mutex en bomba de circulación compartida.

**Solución:** módulo **`RelayCoordinator`** en ESP32 master — capa Plant I/O mínima (no segundo Decision Engine).

```mermaid
flowchart TB
  subgraph consumers [Consumidores]
    AutoEC[HydroControl recirc EC/pH]
    P4[processRuleCommand]
    Manual[processManualCommand]
    DE[DecisionEngine]
  end
  subgraph coord [RelayCoordinator]
    Owner[owner + refCount circulación]
    Observed[TrustedSlave + relayStates master]
    Exec[PCF2 + ESP-NOW]
  end
  AutoEC --> Owner
  P4 --> Owner
  Manual --> Owner
  DE --> Owner
  Owner --> Exec
  Observed --> Owner
```

**API mínima (firmware):**

| Método | Uso |
|--------|-----|
| `requestActuation(owner, target, on/off, durationSec)` | Puerta única ON/OFF master o slave |
| `getObservedState(target)` | Lee `hydroControl.getRelayStates()` o `TrustedSlave.relayStates[]` |
| `getOwner(circTarget)` | Dueño actual bomba circulación (mutex P4 vs recirc) |
| `startPostDoseRecirc` / `endPostDoseRecirc` | Fase 4 — ON/OFF al entrar/salir `RECIRCULATING` |

**Archivos:**

| Área | Archivo |
|------|---------|
| Coordinador | [`RelayCoordinator.h`](../../../ESP-HIDROWAVE-main/include/RelayCoordinator.h), [`RelayCoordinator.cpp`](../../../ESP-HIDROWAVE-main/src/RelayCoordinator.cpp) |
| Integración | [`HydroSystemCore.cpp`](../../../ESP-HIDROWAVE-main/src/HydroSystemCore.cpp) |
| Recirc callback | [`HydroControl.cpp`](../../../ESP-HIDROWAVE-main/src/HydroControl.cpp) |
| Reglas locales | [`DecisionEngine.cpp`](../../../ESP-HIDROWAVE-main/src/DecisionEngine.cpp) |
| Config NVS | claves `circ_slave_mac`, `circ_relay_id` (default relay 7) |

**Verdad operativa:** coordinador + `TrustedSlave` en master. **Espejo cloud:** `syncAllRelayStatesToSupabase()` sin cambiar rol.

**Qué NO hace:** setpoints EC/pH, interlocks P1 (`holdAutoDosingForTankScript`), poll Supabase para decidir ON/OFF en tiempo real.

### Explícitamente fuera de scope

- UI calendario 12 semanas
- Tipo acción “Sensor Valve” o “FillAndDose” monolítica
- Auto-setpoint por semana en BD
- Togglear Auto EC/pH en cada regla individual

---

## 10. Checklist bancada

Ejecutar en `ESP32_HIDRO_269844` (o device de prueba) antes de automatizar changeout en producción.

### 10.1 Initial Fill

- [ ] Trigger circadian 8–9 am dispara script (o disparo manual equivalente).
- [ ] Priming: válvula fill abre; para a >20% o timeout 10 min; válvula queda abierta.
- [ ] Circulación ON tras encadenamiento.
- [ ] Fill hasta 80% o 20 min; válvula cierra al final.
- [ ] Delay mix completado; **sin** filas `nutrient_dosages` durante fase fill (EC no dosifica en fill).
- [ ] Tras activar Auto EC/pH: primera dosagem solo después de delay + idle.

### 10.2 Changeout con Auto EC/pH ON

- [ ] Con Auto EC/pH activos, disparar `CHANGEOUT_W01_W02`.
- [ ] Durante drain parcial: **sin** dosaje no deseado (hold P1 en serial).
- [ ] ~~Si hubo dosaje: desactivar Auto EC/pH manual~~ — solo si firmware pre-17/jun.
- [ ] `chained_events` dispara `INITIAL_FILL_DOSE` tras drain.
- [ ] Post-fill: EC/pH corrigen undershoot dentro de tolerancia en < 3 ciclos.

### 10.3 Drain Rule

- [ ] Circulación OFF antes de drain pump ON.
- [ ] Drain hasta `level_4 == vazio` o timeout 15 min.
- [ ] Delays 1 min ejecutados (serial / rule_executions si disponible).
- [ ] Toggle final drain 1 min ON luego OFF.
- [ ] Válvula drain cerrada al final; bombas OFF.
- [ ] Auto EC/pH desactivados manualmente antes del drain total.

### 10.4 Timeout sensor valve (patrón WHILE)

- [ ] Simular sensor nivel pegado: script aborta por `max_duration_ms`, no loop infinito.
- [ ] Válvulas en estado seguro tras timeout (documentar estado observado).

### 10.5 Convivencia P4 + P1 + P2/P3 + RelayCoordinator

- [ ] `SCHEDULE_*` circulación (priority 25) no bloquea script P1 (priority 85+).
- [ ] Durante recirc Auto EC/pH: serial `[COORD] Post-dose recirc ON` y relé circulación slave ON (si `circ_slave_mac` configurado en NVS).
- [ ] Al fin de `tempo_recirculacao`: serial `[COORD] Post-dose recirc OFF` — bomba OFF **solo si** owner recirc (P4 activo no debe apagarse: `[COORD] release skipped`).
- [ ] `getObservedState` slave: `relay_slaves` coherente con ACK ESP-NOW tras recirc ON (poll ≤10 s).
- [ ] Badge UI recirc post-dosis no implica pulso P4 independiente (estados distintos en `ec_operation_*` vs `relay_slaves`).
- [ ] Sin conflicto `relay-allocation` en válvulas compartidas (ver `src/lib/relay-allocation.ts`).
- [ ] P4 ON durante recirc post-dosis: refcount owner — no OFF prematuro al terminar timer EC/pH.

### 10.6 Gates de cierre

- [ ] `node scripts/verify-e2e-schema.js` OK (si se valida telemetría post-proceso).
- [ ] Decision Engine: al menos un `rule_executions` o equivalente serial por script probado.
- [ ] Documentar desviaciones en issue/checkpoint.

### 10.7 Verificación interlocks firmware (post 17/jun/2026)

Ejecutar con Auto EC/pH **ON** (`auto_enabled=true`) — ya no hace falta desactivar manualmente antes de P1.

| Escenario | Acción | Serial / resultado esperado |
|-----------|--------|----------------------------|
| Nivel bajo | Simular `water_level_ok=false` (MQTT o tanque vacío) | `[AUTO EC] Pausado — nível de água baixo` y sin filas nuevas en `nutrient_dosages` / `ph_dosages` |
| Comando rule P1 | Enviar `relay_commands` con `command_type=rule`, `priority=80+` | `🔒 [INTERLOCK P1] Auto EC/pH pausados` |
| Post-hold | Esperar fin del hold (~120 s default) | Auto EC/pH reanudan evaluación en siguiente `intervalo_auto_*` |
| Changeout | Disparar script drenaje+fill con priority 85 | Sin dosaje químico durante ventana hold |
| UI dev | `npm run dev` — panel pH sin candado inicial | Controles editables sin contraseña admin |

- [ ] Nivel bajo bloquea dosaje (§10.7 fila 1).
- [ ] Comando rule priority ≥ 80 activa hold P1 (§10.7 fila 2).
- [ ] Tras hold, corrección química normal (§10.2 post-fill).

---

## 13. Mapa de interlocks — ahora vs después (17/jun/2026)

Un **interlock** es una regla del tipo «no hagas X hasta que Y». Protege el sistema; en bancada puede confundir si la doc y el código no coinciden.

### Resumen en lenguaje llano

| | **Antes (jun/2026)** | **Después (implementado / objetivo)** |
|---|----------------------|----------------------------------------|
| Avisos UI pH | Banners ámbar (preview diverge, ESP neste ciclo) | Eliminados — solo badges + debug JSON |
| Auto EC/pH en P1 | Operador apagaba manualmente | Hold automático si `priority >= 80` |
| Nivel bajo | UI decía «bloqueado» pero firmware dosaba igual | `checkAutoEC`/`checkAutoPH` respetan `tankLevelOk` |
| G5 EC↔pH | Relajado en dev (`PH_PROTOTYPE_RELAX_GUARDS=1`) | Prod: pH espera EC idle (`=0`) |
| Candado pH UI | Bloqueado por default | Dev: desbloqueado; prod: operador elige |
| Matriz relés | Bloquea selects conflictivos | Se mantiene — seguridad hardware |

### Firmware — tabla detallada

| Interlock | Ahora | Después | Archivo |
|-----------|-------|---------|---------|
| G5 EC→pH | Relajado (dev) | Activo en prod | `HydroControl.cpp`, `Config.h` |
| Sensores inválidos | Relajado (`HIDRO_DEV_RELAX_SENSORS=1`) | Estricto en prod | `checkAutoEC`, `checkAutoPH` |
| `water_level_ok` | Solo Decision Engine | **+ Auto EC/pH** | `isAutoDosingPausedByInterlock()` |
| P1 vs P2/P3 | Manual OFF | **Hold automático** | `holdAutoDosingForTankScript()` |
| `ph_low_control` | Off si Auto pH ON | Igual | `DecisionEngine.cpp` |
| Recirc post-dosis | ON/OFF slave vía RelayCoordinator | Mutex owner P4 vs recirc | `RelayCoordinator`, `tempo_recirculacao` |
| Verdad relés distribuidos | Fragmentada | **RelayCoordinator** unifica actuación | `RelayCoordinator.cpp` |

### UI — tabla detallada

| Interlock | Ahora | Después |
|-----------|-------|---------|
| Candados admin EC/Reglas | Desbloqueados por default | Igual; prod puede bloquear con admin |
| Candado panel pH | Bloqueado por default | **Dev: desbloqueado** (`PhControllerPanel`) |
| `relay-allocation` | Conflictos en selects | Se mantiene |
| `canActivateAutoEc` | Requiere nutrientes | Se mantiene |

### Qué NO relajar

1. No dosar con tanque vacío (`tankLevelOk`).
2. P1 pausa dosaje químico (hold priority ≥ 80).
3. G5 en producción.
4. Matriz de relés (un relé, un dueño).
5. Mutex `ph_low_control` vs Auto pH.

---

## 11. Referencias cruzadas

| Doc | Uso |
|-----|-----|
| [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) | Eventos vs métricas EC/pH |
| [ph/S09_EC_PH_COORDINACAO.md](../ph/S09_EC_PH_COORDINACAO.md) | Poll vs dosaje; G5 |
| [HANDOFF_CHECKPOINT_JUN2026.md](../../HANDOFF_CHECKPOINT_JUN2026.md) | Macro Decision Engine |
| [ARQUITETURA_DECISION_RULES_COMPLETA.md](../../../ARQUITETURA_DECISION_RULES_COMPLETA.md) | Schema completo |
| `/processos` UI | Stack P1–P4 operador |

---

## 12. Criterios de éxito de este handoff

- [x] Un dev traduce pantallas Aurora (Fill, Drain, Changeout) a JSON `decision_rules` sin adivinar.
- [x] Queda claro qué es manual hoy vs roadmap Fase 1–4.
- [x] Fase 4 documentada: recirc física post-dosis vía slave (obligatoria futura; hoy dead-time + P4).
- [x] Fase 5 RelayCoordinator documentada e implementada en firmware master.
- [x] No se promete UI schedule multi-semana ni tipos de acción nuevos.
- [x] Checklist bancada §10 reproducible antes de changeout en producción.

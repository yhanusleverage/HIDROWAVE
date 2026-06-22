# S05 — Flujo ciclo adaptativo pH

**Prerequisito:** [S04](S04_FLUJO_POLL_CONFIG.md) poll OK  
**Duración estimada:** 15 min  
**Siguiente:** [S06_CALIBRATION_UI.md](S06_CALIBRATION_UI.md)

---

## Máquina de estados

| Estado | Nombre UI | Transición |
|--------|-----------|------------|
| `PH_IDLE` | idle / Próxima verificación | → `PH_DOSING` si `checkAutoPH` dosifica |
| `PH_DOSING` | Dosando | OFF relé → `PH_RECIRCULATING` |
| `PH_RECIRCULATING` | Aguardando recirculação | timeout → `finishPhRecirculation` → `PH_IDLE` |

Estado remoto `ph_check_pending`: countdown hasta próximo `checkAutoPH` (`getPhNextCheckInSec`).

Código: `HydroControl::processPhAutoState`, `checkAutoPH`, `startPhAutoDosage`, `emitPhDoseEvent`.

---

## Ciclo `checkAutoPH`

1. Guards: `autoPHEnabled`, `phAutoState == PH_IDLE` (interlock EC omitido si `PH_PROTOTYPE_RELAX_GUARDS=1`).
2. Intervalo: `autoPHIntervalSeconds` desde último check.
3. Lectura pH finita (NaN/Inf rechazados).
4. `needsAdjustment` vs tolerancia → si OK, reset contador consecutivo.
5. `selectPath` → ácido/base.
6. `planDose` (dominio H, ver S03).
7. `startPhAutoDosage` → relé ON (`phCycleDurationMs`).

Serial (paridad EC):

```
🤖 === CONTROLE AUTOMÁTICO pH ===
🚀 [DOSAGEM pH] Iniciando: ...
🔴 [DOSAGEM pH] Relé N DESLIGADO após Xs
⏳ [RECIRC] Aguardando N s (tempo_recirculacao)...
💾 [PH K] PATCH k_acid/k_base post-recirc
✅ SEQUÊNCIA pH COMPLETA
```

---

## Transporte por fase

| Momento | Canal | Acción |
|---------|-------|--------|
| Relay OFF (`PH_DOSING` end) | MQTT `ph_dose` o HTTPS | INSERT `ph_dosages` — [`handlePhDoseEvent`](../../../../ESP-HIDROWAVE-main/src/HydroSystemCore.cpp) |
| Fin recirc (`finishPhRecirculation`) | NVS + HTTPS | `updateGainAfterDose` → [`handlePhGainLearned`](../../../../ESP-HIDROWAVE-main/src/HydroSystemCore.cpp) PATCH `k_acid`/`k_base` |
| Siempre | MQTT `ph_operation` o HTTPS | `ph_operation_*` |

---

## Heartbeat operación

`HydroSystemCore::loop` — espejo EC:

- Ciclo activo (dosing/recirc/ph_check_pending): sync cada **12 s**.
- Idle: sync cada **30 s** (limpia estado huérfano en Supabase).

---

## Verificar (gate)

- [ ] **Producción** (`PH_PROTOTYPE_RELAX_GUARDS=0`): con EC secuencial activo, serial muestra `EC sequencial ativo — adiando dosagem pH`.
- [ ] **Prototipo** (default `PH_PROTOTYPE_RELAX_GUARDS=1`): gate interlock EC **N/A** — pH puede dosar en paralelo; ver [S09](S09_EC_PH_COORDENACAO.md).
- [ ] Tras recirc, serial `💾 [PH K] PATCH k_acid/k_base post-recirc`; Supabase K coincide con NVS.
- [ ] `ph_operation_state` cambia dosing → recirculating → idle.

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| No dosifica | Auto OFF, pH en banda, o interlock EC |
| Sin INSERT | Ver S07 MQTT o HTTPS memoria |
| K no actualiza | PATCH falló — serial `PATCH k_acid/k_base falhou` o sin `💾 [PH K] post-recirc` |

---

## Siguiente

[S06 — Calibragem UI](S06_CALIBRATION_UI.md)

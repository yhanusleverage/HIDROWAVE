# Ingeniería HIDROWAVE — Índice vivo

> Visión Master / Eng Manager.  
> Estado: **activo** — Jul 2026  
> Objetivo: gobernar ~1.000 PF / ~8.000–9.000 HH de reposición con indicadores P, contrato congelado y escopo por jobs.

## Documentos

| # | Doc | Todo plan | Estado |
|---|-----|-----------|--------|
| 01 | [P Baseline — indicadores](01_P_BASELINE.md) | `p-baseline` | Definido + plantilla 2 semanas |
| 02 | [Contrato dispositivo](02_CONTRATO_DISPOSITIVO.md) | `contrato-dispositivo` | Congelado v1 |
| 03 | [Firmware bounded contexts](03_FIRMWARE_BOUNDED_CONTEXTS.md) | `firmware-bounded` | Plan de desacople |
| 04 | [Backlog por jobs](04_BACKLOG_JOBS_USUARIO.md) | `escopo-jobs` | Prioridad + freeze |
| 05 | [Definition of Done](05_DEFINITION_OF_DONE.md) | `dod-capas` | Por capa |
| 06 | [Top 5 cambios estructurales](06_CAMBIOS_ESTRUCTURALES_TOP5.md) | entregable | Priorizado |
| — | [HMI ↔ Web paridad F0](../handoffs/HMI_WEB_PARITY_F0.md) | `hmi-web-parity` | Congelado 12/08/2026 |

Plantilla de medición: [`p-baseline-log.csv`](p-baseline-log.csv)

## Mapa de owners por capa

| Capa | Owner técnico | Fuentes canónicas | No tocar sin DoD |
|------|---------------|-------------------|------------------|
| **Firmware control** | Firmware lead | `ESP-HIDROWAVE-main` → `HydroControl.*` | Lazo EC/pH/nivel/flujo |
| **Firmware orquestación** | Firmware lead | `HydroSystemCore.*`, `main.cpp` | Solo adapters / wiring |
| **Firmware mesh** | Firmware lead | `ESPNow*`, `MasterSlaveManager.*` | Comandos slave ACK |
| **Cloud MQTT** | Cloud/bridge | `infra/mqtt`, docs `ESP-HIDROWAVE-main/docs/mqtt/` | Topics v1 |
| **Cloud datos** | Backend | Supabase SQL + RPC en `HIDROWAVE-main/scripts/` | Schema hydro/relay |
| **Frontend dominio** | Frontend lead | `HIDROWAVE-main/src/lib/` | SDK; UI no inventa reglas |
| **Frontend UI** | Frontend lead | `src/components`, `src/app` | Jobs críticos primero |
| **Ingeniería / P** | Eng Manager | esta carpeta `docs/engineering/` | Baseline semanal |

## Repos

| Repo | Rol |
|------|-----|
| `HIDROWAVE-main` | Next.js + API + SQL + docs de producto |
| `ESP-HIDROWAVE-main` | Firmware ESP32 Master (PlatformIO) |

## Regla de oro

No abrir gran refactor sin **baseline P ≥ 2 semanas** registradas en `p-baseline-log.csv`.  
Medir → priorizar cuello → cambiar una capa → re-medir.

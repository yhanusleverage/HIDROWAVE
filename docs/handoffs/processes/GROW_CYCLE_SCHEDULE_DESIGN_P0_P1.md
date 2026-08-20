# Grow Cycle — Schedules P4 UI (P0 baseline / P1 redesign)

**Data:** jul 2026  
**Rota:** `/processos/timeline-cultivo`  
**Relacionado:** [GROW_CYCLE_TIMELINE_IMPLEMENTATION.md](./GROW_CYCLE_TIMELINE_IMPLEMENTATION.md)

---

## 1. Objetivo

Documentar o visual **P0** (baseline legado) e o redesign **P1** dos agendamentos P4 (TIME) na timeline de cultivo — circulação, UC Roots e futuros schedules custom.

---

## 2. Baseline P0 (preservado)

### Carril P4 no chart

```
P4  | ⟳ 2h | ⟳ 2h | ... | ⟳ 2h + UC Dom | ... | ⟳ 2h
     text-[8px] text-cyan-400/80
```

- Sem chip, sem ícone Heroicon, sem distinção visual entre tipos
- Labels hardcoded: `Circulação` → `⟳ 2h`, outro → `UC Dom`
- Label carril: `P4` em `text-dark-textSecondary`

### Painel semana

- `SectionHeader accent="neutral"`
- Lista texto: `ruleId — label (cadence)`

### Log simulação

- P4 em `text-dark-textSecondary` (menos destaque que P1–P3)

### Critérios de regressão P0

Ativar com `?scheduleUi=p0` na URL:

1. Carril P4 mostra apenas texto 8px ciano
2. Painel semana lista plana sem chips
3. Comportamento funcional inalterado (dados, simulação, seleção de semana)

---

## 3. Redesign P1

### Princípios

- Alinhar a [`design-tokens.ts`](../../../src/lib/design-tokens.ts) (`HW_BADGE`, `HW_TEXT`, `HW_BG_SUBTLE`)
- Acento P4 = `wait` (ciano) — já usado em `/processos` no sidebar
- WCAG 1.4.1: cor + ícone + label (nunca só cor)
- Progressive disclosure: compact no chart, detail no painel

### Paleta por `ScheduleKind`

| Kind | Uso | Acento HW | Hex ref | Ícone |
|------|-----|-----------|---------|-------|
| `circulation` | Recorrente (every 2h) | `wait` | `#22d3ee` | ArrowPath |
| `maintenance` | Pontual (Dom 10:00) | `brand` | `#26c6da` | Clock |
| `custom` | Outros P4 | `neutral` | `#bae6fd` | CalendarDays |

### Componentes

| Componente | Ficheiro | Variante |
|------------|----------|----------|
| `ScheduleChip` | `src/components/grow-cycle/ScheduleChip.tsx` | `compact` / `detail` |
| `ScheduleLaneRow` | `src/components/grow-cycle/ScheduleLaneRow.tsx` | carril P4 no chart |
| Tokens | `src/lib/grow-cycle-timeline/schedule-tokens.ts` | `resolveScheduleKind`, classes |

### Wireframe P1 (carril)

```
P4 · Agendamentos │ [⟳ Circ·2h] │ [⟳ Circ·2h] │ ... │ [⟳ Circ·2h] │
                  │             │             │     │ [🕐 UC Dom] │
                  │ ▬▬▬▬▬▬▬▬▬▬ │ (mini-bar tracejada = recorrente)
```

### Flag de transição

```ts
// TimelineCultivoClient — query ?scheduleUi=p0|p1 (default p1)
scheduleUiVersion: 'p0' | 'p1'
```

---

## 4. Verificação QA

| # | Teste | Esperado P1 |
|---|-------|-------------|
| 1 | Carril P4 S0–S12 | Chips distintos circulation vs maintenance (S7) |
| 2 | Selecionar S7 | Painel “Agendamentos P4” com chips detail + ruleId |
| 3 | Legenda chart | Swatches circulation + maintenance |
| 4 | Log simulação | Entradas P4 em ciano (`HW_TEXT.wait`) |
| 5 | `?scheduleUi=p0` | Visual legado restaurado |
| 6 | Contraste | Chips legíveis em `dark-card`; ícone + texto presentes |

---

## 5. Fora de escopo P1

- Gantt interativo (arrastar barras)
- Persistência Supabase de schedules custom
- Publicar P4 → `decision_rules` (F2)

# Ciclo de cultivo — hover semanal (resumo, não laço live)

**Fecha:** 25/ago/2026  
**Índice:** [00_INDICE_SERIAL.md](00_INDICE_SERIAL.md)  
**Relacionado:** [GROW_CYCLE_TIMELINE_IMPLEMENTATION.md](GROW_CYCLE_TIMELINE_IMPLEMENTATION.md) · [S01_GROW_CYCLE_RULES_17JUN2026.md](S01_GROW_CYCLE_RULES_17JUN2026.md)

---

## 1. Problema

En el gráfico de semanas (S0…Sn), el tooltip al pasar el ratón mezclaba **receta de esa semana** con **EC/pH agora** del tanque (y “última dosagem 24 h”).

Eso no tiene sentido: S5 no está ocurriendo ahora. “Atual” copiado en todas las barras mentía.

**Alcance:** solo el **hover del gráfico**, no las cards de detalle debajo.

---

## 2. Contrato del hover (congelado)

| Semana | Qué mostrar |
|--------|-------------|
| **Futura** | Alvo EC / pH + filas **Queda** e **médio** (— até a semana começar) |
| **Atual** | Alvo + queda/Δ + médio + ml + nº ajustes **desta semana até agora** |
| **Passada** | Idem, ventana completa de 7 días |

**No mostrar:** EC/pH live, erro vs sensor agora, última dosis 24 h, badge “Ao vivo / Simulado” como si fuera Auto EC.

**Δ** = último valor − primeiro valor na janela (`queda N` se negativo, `+N` se subiu).

---

## 3. Campos EC / pH

**EC**

- Alvo (`plan.weeks[].ecSetpointUsCm`)
- Δ EC da semana
- EC médio
- ml nutrientes (total + GROW/BLOW/YULEH)
- nº ajustes (`sequence_id` distintos em `nutrient_dosages`)

**pH**

- Alvo
- Δ pH
- ml pH+ / pH−
- nº ajustes (`ph_dosages` com ml > 0)

---

## 4. Janela de tempo

```text
start = grow_cycle_instances.started_at + weekIndex × 7d
end   = min(start + 7d, now)   ← semana atual corta em agora
```

Sem `started_at` (preview / sem instância): só receta. Sem inventar “atual”.

Playhead / `current_week_index` define future vs current vs past.

---

## 5. Código

| Ficheiro | Papel |
|---------|--------|
| `src/lib/grow-cycle-timeline/simulation-engine.ts` | `WeekHoverMetrics`, `getWeekHoverRecipe` |
| `src/lib/grow-cycle-timeline/week-hover-summary.ts` | `weekTimeWindow` + `fetchWeekHoverStats` |
| `src/hooks/useGrowCycleWeekHoverMetrics.ts` | junta receta + fetch |
| `src/components/grow-cycle/GrowCycleWeekHoverTooltip.tsx` | UI |
| `GrowCycleTimelineChart.tsx` | passa `cycleStartedAt`, `currentWeekIndex` |
| `GrowCycleTimelinePanel.tsx` | `activeInstance.started_at` / `current_week_index` |

**Leituras (fail-soft se a tabela não existe):**

- `hydro_measurements` (Δ/médio; fallback `ec_controller_metrics` / `ph_controller_metrics`)
- `nutrient_dosages` (ml + ajustes EC)
- `ph_dosages` (ml + ajustes pH)
- fallback médio: `grow_cycle_weekly_stats.ec_avg` / `ph_avg`

**Não usar** `pump_quantity` (odómetro de vida, não da semana).

---

## 6. Verificar em bancada

1. Ciclo publicado com `started_at`.
2. Hover **semana futura** → só alvo.
3. Hover **semana atual** após uma dose EC → ml e ajustes > 0; Δ coerente com 1.º/último sample.
4. Hover **semana passada** → não muda se o tanque mudar agora.
5. Sem instância (preview) → só alvo, sem “simulado” de erro fake.

---

## 7. Aberto

- Métricas FIFO ~24 h: semanas antigas podem ficar sem Δ se `hydro_measurements` não retiver 7 d. Rollup `grow_cycle_weekly_stats` é o cold path.
- Preencher `dosages_summary` no job `compute_grow_cycle_weekly_stats` (hoje só médias EC/pH) para não re-sumar raw no hover.
- k EC aprendido (`k_value`) é outro tema: só actualiza se ΔEC ≥ 5 µS pós-recirc — ver serial `📈 [EC k]` vs `sem update`.

# Rule Builder — guia rápido (2 minutos)

**Pergunta principal:** onde crio regras de dreno, enchimento e ciclo?

Resposta curta: **existem 2 telas**. Use a **procedural** no dia a dia; use a **Nova Regra** só se precisar de script avançado.

---

## Os 2 editores — qual usar?

| | **Rule Builder procedural** | **Nova Regra** (Motor de Decisão) |
|---|---------------------------|-----------------------------------|
| **Onde** | `/automacao/procedimento` | Automação → Motor de Decisão → **Nova Regra** |
| **Para quem** | Operador / produtor | Técnico que quer controle fino |
| **Como pensa** | Passos numerados (1, 2, 3…) | Lista de instruções (Repetir enquanto, Se, Acionar relé…) |
| **Exemplo** | "Válvula por sensor" → encher até nível X | "Repetir enquanto nível ≠ vazio" + "Acionar relé" |
| **Templates** | Sim — Initial Fill, timeline Publicar | Não — monta tudo na mão |
| **Guardar** | Botão **Guardar** → Supabase | **Salvar Regra** no modal |

### Regra prática

- **Fill, dreno, changeout de ciclo** → vá em **`/automacao/procedimento`**
- **Loop aninhado, lógica rara, teste técnico** → **Nova Regra**

---

## Por que não aparece "while"?

O firmware usa `while` por baixo. **Na tela você não precisa ver esse nome.**

| O que você vê | O que o ESP32 recebe |
|---------------|----------------------|
| **Válvula por sensor** (procedural) | `while` + ligar relé |
| **Repetir enquanto** (Nova Regra) | `while` |
| **Acionar relé** | `relay_action` |
| **Aguardar** | `delay` |

Ou seja: **mesma ideia, nomes diferentes** — procedural esconde o jargão de programação.

---

## Rule Builder procedural — fluxo em 5 passos

1. Abrir `/automacao/procedimento` (link também no topo de Automação).
2. Escolher **dispositivo master**.
3. Carregar **Initial Fill** ou editar passos.
4. Revisar triggers (horário) e steps (válvula, relé, espera).
5. **Guardar** → grava em `decision_rules` no Supabase.

**Tipos de passo (nomes na tela):**

| Passo | Significado |
|-------|-------------|
| Válvula por sensor | Liga relé até sensor atingir condição (ex.: encher/drenar) |
| Ligar / desligar relé | Relé fixo ON ou OFF |
| Aguardar | Pausa em segundos (ex.: mistura) |
| Regra encadeada | Depois desta, dispara outra regra |

---

## Nova Regra — fluxo em 4 passos

1. Automação → Motor de Decisão → **Nova Regra**.
2. Seção **Passos do script** (sempre visível) → **Repetir enquanto** + **Acionar relé**.
3. Ou clique em *"Abrir Rule Builder procedural"* se preferir passos guiados.
4. **Salvar Regra**.

**Dreno típico:** Repetir enquanto (nível ≠ vazio) → Acionar relé (dreno ON).

---

## Onde fica cada coisa no app

```
Automação (/automacao)
├── Rule Builder — procedimento  →  /automacao/procedimento  ← USE ESTE no dia a dia
├── Motor de Decisão
│   └── Nova Regra (modal)       ← script avançado
└── Auto EC / pH                 ← outra coisa (dosagem), não é regra procedural

Processos (/processos)
└── Timeline → Publicar          ← gera regras P1 do ciclo 12 semanas
```

---

## Pendências (não bloqueiam uso)

- Dropdown master/slave melhor no editor de passos procedural
- Editor visual de regras encadeadas (chain)

---

## Referência técnica

Detalhes ISA-88, compilação e JSON: [DECISION_ENGINE_PROCEDURE_STANDARD.md](./DECISION_ENGINE_PROCEDURE_STANDARD.md)

Código dos rótulos: `src/lib/instruction-labels.ts` e `src/lib/rule-procedure/types.ts`

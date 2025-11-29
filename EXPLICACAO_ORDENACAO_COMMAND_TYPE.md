# 📚 EXPLICAÇÃO: Ordenação por `command_type` no SQL

## 🎯 Como Funciona a Ordenação

### **Código SQL:**

```sql
ORDER BY 
  CASE COALESCE(rc.command_type, 'manual')
    WHEN 'peristaltic' THEN 1
    WHEN 'rule' THEN 2
    WHEN 'manual' THEN 3
  END,
  COALESCE(rc.priority, 50) DESC,
  rc.created_at ASC
```

---

## 🔍 ANÁLISE PASSO A PASSO

### **1. `COALESCE(rc.command_type, 'manual')`**

**O que faz:**
- Se `command_type` for `NULL` → usa `'manual'` como padrão
- Se `command_type` tiver valor → usa o valor

**Exemplo:**
```sql
command_type = NULL        → COALESCE retorna 'manual'
command_type = 'peristaltic' → COALESCE retorna 'peristaltic'
command_type = 'rule'     → COALESCE retorna 'rule'
```

---

### **2. `CASE ... WHEN ... THEN`**

**O que faz:**
- Compara o valor de `command_type` com cada `WHEN`
- Retorna o número correspondente

**Mapeamento:**
```
'peristaltic' → 1  (Maior prioridade - processado primeiro)
'rule'        → 2  (Prioridade média)
'manual'      → 3  (Menor prioridade - processado por último)
```

**Exemplo:**
```sql
command_type = 'peristaltic' → CASE retorna 1
command_type = 'rule'        → CASE retorna 2
command_type = 'manual'      → CASE retorna 3
command_type = NULL          → COALESCE vira 'manual' → CASE retorna 3
```

---

### **3. Ordenação Completa**

```sql
ORDER BY 
  CASE ... END,              -- 1º critério: command_type (1, 2, ou 3)
  priority DESC,             -- 2º critério: priority (100 → 0)
  created_at ASC             -- 3º critério: created_at (mais antigo primeiro)
```

**Como funciona:**
1. **Primeiro:** Ordena por `command_type` (1 < 2 < 3)
   - Todos os `peristaltic` (1) vêm primeiro
   - Depois todos os `rule` (2)
   - Por último todos os `manual` (3)

2. **Segundo:** Dentro de cada tipo, ordena por `priority DESC`
   - `priority = 100` vem antes de `priority = 50`
   - `priority = 50` vem antes de `priority = 10`

3. **Terceiro:** Dentro da mesma prioridade, ordena por `created_at ASC`
   - Comando mais antigo vem primeiro

---

## 📊 EXEMPLO PRÁTICO

### **Comandos na Tabela:**

| ID | command_type | priority | created_at | Ordem Final |
|----|--------------|----------|------------|-------------|
| 1  | `manual`     | 100      | 10:00:00   | 7º          |
| 2  | `peristaltic`| 50       | 10:01:00   | 2º          |
| 3  | `rule`       | 80       | 10:02:00   | 4º          |
| 4  | `peristaltic`| 100      | 10:03:00   | 1º          |
| 5  | `manual`     | 50       | 10:04:00   | 8º          |
| 6  | `rule`       | 50       | 10:05:00   | 6º          |
| 7  | `peristaltic`| 30       | 10:06:00   | 3º          |
| 8  | `rule`       | 90       | 10:07:00   | 5º          |

### **Ordenação Resultante:**

```
1º: ID=4  (peristaltic, priority=100, 10:03:00)  ← Tipo 1, maior priority
2º: ID=2  (peristaltic, priority=50,  10:01:00)  ← Tipo 1, priority média, mais antigo
3º: ID=7  (peristaltic, priority=30,  10:06:00)  ← Tipo 1, menor priority

4º: ID=8  (rule,        priority=90,  10:07:00)  ← Tipo 2, maior priority
5º: ID=3  (rule,        priority=80,  10:02:00)  ← Tipo 2, priority média
6º: ID=6  (rule,        priority=50,  10:05:00)  ← Tipo 2, menor priority

7º: ID=1  (manual,      priority=100, 10:00:00) ← Tipo 3, maior priority
8º: ID=5  (manual,      priority=50,  10:04:00) ← Tipo 3, menor priority
```

---

## 🎯 POR QUE ESSA ORDENAÇÃO?

### **Lógica de Prioridade:**

1. **`peristaltic` (1) - MAIOR PRIORIDADE:**
   - Comandos de dosagem (bomba peristáltica)
   - Críticos para nutrição das plantas
   - Devem ser executados primeiro

2. **`rule` (2) - PRIORIDADE MÉDIA:**
   - Comandos de automação (regras)
   - Importantes, mas não críticos
   - Executados após peristaltic

3. **`manual` (3) - MENOR PRIORIDADE:**
   - Comandos do usuário (botão)
   - Menos críticos
   - Executados por último

---

## 💡 OBSERVAÇÃO IMPORTANTE

Você mencionou que **`peristaltic` é somente do Master**. Isso faz sentido porque:

- **Master:** Tem bomba peristáltica → pode dosar nutrientes
- **Slave:** Apenas relés → não tem bomba peristáltica

**Implicação:**
- `relay_commands_master` pode ter `command_type = 'peristaltic'`
- `relay_commands_slave` **NÃO** deve ter `command_type = 'peristaltic'`

**Sugestão:** Adicionar constraint no SQL:

```sql
-- Para relay_commands_master
ALTER TABLE relay_commands_master
  ADD CONSTRAINT command_type_master_check
  CHECK (command_type IN ('manual', 'rule', 'peristaltic'));

-- Para relay_commands_slave
ALTER TABLE relay_commands_slave
  ADD CONSTRAINT command_type_slave_check
  CHECK (command_type IN ('manual', 'rule'));  -- ✅ Sem 'peristaltic'
```

---

## 🔄 ALTERNATIVA: Ordenação Mais Simples

Se quiser simplificar, pode usar apenas `priority`:

```sql
ORDER BY 
  COALESCE(priority, 50) DESC,  -- Maior priority primeiro
  created_at ASC                 -- Mais antigo primeiro
```

**Vantagem:** Mais simples
**Desvantagem:** Não diferencia tipos (peristaltic pode ter mesma priority que manual)

---

## ✅ RESUMO

1. **`CASE` cria números:** `peristaltic=1`, `rule=2`, `manual=3`
2. **Ordena por números:** 1 vem antes de 2, que vem antes de 3
3. **Dentro de cada tipo:** Ordena por `priority DESC`
4. **Dentro da mesma priority:** Ordena por `created_at ASC`

**Resultado:** Comandos `peristaltic` sempre são processados primeiro, independente da priority numérica.





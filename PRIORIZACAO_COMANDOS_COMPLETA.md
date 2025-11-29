# 🎯 PRIORIZAÇÃO DE COMANDOS - FLUXO COMPLETO

## 📋 RESUMO EXECUTIVO

O sistema usa **3 níveis de priorização** para ordenar comandos:
1. **`command_type`** (categoria): `peristaltic` > `rule` > `manual`
2. **`priority`** (numérico 0-100): Maior valor = maior prioridade
3. **`created_at`** (temporal): Mais antigo primeiro (dentro da mesma prioridade)

---

## 🔄 FLUXO COMPLETO DE PRIORIZAÇÃO

### 1️⃣ **FRONTEND - Definição de Priority**

**Localização:** `HIDROWAVE-main/src/app/api/esp-now/command/route.ts`

#### Como funciona:

```typescript
// 1. Se priority foi enviado → usa o valor
let finalPriority = priority;

// 2. Se não foi enviado e é 'rule' → busca da regra
if (finalPriority === undefined && command_type === 'rule' && rule_id) {
  const ruleData = await supabase
    .from('decision_rules')
    .select('priority')
    .eq('rule_id', rule_id)
    .single();
  
  if (ruleData?.priority !== undefined) {
    finalPriority = ruleData.priority; // Usa priority da regra
  }
}

// 3. Se ainda não tem → usa defaults por command_type
if (finalPriority === undefined) {
  switch (command_type) {
    case 'peristaltic': finalPriority = 80; // Alta
    case 'rule':        finalPriority = 50; // Média
    case 'manual':      finalPriority = 10; // Baixa
  }
}
```

#### Defaults por tipo:

| Tipo | Priority Default | Quando Usar |
|------|-----------------|-------------|
| **`peristaltic`** | 80 | Dosagem de nutrientes (crítico) |
| **`rule`** | 50 (ou da regra) | Comandos de automação |
| **`manual`** | 10 | Comandos manuais do usuário |

#### Exemplo Frontend:

```typescript
// Comando manual (priority não enviada)
POST /api/esp-now/command
{
  command_type: 'manual',
  // priority não enviada → usa default: 10
}

// Comando de regra (priority da regra)
POST /api/esp-now/command
{
  command_type: 'rule',
  rule_id: 'RULE_123',
  // priority não enviada → busca de decision_rules
  // Se regra tem priority: 90 → usa 90
  // Se regra não tem → usa default: 50
}

// Comando manual de emergência (priority explícita)
POST /api/esp-now/command
{
  command_type: 'manual',
  priority: 95, // ✅ Usuário define alta prioridade
}
```

---

### 2️⃣ **SUPABASE - Ordenação na Query**

**Localização:** `HIDROWAVE-main/scripts/SCHEMA_COMPLETO_VALIDADO.sql`

#### Função SQL: `get_pending_commands()`

**Ordenação atual (CORRIGIDA):**

```sql
ORDER BY 
  -- 1. command_type (categoria): peristaltic > rule > manual
  CASE COALESCE(rc.command_type, 'manual')
    WHEN 'peristaltic' THEN 1
    WHEN 'rule' THEN 2
    WHEN 'manual' THEN 3
    ELSE 3
  END,
  -- 2. priority (numérico): maior = mais importante
  COALESCE(rc.priority, 50) DESC,
  -- 3. created_at (temporal): mais antigo primeiro
  rc.created_at ASC
```

#### Exemplo de ordenação:

**Comandos no Supabase:**
```
ID | command_type | priority | created_at
---|--------------|----------|------------
1  | manual       | 10       | 10:00:00
2  | peristaltic  | 80       | 10:01:00
3  | rule         | 50       | 10:02:00
4  | manual       | 95       | 10:03:00  ← Emergência manual
5  | peristaltic  | 90       | 10:04:00
```

**Ordem de processamento:**
1. **ID 5** - `peristaltic` priority 90 (10:04:00)
2. **ID 2** - `peristaltic` priority 80 (10:01:00)
3. **ID 4** - `manual` priority 95 (10:03:00) ← Emergência manual
4. **ID 3** - `rule` priority 50 (10:02:00)
5. **ID 1** - `manual` priority 10 (10:00:00)

---

### 3️⃣ **ESP32 EMBARCADO - Busca e Processamento**

**Localização:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

#### Como o ESP32 busca comandos:

**Atual (NÃO usa função SQL):**
```cpp
// Query direta - ordena apenas por created_at
String endpoint = String(SUPABASE_RELAY_TABLE) 
  + "?device_id=eq." + getDeviceID() 
  + "&status=eq.pending"
  + "&order=created_at.asc"  // ❌ PROBLEMA: Não ordena por priority!
  + "&limit=" + maxCommands;
```

**Problema:** O ESP32 está ordenando apenas por `created_at`, ignorando `command_type` e `priority`.

#### Solução recomendada:

**Opção 1: Usar função SQL (RECOMENDADO)**
```cpp
// Usar função get_pending_commands() que já ordena corretamente
String endpoint = "rpc/get_pending_commands";
String payload = "{\"p_device_id\":\"" + getDeviceID() + "\",\"p_limit\":" + maxCommands + "}";
```

**Opção 2: Query direta com ordenação correta**
```cpp
// Ordenar por command_type, priority DESC, created_at ASC
String endpoint = String(SUPABASE_RELAY_TABLE) 
  + "?device_id=eq." + getDeviceID() 
  + "&status=eq.pending"
  + "&order=command_type.asc,priority.desc,created_at.asc"
  + "&limit=" + maxCommands;
```

**Nota:** A ordenação por `command_type.asc` não funciona diretamente (precisa CASE). 
**Solução atual:** Ordenar por `priority.desc,created_at.asc` (prioridade numérica funciona bem).
**Ideal:** Usar função SQL `get_pending_commands()` que ordena corretamente por `command_type` + `priority`.

---

## 📊 DIAGRAMA DE FLUXO

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Usuário clica botão OU Regra dispara                 │  │
│  │                                                        │  │
│  │ POST /api/esp-now/command                            │  │
│  │ {                                                     │  │
│  │   command_type: 'manual' | 'rule' | 'peristaltic'   │  │
│  │   priority: 10-100 (opcional)                        │  │
│  │ }                                                     │  │
│  │                                                        │  │
│  │ ✅ Determina priority:                               │  │
│  │   - Se enviado → usa valor                          │  │
│  │   - Se rule → busca de decision_rules              │  │
│  │   - Senão → defaults (peristaltic:80, rule:50,      │  │
│  │              manual:10)                              │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │ INSERT                            │
└──────────────────────────┼───────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ relay_commands {                                    │  │
│  │   id: 136,                                         │  │
│  │   device_id: "ESP32_HIDRO_F44738",                 │  │
│  │   command_type: "manual",                          │  │
│  │   priority: 10,  ← ✅ Salvo no BD                  │  │
│  │   status: "pending",                                │  │
│  │   ...                                               │  │
│  │ }                                                    │  │
│  │                                                        │  │
│  │ ✅ Função get_pending_commands() ordena:            │  │
│  │   1. command_type (peristaltic > rule > manual)    │  │
│  │   2. priority DESC (maior = mais importante)        │  │
│  │   3. created_at ASC (mais antigo primeiro)         │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │ SELECT (ordenado)                │
└──────────────────────────┼───────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              ESP32 MASTER (Embarcado)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ A cada 5s: checkSupabaseCommands()                  │  │
│  │                                                        │  │
│  │ ✅ Busca comandos pendentes (ordenados)             │  │
│  │ ✅ Processa UM comando por vez                       │  │
│  │ ✅ Marca como 'sent' → depois 'completed'           │  │
│  │ ✅ Deleta após processar (ou mantém para histórico) │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 CORREÇÕES NECESSÁRIAS

### ❌ PROBLEMA ATUAL:

1. **Função SQL não usa `priority`:**
   - A função `get_pending_commands()` ordena apenas por `command_type` e `created_at`
   - Não inclui `priority` na ordenação

2. **ESP32 não usa função SQL:**
   - ESP32 faz query direta ordenando apenas por `created_at`
   - Ignora `command_type` e `priority`

### ✅ SOLUÇÕES:

#### 1. Atualizar função SQL (já feito no schema):

```sql
ORDER BY 
  CASE COALESCE(rc.command_type, 'manual')
    WHEN 'peristaltic' THEN 1
    WHEN 'rule' THEN 2
    WHEN 'manual' THEN 3
  END,
  COALESCE(rc.priority, 50) DESC,  -- ✅ ADICIONADO
  rc.created_at ASC
```

#### 2. ESP32 usar função SQL (RECOMENDADO):

```cpp
// Usar RPC call para get_pending_commands()
String endpoint = "rpc/get_pending_commands";
String payload = "{\"p_device_id\":\"" + getDeviceID() + "\",\"p_limit\":5}";
httpClient->POST(payload);
```

#### 3. Ou atualizar query direta do ESP32:

```cpp
// Ordenar manualmente após receber (menos eficiente)
// Ou usar função SQL (mais eficiente)
```

---

## 📝 EXEMPLO PRÁTICO

### Cenário: 5 comandos pendentes

**Comandos no Supabase:**
```json
[
  {id: 1, command_type: "manual", priority: 10, created_at: "10:00:00"},
  {id: 2, command_type: "peristaltic", priority: 80, created_at: "10:01:00"},
  {id: 3, command_type: "rule", priority: 50, created_at: "10:02:00"},
  {id: 4, command_type: "manual", priority: 95, created_at: "10:03:00"},
  {id: 5, command_type: "peristaltic", priority: 90, created_at: "10:04:00"}
]
```

**Ordem de processamento (CORRETA):**
1. **ID 5** - `peristaltic` priority 90 (dosagem crítica)
2. **ID 2** - `peristaltic` priority 80 (dosagem normal)
3. **ID 4** - `manual` priority 95 (emergência manual)
4. **ID 3** - `rule` priority 50 (automação)
5. **ID 1** - `manual` priority 10 (comando normal)

**Resultado:** Dosagens (`peristaltic`) são processadas primeiro, mesmo que comandos manuais tenham sido criados antes.

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Frontend define `priority` corretamente
- [x] Supabase armazena `priority` na tabela
- [x] Função SQL `get_pending_commands()` ordena por `priority`
- [ ] **ESP32 usar função SQL** (ou atualizar query direta)
- [ ] Testar ordenação completa

---

## 🚨 IMPORTANTE

**O ESP32 atualmente NÃO está usando a função SQL `get_pending_commands()`**, então a priorização não está funcionando corretamente no embarcado.

**Solução aplicada:** 
- ✅ ESP32 agora ordena por `priority.desc,created_at.asc`
- ✅ ESP32 parseia `priority` do JSON
- ✅ Logs de debug mostram ordem de processamento
- ⚠️ **Nota:** Ordenação por `command_type` ainda não está implementada na query direta (precisa usar função SQL ou ordenar no código após receber)


# 🔍 COMPARAÇÃO: Relay Command vs Decision Engine

## 🎯 **RESUMO RÁPIDO (TL;DR)**

**Relay Command:** Usuário clica botão → Relé liga ✅ (FUNCIONA 100%)

**Decision Engine:** Usuário cria regra → ESP32 verifica → Se condição verdadeira, ESP32 cria comando → Relé liga ⚠️ (FUNCIONA 60% - FALTA ESP32)

**Diferença:** Um é manual (botão), outro é automático (regra). Do comando em diante, são IDÊNTICOS!

---

## 📋 **VISÃO GERAL**

Este documento compara **estruturalmente** o sistema de Relay Commands (manual) com o Decision Engine (automático), identificando diferenças, semelhanças e o que precisa ser implementado.

---

## 🎯 **DIFERENÇAS PRINCIPAIS**

| Aspecto | **Relay Command** | **Decision Engine** |
|---------|------------------|---------------------|
| **Origem** | Usuário clica botão | Regra criada no frontend |
| **Trigger** | Imediato (onClick) | Condição avaliada pelo ESP32 |
| **Tabela Origem** | `relay_commands_slave` (direto) | `decision_rules` → `relay_commands_slave` |
| **Criação do Comando** | Frontend → Supabase (direto) | Frontend → Supabase → ESP32 cria comando |
| **Batch** | Até 5 comandos por vez | **1 regra por vez** (mais leve) |
| **triggered_by** | `'manual'` | `'rule'` ou `'automation'` |
| **command_type** | `'manual'` | `'rule'` |
| **RPC Buscar** | `get_and_lock_slave_commands()` ✅ | `get_active_decision_rules()` ⚠️ (FUTURO) |

---

## 📊 **ESTRUTURA DE DADOS**

### **1. Tabela: `relay_commands_slave`**

**Usado por AMBOS os sistemas:**

```sql
CREATE TABLE relay_commands_slave (
  id BIGINT PRIMARY KEY,
  master_device_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  master_mac_address TEXT NOT NULL,
  slave_device_id TEXT NOT NULL,
  slave_mac_address TEXT NOT NULL,
  
  -- ✅ ARRAYS (batch)
  relay_numbers INTEGER[] NOT NULL,
  actions TEXT[] NOT NULL,
  duration_seconds INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  
  -- ✅ DIFERENÇA: command_type
  command_type TEXT DEFAULT 'manual' CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  
  -- ✅ DIFERENÇA: triggered_by
  triggered_by TEXT DEFAULT 'manual',
  
  -- ✅ DIFERENÇA: Campos de regra (NULL para comandos manuais)
  rule_id TEXT,           -- NULL para manual, "RULE_001" para rule
  rule_name TEXT,         -- NULL para manual, "Ajustar pH" para rule
  
  priority INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ...
);
```

**Diferenças por tipo:**

| Campo | **Manual** | **Rule** |
|-------|-----------|----------|
| `command_type` | `'manual'` | `'rule'` |
| `triggered_by` | `'manual'` | `'rule'` |
| `rule_id` | `NULL` | `"RULE_001"` |
| `rule_name` | `NULL` | `"Ajustar pH quando baixo"` |
| `priority` | `10` (default) | `50` (da regra) |

---

### **2. Tabela: `decision_rules`**

**Usado APENAS pelo Decision Engine:**

```sql
CREATE TABLE decision_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  rule_id TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  
  -- ✅ JSON com condições e ações
  rule_json JSONB NOT NULL,
  
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'web_interface',
  
  CONSTRAINT fk_decision_rules_device 
    FOREIGN KEY (device_id) REFERENCES device_status(device_id)
);
```

**Estrutura do `rule_json`:**

```json
{
  "conditions": {
    "type": "sensor_compare",
    "sensor": "ph",
    "operator": "<",
    "value": 6.5
  },
  "actions": [
    {
      "type": "relay_on",
      "slave_mac_address": "14:33:5C:38:BF:60",
      "relay_number": 0,
      "duration_seconds": 60
    }
  ]
}
```

---

## 🔄 **FLUXO COMPARATIVO**

### **Relay Command (Manual)**

```
1. Frontend → POST /api/esp-now/command
2. API → createRelayCommand()
3. Supabase → INSERT em relay_commands_slave
   - command_type: 'manual'
   - triggered_by: 'manual'
   - status: 'pending'
4. ESP32 → RPC get_and_lock_slave_commands()
5. ESP32 → processRelayCommand()
6. ESP32 → sendRelayCommandToSlave() (ESP-NOW)
7. Slave → Executa relé físico
8. Slave → ACK → Master
9. Master → markCommandCompleted()
10. Supabase → UPDATE status='completed'
```

### **Decision Engine (Automático)**

```
1. Frontend → POST /api/automation/rules
2. API → createDecisionRule()
3. Supabase → INSERT em decision_rules
   - enabled: true
4. ESP32 → RPC get_active_decision_rules() ⚠️ (FUTURO)
5. ESP32 → evaluateAllRules()
   - Avalia condições
   - Verifica cooldown
   - Verifica safety constraints
6. ESP32 → createSlaveCommandFromRule() ⚠️ (FUTURO)
7. Supabase → INSERT em relay_commands_slave
   - command_type: 'rule'
   - triggered_by: 'rule'
   - rule_id: "RULE_001"
   - status: 'pending'
8. ESP32 → RPC get_and_lock_slave_commands() ✅ (MESMO)
9. ESP32 → processRelayCommand() ✅ (MESMO)
10. ESP32 → sendRelayCommandToSlave() (ESP-NOW) ✅ (MESMO)
11. Slave → Executa relé físico ✅ (MESMO)
12. Slave → ACK → Master ✅ (MESMO)
13. Master → markCommandCompleted() ✅ (MESMO)
14. Supabase → UPDATE status='completed' ✅ (MESMO)
```

**✅ A partir do passo 8, o fluxo é IDÊNTICO!**

---

## 🎯 **PONTOS DE INTEGRAÇÃO**

### **1. RPC Functions**

| Função | Status | Uso |
|--------|--------|-----|
| `get_and_lock_slave_commands()` | ✅ Implementado | **AMBOS** (manual e rule) |
| `get_active_decision_rules()` | ⚠️ FUTURO | Apenas Decision Engine |

### **2. Frontend APIs**

| Endpoint | Status | Uso |
|----------|--------|-----|
| `POST /api/esp-now/command` | ✅ Implementado | Relay Command (manual) |
| `POST /api/automation/rules` | ✅ Implementado | Decision Engine (criar regra) |
| `GET /api/automation/rules` | ✅ Implementado | Decision Engine (listar regras) |

### **3. ESP32 Functions**

| Função | Status | Uso |
|--------|--------|-----|
| `checkForSlaveCommands()` | ✅ Implementado | **AMBOS** (buscar comandos) |
| `processRelayCommand()` | ✅ Implementado | **AMBOS** (processar comando) |
| `sendRelayCommandToSlave()` | ✅ Implementado | **AMBOS** (enviar ESP-NOW) |
| `fetchDecisionRules()` | ⚠️ FUTURO | Apenas Decision Engine |
| `evaluateAllRules()` | ⚠️ Parcial | Apenas Decision Engine |
| `createSlaveCommandFromRule()` | ⚠️ FUTURO | Apenas Decision Engine |

---

## 📝 **triggered_by VALUES**

| Valor | Significado | Uso | Exemplo |
|-------|-------------|-----|---------|
| `'manual'` | Comando manual do usuário | Botão ON/OFF | Usuário clica botão |
| `'rule'` | Comando de regra individual | Decision Engine (1 regra) | Regra "Ajustar pH" ativa |
| `'automation'` | Automação completa | Autodoser + regras + sensores | Sistema completo |
| `'peristaltic'` | Dosagem peristáltica | EC Controller | Dosagem de nutrientes |

---

## ⚡ **OTIMIZAÇÕES: 1 REGRA POR VEZ**

### **Por quê mais leve que batch de 5?**

1. ✅ **Menos memória no ESP32**
   - 1 comando = ~200 bytes
   - 5 comandos = ~1000 bytes
   - Batch pode fragmentar heap

2. ✅ **Mais fácil de debugar**
   - 1 regra por vez = logs mais claros
   - Erro isolado = não afeta outras regras

3. ✅ **Evita sobrecarga**
   - ESP32 processa 1 regra por ciclo
   - Cooldown entre regras
   - Limite por hora

4. ✅ **Priorização mais clara**
   - RPC ordena por priority DESC
   - Regras de alta prioridade executam primeiro

### **Como funciona?**

```cpp
// ESP32 processa 1 regra por ciclo de avaliação
void DecisionEngine::evaluateAllRules() {
  // Ordena por priority DESC
  std::sort(rules.begin(), rules.end(), [](const DecisionRule& a, const DecisionRule& b) {
    return a.priority > b.priority;
  });
  
  // Processa 1 regra por vez
  for (auto& rule : rules) {
    if (!rule.enabled) continue;
    if (isInCooldown(rule)) continue;
    if (hasExceededHourlyLimit(rule)) continue;
    
    // Avalia condição
    if (evaluateCondition(rule.condition, current_state)) {
      // Cria 1 comando por vez
      createSlaveCommandFromRule(rule);
      break;  // ✅ Processa apenas 1 regra por ciclo
    }
  }
}
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **Frontend (✅ Implementado)**
- [x] API `/api/automation/rules` (POST, GET)
- [x] Função `createDecisionRule()`
- [x] Função `getDecisionRules()`
- [x] Validação de `rule_json`

### **Supabase (⚠️ Parcial)**
- [x] Tabela `decision_rules` criada
- [x] Tabela `relay_commands_slave` suporta `command_type='rule'`
- [ ] RPC `get_active_decision_rules()` ⚠️ **FALTA**

### **ESP32 (⚠️ Parcial)**
- [x] Estrutura `DecisionRule` definida
- [x] Função `evaluateAllRules()` parcial
- [ ] Função `fetchDecisionRules()` ⚠️ **FALTA**
- [ ] Função `createSlaveCommandFromRule()` ⚠️ **FALTA**
- [ ] Integração no loop principal ⚠️ **FALTA**

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Criar RPC `get_active_decision_rules()`** no Supabase
2. **Implementar `fetchDecisionRules()`** no ESP32
3. **Implementar `createSlaveCommandFromRule()`** no ESP32
4. **Integrar Decision Engine** no loop principal
5. **Testar fluxo completo** (regra → comando → relé físico)

---

## 📊 **RESUMO**

**Decision Engine replica o modelo de sucesso dos Relay Commands**, mas com:

1. ✅ **Origem diferente**: Regra → ESP32 cria comando
2. ✅ **Batch menor**: 1 regra por vez (mais leve)
3. ✅ **Campos adicionais**: `rule_id`, `rule_name`
4. ✅ **Fluxo idêntico**: A partir do comando em `relay_commands_slave`, segue o MESMO fluxo

**Status:** ⏳ **Parcialmente implementado** - Falta integração completa no ESP32


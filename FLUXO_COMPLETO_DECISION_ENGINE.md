# 🔄 FLUXO COMPLETO: Decision Engine (Da Regra ao Relé Físico)

## 📋 **VISÃO GERAL**

Este documento mapeia **TODO o caminho** do Decision Engine, desde a criação de uma regra no frontend até a execução física no ESP32 Slave. **Replica o modelo de sucesso dos Relay Commands**, mas com a diferença de que o comando é **gerado automaticamente pelo ESP32** quando a condição da regra é verdadeira.

---

## 🎯 **DIFERENÇAS ENTRE RELAY COMMAND E DECISION ENGINE**

| Aspecto | **Relay Command (Manual)** | **Decision Engine (Automático)** |
|---------|---------------------------|----------------------------------|
| **Origem** | Usuário clica botão | Regra criada no frontend |
| **Trigger** | Imediato (onClick) | Condição avaliada pelo ESP32 |
| **Comando** | Criado diretamente no Supabase | Criado pelo ESP32 quando condição = true |
| **Tabela Origem** | `relay_commands_slave` (direto) | `decision_rules` → `relay_commands_slave` |
| **triggered_by** | `'manual'` | `'rule'` ou `'automation'` |
| **Batch** | Até 5 comandos por vez | **1 regra por vez** (mais leve) |
| **Polling** | ESP32 busca comandos | ESP32 busca regras + avalia condições |
| **RPC** | `get_and_lock_slave_commands()` | `get_active_decision_rules()` (futuro) |

---

## 🔄 **FLUXO COMPLETO (Passo a Passo)**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ FRONTEND - Criar Regra de Automação                         │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ Usuário preenche formulário:
                    │ - Nome da regra
                    │ - Condição (ex: "ph < 6.5")
                    │ - Ações (ex: ligar relay 0 do slave X)
                    │ - Prioridade, cooldown, etc.
                    │
                    │ fetch('/api/automation/rules', {
                    │   method: 'POST',
                    │   body: JSON.stringify({
                    │     device_id: "ESP32_HIDRO_F44738",
                    │     rule_id: "RULE_001",
                    │     rule_name: "Ajustar pH quando baixo",
                    │     rule_json: {
                    │       conditions: { type: "sensor_compare", sensor: "ph", operator: "<", value: 6.5 },
                    │       actions: [
                    │         { type: "relay_on", slave_mac_address: "14:33:5C:38:BF:60", relay_number: 0, duration_seconds: 60 }
                    │       ]
                    │     },
                    │     enabled: true,
                    │     priority: 50
                    │   })
                    │ })
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ API ROUTE - /api/automation/rules                           │
│    Arquivo: src/app/api/automation/rules/route.ts              │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Valida dados recebidos
                    │ 2. Valida rule_json (conditions + actions)
                    │ 3. Valida priority (0-100)
                    │ 4. Chama createDecisionRule(rule)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ AUTOMATION LIB - createDecisionRule()                        │
│    Arquivo: src/lib/automation.ts                              │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Insere em Supabase:
                    │    supabase.from('decision_rules').insert({
                    │      device_id,
                    │      rule_id,
                    │      rule_name,
                    │      rule_description,
                    │      rule_json: {
                    │        conditions: {...},
                    │        actions: [...]  // ✅ ARRAY de ações
                    │      },
                    │      enabled: true,
                    │      priority: 50,
                    │      created_by: 'web_interface'
                    │    })
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣ SUPABASE - Tabela decision_rules                           │
│    Status: enabled = true                                       │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⏳ Regra aguardando avaliação pelo ESP32...
                    │
                    │ ESP32 Master busca regras ativas a cada X segundos
                    │ (intervalo configurável via Feature Flags)
                    │
                    │ ⚠️ NOTA: Atualmente não há RPC específico para regras
                    │    ESP32 faz query direta: SELECT * FROM decision_rules
                    │    WHERE device_id = ? AND enabled = true
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣ ESP32 MASTER - Buscar Regras Ativas                         │
│    Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp          │
│    Função: fetchDecisionRules() (FUTURO)                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ ATUAL: Não implementado ainda
                    │
                    │ ✅ FUTURO: RPC get_active_decision_rules()
                    │    POST /rest/v1/rpc/get_active_decision_rules
                    │    {
                    │      "p_device_id": "ESP32_HIDRO_F44738",
                    │      "p_limit": 10  // ✅ 1 regra por vez (mais leve)
                    │    }
                    │
                    │ Retorna array de regras:
                    │ [
                    │   {
                    │     "id": "uuid",
                    │     "rule_id": "RULE_001",
                    │     "rule_name": "Ajustar pH quando baixo",
                    │     "rule_json": {
                    │       "conditions": {...},
                    │       "actions": [...]  // ✅ ARRAY de ações
                    │     },
                    │     "enabled": true,
                    │     "priority": 50
                    │   }
                    │ ]
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6️⃣ ESP32 MASTER - Decision Engine                              │
│    Arquivo: ESP-HIDROWAVE-main/src/DecisionEngine.cpp          │
│    Função: evaluateAllRules()                                  │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Ordena regras por priority DESC
                    │ 2. Para cada regra ativa:
                    │    a. Verifica cooldown (tempo mínimo entre execuções)
                    │    b. Verifica limite por hora (max_executions_per_hour)
                    │    c. Avalia condição principal:
                    │       - Lê sensores (pH, TDS, temperatura, etc.)
                    │       - Compara com valor da condição
                    │       - Ex: ph < 6.5 → true/false
                    │    d. Verifica safety constraints (interlocks)
                    │    e. SE (condição = true E safety = ok):
                    │       → Executa ações da regra
                    │
                    │ 3. Para cada ação na regra:
                    │    - Extrai slave_mac_address
                    │    - Extrai relay_number
                    │    - Extrai action (on/off)
                    │    - Extrai duration_seconds
                    │
                    │ 4. Cria comando em relay_commands_slave:
                    │    (via createSlaveCommandFromRule())
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7️⃣ ESP32 MASTER - Criar Comando a Partir de Regra              │
│    Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp          │
│    Função: createSlaveCommandFromRule()                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ ATUAL: Não implementado ainda
                    │
                    │ ✅ FUTURO: Criar comando em relay_commands_slave
                    │
                    │ Para cada ação na regra.actions[]:
                    │
                    │ 1. Prepara payload:
                    │    {
                    │      master_device_id: "ESP32_HIDRO_F44738",
                    │      user_email: (buscar de device_status),
                    │      master_mac_address: (buscar de device_status),
                    │      slave_device_id: "ESP32_SLAVE_14_33_5C_38_BF_60",
                    │      slave_mac_address: "14:33:5C:38:BF:60",
                    │      relay_numbers: [0],        // ✅ ARRAY (1 por vez)
                    │      actions: ["on"],          // ✅ ARRAY (1 por vez)
                    │      duration_seconds: [60],   // ✅ ARRAY (1 por vez)
                    │      command_type: "rule",     // ✅ DIFERENTE de "manual"
                    │      priority: 50,             // ✅ Prioridade da regra
                    │      triggered_by: "rule",     // ✅ DIFERENTE de "manual"
                    │      rule_id: "RULE_001",      // ✅ ID da regra
                    │      rule_name: "Ajustar pH quando baixo",  // ✅ Nome da regra
                    │      status: "pending"
                    │    }
                    │
                    │ 2. Insere em Supabase:
                    │    POST /rest/v1/relay_commands_slave
                    │    (mesmo endpoint usado por comandos manuais)
                    │
                    │ ⚠️ IMPORTANTE: 1 comando por vez (mais leve que batch de 5)
                    │    - Mais eficiente em memória
                    │    - Mais fácil de debugar
                    │    - Evita sobrecarga do ESP32
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8️⃣ SUPABASE - Tabela relay_commands_slave                      │
│    Status: 'pending'                                             │
│    triggered_by: 'rule'                                          │
│    command_type: 'rule'                                         │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⏳ Comando aguardando processamento...
                    │
                    │ ⚠️ NOTA: Este comando segue o MESMO fluxo
                    │    dos comandos manuais a partir daqui!
                    │
                    │ ESP32 Master busca comandos via RPC:
                    │ get_and_lock_slave_commands()
                    │
                    │ ✅ RPC já ordena por:
                    │    - command_type (peristaltic > rule > manual)
                    │    - priority DESC
                    │    - created_at ASC
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9️⃣ ESP32 MASTER - Buscar Comando (RPC)                         │
│    Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp           │
│    Função: checkForSlaveCommands()                              │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Faz POST para RPC:
                    │    POST /rest/v1/rpc/get_and_lock_slave_commands
                    │    {
                    │      "p_master_device_id": "ESP32_HIDRO_F44738",
                    │      "p_limit": 5,
                    │      "p_timeout_seconds": 30
                    │    }
                    │
                    │ 2. RPC retorna comandos ordenados:
                    │    - Primeiro: peristaltic (prioridade 80)
                    │    - Segundo: rule (prioridade 50)
                    │    - Terceiro: manual (prioridade 10)
                    │
                    │ 3. Parseia JSON array:
                    │    [
                    │      {
                    │        "id": 123,
                    │        "relay_numbers": [0],
                    │        "actions": ["on"],
                    │        "duration_seconds": [60],
                    │        "command_type": "rule",
                    │        "triggered_by": "rule",
                    │        "rule_id": "RULE_001",
                    │        "rule_name": "Ajustar pH quando baixo",
                    │        ...
                    │      }
                    │    ]
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 🔟 ESP32 MASTER - Processar Comando                             │
│    Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp          │
│    Função: processRelayCommand()                                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Detecta command_type = "rule"
                    │ 2. Chama processRuleCommand(cmd, isSlave=true)
                    │
                    │ Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp
                    │ Função: processRuleCommand()
                    │
                    │ 3. Itera sobre arrays BATCH:
                    │    for (int i = 0; i < cmd.relayNumbers.size(); i++) {
                    │      int relayNum = cmd.relayNumbers[i];
                    │      String action = cmd.actions[i];
                    │      int duration = cmd.durationSecondsArray[i];
                    │
                    │      // Enviar para cada relé no batch
                    │      masterManager->sendRelayCommandToSlave(
                    │        targetMac,
                    │        relayNum,
                    │        action,
                    │        duration,
                    │        cmd.id,
                    │        false
                    │      );
                    │    }
                    │
                    │ ⚠️ NOTA: Mesmo código usado para comandos manuais!
                    │    A diferença está apenas em:
                    │    - command_type: "rule" vs "manual"
                    │    - triggered_by: "rule" vs "manual"
                    │    - rule_id e rule_name presentes
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣1️⃣ ESP32 MASTER - MasterSlaveManager                         │
│    Arquivo: ESP-HIDROWAVE-main/src/MasterSlaveManager.cpp       │
│    Função: sendRelayCommandToSlave()                            │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ MESMO FLUXO DOS COMANDOS MANUAIS!
                    │
                    │ 1. Verifica se slave está na lista confiável
                    │ 2. Verifica se slave está ONLINE
                    │ 3. Gera commandId único
                    │ 4. Envia via ESP-NOW
                    │ 5. Cria mapeamento ESP-NOW ID → Supabase ID
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣2️⃣ ESP-NOW - Transmissão Wireless                            │
│    Protocolo: ESP-NOW (802.11)                                   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 📡 Pacote ESP-NOW enviado:
                    │    - Destino: MAC 14:33:5C:38:BF:60
                    │    - Comando: Relay 0 → ON
                    │    - Duração: 60 segundos
                    │
                    │ ⚡ Transmissão instantânea (< 10ms)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣3️⃣ ESP32 SLAVE - Recebe Comando ESP-NOW                      │
│    Arquivo: ESP32-SLAVE (firmware do slave)                     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ MESMO FLUXO DOS COMANDOS MANUAIS!
                    │
                    │ 1. Recebe pacote ESP-NOW
                    │ 2. Valida origem (Master confiável)
                    │ 3. Executa comando físico:
                    │    digitalWrite(relayPin[0], HIGH)  // Liga relé
                    │ 4. Envia ACK via ESP-NOW
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣4️⃣ ESP32 MASTER - Recebe ACK                                 │
│    Arquivo: ESP-HIDROWAVE-main/src/MasterSlaveManager.cpp       │
│    Função: onRelayAckReceived()                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ MESMO FLUXO DOS COMANDOS MANUAIS!
                    │
                    │ 1. Recebe ACK do Slave
                    │ 2. Busca mapeamento ESP-NOW ID → Supabase ID
                    │ 3. Atualiza estado do relé no cache local
                    │ 4. Marca comando como completed:
                    │    supabase.markCommandCompleted(
                    │      supabaseCommandId,
                    │      currentState,
                    │      true  // isSlave
                    │    )
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣5️⃣ ESP32 MASTER - Atualizar Supabase                         │
│    Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp           │
│    Função: markCommandCompleted()                               │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⚠️ MESMO FLUXO DOS COMANDOS MANUAIS!
                    │
                    │ 1. Atualiza relay_commands_slave:
                    │    PATCH /rest/v1/relay_commands_slave?id=eq.123
                    │    {
                    │      "status": "completed",
                    │      "completed_at": "2024-01-15T10:30:00Z",
                    │      "execution_time_ms": 150
                    │    }
                    │
                    │ 2. Atualiza relay_slaves (estado do relé)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣6️⃣ SUPABASE - Tabelas Atualizadas                           │
│    - relay_commands_slave: status = 'completed'                 │
│    - relay_slaves: relay_states[0] = true                      │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ✅ Comando finalizado com sucesso!
                    │
                    │ ⚠️ NOTA: O Decision Engine pode criar
                    │    novos comandos se a condição continuar verdadeira
                    │    (respeitando cooldown e limites)
```

---

## 📊 **COMPARAÇÃO: ESTRUTURAS E DIFERENÇAS**

### **1. Tabela de Origem**

| Campo | **Relay Command** | **Decision Engine** |
|-------|------------------|---------------------|
| **Tabela** | `relay_commands_slave` (direto) | `decision_rules` → `relay_commands_slave` |
| **Criação** | Frontend → Supabase (direto) | Frontend → Supabase → ESP32 cria comando |
| **Status Inicial** | `'pending'` | `enabled = true` (regra) → `'pending'` (comando) |

### **2. Campos do Comando**

| Campo | **Relay Command** | **Decision Engine** |
|-------|------------------|---------------------|
| **command_type** | `'manual'` | `'rule'` |
| **triggered_by** | `'manual'` | `'rule'` ou `'automation'` |
| **rule_id** | `null` | `"RULE_001"` ✅ |
| **rule_name** | `null` | `"Ajustar pH quando baixo"` ✅ |
| **priority** | `10` (default manual) | `50` (da regra) ✅ |
| **relay_numbers[]** | `[0]` (1-5 relés) | `[0]` (1 relé por vez) ✅ |
| **actions[]** | `['on']` (1-5 ações) | `['on']` (1 ação por vez) ✅ |

### **3. RPC Functions**

| Função | **Relay Command** | **Decision Engine** |
|--------|------------------|---------------------|
| **Buscar Comandos** | `get_and_lock_slave_commands()` ✅ | `get_and_lock_slave_commands()` ✅ (mesmo) |
| **Buscar Regras** | N/A | `get_active_decision_rules()` ⚠️ (FUTURO) |

### **4. Processamento no ESP32**

| Aspecto | **Relay Command** | **Decision Engine** |
|---------|------------------|---------------------|
| **Origem** | Supabase (direto) | Supabase (regra) → ESP32 cria comando |
| **Avaliação** | Não precisa | Avalia condições de sensores ✅ |
| **Criação de Comando** | Já existe | ESP32 cria em `relay_commands_slave` ✅ |
| **Batch** | Até 5 comandos | 1 regra por vez (mais leve) ✅ |

---

## 🎯 **PONTOS CRÍTICOS PARA IMPLEMENTAÇÃO**

### **1. RPC para Buscar Regras (FUTURO)**

```sql
-- ✅ CRIAR RPC: get_active_decision_rules
CREATE OR REPLACE FUNCTION get_active_decision_rules(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  rule_id TEXT,
  rule_name TEXT,
  rule_json JSONB,
  enabled BOOLEAN,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.rule_id,
    dr.rule_name,
    dr.rule_json,
    dr.enabled,
    dr.priority
  FROM public.decision_rules dr
  WHERE dr.device_id = p_device_id
    AND dr.enabled = true
  ORDER BY dr.priority DESC, dr.created_at ASC
  LIMIT p_limit;
END;
$$;
```

### **2. Estrutura do rule_json**

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

### **3. triggered_by Values**

| Valor | Significado | Uso |
|-------|-------------|-----|
| `'manual'` | Comando manual do usuário | Botão ON/OFF |
| `'rule'` | Comando de regra individual | Decision Engine (1 regra) |
| `'automation'` | Automação completa | Autodoser + regras + sensores |
| `'peristaltic'` | Dosagem peristáltica | EC Controller |

### **4. Um Comando por Vez (Mais Leve)**

**Por quê?**
- ✅ Menos memória no ESP32
- ✅ Mais fácil de debugar
- ✅ Evita sobrecarga
- ✅ Priorização mais clara

**Como?**
- ESP32 processa 1 regra por ciclo de avaliação
- Cada regra cria 1 comando em `relay_commands_slave`
- Comando segue fluxo normal (RPC → ESP-NOW → Slave)

---

## ✅ **CHECKLIST DE VALIDAÇÃO**

### **Frontend → Supabase**
- [ ] Frontend cria regra em `decision_rules`
- [ ] `rule_json` contém `conditions` e `actions`
- [ ] `actions[]` contém apenas relays slave (não master)
- [ ] `priority` está entre 0-100
- [ ] `enabled = true` por padrão

### **ESP32 → Buscar Regras**
- [ ] ESP32 busca regras ativas via RPC (FUTURO)
- [ ] RPC retorna regras ordenadas por priority DESC
- [ ] ESP32 parseia `rule_json` corretamente

### **ESP32 → Avaliar Condições**
- [ ] ESP32 lê sensores (pH, TDS, temperatura)
- [ ] ESP32 avalia condição (ex: ph < 6.5)
- [ ] ESP32 verifica cooldown
- [ ] ESP32 verifica limite por hora
- [ ] ESP32 verifica safety constraints

### **ESP32 → Criar Comando**
- [ ] ESP32 cria comando em `relay_commands_slave`
- [ ] `command_type = 'rule'`
- [ ] `triggered_by = 'rule'`
- [ ] `rule_id` e `rule_name` preenchidos
- [ ] `priority` vem da regra
- [ ] **1 comando por vez** (não batch)

### **ESP32 → Processar Comando**
- [ ] Comando segue fluxo normal (RPC → ESP-NOW → Slave)
- [ ] Status atualizado para `'completed'`
- [ ] Estado do relé atualizado em `relay_slaves`

---

## 🚀 **PRÓXIMOS PASSOS PARA MVP**

1. ⏳ **Criar RPC `get_active_decision_rules()`** no Supabase
2. ⏳ **Implementar `fetchDecisionRules()`** no ESP32
3. ⏳ **Implementar `createSlaveCommandFromRule()`** no ESP32
4. ⏳ **Integrar Decision Engine** no loop principal do ESP32
5. ⏳ **Testar fluxo completo** (regra → comando → relé físico)

---

## 📝 **RESUMO**

**Decision Engine replica o modelo de sucesso dos Relay Commands**, mas com as seguintes diferenças:

1. ✅ **Origem**: Regra criada no frontend → ESP32 cria comando automaticamente
2. ✅ **Trigger**: Condição avaliada pelo ESP32 (não clique do usuário)
3. ✅ **Batch**: 1 regra por vez (mais leve que batch de 5 comandos)
4. ✅ **Campos**: `command_type='rule'`, `triggered_by='rule'`, `rule_id`, `rule_name`
5. ✅ **Fluxo**: A partir do comando em `relay_commands_slave`, segue o MESMO fluxo dos comandos manuais

**Status Atual:** ⏳ **Parcialmente implementado** - Falta integração completa no ESP32


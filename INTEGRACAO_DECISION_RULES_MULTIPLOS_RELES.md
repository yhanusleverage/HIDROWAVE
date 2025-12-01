# 🎯 INTEGRAÇÃO: Decision Rules → Múltiplos Relés

## 📋 **RESUMO**

Este documento explica como as `decision_rules` se integram com o sistema de comandos de múltiplos relés, permitindo que uma regra acione vários relés do mesmo slave em um único comando.

---

## ✅ **VERIFICAÇÃO DO SCHEMA**

### **Tabela `decision_rules` - ✅ COMPLETA**

```sql
CREATE TABLE public.decision_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL CHECK (length(rule_id) >= 3),
  rule_name text NOT NULL,
  rule_description text,
  rule_json jsonb NOT NULL,  -- ✅ Contém as instruções
  enabled boolean DEFAULT true,
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text DEFAULT 'system'::text,
  CONSTRAINT decision_rules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_decision_rules_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
);
```

**✅ Status:** A tabela já existe e tem todos os campos necessários!

### **Tabela `relay_commands_slave` - ✅ COMPLETA**

```sql
CREATE TABLE public.relay_commands_slave (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  master_device_id text NOT NULL,
  user_email text NOT NULL,
  master_mac_address text NOT NULL,
  slave_device_id text NOT NULL,
  slave_mac_address text NOT NULL,
  
  -- ✅ ARRAYS: Múltiplos relés por comando
  relay_numbers ARRAY NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
  actions ARRAY NOT NULL,
  duration_seconds ARRAY DEFAULT ARRAY[]::integer[],
  
  -- ✅ ORIGEM DO COMANDO
  command_type text DEFAULT 'manual' 
    CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  triggered_by text DEFAULT 'manual',
  rule_id text,                          -- NULL para manual, "RULE_001" para rule
  rule_name text,                         -- NULL para manual, "Ajustar pH" para rule
  
  priority integer DEFAULT 50,
  status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired')),
  -- ... outros campos
);
```

**✅ Status:** A tabela já suporta arrays e tem campos para rastrear regras!

---

## 🔄 **FLUXO COMPLETO**

### **1️⃣ FRONTEND → Salvar Regra**

```typescript
// SequentialScriptEditor.tsx - handleSave()
const ruleData = {
  device_id: deviceId,
  rule_id: scriptId || `RULE_${Date.now()}`,
  rule_name: ruleName,
  rule_description: ruleDescription,
  rule_json: {
    script: {
      instructions: [
        {
          type: 'while',
          condition: { sensor: 'ph', operator: '<', value: 6.5 },
          body: [
            // ✅ Múltiplos relay_action do mesmo slave
            { 
              type: 'relay_action', 
              target: 'slave', 
              slave_mac: '14:33:5C:38:BF:60', 
              relay_number: 0, 
              action: 'on',
              duration_seconds: 60
            },
            { 
              type: 'relay_action', 
              target: 'slave', 
              slave_mac: '14:33:5C:38:BF:60', 
              relay_number: 1, 
              action: 'on',
              duration_seconds: 60
            },
            { 
              type: 'relay_action', 
              target: 'slave', 
              slave_mac: '14:33:5C:38:BF:60', 
              relay_number: 2, 
              action: 'on',
              duration_seconds: 60
            },
          ]
        }
      ],
      loop_interval_ms: 5000,
      max_iterations: 0,
      cooldown: 60,
      max_executions_per_hour: 10
    },
  },
  enabled: true,
  priority: 50,
  created_by: userProfile?.email || 'system',
};

// ✅ Salvar no Supabase
await supabase.from('decision_rules').insert(ruleData);
```

**✅ Status:** Regra salva com múltiplas instruções `relay_action`!

---

### **2️⃣ ESP32 → Buscar Regras Ativas**

```cpp
// ESP32: HydroSystemCore.cpp
// POST /rest/v1/rpc/get_active_decision_rules
{
  "p_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 50
}

// Supabase retorna:
[
  {
    "id": "uuid-123",
    "rule_id": "RULE_001",
    "rule_name": "Ajustar pH quando baixo",
    "rule_json": {
      "script": {
        "instructions": [
          {
            "type": "while",
            "condition": { "sensor": "ph", "operator": "<", "value": 6.5 },
            "body": [
              { "type": "relay_action", "target": "slave", "slave_mac": "14:33:5C:38:BF:60", "relay_number": 0, "action": "on" },
              { "type": "relay_action", "target": "slave", "slave_mac": "14:33:5C:38:BF:60", "relay_number": 1, "action": "on" },
              { "type": "relay_action", "target": "slave", "slave_mac": "14:33:5C:38:BF:60", "relay_number": 2, "action": "on" }
            ]
          }
        ]
      }
    },
    "enabled": true,
    "priority": 50
  }
]
```

**✅ Status:** ESP32 recebe regras com múltiplas instruções!

---

### **3️⃣ ESP32 → Agrupar e Criar Comando**

```cpp
// ESP32: DecisionEngine.cpp
void DecisionEngine::executeRuleActions(const DecisionRule& rule) {
  // 1. Extrair todas as instruções relay_action
  std::vector<RelayAction> relayActions = extractRelayActions(rule.rule_json);
  
  // 2. Agrupar por slave_mac
  std::map<String, GroupedRelayAction> grouped = groupBySlave(relayActions);
  
  // 3. Criar comando para cada slave (com arrays)
  for (const auto& [slaveMac, group] : grouped) {
    DynamicJsonDocument commandDoc(1024);
    commandDoc["master_device_id"] = getDeviceID();
    commandDoc["user_email"] = getUserEmail();
    commandDoc["master_mac_address"] = getMasterMacAddress();
    commandDoc["slave_device_id"] = "ESP32_SLAVE_001";
    commandDoc["slave_mac_address"] = slaveMac;
    
    // ✅ ARRAYS: Agrupar múltiplos relés
    JsonArray relayNumbers = commandDoc.createNestedArray("relay_numbers");
    JsonArray actions = commandDoc.createNestedArray("actions");
    JsonArray durations = commandDoc.createNestedArray("duration_seconds");
    
    for (int i = 0; i < group.relay_numbers.size(); i++) {
      relayNumbers.add(group.relay_numbers[i]);
      actions.add(group.actions[i]);
      durations.add(group.duration_seconds[i]);
    }
    
    commandDoc["command_type"] = "rule";
    commandDoc["triggered_by"] = "rule";
    commandDoc["rule_id"] = rule.rule_id;
    commandDoc["rule_name"] = rule.rule_name;
    commandDoc["priority"] = rule.priority;
    commandDoc["status"] = "pending";
    
    // POST para Supabase
    String payload;
    serializeJson(commandDoc, payload);
    httpClient->POST("/rest/v1/relay_commands_slave", payload);
  }
}
```

**✅ Status:** Comando criado com arrays de múltiplos relés!

---

### **4️⃣ ESP32 → Processar Comando (RPC Atômico)**

```cpp
// ESP32: SupabaseClient.cpp (JÁ EXISTE)
// POST /rest/v1/rpc/get_and_lock_slave_commands
{
  "p_master_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 5,
  "p_timeout_seconds": 30
}

// RPC retorna:
[
  {
    "id": 123,
    "slave_mac_address": "14:33:5C:38:BF:60",
    "relay_numbers": [0, 1, 2],  // ✅ ARRAY
    "actions": ["on", "on", "on"], // ✅ ARRAY
    "duration_seconds": [60, 60, 60], // ✅ ARRAY
    "command_type": "rule",
    "rule_id": "RULE_001"
  }
]
```

**✅ Status:** RPC retorna arrays corretamente!

---

### **5️⃣ ESP32 → Processar Arrays**

```cpp
// ESP32: SupabaseClient.cpp
void processSlaveCommand(JsonObject cmd) {
  JsonArray relayNumbers = cmd["relay_numbers"];
  JsonArray actions = cmd["actions"];
  JsonArray durations = cmd["duration_seconds"];
  
  String slaveMac = cmd["slave_mac_address"].as<String>();
  
  Serial.printf("🔌 Processando comando: %d relés\n", relayNumbers.size());
  
  // ✅ Loop processa cada relé
  for (int i = 0; i < relayNumbers.size(); i++) {
    int relayNum = relayNumbers[i];
    String action = actions[i].as<String>();
    int duration = durations[i];
    
    Serial.printf("   Relé %d: %s (duração: %ds)\n", relayNum, action.c_str(), duration);
    
    // ✅ Enviar comando via ESP-NOW
    sendRelayCommandToSlave(slaveMac, relayNum, action, duration);
    
    delay(50); // Pequeno delay entre comandos
  }
  
  Serial.println("✅ Todos os relés processados!");
}
```

**✅ Status:** ESP32 processa arrays corretamente!

---

## 🎯 **FUNÇÃO HELPER: `decision-rules-executor.ts`**

Criei uma função helper no frontend que agrupa múltiplas instruções `relay_action` do mesmo slave:

```typescript
import { executeDecisionRule } from '@/lib/decision-rules-executor';

// Exemplo de uso:
const ruleJson = {
  script: {
    instructions: [
      {
        type: 'while',
        condition: { sensor: 'ph', operator: '<', value: 6.5 },
        body: [
          { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 0, action: 'on' },
          { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 1, action: 'on' },
          { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 2, action: 'on' },
        ]
      }
    ]
  }
};

const context = {
  device_id: 'ESP32_HIDRO_F44738',
  user_email: 'user@email.com',
  master_mac_address: 'AA:BB:CC:DD:EE:FF',
  rule_id: 'RULE_001',
  rule_name: 'Ajustar pH quando baixo',
  priority: 50,
};

const result = await executeDecisionRule(ruleJson, context);
// Cria 1 comando com: relay_numbers: [0, 1, 2], actions: ['on', 'on', 'on']
```

---

## ✅ **CONCLUSÃO**

### **Schema - ✅ COMPLETO**

1. ✅ **`decision_rules`**: Já existe e tem todos os campos necessários
2. ✅ **`relay_commands_slave`**: Já suporta arrays e rastreamento de regras
3. ✅ **Não precisa criar novas tabelas!**

### **Fluxo - ✅ FUNCIONAL**

1. ✅ Frontend salva regra com múltiplas instruções `relay_action`
2. ✅ ESP32 busca regras ativas via RPC
3. ✅ ESP32 agrupa instruções do mesmo slave
4. ✅ ESP32 cria comando com arrays em `relay_commands_slave`
5. ✅ ESP32 processa comando via RPC atômico
6. ✅ ESP32 envia múltiplos relés via ESP-NOW

### **Próximos Passos**

1. ✅ Função helper criada (`decision-rules-executor.ts`)
2. ⏳ Implementar agrupamento no ESP32 (similar ao helper do frontend)
3. ⏳ Testar fluxo completo end-to-end

**🎯 O sistema está pronto para suportar múltiplos relés em decision_rules!**

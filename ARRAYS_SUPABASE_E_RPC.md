# 📊 ARRAYS EN SUPABASE: Como Funcionam e Exemplos

## ✅ **RESPOSTA RÁPIDA**

**SIM!** As tabelas suportam arrays e você **JÁ PODE** acionar todos os relés de uma vez!

---

## 🎯 **ESTRUTURA DA TABELA (Suporta Arrays)**

### **`relay_commands_slave`:**

```sql
relay_numbers ARRAY NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
actions ARRAY NOT NULL CHECK (
  array_length(actions, 1) = array_length(relay_numbers, 1)
),
duration_seconds ARRAY DEFAULT ARRAY[]::integer[]
```

**✅ Suporta:**
- Múltiplos relés em 1 comando
- Múltiplas ações (uma por relé)
- Múltiplas durações (uma por relé)

---

## 📦 **EXEMPLO: Acionar TODOS os Relés de Uma Vez**

### **Frontend → Supabase:**

```typescript
// ✅ Comando para acionar TODOS os 8 relés de uma vez
const command = {
  master_device_id: "ESP32_HIDRO_F44738",
  user_email: "user@email.com",
  master_mac_address: "AA:BB:CC:DD:EE:FF",
  slave_device_id: "ESP32_SLAVE_001",
  slave_mac_address: "14:33:5C:38:BF:60",
  
  // ✅ ARRAYS: Todos os relés de uma vez
  relay_numbers: [0, 1, 2, 3, 4, 5, 6, 7],  // Todos os 8 relés
  actions: ['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on'],  // Todos ON
  duration_seconds: [60, 60, 60, 60, 60, 60, 60, 60],  // 60s cada
  
  command_type: 'manual',
  priority: 50,
  status: 'pending'
};

// POST para Supabase
await fetch('/api/relay-commands/slave', {
  method: 'POST',
  body: JSON.stringify(command)
});
```

### **Supabase armazena:**

```json
{
  "id": 123,
  "relay_numbers": [0, 1, 2, 3, 4, 5, 6, 7],
  "actions": ["on", "on", "on", "on", "on", "on", "on", "on"],
  "duration_seconds": [60, 60, 60, 60, 60, 60, 60, 60],
  "status": "pending"
}
```

---

## 🔄 **RPC Processa Arrays (Já Funciona!)**

### **RPC `get_and_lock_slave_commands()` retorna:**

```sql
-- RPC retorna arrays diretamente
SELECT 
  rc.relay_numbers,    -- [0, 1, 2, 3, 4, 5, 6, 7]
  rc.actions,          -- ['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on']
  rc.duration_seconds  -- [60, 60, 60, 60, 60, 60, 60, 60]
FROM relay_commands_slave rc
WHERE rc.id = 123;
```

### **ESP32 recebe e processa:**

```cpp
// ESP32: SupabaseClient.cpp
// RPC retorna JSON com arrays
{
  "id": 123,
  "relay_numbers": [0, 1, 2, 3, 4, 5, 6, 7],
  "actions": ["on", "on", "on", "on", "on", "on", "on", "on"],
  "duration_seconds": [60, 60, 60, 60, 60, 60, 60, 60]
}

// ESP32 processa cada relé
for (int i = 0; i < relay_numbers.size(); i++) {
  int relayNum = relay_numbers[i];
  String action = actions[i];
  int duration = duration_seconds[i];
  
  // Enviar comando via ESP-NOW
  sendRelayCommandToSlave(slaveMac, relayNum, action, duration);
}
```

---

## ✅ **VERIFICAÇÃO: Frontend → Supabase**

### **1. Frontend envia arrays corretamente:**

**Arquivo:** `src/app/api/relay-commands/slave/route.ts`

```typescript
// ✅ Validação de arrays
if (!Array.isArray(relay_numbers) || relay_numbers.length === 0) {
  return NextResponse.json({ error: 'relay_numbers deve ser um array não vazio' });
}

if (!Array.isArray(actions) || actions.length !== relay_numbers.length) {
  return NextResponse.json({ error: 'actions deve ter mesmo tamanho de relay_numbers' });
}

// ✅ Envia para Supabase
const result = await createSlaveCommandDirect({
  relay_numbers,  // [0, 1, 2, 3, 4, 5, 6, 7]
  actions,        // ['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on']
  duration_seconds: durations  // [60, 60, 60, 60, 60, 60, 60, 60]
});
```

**✅ Status:** **CORRETO!** Frontend já envia arrays.

---

### **2. Supabase armazena arrays:**

**Tabela:** `relay_commands_slave`

```sql
-- ✅ Estrutura suporta arrays
relay_numbers ARRAY NOT NULL,
actions ARRAY NOT NULL,
duration_seconds ARRAY DEFAULT ARRAY[]::integer[]
```

**✅ Status:** **CORRETO!** Tabela suporta arrays.

---

### **3. RPC retorna arrays:**

**Função:** `get_and_lock_slave_commands()`

```sql
RETURNS TABLE (
  relay_numbers integer[],  -- ✅ Array
  actions text[],           -- ✅ Array
  duration_seconds integer[] -- ✅ Array
)
```

**✅ Status:** **CORRETO!** RPC retorna arrays.

---

### **4. ESP32 processa arrays:**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

```cpp
// ✅ Parse de arrays JSON
JsonArray relayNumbers = cmd["relay_numbers"];
JsonArray actions = cmd["actions"];
JsonArray durations = cmd["duration_seconds"];

// ✅ Processar cada relé
for (int i = 0; i < relayNumbers.size(); i++) {
  int relayNum = relayNumbers[i];
  String action = actions[i].as<String>();
  int duration = durations[i];
  
  // Enviar comando
  sendRelayCommandToSlave(slaveMac, relayNum, action, duration);
}
```

**✅ Status:** **CORRETO!** ESP32 processa arrays.

---

## 🎯 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Acionar 3 Relés Específicos**

```typescript
{
  relay_numbers: [0, 2, 5],           // Relés 0, 2 e 5
  actions: ['on', 'off', 'on'],       // ON, OFF, ON
  duration_seconds: [30, 0, 60]       // 30s, infinito, 60s
}
```

### **Exemplo 2: Acionar TODOS os Relés**

```typescript
{
  relay_numbers: [0, 1, 2, 3, 4, 5, 6, 7],  // Todos
  actions: ['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on'],  // Todos ON
  duration_seconds: [60, 60, 60, 60, 60, 60, 60, 60]  // 60s cada
}
```

### **Exemplo 3: Acionar Relés com Durações Diferentes**

```typescript
{
  relay_numbers: [0, 1, 2],
  actions: ['on', 'on', 'on'],
  duration_seconds: [30, 60, 120]  // 30s, 60s, 120s
}
```

---

## 🔍 **VERIFICAÇÃO: Configurações Dinâmicas do Usuário**

### **1. Decision Rules (`rule_json`):**

```typescript
// Frontend: CreateRuleModal.tsx
const ruleJson = {
  script: {
    instructions: [
      {
        type: 'relay_action',
        target: 'slave',
        slave_mac: '14:33:5C:38:BF:60',
        relay_number: 0,
        action: 'on'
      }
    ]
  }
};

// ✅ Salva em Supabase
await supabase.from('decision_rules').insert({
  rule_json: ruleJson  // ✅ JSONB suporta estrutura dinâmica
});
```

**✅ Status:** **CORRETO!** `rule_json` é JSONB (suporta qualquer estrutura).

---

### **2. EC Controller Config:**

```typescript
// Frontend: automacao/page.tsx
const ecConfig = {
  base_dose: 1.2,
  flow_rate: 2.5,
  volume: 100,
  total_ml: 50,
  kp: 1.5,
  ec_setpoint: 1500,
  auto_enabled: true
};

// ✅ Salva em Supabase
await supabase.from('ec_controller_config').upsert({
  device_id: deviceId,
  ...ecConfig
});
```

**✅ Status:** **CORRETO!** Configurações dinâmicas são salvas.

---

### **3. Relay States (Arrays):**

```typescript
// Frontend: relay-slaves-api.ts
const relayStates = {
  relay_states: [true, false, true, false, true, false, true, false],
  relay_has_timers: [false, false, true, false, false, false, true, false],
  relay_remaining_times: [0, 0, 30, 0, 0, 0, 60, 0]
};

// ✅ Salva em Supabase
await supabase.from('relay_slaves').upsert({
  device_id: slaveDeviceId,
  ...relayStates  // ✅ Arrays são suportados
});
```

**✅ Status:** **CORRETO!** Arrays de estados são salvos.

---

## 🎯 **RESPOSTA FINAL**

### **✅ SIM, tudo está funcionando corretamente!**

1. **✅ Arrays suportados:** Tabelas usam `ARRAY` type
2. **✅ Frontend envia arrays:** Validação e envio corretos
3. **✅ Supabase armazena arrays:** Estrutura suporta
4. **✅ RPC retorna arrays:** Função retorna arrays
5. **✅ ESP32 processa arrays:** Loop processa cada elemento
6. **✅ Múltiplos relés:** Pode acionar todos de uma vez

### **Exemplo Completo: Acionar Todos os Relés**

```typescript
// Frontend
POST /api/relay-commands/slave
{
  "relay_numbers": [0, 1, 2, 3, 4, 5, 6, 7],
  "actions": ["on", "on", "on", "on", "on", "on", "on", "on"],
  "duration_seconds": [60, 60, 60, 60, 60, 60, 60, 60]
}

// Supabase armazena
relay_numbers: [0, 1, 2, 3, 4, 5, 6, 7]
actions: ['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on']

// RPC retorna
{
  "relay_numbers": [0, 1, 2, 3, 4, 5, 6, 7],
  "actions": ["on", "on", "on", "on", "on", "on", "on", "on"]
}

// ESP32 processa
for (int i = 0; i < 8; i++) {
  sendRelayCommandToSlave(slaveMac, relay_numbers[i], actions[i]);
}
```

**✅ TUDO FUNCIONA!** 🎯

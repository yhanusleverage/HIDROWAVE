# 🔍 Análise do Schema: relay_commands

## 📋 **ESTRUTURA REAL DA TABELA:**

```sql
CREATE TABLE public.relay_commands (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,                    -- ✅ SEMPRE o ID do Master
  relay_number integer NOT NULL,
  action text NOT NULL,
  duration_seconds integer,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_by text DEFAULT 'web_interface',
  error_message text,
  rule_id text,
  rule_name text,
  execution_time_ms integer,
  triggered_by text DEFAULT 'manual',
  target_device_id text DEFAULT '',           -- ⚠️ DEFAULT é '' (string vazia), NÃO NULL!
  CONSTRAINT relay_commands_pkey PRIMARY KEY (id)
);
```

---

## 🎯 **PONTOS CRÍTICOS:**

### **1. `device_id` (Obrigatório)**
- ✅ **SEMPRE** será o ID do Master (ex: "ESP32_HIDRO_6447D0")
- ✅ Para comandos locais: `device_id` = Master
- ✅ Para comandos de slave: `device_id` = Master (também!)

### **2. `target_device_id` (Opcional)**
- ⚠️ **DEFAULT é `''` (string vazia)**, não NULL!
- ✅ Para comandos locais: `target_device_id = ''` (vazio)
- ✅ Para comandos de slave: `target_device_id = "ESP-NOW-SLAVE"` (nome do slave)

### **3. Como Identificar Comandos de Slave:**
```sql
-- ✅ CORRETO: Filtrar por target_device_id não vazio
SELECT * FROM relay_commands 
WHERE device_id = 'ESP32_HIDRO_6447D0'  -- Master
  AND status = 'pending'
  AND target_device_id != ''            -- ⚠️ Não vazio (não NULL!)
  AND target_device_id IS NOT NULL;      -- Por segurança
```

---

## 🔧 **CORREÇÃO NO MASTER:**

### **Problema Atual (linha 1638):**
```cpp
// ❌ ERRADO: Procura device_id começando com "ESP32_SLAVE_"
if (!deviceId.startsWith("ESP32_SLAVE_")) {
    continue; // Pula comandos do Master!
}
```

### **Solução Correta:**
```cpp
// ✅ CORRETO: Filtrar por target_device_id não vazio
String targetDeviceId = cmd["target_device_id"].as<String>();

// ⚠️ IMPORTANTE: target_device_id pode ser:
// - String vazia "" (comandos locais)
// - NULL (se não foi setado)
// - Nome do slave "ESP-NOW-SLAVE" (comandos de slave)

if (targetDeviceId.isEmpty() || targetDeviceId == "null") {
    continue; // Pular comandos locais (sem target_device_id)
}

// ✅ Se chegou aqui, é comando para slave
// Buscar slave pelo nome (target_device_id)
TrustedSlave* slave = nullptr;
for (auto& s : trustedSlaves) {
    if (s.deviceName == targetDeviceId) {
        slave = &s;
        break;
    }
}

if (!slave) {
    Serial.println("   ❌ Slave não encontrado: " + targetDeviceId);
    failCount++;
    continue;
}

// Usar MAC do slave encontrado
uint8_t macAddress[6];
memcpy(macAddress, slave->macAddress, 6);
```

---

## 📊 **FLUXO COMPLETO:**

### **Frontend → Supabase:**
```typescript
// Comando para Slave
{
  device_id: "ESP32_HIDRO_6447D0",        // Master
  target_device_id: "ESP-NOW-SLAVE",      // Nome do Slave
  relay_number: 0,
  action: "on",
  status: "pending"
}

// Comando Local (Master)
{
  device_id: "ESP32_HIDRO_6447D0",        // Master
  target_device_id: "",                   // Vazio (comando local)
  relay_number: 0,
  action: "on",
  status: "pending"
}
```

### **Supabase → Master (Query):**
```cpp
// ✅ Query correta:
String endpoint = "relay_commands?device_id=eq." + getDeviceID() + 
                  "&status=eq.pending" +
                  "&target_device_id=neq." +  // ⚠️ Não igual a string vazia
                  "&order=created_at.asc&limit=50";

// OU filtrar no código:
// Buscar todos pendentes do Master e filtrar no código
```

### **Master → Slave:**
```cpp
// 1. Buscar comandos pendentes do Master
// 2. Filtrar por target_device_id não vazio
// 3. Buscar slave pelo nome (target_device_id)
// 4. Enviar via ESP-NOW usando MAC do slave
```

---

## 🧪 **TESTE COM QUERY SQL:**

### **1. Criar Comando de Teste:**
```sql
INSERT INTO relay_commands (
    device_id,
    target_device_id,      -- ⚠️ Nome do slave
    relay_number,
    action,
    status
) VALUES (
    'ESP32_HIDRO_6447D0',  -- Master
    'ESP-NOW-SLAVE',       -- Nome do slave
    0,
    'on',
    'pending'
);
```

### **2. Verificar Query do Master:**
```sql
-- O que o Master deve buscar:
SELECT * FROM relay_commands 
WHERE device_id = 'ESP32_HIDRO_6447D0'
  AND status = 'pending'
  AND target_device_id != '';  -- ⚠️ Não vazio
```

### **3. Verificar Filtro no Código:**
```cpp
// No MasterSlaveManager.cpp
String targetDeviceId = cmd["target_device_id"].as<String>();

// ⚠️ CUIDADO: JSON pode retornar:
// - String vazia: ""
// - NULL: "null" (como string!)
// - Valor real: "ESP-NOW-SLAVE"

if (targetDeviceId.isEmpty() || 
    targetDeviceId == "null" || 
    targetDeviceId.length() == 0) {
    continue; // Comando local, pular
}
```

---

## ✅ **CHECKLIST DE CORREÇÃO:**

### **1. Query do Supabase:**
- [ ] Filtrar por `device_id` = Master ID
- [ ] Filtrar por `status = 'pending'`
- [ ] Filtrar por `target_device_id != ''` (não vazio)
- [ ] OU buscar todos e filtrar no código

### **2. Parsing JSON:**
- [ ] Ler `target_device_id` do JSON
- [ ] Verificar se não é vazio
- [ ] Verificar se não é "null" (string)
- [ ] Verificar se não é NULL (objeto)

### **3. Busca do Slave:**
- [ ] Buscar slave pelo nome (`deviceName`)
- [ ] Verificar se slave existe
- [ ] Usar MAC do slave encontrado
- [ ] Log de erro se não encontrar

### **4. Envio ESP-NOW:**
- [ ] Enviar comando via ESP-NOW
- [ ] Atualizar status para 'sent'
- [ ] Aguardar ACK (opcional)
- [ ] Atualizar status para 'completed'

---

## 🎯 **RESUMO:**

**Schema Real:**
- `device_id`: Sempre Master ID
- `target_device_id`: String vazia '' (local) ou nome do slave (remoto)

**Correção Necessária:**
1. Filtrar por `target_device_id != ''` (não vazio)
2. Buscar slave pelo nome (`deviceName`)
3. Usar MAC do slave para enviar via ESP-NOW

**Complexidade:** 🟢 **BAIXA** - Apenas ajuste na lógica de filtro


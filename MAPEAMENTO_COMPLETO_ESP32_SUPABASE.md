# 📡 MAPEAMENTO COMPLETO: ESP32 ↔ SUPABASE

## 🎯 **RESUMO**

**NÃO, nem todas são RPC!** O ESP32 usa:
- ✅ **RPC** (POST `/rest/v1/rpc/...`) - Para buscar comandos e regras
- ✅ **PATCH** (`/rest/v1/device_status`) - Para atualizar status (heartbeat)
- ✅ **POST** (`/rest/v1/device_status`) - Para registrar dispositivo
- ✅ **PATCH** (`/rest/v1/relay_commands_*`) - Para atualizar status de comandos
- ✅ **GET** (raro) - Para ler dados específicos

---

## 📊 **TODAS AS COMUNICAÇÕES DO ESP32**

### **1. HEARTBEAT (Atualização de Status)** 🔄

**Método:** `PATCH`
**Endpoint:** `/rest/v1/device_status?device_id=eq.ESP32_XXX`
**É RPC?** ❌ **NÃO** - É PATCH direto na tabela

**Propósito:**
- Atualizar status do dispositivo a cada 10-30 segundos
- Enviar dados de telemetria (memória, uptime, etc)
- Manter `is_online = true`

**Dados Enviados:**
```json
{
  "last_seen": "2024-01-01T12:00:00Z",
  "free_heap": 50000,
  "uptime_seconds": 3600,
  "wifi_rssi": -65,
  "ip_address": "192.168.1.100",
  "is_online": true,
  "firmware_version": "2.1.0",
  "reboot_count": 3  // ✅ ESP32 envia seu contador
}
```

**Frequência:** A cada 10-30 segundos

**Código ESP32 (Exemplo):**
```cpp
http.begin(SUPABASE_URL + "/rest/v1/device_status?device_id=eq." + deviceId);
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument doc(1024);
doc["last_seen"] = getCurrentTimestamp();
doc["free_heap"] = ESP.getFreeHeap();
doc["reboot_count"] = esp32RebootCount;
// ... outros campos

String jsonPayload;
serializeJson(doc, jsonPayload);
int httpCode = http.PATCH(jsonPayload);
```

---

### **2. BUSCAR COMANDOS SLAVE** 📥

**Método:** `POST`
**Endpoint:** `/rest/v1/rpc/get_and_lock_slave_commands`
**É RPC?** ✅ **SIM** - Função SQL no Supabase

**Propósito:**
- Buscar comandos pendentes para Slaves ESP-NOW
- Travar comandos (marcar como 'processing') para evitar duplicação
- Retornar comandos ordenados por prioridade

**Payload Enviado:**
```json
{
  "p_master_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 5,
  "p_timeout_seconds": 30
}
```

**Resposta Recebida:**
```json
[
  {
    "id": 123,
    "master_device_id": "ESP32_HIDRO_F44738",
    "slave_device_id": "ESP32_SLAVE_AA:BB:CC",
    "slave_mac_address": "AA:BB:CC:DD:EE:FF",
    "relay_numbers": [0, 1],
    "actions": ["on", "off"],
    "duration_seconds": [0, 30],
    "command_type": "manual",
    "priority": 10,
    "status": "processing"
  }
]
```

**Frequência:** A cada 5-10 segundos

**Código ESP32 (Exemplo):**
```cpp
http.begin(SUPABASE_URL + "/rest/v1/rpc/get_and_lock_slave_commands");
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument payload(256);
payload["p_master_device_id"] = deviceId;
payload["p_limit"] = 5;
payload["p_timeout_seconds"] = 30;

String jsonPayload;
serializeJson(payload, jsonPayload);
int httpCode = http.POST(jsonPayload);

String response = http.getString();
// Parsear response e processar comandos
```

**RPC no Supabase:**
```sql
CREATE FUNCTION get_and_lock_slave_commands(
  p_master_device_id TEXT,
  p_limit INTEGER,
  p_timeout_seconds INTEGER
)
RETURNS TABLE (...)
AS $$
BEGIN
  -- 1. Buscar comandos pendentes
  -- 2. Atualizar status para 'processing' (LOCK)
  -- 3. Retornar comandos
END;
$$;
```

---

### **3. BUSCAR COMANDOS MASTER** 📥

**Método:** `POST`
**Endpoint:** `/rest/v1/rpc/get_and_lock_master_commands`
**É RPC?** ✅ **SIM** - Função SQL no Supabase

**Propósito:**
- Buscar comandos pendentes para relés locais do Master
- Travar comandos para evitar duplicação
- Retornar comandos ordenados por prioridade

**Payload Enviado:**
```json
{
  "p_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 5,
  "p_timeout_seconds": 30
}
```

**Resposta Recebida:**
```json
[
  {
    "id": 456,
    "device_id": "ESP32_HIDRO_F44738",
    "relay_numbers": [0, 1, 2],
    "actions": ["on", "on", "off"],
    "duration_seconds": [0, 0, 60],
    "command_type": "manual",
    "priority": 10
  }
]
```

**Frequência:** A cada 5-10 segundos

**RPC no Supabase:**
```sql
CREATE FUNCTION get_and_lock_master_commands(
  p_device_id TEXT,
  p_limit INTEGER,
  p_timeout_seconds INTEGER
)
RETURNS TABLE (...)
AS $$
BEGIN
  -- Similar ao get_and_lock_slave_commands
  -- Mas busca de relay_commands_master
END;
$$;
```

---

### **4. BUSCAR REGRAS DE DECISÃO** 📋

**Método:** `POST`
**Endpoint:** `/rest/v1/rpc/get_active_decision_rules`
**É RPC?** ✅ **SIM** - Função SQL no Supabase
**Status:** ⚠️ **FUTURO** (pode não estar implementado ainda)

**Propósito:**
- Buscar regras de automação ativas
- Retornar regras com condições e ações
- ESP32 avalia condições e executa ações

**Payload Enviado:**
```json
{
  "p_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 10
}
```

**Resposta Recebida:**
```json
[
  {
    "id": "uuid",
    "rule_id": "RULE_001",
    "rule_name": "Ajustar pH",
    "rule_json": {
      "conditions": [...],
      "actions": [...]
    },
    "enabled": true,
    "priority": 50
  }
]
```

**Frequência:** A cada 30-60 segundos (quando implementar)

**RPC no Supabase:**
```sql
CREATE FUNCTION get_active_decision_rules(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (...)
AS $$
BEGIN
  SELECT * FROM decision_rules
  WHERE device_id = p_device_id
    AND enabled = true
  ORDER BY priority DESC;
END;
$$;
```

---

### **5. ATUALIZAR STATUS DE COMANDO** ✅

**Método:** `PATCH`
**Endpoint:** `/rest/v1/relay_commands_slave?id=eq.123`
**É RPC?** ❌ **NÃO** - É PATCH direto na tabela

**Propósito:**
- Marcar comando como 'completed' após executar
- Marcar comando como 'failed' se der erro
- Atualizar `completed_at` ou `failed_at`

**Dados Enviados:**
```json
{
  "status": "completed",
  "completed_at": "2024-01-01T12:00:00Z",
  "execution_time_ms": 150
}
```

**OU (se falhou):**
```json
{
  "status": "failed",
  "failed_at": "2024-01-01T12:00:00Z",
  "error_message": "Slave não respondeu"
}
```

**Frequência:** Após processar cada comando

**Código ESP32 (Exemplo):**
```cpp
// Após executar comando com sucesso
String url = SUPABASE_URL + "/rest/v1/relay_commands_slave?id=eq." + String(commandId);
http.begin(url);
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument doc(256);
doc["status"] = "completed";
doc["completed_at"] = getCurrentTimestamp();
doc["execution_time_ms"] = executionTime;

String jsonPayload;
serializeJson(doc, jsonPayload);
int httpCode = http.PATCH(jsonPayload);
```

---

### **6. REGISTRAR DISPOSITIVO** 📝

**Método:** `POST`
**Endpoint:** `/rest/v1/rpc/register_device_with_email`
**É RPC?** ✅ **SIM** - Função SQL no Supabase

**Propósito:**
- Registrar dispositivo Master na primeira inicialização
- Criar registro em `device_status`
- Associar dispositivo ao usuário

**Payload Enviado:**
```json
{
  "p_device_id": "ESP32_HIDRO_F44738",
  "p_mac_address": "AA:BB:CC:DD:EE:FF",
  "p_user_email": "usuario@email.com",
  "p_device_name": "Hidroponia Principal",
  "p_location": "Estufa 1",
  "p_ip_address": "192.168.1.100"
}
```

**Resposta Recebida:**
```json
{
  "device_id": "ESP32_HIDRO_F44738",
  "user_email": "usuario@email.com",
  "registered_at": "2024-01-01T12:00:00Z"
}
```

**Frequência:** Uma vez na inicialização

**RPC no Supabase:**
```sql
CREATE FUNCTION register_device_with_email(
  p_device_id TEXT,
  p_mac_address TEXT,
  p_user_email TEXT,
  p_device_name TEXT,
  p_location TEXT,
  p_ip_address TEXT
)
RETURNS JSONB
AS $$
BEGIN
  -- 1. Verificar se dispositivo já existe
  -- 2. Se não existe, criar registro
  -- 3. Retornar dados do dispositivo
END;
$$;
```

---

### **7. ATUALIZAR ESTADOS DE RELAYS SLAVES** 🔌

**Método:** `PATCH`
**Endpoint:** `/rest/v1/relay_slaves?device_id=eq.ESP32_SLAVE_XXX`
**É RPC?** ❌ **NÃO** - É PATCH direto na tabela

**Propósito:**
- Atualizar estados dos relés dos Slaves
- Enviar estados atuais (on/off)
- Enviar timers restantes

**Dados Enviados:**
```json
{
  "relay_states": [true, false, true, false, false, false, false, false],
  "relay_has_timers": [false, true, false, false, false, false, false, false],
  "relay_remaining_times": [0, 30, 0, 0, 0, 0, 0, 0],
  "last_update": "2024-01-01T12:00:00Z"
}
```

**Frequência:** A cada 5-10 segundos (após receber estados via ESP-NOW)

**Código ESP32 (Exemplo):**
```cpp
String url = SUPABASE_URL + "/rest/v1/relay_slaves?device_id=eq." + slaveDeviceId;
http.begin(url);
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument doc(512);
doc["relay_states"] = relayStatesArray;
doc["relay_has_timers"] = hasTimersArray;
doc["relay_remaining_times"] = remainingTimesArray;
doc["last_update"] = getCurrentTimestamp();

String jsonPayload;
serializeJson(doc, jsonPayload);
int httpCode = http.PATCH(jsonPayload);
```

---

### **8. REGISTRAR SLAVE ESP-NOW** 📝

**Método:** `POST`
**Endpoint:** `/rest/v1/rpc/register_device_with_email`
**É RPC?** ✅ **SIM** - Mesma função do Master

**Propósito:**
- Registrar Slave descoberto via ESP-NOW
- Criar registro em `device_status` com `device_type = 'ESP32_SLAVE'`
- Associar ao Master

**Payload Enviado:**
```json
{
  "p_device_id": "ESP32_SLAVE_AA_BB_CC",
  "p_mac_address": "AA:BB:CC:DD:EE:FF",
  "p_user_email": "usuario@email.com",
  "p_device_name": "ESP-NOW Slave AA:BB:CC",
  "p_location": null,
  "p_ip_address": null
}
```

**Frequência:** Quando descobre novo Slave

---

## 📊 **TABELA RESUMO**

| # | Comunicação | Método | Endpoint | É RPC? | Propósito | Frequência |
|---|-------------|--------|----------|--------|-----------|------------|
| 1 | Heartbeat | `PATCH` | `/rest/v1/device_status` | ❌ | Atualizar status | 10-30s |
| 2 | Buscar Comandos Slave | `POST` | `/rest/v1/rpc/get_and_lock_slave_commands` | ✅ | Buscar comandos pendentes | 5-10s |
| 3 | Buscar Comandos Master | `POST` | `/rest/v1/rpc/get_and_lock_master_commands` | ✅ | Buscar comandos locais | 5-10s |
| 4 | Buscar Regras | `POST` | `/rest/v1/rpc/get_active_decision_rules` | ✅ | Buscar regras ativas | 30-60s |
| 5 | Atualizar Status Comando | `PATCH` | `/rest/v1/relay_commands_slave` | ❌ | Marcar como completed/failed | Após cada comando |
| 6 | Registrar Dispositivo | `POST` | `/rest/v1/rpc/register_device_with_email` | ✅ | Registrar na inicialização | Uma vez |
| 7 | Atualizar Estados Slaves | `PATCH` | `/rest/v1/relay_slaves` | ❌ | Atualizar estados dos relés | 5-10s |
| 8 | Registrar Slave | `POST` | `/rest/v1/rpc/register_device_with_email` | ✅ | Registrar Slave descoberto | Quando descobre |

---

## 🎯 **RESPOSTA DIRETA**

### **Pergunta: Todas são RPC do lado do Supabase?**

**Resposta:** ❌ **NÃO!**

**São RPC (POST `/rest/v1/rpc/...`):**
- ✅ `get_and_lock_slave_commands` - Buscar comandos slave
- ✅ `get_and_lock_master_commands` - Buscar comandos master
- ✅ `get_active_decision_rules` - Buscar regras (futuro)
- ✅ `register_device_with_email` - Registrar dispositivo

**NÃO são RPC (PATCH/GET direto na tabela):**
- ❌ Heartbeat - PATCH direto em `device_status`
- ❌ Atualizar status comando - PATCH direto em `relay_commands_slave`
- ❌ Atualizar estados slaves - PATCH direto em `relay_slaves`

---

## 🔍 **DIFERENÇA: RPC vs PATCH/GET DIRETO**

### **RPC (POST `/rest/v1/rpc/...`):**
- ✅ Executa função SQL no Supabase
- ✅ Pode fazer SELECT + UPDATE + RETURN (tudo atômico)
- ✅ Lógica complexa no banco
- ✅ Exemplo: Buscar E travar comandos

### **PATCH/GET Direto (`/rest/v1/tabela`):**
- ✅ Acesso direto à tabela
- ✅ Operação simples (UPDATE ou SELECT)
- ✅ Lógica no ESP32
- ✅ Exemplo: Atualizar status, ler dados

---

## 📝 **RESUMO FINAL**

**Total de comunicações:** 8 tipos

**São RPC:** 4 (50%)
- Buscar comandos (slave + master)
- Buscar regras
- Registrar dispositivo

**NÃO são RPC:** 4 (50%)
- Heartbeat (PATCH)
- Atualizar status comando (PATCH)
- Atualizar estados slaves (PATCH)
- (Possíveis GETs para ler dados específicos)

**Conclusão:** Nem todas são RPC! Apenas operações complexas usam RPC. Operações simples usam PATCH/GET direto.


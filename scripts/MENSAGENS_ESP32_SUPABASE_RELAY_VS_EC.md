# 📡 MENSAGENS ESP32 → SUPABASE: Relay Commands vs EC Config

## 📋 **RESUMO**

Este documento lista **todas as mensagens** que o ESP32 faz para o Supabase relacionadas a **Relay Commands** e compara com **EC Config**.

---

## 🔄 **RELAY COMMANDS - Mensagens ESP32 → Supabase**

### **1. Buscar Comandos Pendentes (RPC)**

**Método:** `POST`  
**Endpoint:** `/rest/v1/rpc/get_and_lock_slave_commands`  
**Frequência:** A cada 10-30 segundos (configurável)

**Request:**
```json
POST /rest/v1/rpc/get_and_lock_slave_commands
{
  "p_master_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 5,
  "p_timeout_seconds": 30
}
```

**Response (Sucesso):**
```json
[
  {
    "id": 123,
    "master_device_id": "ESP32_HIDRO_F44738",
    "slave_device_id": "ESP32_SLAVE_14_33_5C_38_BF_60",
    "slave_mac_address": "14:33:5C:38:BF:60",
    "relay_numbers": [2, 3],
    "actions": ["on", "off"],
    "duration_seconds": [10, 0],
    "command_type": "peristaltic",
    "priority": 80,
    "triggered_by": "auto_ec",
    "rule_id": null,
    "rule_name": null,
    "status": "processing",  // ✅ Já marcado como processing pelo RPC
    "created_at": "2025-01-12T10:00:00Z"
  }
]
```

**Response (Vazio - Sem comandos):**
```json
[]
```

**Código ESP32 (Exemplo):**
```cpp
// SupabaseClient.cpp
bool SupabaseClient::checkForSlaveCommands(RelayCommand* commands, int maxCommands, int& commandCount) {
  String endpoint = "rpc/get_and_lock_slave_commands";
  
  DynamicJsonDocument payload(512);
  payload["p_master_device_id"] = getDeviceID();
  payload["p_limit"] = maxCommands;
  payload["p_timeout_seconds"] = 30;
  
  String jsonPayload;
  serializeJson(payload, jsonPayload);
  
  int httpCode = http.POST("/rest/v1/" + endpoint, jsonPayload);
  
  if (httpCode == 200) {
    // Parse JSON response
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, http.getString());
    
    // Processar comandos retornados
    for (int i = 0; i < doc.size() && i < maxCommands; i++) {
      // Parse command...
      commands[commandCount++] = parsedCommand;
    }
  }
}
```

---

### **2. Atualizar Status do Comando (PATCH)**

**Método:** `PATCH`  
**Endpoint:** `/rest/v1/relay_commands_slave?id=eq.{command_id}`  
**Frequência:** Após processar cada comando

**Request (Marcar como "sent"):**
```json
PATCH /rest/v1/relay_commands_slave?id=eq.123
{
  "status": "sent",
  "sent_at": "2025-01-12T10:00:05Z",
  "updated_at": "2025-01-12T10:00:05Z"
}
```

**Request (Marcar como "completed"):**
```json
PATCH /rest/v1/relay_commands_slave?id=eq.123
{
  "status": "completed",
  "completed_at": "2025-01-12T10:00:15Z",
  "updated_at": "2025-01-12T10:00:15Z"
}
```

**Request (Marcar como "failed"):**
```json
PATCH /rest/v1/relay_commands_slave?id=eq.123
{
  "status": "failed",
  "failed_at": "2025-01-12T10:00:10Z",
  "error_message": "ESP-NOW timeout",
  "updated_at": "2025-01-12T10:00:10Z"
}
```

**Código ESP32 (Exemplo):**
```cpp
// SupabaseClient.cpp
bool SupabaseClient::updateCommandStatus(int commandId, const String& status, bool isSlave) {
  String table = isSlave ? "relay_commands_slave" : "relay_commands_master";
  String endpoint = "/rest/v1/" + table + "?id=eq." + String(commandId);
  
  DynamicJsonDocument payload(512);
  payload["status"] = status;
  payload["updated_at"] = getCurrentTimestamp();
  
  if (status == "sent") {
    payload["sent_at"] = getCurrentTimestamp();
  } else if (status == "completed") {
    payload["completed_at"] = getCurrentTimestamp();
  } else if (status == "failed") {
    payload["failed_at"] = getCurrentTimestamp();
    payload["error_message"] = errorMessage;
  }
  
  String jsonPayload;
  serializeJson(payload, jsonPayload);
  
  int httpCode = http.PATCH(endpoint, jsonPayload);
  return (httpCode == 200 || httpCode == 204);
}
```

---

### **3. Buscar Comandos Master (RPC)**

**Método:** `POST`  
**Endpoint:** `/rest/v1/rpc/get_and_lock_master_commands`  
**Frequência:** A cada 10-30 segundos (configurável)

**Request:**
```json
POST /rest/v1/rpc/get_and_lock_master_commands
{
  "p_device_id": "ESP32_HIDRO_F44738",
  "p_limit": 5,
  "p_timeout_seconds": 30
}
```

**Response:** Similar ao `get_and_lock_slave_commands`, mas para comandos master (relés locais).

---

## 🔄 **EC CONFIG - Mensagens ESP32 → Supabase**

### **1. Buscar Config Ativada (RPC)**

**Método:** `POST`  
**Endpoint:** `/rest/v1/rpc/activate_auto_ec`  
**Frequência:** A cada `intervalo_auto_ec` segundos (ex: 300 segundos = 5 minutos)

**Request:**
```json
POST /rest/v1/rpc/activate_auto_ec
{
  "p_device_id": "ESP32_HIDRO_F44738"
}
```

**Response (Sucesso):**
```json
[
  {
    "id": 1,
    "device_id": "ESP32_HIDRO_F44738",
    "base_dose": 666.0,
    "flow_rate": 1.0,
    "volume": 10.0,
    "total_ml": 12.0,
    "kp": 1.0,
    "ec_setpoint": 1400.0,
    "auto_enabled": true,  // ✅ Já ativado pelo RPC
    "intervalo_auto_ec": 300,
    "tempo_recirculacao": 60000,
    "nutrients": [
      {
        "name": "Grow",
        "relay": 2,
        "mlPerLiter": 3.0,
        "active": true
      }
    ],
    "distribution": {
      "totalUt": 15.50,
      "intervalo": 5,
      "distribution": [
        {
          "name": "Grow",
          "relay": 2,
          "dosage": 6.20,
          "duration": 6.37
        }
      ]
    },
    "created_at": "2025-01-12T10:00:00Z",
    "updated_at": "2025-01-12T10:05:00Z"
  }
]
```

**Response (Erro - Config não encontrada):**
```json
{
  "code": "P0001",
  "message": "Configuração EC não encontrada para device_id: ESP32_HIDRO_F44738. Execute \"Salvar Parâmetros\" primeiro."
}
```

**Código ESP32 (Exemplo):**
```cpp
// SupabaseClient.cpp ou HydroControl.cpp
bool SupabaseClient::getECConfig(ECConfig& config) {
  String endpoint = "rpc/activate_auto_ec";
  
  DynamicJsonDocument payload(256);
  payload["p_device_id"] = getDeviceID();
  
  String jsonPayload;
  serializeJson(payload, jsonPayload);
  
  int httpCode = http.POST("/rest/v1/" + endpoint, jsonPayload);
  
  if (httpCode == 200) {
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, http.getString());
    
    if (doc.size() > 0) {
      JsonObject ecConfig = doc[0];
      
      // Parse config
      config.base_dose = ecConfig["base_dose"] | 0.0;
      config.flow_rate = ecConfig["flow_rate"] | 1.0;
      config.volume = ecConfig["volume"] | 10.0;
      config.ec_setpoint = ecConfig["ec_setpoint"] | 0.0;
      config.auto_enabled = ecConfig["auto_enabled"] | false;
      config.intervalo_auto_ec = ecConfig["intervalo_auto_ec"] | 300;
      config.tempo_recirculacao = ecConfig["tempo_recirculacao"] | 60000;
      
      // Parse distribution
      if (ecConfig.containsKey("distribution")) {
        JsonObject dist = ecConfig["distribution"];
        config.distribution.totalUt = dist["totalUt"] | 0.0;
        config.distribution.intervalo = dist["intervalo"] | 5;
        
        // Parse array de distribution
        JsonArray distArray = dist["distribution"];
        for (int i = 0; i < distArray.size(); i++) {
          JsonObject item = distArray[i];
          DistributionItem dItem;
          dItem.name = item["name"].as<String>();
          dItem.relay = item["relay"] | 0;
          dItem.dosage = item["dosage"] | 0.0;
          dItem.duration = item["duration"] | 0.0;
          config.distribution.items.push_back(dItem);
        }
      }
      
      return true;
    }
  }
  
  return false;
}
```

---

## 📊 **COMPARAÇÃO: Relay Commands vs EC Config**

| Aspecto | Relay Commands | EC Config |
|---------|----------------|-----------|
| **Tipo de RPC** | `get_and_lock_slave_commands` | `activate_auto_ec` |
| **Método HTTP** | `POST` | `POST` |
| **Frequência** | 10-30 segundos | `intervalo_auto_ec` (ex: 300s) |
| **Retorno** | Array de comandos | Array com 1 config |
| **Lock** | `UPDATE status = 'processing'` | `FOR UPDATE SKIP LOCKED` |
| **Estados** | pending → processing → sent → completed | false → true (binário) |
| **Atualização Status** | ✅ Sim (PATCH após processar) | ❌ Não (RPC já ativa) |
| **Múltiplos Itens** | ✅ Sim (vários comandos) | ❌ Não (1 config) |

---

## 🎯 **RESPOSTA À SUA PERGUNTA**

### **"Quais são as mensagens que o ESP32 faz para o Supabase relacionadas aos relays?"**

**Resposta:**

1. **POST `/rest/v1/rpc/get_and_lock_slave_commands`**
   - Busca comandos pendentes para slaves
   - RPC marca como `processing` atômicamente
   - Retorna array de comandos

2. **POST `/rest/v1/rpc/get_and_lock_master_commands`**
   - Busca comandos pendentes para master (relés locais)
   - Similar ao anterior, mas para master

3. **PATCH `/rest/v1/relay_commands_slave?id=eq.{id}`**
   - Atualiza status do comando após processar
   - Estados: `sent`, `completed`, `failed`

### **"Existe uma estratégia melhor ou a tabela de fila de comandos é a mais foda para ser atômica?"**

**Resposta:** ✅ **A tabela de fila de comandos (`relay_commands_slave`) É a melhor estratégia para relays!**

**Por quê?**
- ✅ **Atômico:** RPC marca como `processing` em uma transação
- ✅ **Previne duplicação:** Apenas um ESP32 processa cada comando
- ✅ **Priorização:** Ordena por tipo (peristaltic > rule > manual)
- ✅ **Retry automático:** Comandos expirados voltam para `pending`
- ✅ **Histórico completo:** Todos os comandos executados

**Para EC Config, a estratégia atual também é a melhor:**
- ✅ **Lock atômico:** `FOR UPDATE SKIP LOCKED`
- ✅ **Configuração única:** Não precisa de fila
- ✅ **Mais simples:** Estado binário (`auto_enabled: false/true`)

---

## ✅ **CONCLUSÃO**

**Relay Commands:**
- ✅ Tabela de fila (`relay_commands_slave`) é **PERFEITA**
- ✅ RPC atômico com estados (`pending → processing → sent → completed`)
- ✅ Priorização e retry automático

**EC Config:**
- ✅ View table (`ec_config_view`) é **PERFEITA**
- ✅ RPC atômico com lock (`FOR UPDATE SKIP LOCKED`)
- ✅ Estado binário (`auto_enabled: false/true`)

**Ambas as estratégias são as melhores para seus respectivos casos de uso!** 🎯

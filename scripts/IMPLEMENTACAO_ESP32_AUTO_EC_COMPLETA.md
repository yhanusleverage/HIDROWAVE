# 🚀 Implementação ESP32: Auto EC com RPC activate_auto_ec

## 🎯 **RESUMO**

**SIM, usamos LOCK!** O RPC `activate_auto_ec` usa `FOR UPDATE SKIP LOCKED` para garantir que apenas um ESP32 processe a config por vez.

## ⚠️ **IMPORTANTE: PADRONIZAÇÃO DE UNIDADES**

**TODOS os tempos no ESP32 são em SEGUNDOS:**
- ✅ `intervalo_auto_ec`: **SEGUNDOS** (ex: 300 = 5 minutos)
- ✅ `tempo_recirculacao`: **SEGUNDOS** (ex: 4500 = 75 minutos)
- ⚠️ **NOTA:** A BD retorna `tempo_recirculacao` em **MILISEGUNDOS**, mas convertemos para **SEGUNDOS** no ESP32 para padronizar
- 💡 **Uso:** Quando precisar usar `delay()`, converter: `delay(tempo_recirculacao * 1000)`

---

## 🔒 **USAMOS LOCK? SIM!**

### **RPC activate_auto_ec usa Lock:**

```sql
-- CREATE_RPC_ACTIVATE_AUTO_EC.sql
SELECT * INTO config_record
FROM public.ec_config_view
WHERE device_id = p_device_id
FOR UPDATE SKIP LOCKED;  -- ✅ LOCK AQUI!
```

**Por quê usar lock?**
- ✅ **Evita race conditions** - múltiplos ESP32s não processam simultaneamente
- ✅ **Atômico** - lock + ativação em uma transação
- ✅ **Similar ao padrão** `get_and_lock_slave_commands`

---

## 📡 **MENSAGENS ESP32 → SUPABASE (Auto EC)**

### **1. Buscar Config Ativada (RPC com Lock)** 🔒

**Método:** `POST`  
**Endpoint:** `/rest/v1/rpc/activate_auto_ec`  
**Frequência:** A cada `intervalo_auto_ec` segundos (ex: 300s = 5 minutos)

**Request:**
```json
POST /rest/v1/rpc/activate_auto_ec
Content-Type: application/json
apikey: [SUPABASE_ANON_KEY]
Authorization: Bearer [SUPABASE_ANON_KEY]

{
  "p_device_id": "ESP32_HIDRO_F44738"
}
```

**Response (Sucesso - Array com 1 elemento):**
```json
[
  {
    "id": 1,
    "device_id": "ESP32_HIDRO_F44738",
    "base_dose": 1525.0,
    "flow_rate": 0.98,
    "volume": 100.0,
    "total_ml": 4.1,
    "kp": 1.0,
    "ec_setpoint": 1400.0,
    "auto_enabled": true,  // ✅ Já ativado pelo RPC
    "intervalo_auto_ec": 300,  // ✅ SEGUNDOS (300s = 5 minutos)
    "tempo_recirculacao": 4500000,  // ⚠️ MILISEGUNDOS da BD (4500000ms = 75 minutos) → converter para SEGUNDOS no ESP32
    "nutrients": [
      {
        "name": "22CCCdddd",
        "relay": 0,
        "mlPerLiter": 1.8,
        "active": true,
        "relayName": "clciomagnesio"
      },
      {
        "name": "s",
        "relay": 4,
        "mlPerLiter": 1.2,
        "active": true,
        "relayName": "s"
      }
    ],
    "distribution": {
      "totalUt": 384.7,
      "intervalo": 300,
      "distribution": [
        {
          "name": "22CCCdddd",
          "relay": 0,
          "dosage": 168.62,
          "duration": 172.06
        },
        {
          "name": "s",
          "relay": 4,
          "dosage": 112.41,
          "duration": 114.71
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

**Response (Vazio - Se lock falhou):**
```json
[]
```

---

## 💻 **IMPLEMENTAÇÃO ESP32 (Código Completo)**

### **1. Função para Chamar RPC activate_auto_ec**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp` ou `HydroSystemCore.cpp`

```cpp
// ✅ NOVA FUNÇÃO: Buscar config EC ativada via RPC
bool SupabaseClient::getECConfigFromSupabase(ECConfig& config) {
    if (!isConnected()) {
        Serial.println("❌ [EC CONFIG] Supabase não conectado");
        return false;
    }
    
    String endpoint = "/rest/v1/rpc/activate_auto_ec";
    
    // ✅ Preparar payload
    DynamicJsonDocument payload(256);
    payload["p_device_id"] = getDeviceID();
    
    String jsonPayload;
    serializeJson(payload, jsonPayload);
    
    Serial.println("\n📡 [EC CONFIG] Buscando config ativada do Supabase...");
    Serial.printf("   Endpoint: %s\n", endpoint.c_str());
    Serial.printf("   Device ID: %s\n", getDeviceID().c_str());
    
    // ✅ Fazer POST request (RPC precisa de POST, não GET)
    httpClient->begin(SUPABASE_URL + endpoint);
    httpClient->addHeader("Content-Type", "application/json");
    httpClient->addHeader("apikey", SUPABASE_ANON_KEY);
    httpClient->addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    httpClient->addHeader("Prefer", "return=representation");
    
    int httpCode = httpClient->POST(jsonPayload);
    
    if (httpCode != 200) {
        Serial.printf("❌ [EC CONFIG] Erro HTTP: %d\n", httpCode);
        String errorResponse = httpClient->getString();
        Serial.printf("   Resposta: %s\n", errorResponse.c_str());
        httpClient->end();
        return false;
    }
    
    // ✅ Parsear resposta
    String response = httpClient->getString();
    httpClient->end();
    
    if (response.length() == 0) {
        Serial.println("❌ [EC CONFIG] Resposta vazia");
        return false;
    }
    
    // ✅ Verificar se é JSON válido
    if (response.charAt(0) != '[' && response.charAt(0) != '{') {
        Serial.println("❌ [EC CONFIG] Resposta não é JSON válido");
        Serial.printf("   Primeiros 100 chars: %s\n", response.substring(0, 100).c_str());
        return false;
    }
    
    // ✅ Parsear JSON (buffer dinâmico)
    int jsonSize = max(2048, min((int)(response.length() * 1.3), 16384));
    DynamicJsonDocument doc(jsonSize);
    DeserializationError error = deserializeJson(doc, response);
    
    if (error) {
        Serial.printf("❌ [EC CONFIG] Erro ao parsear JSON: %s\n", error.c_str());
        Serial.printf("   Tamanho resposta: %d bytes | Buffer: %d bytes\n", 
                     response.length(), jsonSize);
        return false;
    }
    
    // ✅ Verificar se retornou array com dados
    if (!doc.is<JsonArray>() || doc.size() == 0) {
        Serial.println("⚠️ [EC CONFIG] Nenhuma config encontrada ou lock falhou");
        return false;
    }
    
    JsonObject ecConfig = doc[0];
    
    // ✅ Parsear campos básicos
    config.base_dose = ecConfig["base_dose"] | 0.0;
    config.flow_rate = ecConfig["flow_rate"] | 1.0;
    config.volume = ecConfig["volume"] | 10.0;
    config.total_ml = ecConfig["total_ml"] | 0.0;
    config.kp = ecConfig["kp"] | 1.0;
    config.ec_setpoint = ecConfig["ec_setpoint"] | 0.0;
    config.auto_enabled = ecConfig["auto_enabled"] | false;
    config.intervalo_auto_ec = ecConfig["intervalo_auto_ec"] | 300;  // ✅ SEGUNDOS
    // ⚠️ IMPORTANTE: tempo_recirculacao vem em MILISEGUNDOS da BD, converter para SEGUNDOS
    int tempoRecirculacaoMs = ecConfig["tempo_recirculacao"] | 60000;  // BD: milisegundos
    config.tempo_recirculacao = tempoRecirculacaoMs / 1000;  // Converter para segundos
    
    // ✅ Parsear nutrients array
    if (ecConfig.containsKey("nutrients") && ecConfig["nutrients"].is<JsonArray>()) {
        JsonArray nutrients = ecConfig["nutrients"];
        config.nutrientsCount = min((int)nutrients.size(), 8);
        
        for (int i = 0; i < config.nutrientsCount; i++) {
            JsonObject nut = nutrients[i];
            config.nutrients[i].name = nut["name"] | "";
            config.nutrients[i].relay = nut["relay"] | 0;
            config.nutrients[i].mlPerLiter = nut["mlPerLiter"] | 0.0;
            config.nutrients[i].active = nut["active"] | false;
        }
    }
    
    // ✅ Parsear distribution (se existir)
    if (ecConfig.containsKey("distribution") && ecConfig["distribution"].is<JsonObject>()) {
        JsonObject dist = ecConfig["distribution"];
        config.hasDistribution = true;
        config.distribution.totalUt = dist["totalUt"] | 0.0;
        config.distribution.intervalo = dist["intervalo"] | 5;
        
        if (dist.containsKey("distribution") && dist["distribution"].is<JsonArray>()) {
            JsonArray distArray = dist["distribution"];
            config.distribution.count = min((int)distArray.size(), 8);
            
            for (int i = 0; i < config.distribution.count; i++) {
                JsonObject item = distArray[i];
                config.distribution.items[i].name = item["name"] | "";
                config.distribution.items[i].relay = item["relay"] | 0;
                config.distribution.items[i].dosage = item["dosage"] | 0.0;
                config.distribution.items[i].duration = item["duration"] | 0.0;  // SEGUNDOS
            }
        }
    } else {
        config.hasDistribution = false;
    }
    
    Serial.println("✅ [EC CONFIG] Config recebida com sucesso:");
    Serial.printf("   EC Setpoint: %.0f µS/cm\n", config.ec_setpoint);
    Serial.printf("   Auto Enabled: %s\n", config.auto_enabled ? "SIM" : "NÃO");
    Serial.printf("   Intervalo: %d segundos\n", config.intervalo_auto_ec);
    Serial.printf("   Tempo Recirculação: %lu segundos (%.1f minutos)\n", 
                 config.tempo_recirculacao, config.tempo_recirculacao / 60.0);
    Serial.printf("   Distribution: %s\n", config.hasDistribution ? "SIM" : "NÃO");
    
    return true;
}
```

---

### **2. Estrutura de Dados ECConfig**

**Arquivo:** `ESP-HIDROWAVE-main/include/SupabaseClient.h` ou `HydroControl.h`

```cpp
// ✅ Estrutura para config EC
struct ECConfig {
    // Parâmetros básicos
    double base_dose;
    double flow_rate;
    double volume;
    double total_ml;
    double kp;
    double ec_setpoint;
    bool auto_enabled;
    int intervalo_auto_ec;  // ✅ SEGUNDOS
    int long tempo_recirculacao;  // ✅ SEGUNDOS (converter para ms quando usar delay())
    
    // Nutrients
    struct Nutrient {
        String name;
        int relay;
        double mlPerLiter;
        bool active;
    } nutrients[8];
    int nutrientsCount;
    
    // Distribution (se existir)
    struct Distribution {
        double totalUt;
        int intervalo;
        struct DistributionItem {
            String name;
            int relay;
            double dosage;      // ml
            double duration;    // SEGUNDOS
        } items[8];
        int count;
    } distribution;
    bool hasDistribution;
};
```

---

### **3. Integração no HydroControl**

**Arquivo:** `ESP-HIDROWAVE-main/src/HydroControl.cpp`

```cpp
void HydroControl::checkAutoEC() {
    // Se controle automático não está habilitado, não fazer nada
    if (!autoECEnabled) {
        return;
    }
    
    // Verificar intervalo de verificação
    unsigned long currentMillis = millis();
    unsigned long checkInterval = autoECIntervalSeconds > 0 ? 
        (autoECIntervalSeconds * 1000) : EC_CHECK_INTERVAL;
    
    if (currentMillis - lastECCheck < checkInterval) {
        return;  // Ainda não é hora de verificar
    }
    
    lastECCheck = currentMillis;
    
    // ✅ NOVO: Buscar config do Supabase via RPC activate_auto_ec
    if (supabaseClient) {
        ECConfig config;
        if (supabaseClient->getECConfigFromSupabase(config)) {
            // ✅ Atualizar parâmetros do controller
            ecController.setParameters(
                config.base_dose,
                config.flow_rate,
                config.volume,
                config.total_ml
            );
            ecController.setKp(config.kp);
            ecSetpoint = config.ec_setpoint;
            autoECEnabled = config.auto_enabled;
            autoECIntervalSeconds = config.intervalo_auto_ec;
            
            // ✅ Se tem distribution, usar diretamente
            if (config.hasDistribution && config.distribution.count > 0) {
                Serial.println("🌐 [AUTO EC] Usando distribution do Supabase");
                
                // Converter distribution para JsonArray
                DynamicJsonDocument distDoc(2048);
                JsonArray distArray = distDoc.to<JsonArray>();
                
                for (int i = 0; i < config.distribution.count; i++) {
                    JsonObject item = distArray.createNestedObject();
                    item["name"] = config.distribution.items[i].name;
                    item["relay"] = config.distribution.items[i].relay;
                    item["dosage"] = config.distribution.items[i].dosage;
                    item["duration"] = config.distribution.items[i].duration;  // SEGUNDOS
                }
                
                // ✅ Executar dosagem usando distribution
                executeWebDosage(distArray, config.distribution.intervalo);
                return;  // Já executou, não precisa calcular
            }
        } else {
            Serial.println("⚠️ [AUTO EC] Não foi possível buscar config do Supabase");
            // Continuar com cálculo local se falhar
        }
    }
    
    // ✅ FALLBACK: Calcular localmente se não tem distribution
    // Verificar se precisa de ajuste (tolerância padrão: 50 µS/cm)
    if (ecController.needsAdjustment(ecSetpoint, ec, 50.0)) {
        float dosageML = ecController.calculateDosage(ecSetpoint, ec);
        
        if (dosageML > 0.1) {
            if (currentState == IDLE) {
                startSimpleSequentialDosage(dosageML, ecSetpoint, ec);
            } else {
                Serial.println("⚠️  Auto EC: Sistema sequencial já ativo");
            }
        }
    }
}
```

---

### **4. Chamar Periodicamente no Loop**

**Arquivo:** `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp`

```cpp
void HydroSystemCore::loop() {
    // ... outros checks ...
    
    // ✅ NOVO: Verificar Auto EC periodicamente
    // Chamar checkAutoEC() que já busca config do Supabase
    if (hydroControl.isAutoECEnabled()) {
        hydroControl.checkAutoEC();
    }
    
    // ... resto do loop ...
}
```

---

## 🔄 **FLUXO COMPLETO: ESP32 Auto EC**

```
┌─────────────────────────────────────────────────────────────┐
│ ESP32 Loop (a cada intervalo_auto_ec segundos)             │
│                                                              │
│ if (autoECEnabled) {                                        │
│   checkAutoEC();                                            │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ checkAutoEC()                                               │
│                                                              │
│ 1. Verificar intervalo (não verificar muito frequente)     │
│ 2. POST /rpc/activate_auto_ec                              │
│    { "p_device_id": "ESP32_XXX" }                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase RPC activate_auto_ec                               │
│                                                              │
│ 1. SELECT ... FOR UPDATE SKIP LOCKED  ← 🔒 LOCK            │
│ 2. UPDATE auto_enabled = true                              │
│ 3. RETURN config completa com distribution                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ ESP32 Recebe Config                                         │
│                                                              │
│ 1. Parse JSON                                               │
│ 2. Atualizar parâmetros do controller                     │
│ 3. Se tem distribution → executeWebDosage(distribution)    │
│ 4. Se não tem → calcular localmente                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **RESUMO DAS COMUNICAÇÕES**

### **Mensagens ESP32 → Supabase (Auto EC):**

| # | Método | Endpoint | Frequência | Lock? |
|---|--------|----------|------------|-------|
| 1 | `POST` | `/rest/v1/rpc/activate_auto_ec` | A cada `intervalo_auto_ec` segundos | ✅ **SIM** (`FOR UPDATE SKIP LOCKED`) |

### **Outras Mensagens (Não relacionadas a Auto EC):**

| # | Método | Endpoint | Frequência | Propósito |
|---|--------|----------|------------|------------|
| 2 | `PATCH` | `/rest/v1/device_status` | 10-30s | Heartbeat |
| 3 | `POST` | `/rest/v1/rpc/get_and_lock_slave_commands` | 10-30s | Comandos slaves |
| 4 | `POST` | `/rest/v1/rpc/get_and_lock_master_commands` | 10-30s | Comandos master |
| 5 | `PATCH` | `/rest/v1/relay_commands_*` | Após executar | Atualizar status |

---

## ✅ **RESPOSTAS ÀS PERGUNTAS**

### **1. Usamos lock?**
✅ **SIM!** O RPC `activate_auto_ec` usa `FOR UPDATE SKIP LOCKED` para lock atômico.

### **2. Quais mensagens do ESP32 para Auto EC?**
✅ **Apenas 1 mensagem:**
- `POST /rest/v1/rpc/activate_auto_ec` - Busca config ativada (com lock)

**Frequência:** A cada `intervalo_auto_ec` segundos (ex: 300s = 5 minutos)

---

## 🎯 **PRÓXIMOS PASSOS**

1. ✅ **RPC já criado** - `CREATE_RPC_ACTIVATE_AUTO_EC.sql`
2. ⚠️ **Implementar no ESP32:**
   - Função `getECConfigFromSupabase()`
   - Integrar em `checkAutoEC()`
   - Chamar periodicamente no loop

---

**Data:** 2025-01-12  
**Status:** ✅ **DOCUMENTAÇÃO COMPLETA - PRONTO PARA IMPLEMENTAR**

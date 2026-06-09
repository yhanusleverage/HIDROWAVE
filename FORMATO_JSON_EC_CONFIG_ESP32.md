# 📋 FORMATO JSON: EC_CONFIG QUE CHEGA NO ESP32 MASTER

## 🎯 **COMO O ESP32 BUSCA EC_CONFIG**

### **Opção 1: GET Direto (Atual)**
```
GET /rest/v1/ec_controller_config?device_id=eq.ESP32_XXX
```

### **Opção 2: RPC (Recomendado)**
```
POST /rest/v1/rpc/get_ec_controller_config
{
  "p_device_id": "ESP32_XXX"
}
```

### **Opção 3: RPC Activate Auto EC (Nova Arquitetura)**
```
POST /rest/v1/rpc/activate_auto_ec
{
  "p_device_id": "ESP32_XXX"
}
```

---

## 📦 **FORMATO COMPLETO DO JSON**

### **JSON que chega no ESP32 Master:**

```json
{
  "id": 1,
  "device_id": "ESP32_HIDRO_F44738",
  
  // ✅ Parâmetros Básicos
  "base_dose": 0.0,           // EC base em µS/cm
  "flow_rate": 1.0,           // Taxa de vazão em ml/s
  "volume": 10.0,             // Volume do reservatório em litros
  "total_ml": 15.5,           // Total de ml/L (soma de todos os nutrientes)
  "kp": 1.0,                  // Ganho proporcional do PID (0.1 a 10.0)
  "ec_setpoint": 1200.0,      // Setpoint desejado de EC em µS/cm
  
  // ✅ Controle Automático
  "auto_enabled": true,        // Se o controle automático está ativado
  "intervalo_auto_ec": 300,   // Intervalo em segundos entre verificações (1-3600)
  "tempo_recirculacao": 60000, // Tempo de recirculação em milissegundos
  
  // ✅ Array de Nutrientes (JSONB)
  "nutrients": [
    {
      "name": "Grow",
      "relay": 0,              // Número do relé (0-15)
      "mlPerLiter": 2.5,       // ML por litro deste nutriente
      "proportion": 0.4,       // Proporção (0.0 a 1.0)
      "active": true           // Se o nutriente está ativo
    },
    {
      "name": "Micro",
      "relay": 1,
      "mlPerLiter": 1.5,
      "proportion": 0.3,
      "active": true
    },
    {
      "name": "Bloom",
      "relay": 2,
      "mlPerLiter": 2.0,
      "proportion": 0.3,
      "active": true
    }
  ],
  
  // ✅ Metadados
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:30:00Z",
  "created_by": "web_interface"
}
```

---

## 🔍 **DETALHAMENTO DE CADA CAMPO**

### **1. Parâmetros Básicos:**

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `base_dose` | `double` | EC base em µS/cm | `0.0` |
| `flow_rate` | `double` | Taxa de vazão em ml/s | `1.0` |
| `volume` | `double` | Volume do reservatório em litros | `10.0` |
| `total_ml` | `double` | Total de ml/L (soma de nutrientes) | `15.5` |
| `kp` | `double` | Ganho proporcional PID (0.1-10.0) | `1.0` |
| `ec_setpoint` | `double` | Setpoint desejado em µS/cm | `1200.0` |

---

### **2. Controle Automático:**

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `auto_enabled` | `boolean` | Controle automático ativado? | `true` |
| `intervalo_auto_ec` | `integer` | Intervalo entre verificações (segundos) | `300` |
| `tempo_recirculacao` | `integer` | Tempo de recirculação (milissegundos) | `60000` |

---

### **3. Array de Nutrientes (`nutrients`):**

**Tipo:** `JSONB` (Array de objetos)

**Estrutura de cada nutriente:**
```json
{
  "name": "Grow",           // Nome do nutriente (string)
  "relay": 0,               // Número do relé (0-15)
  "mlPerLiter": 2.5,        // ML por litro (double)
  "proportion": 0.4,        // Proporção (0.0-1.0)
  "active": true            // Se está ativo (boolean)
}
```

**Exemplo completo:**
```json
"nutrients": [
  {
    "name": "Grow",
    "relay": 0,
    "mlPerLiter": 2.5,
    "proportion": 0.4,
    "active": true
  },
  {
    "name": "Micro",
    "relay": 1,
    "mlPerLiter": 1.5,
    "proportion": 0.3,
    "active": true
  },
  {
    "name": "Bloom",
    "relay": 2,
    "mlPerLiter": 2.0,
    "proportion": 0.3,
    "active": true
  }
]
```

---

### **4. Distribuição de Dosagem:**

**✅ REMOVIDO** - O ESP32 calcula a distribuição localmente usando os dados de `nutrients` (nome, relay, mlPerLiter).

---

## 📡 **COMO O ESP32 RECEBE**

### **Método 1: GET Direto (Atual)**

```cpp
// ESP32 faz GET
http.begin(SUPABASE_URL + "/rest/v1/ec_controller_config?device_id=eq." + deviceId);
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

int httpCode = http.GET();
String response = http.getString();

// Parsear JSON
DynamicJsonDocument doc(2048);
deserializeJson(doc, response);

// Acessar campos
double baseDose = doc[0]["base_dose"];
double flowRate = doc[0]["flow_rate"];
bool autoEnabled = doc[0]["auto_enabled"];

// Acessar array de nutrientes
JsonArray nutrients = doc[0]["nutrients"];
for (JsonObject nutrient : nutrients) {
  String name = nutrient["name"];
  int relay = nutrient["relay"];
  double mlPerLiter = nutrient["mlPerLiter"];
  bool active = nutrient["active"];
  // ESP32 calcula distribuição localmente usando estes dados
}
```

---

### **Método 2: RPC (Recomendado)**

```cpp
// ESP32 faz POST para RPC
http.begin(SUPABASE_URL + "/rest/v1/rpc/get_ec_controller_config");
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument payload(256);
payload["p_device_id"] = deviceId;

String jsonPayload;
serializeJson(payload, jsonPayload);
int httpCode = http.POST(jsonPayload);

String response = http.getString();
// Parsear igual ao método 1
```

---

### **Método 3: RPC Activate Auto EC (Nova Arquitetura)**

```cpp
// ESP32 faz POST para RPC activate_auto_ec
http.begin(SUPABASE_URL + "/rest/v1/rpc/activate_auto_ec");
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

DynamicJsonDocument payload(256);
payload["p_device_id"] = deviceId;

String jsonPayload;
serializeJson(payload, jsonPayload);
int httpCode = http.POST(jsonPayload);

String response = http.getString();
// Retorna o mesmo formato do JSON acima
```

---

## 📊 **VALORES PADRÃO (Se não encontrado)**

Se o ESP32 buscar e não encontrar configuração, deve usar:

```json
{
  "device_id": "ESP32_XXX",
  "base_dose": 0.0,
  "flow_rate": 0.0,
  "volume": 0.0,
  "total_ml": 0.0,
  "kp": 1.0,
  "ec_setpoint": 0.0,
  "auto_enabled": false,
  "intervalo_auto_ec": 300,
  "tempo_recirculacao": 60000,
  "nutrients": [],
}
```

---

## ⚠️ **NOTAS IMPORTANTES**

1. **`total_ml` pode estar vazio:**
   - Se `nutrients` estiver vazio → `total_ml = 0`
   - Se `nutrients` tiver dados mas não calcular → `total_ml = 0`
   - **Solução:** Calcular no frontend antes de salvar

2. **`distribution` foi removido:**
   - ESP32 calcula localmente usando `nutrients` (nome, relay, mlPerLiter)
   - Não precisa enviar do frontend

3. **`nutrients` pode estar vazio:**
   - Array vazio `[]` se não houver nutrientes configurados
   - ESP32 deve verificar `nutrients.length() > 0` antes de usar

4. **Tipos de dados:**
   - `base_dose`, `flow_rate`, `volume`, `total_ml`, `kp`, `ec_setpoint` → `double` (REAL no PostgreSQL)
   - `intervalo_auto_ec` → `integer`
   - `tempo_recirculacao` → `integer` (milissegundos)
   - `auto_enabled` → `boolean`
   - `nutrients` → `JSONB` (array)
   - `distribution` → `JSONB` (objeto ou null)

---

## 🔍 **EXEMPLO REAL (Minimalista)**

```json
{
  "device_id": "ESP32_HIDRO_F44738",
  "base_dose": 0.0,
  "flow_rate": 1.0,
  "volume": 10.0,
  "total_ml": 6.0,
  "kp": 1.0,
  "ec_setpoint": 1200.0,
  "auto_enabled": true,
  "intervalo_auto_ec": 300,
  "tempo_recirculacao": 60000,
  "nutrients": [
    {
      "name": "Grow",
      "relay": 0,
      "mlPerLiter": 2.5,
      "proportion": 0.4,
      "active": true
    },
    {
      "name": "Micro",
      "relay": 1,
      "mlPerLiter": 1.5,
      "proportion": 0.3,
      "active": true
    },
    {
      "name": "Bloom",
      "relay": 2,
      "mlPerLiter": 2.0,
      "proportion": 0.3,
      "active": true
    }
  ],
}
```

---

## ✅ **RESUMO**

**Formato do JSON que chega no ESP32:**
- ✅ Objeto JSON com todos os campos acima
- ✅ `nutrients` é um array de objetos (nome, relay, mlPerLiter, proportion, active)
- ✅ **Distribution removido** - ESP32 calcula localmente usando `nutrients`
- ✅ Todos os campos numéricos são `double` (exceto `intervalo_auto_ec` que é `integer`)
- ✅ `tempo_recirculacao` está em **milissegundos** (ex: 60000 = 1 minuto)

**Se `total_ml` estiver vazio:**
- Verificar se `nutrients` tem dados
- Calcular: `total_ml = soma de todos os mlPerLiter dos nutrientes ativos`


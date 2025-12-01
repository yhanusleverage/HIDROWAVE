# 🚀 PASO 1: Implementar Decision Engine (Conciso)

## 📍 **DÓNDE VA A RODAR:**

### **1 segundo (EC_config):**
- **Ubicación:** `HydroSystemCore::loop()` → `hydroControl.update()` → `checkAutoEC()`
- **Ya existe:** ✅ Funcionando

### **30 segundos (Decision Engine):**
- **Ubicación:** `HydroSystemCore::loop()` (mismo lugar)
- **Agregar:** Lógica de Decision Engine

---

## ✅ **PASO 1: Crear RPC para Decision Rules**

**Archivo:** `scripts/CREAR_DECISION_RULES_E_RPC.sql` (ya existe, solo ejecutar)

```sql
-- ✅ RPC similar a get_and_lock_slave_commands
CREATE OR REPLACE FUNCTION get_active_decision_rules(
  p_device_id text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  device_id text,
  rule_id text,
  rule_name text,
  rule_json jsonb,
  enabled boolean,
  priority integer,
  created_by text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.device_id,
    dr.rule_id,
    dr.rule_name,
    dr.rule_json,
    dr.enabled,
    dr.priority,
    dr.created_by
  FROM public.decision_rules dr
  WHERE dr.device_id = p_device_id
    AND dr.enabled = true
  ORDER BY dr.priority DESC, dr.created_at ASC
  LIMIT p_limit;
END;
$$;
```

**Ejecutar en Supabase:** ✅ Ya está en el script

---

## ✅ **PASO 2: Agregar en HydroSystemCore::loop()**

**Archivo:** `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp`

**Ubicación:** Después de `hydroControl.loop()` (línea ~399)

```cpp
void HydroSystemCore::loop() {
  if (!systemReady) return;
  
  unsigned long now = millis();
  
  // ... código existente ...
  
  // ✅ EC Controller (cada 1s - ya existe)
  hydroControl.loop();  // ← Ya está aquí
  
  // ✅ Decision Engine (cada 30s - NUEVO)
  static unsigned long lastDecisionCheck = 0;
  const unsigned long DECISION_CHECK_INTERVAL = 30000;  // 30 segundos
  
  if (now - lastDecisionCheck >= DECISION_CHECK_INTERVAL) {
    evaluateDecisionRules();  // ← NUEVA FUNCIÓN
    lastDecisionCheck = now;
  }
  
  // ... resto del código ...
}
```

---

## ✅ **PASO 3: Crear función evaluateDecisionRules()**

**Archivo:** `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp`

```cpp
void HydroSystemCore::evaluateDecisionRules() {
  if (!supabaseConnected) return;
  
  Serial.println("🧠 [DECISION] Evaluando regras...");
  
  // 1. Buscar regras ativas (RPC)
  String endpoint = "rpc/get_active_decision_rules";
  DynamicJsonDocument payloadDoc(256);
  payloadDoc["p_device_id"] = getDeviceID();
  payloadDoc["p_limit"] = 50;
  
  String payload;
  serializeJson(payloadDoc, payload);
  
  // 2. POST para Supabase
  HTTPClient http;
  http.begin(secureClient, baseUrl + "/rest/v1/" + endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(8192);
    deserializeJson(doc, response);
    
    // 3. Avaliar cada regra
    JsonArray rules = doc.as<JsonArray>();
    for (JsonObject rule : rules) {
      bool conditionMet = evaluateRuleCondition(rule["rule_json"]);
      
      if (conditionMet) {
        // 4. Criar comando em relay_commands_slave
        createCommandFromRule(rule);
      }
    }
  }
  
  http.end();
}
```

---

## ✅ **PASO 4: Usar RPC existente para comandos**

**Ya existe:** `get_and_lock_slave_commands()` ✅

**Decision Engine crea comando:**
```cpp
void HydroSystemCore::createCommandFromRule(JsonObject rule) {
  // POST para relay_commands_slave
  // command_type: 'rule'
  // triggered_by: 'rule'
  // rule_id: rule["rule_id"]
  // ... resto igual a comandos manuais
}
```

**ESP32 processa comando:**
```cpp
// Ya existe en checkForSlaveCommands()
// Usa el MESMO RPC get_and_lock_slave_commands()
// ✅ No necesita cambios!
```

---

## 🎯 **RESUMEN:**

1. **✅ RPC:** `get_active_decision_rules()` (ya existe en script)
2. **✅ Loop:** Agregar en `HydroSystemCore::loop()` (30s)
3. **✅ Función:** `evaluateDecisionRules()` (nueva)
4. **✅ Comandos:** Usar `get_and_lock_slave_commands()` (ya existe)

**Todo se ejecuta en `HydroSystemCore::loop()`:**
- EC_config: cada 1s (ya existe)
- Decision Engine: cada 30s (nuevo)

# 🔄 COMO IMPLEMENTAR REBOOT_COUNT NO ESP32

## 🎯 **PROBLEMA IDENTIFICADO**

O `reboot_count` **NÃO está sendo enviado** pelo ESP32 porque:

1. ❌ A estrutura `DeviceStatusData` (em `SupabaseClient.h`) **NÃO tem** o campo `reboot_count`
2. ❌ A função `buildDeviceStatusPayload()` (em `SupabaseClient.cpp`) **NÃO inclui** `reboot_count` no JSON
3. ❌ Não existe código para **gerar/incrementar** o contador no ESP32

---

## ✅ **SOLUÇÃO COMPLETA**

### **ETAPA 1: Adicionar reboot_count à estrutura DeviceStatusData**

**Arquivo:** `ESP-HIDROWAVE-main - copia/include/SupabaseClient.h`

**Localização:** Linha ~54-64 (estrutura `DeviceStatusData`)

**Mudança:**
```cpp
struct DeviceStatusData {
    String deviceId;
    int wifiRssi;
    uint32_t freeHeap;
    unsigned long uptimeSeconds;
    bool relayStates[16];
    bool isOnline;
    String firmwareVersion;
    String ipAddress;
    unsigned long timestamp;
    int rebootCount;  // ✅ ADICIONAR ESTA LINHA
};
```

---

### **ETAPA 2: Incluir reboot_count no payload**

**Arquivo:** `ESP-HIDROWAVE-main - copia/src/SupabaseClient.cpp`

**Localização:** Linha ~590-610 (função `buildDeviceStatusPayload()`)

**Mudança:**
```cpp
String SupabaseClient::buildDeviceStatusPayload(const DeviceStatusData& status) {
    DynamicJsonDocument doc(1024);
    
    doc["device_id"] = status.deviceId;
    doc["last_seen"] = "now()";
    doc["wifi_rssi"] = status.wifiRssi;
    doc["free_heap"] = status.freeHeap;
    doc["uptime_seconds"] = status.uptimeSeconds;
    doc["is_online"] = status.isOnline;
    doc["firmware_version"] = status.firmwareVersion;
    doc["ip_address"] = status.ipAddress;
    doc["updated_at"] = "now()";
    doc["reboot_count"] = status.rebootCount;  // ✅ ADICIONAR ESTA LINHA
    
    String payload;
    serializeJson(doc, payload);
    return payload;
}
```

---

### **ETAPA 3: Criar sistema de contador persistente no ESP32**

**Arquivo:** `ESP-HIDROWAVE-main - copia/src/main.cpp` ou criar novo arquivo `RebootCounter.cpp`

**Código para adicionar:**

```cpp
#include <Preferences.h>

// ✅ Classe para gerenciar contador de reinícios
class RebootCounter {
private:
    Preferences preferences;
    int currentCount;
    bool initialized;
    
public:
    RebootCounter() : currentCount(0), initialized(false) {}
    
    // ✅ Inicializar e incrementar contador
    int begin() {
        if (initialized) return currentCount;
        
        preferences.begin("device", true);  // Modo read-only primeiro
        currentCount = preferences.getInt("reboot_count", 0);
        preferences.end();
        
        // ✅ Incrementar (este é o reboot atual)
        currentCount++;
        
        // ✅ Salvar novo valor
        preferences.begin("device", false);  // Modo write
        preferences.putInt("reboot_count", currentCount);
        preferences.end();
        
        initialized = true;
        Serial.printf("🔄 Reboot count: %d\n", currentCount);
        
        return currentCount;
    }
    
    // ✅ Obter contador atual
    int getCount() const {
        return currentCount;
    }
    
    // ✅ Resetar contador (para testes)
    void reset() {
        preferences.begin("device", false);
        preferences.putInt("reboot_count", 0);
        preferences.end();
        currentCount = 0;
        Serial.println("🔄 Reboot count resetado");
    }
};

// ✅ Instância global
RebootCounter rebootCounter;
```

**No `setup()` do ESP32:**
```cpp
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    // ✅ Inicializar contador de reinícios (PRIMEIRO!)
    int rebootCount = rebootCounter.begin();
    Serial.printf("🚀 Sistema iniciado - Reboot #%d\n", rebootCount);
    
    // ... resto do código ...
}
```

**Ao atualizar device_status:**
```cpp
DeviceStatusData status;
status.deviceId = getDeviceID();
status.wifiRssi = WiFi.RSSI();
status.freeHeap = ESP.getFreeHeap();
status.uptimeSeconds = millis() / 1000;
status.isOnline = true;
status.firmwareVersion = FIRMWARE_VERSION;
status.ipAddress = WiFi.localIP().toString();
status.rebootCount = rebootCounter.getCount();  // ✅ ADICIONAR ESTA LINHA

supabaseClient.updateDeviceStatus(status);
```

---

### **ETAPA 4: Criar trigger no Supabase para manter máximo**

**Arquivo:** `HIDROWAVE-main - copia/scripts/TRIGGER_REBOOT_COUNT_MAX.sql`

**Executar no Supabase SQL Editor:**

```sql
-- ✅ Função para manter sempre o MAIOR valor de reboot_count
CREATE OR REPLACE FUNCTION maintain_max_reboot_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- ✅ Se reboot_count está sendo atualizado
  IF NEW.reboot_count IS NOT NULL THEN
    -- ✅ Se já existe um registro (UPDATE)
    IF OLD.reboot_count IS NOT NULL THEN
      -- ✅ Manter o MAIOR valor entre o novo (ESP32) e o antigo (acumulado)
      NEW.reboot_count := GREATEST(NEW.reboot_count, OLD.reboot_count);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ✅ Criar trigger
DROP TRIGGER IF EXISTS trigger_maintain_max_reboot_count ON device_status;

CREATE TRIGGER trigger_maintain_max_reboot_count
  BEFORE INSERT OR UPDATE ON device_status
  FOR EACH ROW
  WHEN (NEW.reboot_count IS NOT NULL)
  EXECUTE FUNCTION maintain_max_reboot_count();
```

---

## 🔄 **FLUXO COMPLETO**

### **1. ESP32 inicia:**
```
setup() → rebootCounter.begin()
  → Carrega: 3 (do Preferences)
  → Incrementa: 4
  → Salva: 4 (no Preferences)
  → Retorna: 4
```

### **2. ESP32 envia heartbeat:**
```
updateDeviceStatus() → buildDeviceStatusPayload()
  → Inclui: "reboot_count": 4
  → PATCH /rest/v1/device_status
```

### **3. Supabase recebe:**
```
Trigger: maintain_max_reboot_count()
  → Compara: NEW.reboot_count (4) vs OLD.reboot_count (5)
  → Mantém: GREATEST(4, 5) = 5
  → Salva: 5
```

### **4. Frontend incrementa (via RPC):**
```
POST /api/device/reboot
  → RPC: increment_reboot_count()
  → Atualiza: reboot_count = 6
```

### **5. ESP32 envia próximo heartbeat:**
```
PATCH com reboot_count = 4
  → Trigger compara: GREATEST(4, 6) = 6
  → Mantém: 6 (não perde o incremento do frontend!)
```

---

## 📝 **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] **1. Adicionar `rebootCount` à estrutura `DeviceStatusData`** (SupabaseClient.h)
- [ ] **2. Incluir `reboot_count` no payload** (SupabaseClient.cpp)
- [ ] **3. Criar classe `RebootCounter`** (novo arquivo ou main.cpp)
- [ ] **4. Inicializar contador no `setup()`** (main.cpp)
- [ ] **5. Passar `rebootCount` ao atualizar status** (onde chama updateDeviceStatus)
- [ ] **6. Executar script SQL do trigger** (Supabase Dashboard)
- [ ] **7. Testar:**
   - [ ] ESP32 reinicia → contador incrementa
   - [ ] Frontend incrementa → contador aumenta
   - [ ] ESP32 envia heartbeat → mantém o maior valor

---

## 🎯 **RESULTADO ESPERADO**

Após implementar, o `reboot_count` será:
- ✅ **Gerado** no ESP32 (usando Preferences)
- ✅ **Enviado** no heartbeat (PATCH device_status)
- ✅ **Acumulado** no Supabase (trigger mantém máximo)
- ✅ **Incrementado** pelo frontend (via RPC)
- ✅ **Nunca perdido** (sempre mantém o maior valor)

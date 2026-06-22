# 🤖 Implementação Automática: Trusted Slaves → Supabase

## 🎯 OBJETIVO

**Copiar os dados de `trustedSlaves` do ESP32 Master e registrar automaticamente no Supabase**, exatamente como fazemos com os comandos de relés, mas ao invés de acionar relés, estamos **registrando MAC address e nome**.

---

## 📋 1. O QUE JÁ EXISTE NO ESP32 MASTER

### 1.1 Estrutura TrustedSlave

**Arquivo**: `include/MasterSlaveManager.h`

```cpp
struct TrustedSlave {
    uint8_t macAddress[6];      // ✅ MAC address do slave
    String deviceName;          // ✅ Nome do dispositivo
    String deviceType;           // Tipo (ex: "RelayBox")
    SlaveStatus status;          // ONLINE, OFFLINE, etc.
    uint8_t numRelays;          // Número de relés
    // ... outros campos
};
```

### 1.2 Funções Existentes

**Arquivo**: `src/MasterSlaveManager.cpp`

```cpp
// ✅ JÁ EXISTE: Adiciona slave à lista trustedSlaves
bool addTrustedSlave(const uint8_t* macAddress, const String& deviceName, const String& deviceType);

// ✅ JÁ EXISTE: Retorna todos os trustedSlaves
std::vector<TrustedSlave> getAllTrustedSlaves();

// ✅ JÁ EXISTE: Callback quando slave é descoberto
void setSlaveDiscoveredCallback(std::function<void(const uint8_t*, const String&, const String&)> callback);
```

---

## 🔧 2. IMPLEMENTAÇÃO: REGISTRO AUTOMÁTICO NO SUPABASE

### 2.1 Função de Registro (Similar a Comandos de Relés)

**Onde adicionar**: `src/MasterSlaveManager.cpp` ou `src/SupabaseClient.cpp`

```cpp
#include "SupabaseClient.h"
#include "DeviceRegistration.h"

/**
 * Registra automaticamente um TrustedSlave no Supabase
 * 
 * Similar ao fluxo de comandos de relés:
 * - Comandos: cria relay_commands → ESP32 busca → envia via ESP-NOW
 * - Registro: cria device_status → ESP32 busca → atualiza localmente
 * 
 * @param slave TrustedSlave com MAC e nome
 * @return true se registrado com sucesso
 */
bool MasterSlaveManager::registerSlaveInSupabase(const TrustedSlave& slave) {
    // 1. Converter MAC para String (formato AA:BB:CC:DD:EE:FF)
    String macStr = ESPNowController::macToString(slave.macAddress);
    
    // 2. Criar device_id único (formato: ESP32_SLAVE_AA_BB_CC_DD_EE_FF)
    String deviceId = "ESP32_SLAVE_" + macStr;
    deviceId.replace(":", "_");
    
    // 3. Obter user_email do Master (já está salvo nas Preferences)
    String userEmail = getUserEmailFromPreferences();
    if (userEmail.isEmpty()) {
        Serial.println("❌ Erro: user_email não encontrado. Slave não será registrado.");
        return false;
    }
    
    // 4. Obter location do Master (opcional)
    String location = getMasterLocation(); // Ex: "Estufa Principal"
    
    // 5. Chamar função RPC do Supabase (igual ao registro do Master)
    // Usar a mesma função que já existe: register_device_with_email
    bool success = DeviceRegistration::registerDeviceWithEmail(
        deviceId,           // device_id
        macStr,             // mac_address
        userEmail,          // user_email (do Master)
        slave.deviceName,   // device_name (do TrustedSlave)
        location,           // location
        "",                 // ip_address (null, pois ESP-NOW não usa IP)
        "ESP32_SLAVE"       // device_type (IMPORTANTE!)
    );
    
    if (success) {
        Serial.println("✅ Slave registrado no Supabase:");
        Serial.println("   MAC: " + macStr);
        Serial.println("   Nome: " + slave.deviceName);
        Serial.println("   Device ID: " + deviceId);
        
        // 6. Atualizar device_type para ESP32_SLAVE (se necessário)
        updateDeviceTypeInSupabase(deviceId, "ESP32_SLAVE");
        
        return true;
    } else {
        Serial.println("❌ Erro ao registrar slave no Supabase: " + macStr);
        return false;
    }
}

/**
 * Atualiza device_type no Supabase após registro
 */
void MasterSlaveManager::updateDeviceTypeInSupabase(const String& deviceId, const String& deviceType) {
    // Usar SupabaseClient para fazer PATCH
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/device_status";
    url += "?device_id=eq." + deviceId;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    
    DynamicJsonDocument update(256);
    update["device_type"] = deviceType;
    update["last_seen"] = getCurrentTimestamp();
    update["is_online"] = true;
    
    String jsonUpdate;
    serializeJson(update, jsonUpdate);
    
    int httpCode = http.PATCH(jsonUpdate);
    http.end();
    
    if (httpCode == 200 || httpCode == 204) {
        Serial.println("✅ device_type atualizado: " + deviceType);
    } else {
        Serial.println("⚠️ Erro ao atualizar device_type: " + String(httpCode));
    }
}
```

### 2.2 Integração no Callback de Descoberta

**Onde modificar**: `src/MasterSlaveManager.cpp` - função `addTrustedSlave()`

```cpp
bool MasterSlaveManager::addTrustedSlave(const uint8_t* macAddress, const String& deviceName, const String& deviceType) {
    // ... código existente ...
    
    // Criar novo TrustedSlave
    TrustedSlave newSlave(macAddress);
    newSlave.deviceName = deviceName;
    newSlave.deviceType = deviceType;
    newSlave.status = SlaveStatus::ONLINE;
    
    trustedSlaves.push_back(newSlave);
    
    // ✅ NOVO: Registrar automaticamente no Supabase
    Serial.println("📡 Registrando slave no Supabase...");
    if (registerSlaveInSupabase(newSlave)) {
        Serial.println("✅ Slave registrado com sucesso no Supabase!");
    } else {
        Serial.println("⚠️ Falha ao registrar slave no Supabase (continuando...)");
        // Não falhar completamente, apenas logar o erro
    }
    
    // Chamar callback (se existir)
    if (slaveDiscoveredCallback) {
        slaveDiscoveredCallback(macAddress, deviceName, deviceType);
    }
    
    return true;
}
```

### 2.3 Sincronização Periódica

**Onde adicionar**: `src/main.cpp` ou `src/HydroSystemCore.cpp`

```cpp
/**
 * Sincroniza todos os trustedSlaves com Supabase
 * 
 * Útil para:
 * - Inicialização (registrar slaves já conhecidos)
 * - Recuperação após reinicialização
 * - Sincronização manual via comando
 */
void syncAllTrustedSlavesToSupabase() {
    auto trustedSlaves = masterManager->getAllTrustedSlaves();
    
    if (trustedSlaves.empty()) {
        Serial.println("⚠️ Nenhum trustedSlave para sincronizar");
        return;
    }
    
    Serial.println("🔄 Sincronizando " + String(trustedSlaves.size()) + " trustedSlave(s) com Supabase...");
    
    int successCount = 0;
    for (const auto& slave : trustedSlaves) {
        if (masterManager->registerSlaveInSupabase(slave)) {
            successCount++;
        }
        delay(500); // Pequeno delay entre registros
    }
    
    Serial.println("✅ " + String(successCount) + " de " + String(trustedSlaves.size()) + " slave(s) sincronizado(s)");
}
```

---

## 🔄 3. FLUXO COMPLETO AUTOMÁTICO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ESP32 Master recebe pacote ESP-NOW de novo Slave         │
│    Callback: onReceiveESPNow()                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. MasterSlaveManager detecta que é novo slave               │
│    - Extrai MAC address                                     │
│    - Extrai deviceName (se disponível)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Chama addTrustedSlave()                                   │
│    - Adiciona à lista trustedSlaves                         │
│    - Cria TrustedSlave com MAC e nome                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. AUTOMÁTICO: registerSlaveInSupabase()                    │
│    - Converte MAC para String                               │
│    - Cria device_id único                                   │
│    - Obtém user_email do Master                             │
│    - Chama register_device_with_email                       │
│    - Atualiza device_type para ESP32_SLAVE                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Supabase registra em device_status                       │
│    - device_id: ESP32_SLAVE_AA_BB_CC_DD_EE_FF              │
│    - mac_address: AA:BB:CC:DD:EE:FF                         │
│    - device_name: Nome do TrustedSlave                      │
│    - device_type: ESP32_SLAVE                               │
│    - user_email: Email do Master                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Frontend busca slaves automaticamente                    │
│    - getESPNOWSlaves() busca device_type = 'ESP32_SLAVE'    │
│    - Aparece no gerenciador de nomes                        │
│    - Usuário pode nomear relés                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 4. PAYLOAD PARA SUPABASE

### 4.1 Chamada RPC: `register_device_with_email`

```json
{
  "p_device_id": "ESP32_SLAVE_AA_BB_CC_DD_EE_FF",
  "p_mac_address": "AA:BB:CC:DD:EE:FF",
  "p_user_email": "usuario@email.com",
  "p_device_name": "Nome do TrustedSlave",
  "p_location": "Estufa Principal",
  "p_ip_address": null
}
```

### 4.2 PATCH para atualizar device_type

```json
{
  "device_type": "ESP32_SLAVE",
  "last_seen": "2024-01-15T10:30:00Z",
  "is_online": true
}
```

---

## ✅ 5. DIFERENÇAS: COMANDOS vs REGISTRO

| Aspecto | Comandos de Relés | Registro de Slaves |
|---------|-------------------|-------------------|
| **Tabela** | `relay_commands` | `device_status` |
| **API** | `/api/esp-now/command` | `/api/device/register` |
| **Dados** | relay_number, action, duration | MAC, device_name, device_type |
| **Fluxo** | Frontend → Supabase → ESP32 → ESP-NOW | ESP32 → Supabase → Frontend |
| **Trigger** | Manual/Automação | Descoberta automática |
| **Via** | HTTP/WebSocket | HTTP (RPC) |

---

## 🎯 6. RESUMO DA IMPLEMENTAÇÃO

### O que fazer:

1. **Adicionar função `registerSlaveInSupabase()`** em `MasterSlaveManager.cpp`
   - Usa dados de `TrustedSlave` (MAC e nome)
   - Chama `register_device_with_email` (igual ao Master)
   - Atualiza `device_type` para `ESP32_SLAVE`

2. **Chamar automaticamente em `addTrustedSlave()`**
   - Quando slave é adicionado à lista
   - Registra no Supabase automaticamente

3. **Sincronização na inicialização**
   - Chamar `syncAllTrustedSlavesToSupabase()` no `setup()`
   - Garante que slaves já conhecidos sejam registrados

### Resultado:

- ✅ Slaves aparecem automaticamente no frontend
- ✅ MAC e nome já estão corretos (vindos de `trustedSlaves`)
- ✅ Usuário pode nomear relés imediatamente
- ✅ Tudo automático, sem intervenção manual

---

## 🚀 PRÓXIMOS PASSOS

1. Implementar `registerSlaveInSupabase()` no ESP32 Master
2. Integrar em `addTrustedSlave()`
3. Testar com um slave real
4. Verificar se aparece no frontend automaticamente

**Tudo pronto no Frontend e Supabase!** Só falta adicionar essas funções no ESP32 Master. 🎉


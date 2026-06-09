/**
 * CÓDIGO PARA ADICIONAR EM MasterSlaveManager.cpp
 * 
 * Função específica para registrar ESP-NOW Slaves no Supabase
 * Usa dados de TrustedSlave (MAC e nome)
 */

#include "SupabaseClient.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

/**
 * Registra TrustedSlave no Supabase via RPC register_device_with_email
 * 
 * @param slave TrustedSlave com MAC, nome e número de relés
 * @return true se registrado com sucesso
 */
bool MasterSlaveManager::registerSlaveInSupabase(const TrustedSlave& slave) {
    // 1. Converter MAC para String (AA:BB:CC:DD:EE:FF)
    String macStr = ESPNowController::macToString(slave.macAddress);
    
    // 2. Criar device_id único
    String deviceId = "ESP32_SLAVE_" + macStr;
    deviceId.replace(":", "_");
    
    // 3. Obter user_email do Master (Preferences)
    Preferences preferences;
    preferences.begin("hydro", true);
    String userEmail = preferences.getString("user_email", "");
    preferences.end();
    
    if (userEmail.isEmpty()) {
        Serial.println("❌ user_email não encontrado nas Preferences");
        return false;
    }
    
    // 4. Obter location do Master (Preferences ou padrão)
    preferences.begin("hydro", true);
    String location = preferences.getString("location", "Estufa Principal");
    preferences.end();
    
    // 5. Preparar payload JSON para RPC
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/rpc/register_device_with_email";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    
    DynamicJsonDocument payload(512);
    payload["p_device_id"] = deviceId;
    payload["p_mac_address"] = macStr;
    payload["p_user_email"] = userEmail;
    payload["p_device_name"] = slave.deviceName.isEmpty() ? "ESP-NOW Slave " + macStr : slave.deviceName;
    payload["p_location"] = location;
    payload["p_ip_address"] = (char*)nullptr; // null
    
    String jsonPayload;
    serializeJson(payload, jsonPayload);
    
    // 6. Chamar RPC
    int httpCode = http.POST(jsonPayload);
    String response = http.getString();
    http.end();
    
    if (httpCode == 200 || httpCode == 201) {
        Serial.println("✅ Slave registrado no Supabase:");
        Serial.println("   MAC: " + macStr);
        Serial.println("   Nome: " + slave.deviceName);
        Serial.println("   Device ID: " + deviceId);
        
        // 7. Atualizar device_type para ESP32_SLAVE
        updateDeviceTypeInSupabase(deviceId, "ESP32_SLAVE");
        
        return true;
    } else {
        Serial.println("❌ Erro ao registrar slave: HTTP " + String(httpCode));
        Serial.println("   Resposta: " + response);
        return false;
    }
}

/**
 * Atualiza device_type no Supabase após registro
 */
void MasterSlaveManager::updateDeviceTypeInSupabase(const String& deviceId, const String& deviceType) {
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/device_status";
    url += "?device_id=eq." + deviceId;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    
    DynamicJsonDocument doc(256);
    doc["device_type"] = deviceType;
    doc["last_seen"] = getCurrentTimestamp();
    doc["is_online"] = true;
    
    String json;
    serializeJson(doc, json);
    
    int httpCode = http.PATCH(json);
    http.end();
    
    if (httpCode == 200 || httpCode == 204) {
        Serial.println("✅ device_type atualizado: " + deviceType);
    } else {
        Serial.println("⚠️ Erro ao atualizar device_type: HTTP " + String(httpCode));
    }
}

/**
 * MODIFICAR addTrustedSlave() - Adicionar chamada automática
 */
bool MasterSlaveManager::addTrustedSlave(const uint8_t* macAddress, const String& deviceName, const String& deviceType) {
    // ... código existente de verificação ...
    
    // Verificar se já existe
    for (auto& slave : trustedSlaves) {
        if (memcmp(slave.macAddress, macAddress, 6) == 0) {
            Serial.println("⚠️ Slave já existe: " + ESPNowController::macToString(macAddress));
            return false;
        }
    }
    
    // Criar novo TrustedSlave
    TrustedSlave newSlave(macAddress);
    newSlave.deviceName = deviceName;
    newSlave.deviceType = deviceType;
    newSlave.status = SlaveStatus::ONLINE;
    newSlave.numRelays = 8; // Padrão
    
    trustedSlaves.push_back(newSlave);
    
    Serial.println("📥 Slave adicionado a trustedSlaves:");
    Serial.println("   MAC: " + ESPNowController::macToString(macAddress));
    Serial.println("   Nome: " + deviceName);
    
    // ✅ NOVO: Registrar automaticamente no Supabase
    Serial.println("📡 Registrando slave no Supabase...");
    if (registerSlaveInSupabase(newSlave)) {
        Serial.println("✅ Slave registrado com sucesso no Supabase!");
    } else {
        Serial.println("⚠️ Falha ao registrar no Supabase (continuando...)");
        // Não falhar completamente, apenas logar
    }
    
    // Chamar callback se existir
    if (slaveDiscoveredCallback) {
        slaveDiscoveredCallback(macAddress, deviceName, deviceType);
    }
    
    return true;
}

/**
 * Sincronizar todos os trustedSlaves com Supabase (útil na inicialização)
 */
void MasterSlaveManager::syncAllTrustedSlavesToSupabase() {
    if (trustedSlaves.empty()) {
        Serial.println("⚠️ Nenhum trustedSlave para sincronizar");
        return;
    }
    
    Serial.println("🔄 Sincronizando " + String(trustedSlaves.size()) + " trustedSlave(s) com Supabase...");
    
    int successCount = 0;
    for (const auto& slave : trustedSlaves) {
        if (registerSlaveInSupabase(slave)) {
            successCount++;
        }
        delay(500); // Delay entre registros
    }
    
    Serial.println("✅ " + String(successCount) + " de " + String(trustedSlaves.size()) + " slave(s) sincronizado(s)");
}


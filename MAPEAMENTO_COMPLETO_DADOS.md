# 🗺️ Mapeamento Completo: TrustedSlaves → Frontend

## 📊 **FLUXO COMPLETO DE DADOS:**

### **1. ESP32 Master - TrustedSlaves (Memória Interna):**

```cpp
// MasterSlaveManager.cpp
std::vector<TrustedSlave> trustedSlaves;

struct TrustedSlave {
    uint8_t macAddress[6];
    String deviceName;
    String deviceType;
    uint8_t numRelays;
    RelayState relayStates[16];  // ✅ Estados dos relés
    
    struct RelayState {
        bool state;              // ON/OFF
        bool hasTimer;          // Tem timer?
        int remainingTime;      // Tempo restante
        String name;            // Nome do relé
        unsigned long lastUpdate; // Última atualização
    };
};
```

**Fonte:** Memória do ESP32 Master

---

### **2. ESP32 Master - WebServerManager (Endpoint /api/slaves):**

```cpp
// WebServerManager.cpp linha 309-374
webTask->addEndpoint("/api/slaves", HTTP_GET, [this](AsyncWebServerRequest *request) {
    // Buscar TrustedSlaves
    std::vector<TrustedSlave> trustedSlaves = this->masterManager->getAllTrustedSlaves();
    
    // Converter para JSON
    for (const auto& slave : trustedSlaves) {
        JsonObject slaveObj = slavesArray.createNestedObject();
        slaveObj["device_id"] = "ESP32_SLAVE_" + macToString(slave.macAddress);
        slaveObj["device_name"] = slave.deviceName;
        slaveObj["mac_address"] = macToString(slave.macAddress);
        slaveObj["is_online"] = slave.isOnline();
        slaveObj["num_relays"] = slave.numRelays;
        
        // ✅ CRÍTICO: Incluir estados dos relés
        JsonArray relaysArray = slaveObj.createNestedArray("relays");
        for (int i = 0; i < slave.numRelays; i++) {
            JsonObject relayObj = relaysArray.createNestedObject();
            relayObj["relay_number"] = i;
            relayObj["name"] = slave.relayStates[i].name;
            relayObj["state"] = slave.relayStates[i].state;        // ✅ Estado real
            relayObj["has_timer"] = slave.relayStates[i].hasTimer;  // ✅ Timer
            relayObj["remaining_time"] = slave.relayStates[i].remainingTime; // ✅ Tempo restante
        }
    }
    
    request->send(200, "application/json", response);
});
```

**Fonte:** `MasterSlaveManager::getAllTrustedSlaves()`

**Formato:** JSON via HTTP

---

### **3. Next.js API Proxy - /api/esp-now/slaves:**

```typescript
// route.ts
export async function GET(request: Request) {
    // 1. Buscar IP do Master do Supabase
    const targetIP = masterIP || await getIPFromSupabase(masterDeviceId);
    
    // 2. Fazer fetch para Master
    const response = await fetch(`http://${targetIP}/api/slaves`);
    
    // 3. Retornar JSON sem modificação
    const data = await response.json();
    return NextResponse.json(data);
}
```

**Fonte:** ESP32 Master HTTP endpoint

**Formato:** JSON (pass-through)

---

### **4. Frontend - esp32-api.ts:**

```typescript
// getSlavesFromMaster()
export async function getSlavesFromMaster(masterDeviceId: string): Promise<ESP32Slave[]> {
    // 1. Buscar IP do Master
    const masterIP = await getMasterIP(masterDeviceId);
    
    // 2. Fazer fetch via API proxy
    const response = await fetch(
        `/api/esp-now/slaves?master_ip=${masterIP}&master_device_id=${masterDeviceId}`
    );
    
    // 3. Converter para ESP32Slave[]
    const data: ESP32SlavesResponse = await response.json();
    return data.slaves; // ESP32Slave[]
}

interface ESP32Slave {
    device_id: string;
    device_name: string;
    mac_address: string;
    is_online: boolean;
    num_relays: number;
    last_seen: number;
    relays: ESP32Relay[];  // ✅ Estados incluídos
}

interface ESP32Relay {
    relay_number: number;
    name: string;
    state: boolean;          // ✅ Estado real do Master
    has_timer: boolean;      // ✅ Timer
    remaining_time: number; // ✅ Tempo restante
}
```

**Fonte:** Next.js API Proxy

**Formato:** TypeScript interfaces

---

### **5. Frontend - esp-now-slaves.ts:**

```typescript
// getESPNOWSlaves()
export async function getESPNOWSlaves(
    masterDeviceId: string,
    userEmail: string
): Promise<ESPNowSlave[]> {
    // 1. Buscar slaves do Master
    const esp32Slaves = await getSlavesFromMaster(masterDeviceId);
    
    // 2. Buscar nomes personalizados do Supabase
    const relayNamesMap = await getRelayNamesFromSupabase(deviceIds);
    
    // 3. Converter ESP32Slave → ESPNowSlave
    const slaves: ESPNowSlave[] = esp32Slaves.map((esp32Slave) => {
        const relays: SlaveRelayConfig[] = esp32Slave.relays.map((esp32Relay) => {
            return {
                id: esp32Relay.relay_number,
                name: personalizedName || esp32Relay.name,
                // ✅ NOVO: Incluir informações completas
                state: esp32Relay.state,              // ✅ Estado real
                has_timer: esp32Relay.has_timer,      // ✅ Timer
                remaining_time: esp32Relay.remaining_time, // ✅ Tempo restante
            } as any;
        });
        
        return {
            macAddress: esp32Slave.mac_address,
            name: esp32Slave.device_name,
            status: esp32Slave.is_online ? 'online' : 'offline',
            relays,
            device_id: esp32Slave.device_id,
            last_seen: new Date(esp32Slave.last_seen).toISOString(),
        };
    });
    
    return slaves;
}
```

**Fonte:** `getSlavesFromMaster()` + Supabase (nomes)

**Formato:** `ESPNowSlave[]`

---

### **6. Frontend - automacao/page.tsx:**

```typescript
// loadESPNOWSlaves()
const slaves = await getESPNOWSlaves(selectedDeviceId, userProfile.email);
setEspnowSlaves(slaves);

// ✅ Sincronizar estados reais
slaves.forEach(slave => {
    slave.relays.forEach(relay => {
        const relayKey = `${slave.macAddress}-${relay.id}`;
        const realState = (relay as any).state;
        if (realState !== undefined) {
            setRelayStates(prev => new Map(prev).set(relayKey, realState));
        }
    });
});

// Renderizar
{slave.relays.map(relay => {
    const realState = (relay as any).state ?? false;
    const isRelayOn = relayStates.get(relayKey) ?? realState;
    // ...
})}
```

**Fonte:** `getESPNOWSlaves()`

**Formato:** React state + renderização

---

## 🔄 **FLUXO DOS ACKs:**

### **1. Slave Envia ACK:**

```cpp
// RelayCommandBox::onRelayCommand()
bool success = setRelay(relayNumber, state);

// Enviar ACK via ESP-NOW
// ⚠️ PROBLEMA: commandId é local (uint32_t), não supabaseCommandId
espNowController->sendRelayCommandAck(
    masterMac,
    commandId,        // ⚠️ ID local, não do Supabase!
    success,
    relayNumber,
    currentState
);
```

---

### **2. Master Recebe ACK:**

```cpp
// MasterSlaveManager::processRelayCommandAck()
void MasterSlaveManager::processRelayCommandAck(
    const RelayCommandAck& ack,
    const uint8_t* senderMac
) {
    // 1. Atualizar estado no TrustedSlave
    slave->relayStates[ack.relayNumber].state = (ack.currentState == 1);
    
    // 2. Remover da fila de retry
    // ⚠️ PROBLEMA: removeFromRetryQueue usa commandId local
    removeFromRetryQueue(ack.commandId);
    
    // 3. Atualizar Supabase
    // ⚠️ PROBLEMA: ack.commandId é local, não supabaseCommandId!
    // Precisa mapear commandId local → supabaseCommandId
    if (ack.commandId > 0) {
        // ⚠️ Como mapear?
        int supabaseCommandId = mapLocalToSupabase(ack.commandId);
        if (supabaseCommandId > 0) {
            supabase.markCommandCompleted(supabaseCommandId);
        }
    }
}
```

---

### **3. Mapeamento Command ID:**

**Problema Identificado:** ⚠️

```cpp
// MasterSlaveManager::sendRelayCommandToSlave()
uint32_t commandId = generateCommandId(); // Local (uint32_t)
int supabaseCommandId = ...; // Do Supabase (int)

// Enviar comando
espNowController->sendRelayCommand(..., commandId); // ⚠️ Envia commandId local

// Adicionar à fila de retry (tem ambos os IDs)
addToRetryQueue(..., commandId, supabaseCommandId);

// Quando receber ACK:
// ⚠️ ACK tem commandId local, mas precisa do supabaseCommandId
// ⚠️ Precisa buscar na fila de retry!
```

**Solução:**
```cpp
// Buscar na fila de retry para mapear
PendingRelayCommand* pendingCmd = findInRetryQueue(ack.commandId);
if (pendingCmd) {
    int supabaseCommandId = pendingCmd->supabaseCommandId;
    supabase.markCommandCompleted(supabaseCommandId);
}
```

---

## ⚠️ **TRINCHERAS OBSCURAS IDENTIFICADAS:**

### **1. Command ID não mapeado para Supabase:**

**Problema:** ACK tem `commandId` local, mas Supabase precisa do `id` (supabaseCommandId)

**Solução:** Buscar na fila de retry para mapear

---

### **2. Estados podem estar desatualizados:**

**Problema:** `relayStates` no `TrustedSlave` pode não refletir estado real se ACK não foi recebido

**Solução:** ✅ Já implementado - atualiza quando recebe ACK

---

### **3. Frontend não recebe ACKs em tempo real:**

**Problema:** Frontend só verifica ACKs a cada 5 segundos (polling)

**Solução:** ✅ Já implementado - polling funciona, mas WebSocket seria melhor

---

## 📋 **CHECKLIST DE VERIFICAÇÃO:**

- [ ] **1.** Slave envia ACK com commandId correto?
- [ ] **2.** Master mapeia commandId local → supabaseCommandId?
- [ ] **3.** Master atualiza Supabase com supabaseCommandId correto?
- [ ] **4.** Frontend busca ACKs do Supabase?
- [ ] **5.** Frontend atualiza estado baseado em ACK?

---

## 💡 **PRÓXIMOS PASSOS:**

1. **Verificar mapeamento Command ID** no Master
2. **Testar se ACKs atualizam Supabase** corretamente
3. **Verificar se estados são sincronizados** corretamente

**Quer que eu verifique o código do Master para o mapeamento de Command ID?** 🎯


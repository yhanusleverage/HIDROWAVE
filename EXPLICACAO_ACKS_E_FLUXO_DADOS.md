# 🔄 Explicação: ACKs e Fluxo Completo de Dados

## 📊 **COMO FUNCIONAM OS ACKs:**

### **Fluxo Completo do ACK:**

```
1. Frontend envia comando
   ↓
2. API cria registro em relay_commands (status: 'pending')
   ↓
3. Master busca comando do Supabase
   ↓
4. Master envia via ESP-NOW para Slave
   ↓
5. Slave recebe comando
   ↓
6. Slave executa comando (aciona relé)
   ↓
7. ✅ SLAVE ENVIA ACK VIA ESP-NOW
   ↓
8. Master recebe ACK
   ↓
9. Master atualiza estado em TrustedSlave
   ↓
10. Master atualiza Supabase (status: 'completed' ou 'failed')
   ↓
11. Frontend busca ACKs do Supabase
   ↓
12. Frontend atualiza estado local
```

---

## 🔍 **DETALHAMENTO DO ACK:**

### **1. Slave Envia ACK:**

**Quando:** Após executar comando de relé

**Estrutura:**
```cpp
struct RelayCommandAck {
    uint32_t commandId;       // ID do comando sendo confirmado
    uint8_t relayNumber;      // Número do relé
    uint8_t success;          // 1=sucesso, 0=falha
    uint8_t currentState;     // Estado atual do relé (0=OFF, 1=ON)
    uint32_t timestamp;       // Quando foi executado
    uint8_t checksum;         // Checksum
};
```

**Código (Slave):**
```cpp
// RelayCommandBox::onRelayCommand()
bool success = setRelay(relayNumber, state);

// Enviar ACK via ESP-NOW
espNowController->sendRelayCommandAck(
    masterMac,
    commandId,
    success,
    relayNumber,
    currentState
);
```

---

### **2. Master Recebe ACK:**

**Código (Master):**
```cpp
// MasterSlaveManager::processRelayCommandAck()
void MasterSlaveManager::processRelayCommandAck(
    const RelayCommandAck& ack,
    const uint8_t* senderMac
) {
    // 1. Atualizar estado do relé no TrustedSlave
    TrustedSlave* slave = getTrustedSlave(senderMac);
    if (slave && ack.success) {
        slave->relayStates[ack.relayNumber].state = (ack.currentState == 1);
        slave->relayStates[ack.relayNumber].lastUpdate = millis();
    }
    
    // 2. Remover da fila de retry
    if (ack.success) {
        removeFromRetryQueue(ack.commandId);
    }
    
    // 3. Atualizar Supabase
    if (ack.commandId > 0) { // Se tem supabaseCommandId
        if (ack.success) {
            supabase.markCommandCompleted(ack.commandId);
        } else {
            supabase.markCommandFailed(ack.commandId, "Falha no Slave");
        }
    }
    
    // 4. Chamar callback
    if (relayAckCallback) {
        relayAckCallback(senderMac, ack.commandId, ack.success, 
                        ack.relayNumber, ack.currentState);
    }
}
```

---

### **3. Master Atualiza Supabase:**

**Código:**
```cpp
// SupabaseClient::markCommandCompleted()
bool SupabaseClient::markCommandCompleted(int commandId) {
    String endpoint = "relay_commands?id=eq." + String(commandId);
    String payload = "{\"status\":\"completed\",\"updated_at\":\"" + 
                     getCurrentTimestamp() + "\"}";
    return makeRequest("PATCH", endpoint, payload);
}
```

---

### **4. Frontend Busca ACKs:**

**Código:**
```typescript
// GET /api/esp-now/command-acks?master_device_id=...
const response = await fetch(`/api/esp-now/command-acks?master_device_id=${selectedDeviceId}`);
const result = await response.json();

// Atualizar estados baseado em ACKs
acks.forEach(ack => {
  const relayKey = commandToRelayMap.current.get(ack.command_id);
  if (relayKey && ack.status === 'completed') {
    setRelayStates(prev => new Map(prev).set(relayKey, ack.action === 'on'));
  }
});
```

---

## 🔄 **FLUXO COMPLETO: TrustedSlaves → Frontend**

### **Caminho dos Dados:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ESP32 MASTER - TrustedSlaves (Memória)                       │
│    std::vector<TrustedSlave> trustedSlaves                     │
│    - slave.relayStates[0-7].state                               │
│    - slave.relayStates[0-7].hasTimer                            │
│    - slave.relayStates[0-7].remainingTime                       │
└────────────────────┬────────────────────────────────────────────┘
                     │ getAllTrustedSlaves()
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ESP32 MASTER - WebServerManager                              │
│    /api/slaves endpoint                                         │
│    - Converte TrustedSlave → JSON                                │
│    - Inclui relayStates no JSON                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP GET /api/slaves
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. NEXT.JS API PROXY - /api/esp-now/slaves                      │
│    route.ts                                                      │
│    - Faz fetch para Master                                       │
│    - Retorna JSON sem modificação                                │
└────────────────────┬────────────────────────────────────────────┘
                     │ JSON Response
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND - esp32-api.ts                                      │
│    getSlavesFromMaster()                                        │
│    - Faz fetch para /api/esp-now/slaves                          │
│    - Converte para ESP32Slave[]                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ ESP32Slave[]
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND - esp-now-slaves.ts                                 │
│    getESPNOWSlaves()                                            │
│    - Converte ESP32Slave → ESPNowSlave                           │
│    - Busca nomes personalizados do Supabase                      │
│    - Inclui state, has_timer, remaining_time                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ ESPNowSlave[]
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. FRONTEND - automacao/page.tsx                                │
│    - Renderiza slaves                                           │
│    - Mostra estados dos relés                                     │
│    - Sincroniza com relayStates                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ **POSSÍVEIS "TRINCHERAS OBSCURAS":**

### **1. TrustedSlaves não está sincronizado com ACKs:**

**Problema:** `relayStates` no `TrustedSlave` pode não estar atualizado

**Verificar:**
```cpp
// MasterSlaveManager::processRelayCommandAck()
// Deve atualizar: slave->relayStates[ack.relayNumber].state
```

**Solução:** ✅ Já implementado (linha 1521)

---

### **2. Endpoint /api/slaves não retorna relayStates atualizados:**

**Problema:** JSON pode não incluir estados mais recentes

**Verificar:**
```cpp
// WebServerManager.cpp linha 355
relayObj["state"] = slave.relayStates[i].state;
```

**Solução:** ✅ Já implementado

---

### **3. Frontend não sincroniza estados reais:**

**Problema:** Frontend usa estado local, não estado real do Master

**Verificar:**
```typescript
// esp-now-slaves.ts linha 92-94
state: esp32Relay.state,  // ✅ Já incluído
has_timer: esp32Relay.has_timer,
remaining_time: esp32Relay.remaining_time,
```

**Solução:** ✅ Já implementado

---

### **4. ACKs não atualizam Supabase:**

**Problema:** Master recebe ACK mas não atualiza Supabase

**Verificar:**
```cpp
// MasterSlaveManager::processRelayCommandAck()
// Deve chamar: supabase.markCommandCompleted(ack.commandId)
```

**Solução:** Verificar se `ack.commandId` corresponde ao `supabaseCommandId`

---

### **5. Command ID não corresponde:**

**Problema:** `commandId` do ESP-NOW não é o mesmo do Supabase

**Verificar:**
```cpp
// MasterSlaveManager::sendRelayCommandToSlave()
// Passa: supabaseCommandId (do Supabase)
// Gera: commandId (local, uint32_t)

// Slave envia ACK com commandId local
// Master precisa mapear commandId local → supabaseCommandId
```

**Solução:** ⚠️ **POSSÍVEL PROBLEMA!**

---

## 🔧 **PROBLEMA IDENTIFICADO:**

### **Mapeamento Command ID:**

**Problema:** 
- Master gera `commandId` local (uint32_t)
- Master passa `supabaseCommandId` para Slave
- Slave envia ACK com `commandId` local
- Master precisa mapear `commandId` local → `supabaseCommandId`

**Verificar:**
```cpp
// MasterSlaveManager::sendRelayCommandToSlave()
uint32_t commandId = generateCommandId(); // Local
// ...
espNowController->sendRelayCommand(..., commandId); // Envia commandId local

// Slave recebe commandId local
// Slave envia ACK com commandId local

// Master recebe ACK
// Master precisa mapear commandId local → supabaseCommandId
```

**Solução:** Criar mapeamento `commandId → supabaseCommandId` no Master

---

## 📋 **CHECKLIST DE VERIFICAÇÃO:**

- [ ] **1.** Slave envia ACK após executar comando?
- [ ] **2.** Master recebe ACK corretamente?
- [ ] **3.** Master atualiza `relayStates` no `TrustedSlave`?
- [ ] **4.** Master atualiza Supabase com status 'completed'?
- [ ] **5.** Command ID local mapeia para supabaseCommandId?
- [ ] **6.** Frontend busca ACKs do Supabase?
- [ ] **7.** Frontend atualiza estado baseado em ACK?

---

## 💡 **PRÓXIMOS PASSOS:**

1. **Verificar mapeamento Command ID** no Master
2. **Verificar se ACKs atualizam Supabase** corretamente
3. **Testar fluxo completo** do ACK

**Quer que eu verifique o mapeamento de Command ID no Master?** 🎯


# 📚 Explicação: WebServerManager Queue e Sistema de Mapeamento

## 🌐 Parte 1: WebServerManager e Processamento de Queue

### **Como Funciona o Sistema de Queue**

O `WebServerManager` usa uma **FreeRTOS Queue** para comunicação thread-safe entre cores do ESP32:

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITETURA                              │
│                                                             │
│  Core 1 (WebServerTask)          Core 0 (Loop Principal)    │
│  ──────────────────────          ─────────────────────     │
│                                                             │
│  1. Usuário acessa dashboard     │                          │
│     web (192.168.x.x)            │                          │
│     ↓                            │                          │
│  2. WebServerManager recebe      │                          │
│     requisição HTTP              │                          │
│     ↓                            │                          │
│  3. Cria WebCommand struct       │                          │
│     ↓                            │                          │
│  4. Envia para Queue             │                          │
│     (sendCommandToQueue)         │                          │
│     ↓                            │                          │
│                                  │  5. HydroSystemCore      │
│                                  │     recebe da Queue      │
│                                  │     (receiveCommand)     │
│                                  │     ↓                    │
│                                  │  6. processWebCommands() │
│                                  │     processa comando     │
│                                  │     ↓                    │
│                                  │  7. Executa ação         │
│                                  │     (relé, status, etc)  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Estrutura WebCommand**

```cpp
struct WebCommand {
    enum Type {
        RELAY_CONTROL,      // Controlar relé (on/off/toggle)
        GET_STATUS,         // Obter status geral
        GET_SLAVES,         // Obter lista de slaves
        DISCOVER_SLAVES,    // Forçar discovery de slaves
        ALL_RELAYS_ON,      // Encender todos os relays
        ALL_RELAYS_OFF      // Apagar todos os relays
    };
    
    Type type;
    uint8_t slaveMac[6];
    String deviceId;
    uint8_t relayNumber;
    String action;          // "on", "off", "toggle"
    int duration;
    uint32_t requestId;     // ID único para rastrear resposta
};
```

### **Fluxo Completo**

#### **1. Core 1 (WebServerTask) - Recebe Requisição**

```cpp
// WebServerManager.h - Core 1
void setupUnifiedRoutes() {
    server->on("/api/relay/control", HTTP_POST, [this](AsyncWebServerRequest* request) {
        // Parsear JSON da requisição
        JsonObject json = jsonBuffer.parseObject(request->arg("plain"));
        
        // Criar WebCommand
        WebCommand cmd;
        cmd.type = WebCommand::RELAY_CONTROL;
        cmd.relayNumber = json["relay"];
        cmd.action = json["action"].as<String>();
        cmd.deviceId = json["deviceId"].as<String>();
        
        // ✅ Enviar para Queue (thread-safe)
        if (sendCommandToQueue(cmd, 100)) {
            request->send(200, "application/json", "{\"status\":\"queued\"}");
        } else {
            request->send(500, "application/json", "{\"error\":\"queue_full\"}");
        }
    });
}
```

#### **2. Core 0 (Loop Principal) - Processa Comando**

```cpp
// HydroSystemCore.cpp - Core 0
void HydroSystemCore::processWebCommands() {
    if (!webServerManager) return;
    
    // ✅ Receber comando da Queue (não-bloqueante)
    WebCommand cmd;
    if (webServerManager->receiveCommand(cmd, 0)) {  // timeout=0 = não bloqueia
        Serial.printf("📥 Comando recebido: type=%d, relay=%d, action=%s\n",
                     cmd.type, cmd.relayNumber, cmd.action.c_str());
        
        // Processar segundo tipo
        switch (cmd.type) {
            case WebCommand::RELAY_CONTROL: {
                // Executar comando de relé
                if (cmd.deviceId.isEmpty()) {
                    // Comando para Master (local)
                    executeLocalRelayCommand(cmd);
                } else {
                    // Comando para Slave (ESP-NOW)
                    sendRelayCommandToSlave(cmd);
                }
                break;
            }
            case WebCommand::GET_STATUS: {
                // Atualizar cache de status
                updateSystemCache();
                break;
            }
            // ... outros tipos
        }
    }
}
```

### **Vantagens do Sistema de Queue**

✅ **Thread-Safe:** Comunicação segura entre cores sem race conditions
✅ **Não-Bloqueante:** Core 1 não espera Core 0 processar
✅ **Desacoplado:** WebServer e lógica de negócio separados
✅ **Escalável:** Fácil adicionar novos tipos de comando

### **Cache de Dados (SystemDataCache)**

```cpp
struct SystemDataCache {
    unsigned long lastUpdate;
    int totalSlaves;
    int onlineSlaves;
    bool wifiConnected;
    String wifiIP;
    String slavesJson;  // JSON com lista de slaves
    // ...
};
```

**Como funciona:**
- **Core 0:** Atualiza cache periodicamente (`updateSystemCache()`)
- **Core 1:** Lê cache quando necessário (`getSystemCache()`)
- **Proteção:** Mutex (`systemCacheMutex`) garante thread-safety

---

## 🔗 Parte 2: Sistema de Mapeamento commandId → supabaseCommandId

### **O Problema**

Quando enviamos um comando via ESP-NOW:
1. `sendRelayCommandToSlave()` gera um `commandId` interno (ESP-NOW)
2. Recebemos `supabaseCommandId` como parâmetro
3. Quando recebemos ACK, temos apenas o `commandId` (ESP-NOW)
4. **Precisamos do `supabaseCommandId` para atualizar o banco!**

### **Solução Atual (Incompleta)**

```cpp
// ❌ PROBLEMA: Mapeamento não é criado quando enviamos comando
void processSlaveCommand(const RelayCommand& cmd) {
    // Enviar comando
    masterManager->sendRelayCommandToSlave(..., cmd.id);
    
    // ❌ Não temos o commandId do ESP-NOW para criar mapeamento!
}

// Callback recebe commandId (ESP-NOW) mas não encontra mapeamento
void relayAckCallback(uint32_t commandId, ...) {
    int supabaseId = findSupabaseCommandId(commandId);  // ❌ Retorna 0!
    // ...
}
```

---

## 🎯 Opção 1: Modificar `sendRelayCommandToSlave()` para Retornar `commandId`

### **Implementação**

```cpp
// MasterSlaveManager.h
uint32_t sendRelayCommandToSlave(..., int supabaseCommandId, ...);
// Retorna: commandId do ESP-NOW (0 se falhou)

// MasterSlaveManager.cpp
uint32_t MasterSlaveManager::sendRelayCommandToSlave(...) {
    // Gerar commandId
    uint32_t commandId = generateCommandId();
    
    // Enviar comando
    bool success = espNowController->sendRelayCommand(...);
    
    if (success) {
        return commandId;  // ✅ Retornar commandId
    }
    return 0;  // Falhou
}

// HydroSystemCore.cpp
void processSlaveCommand(const RelayCommand& cmd) {
    // ✅ Obter commandId do ESP-NOW
    uint32_t espNowCommandId = masterManager->sendRelayCommandToSlave(
        targetMac, 
        cmd.relayNumber, 
        cmd.action.c_str(), 
        cmd.durationSeconds,
        cmd.id,  // supabaseCommandId
        false
    );
    
    // ✅ Criar mapeamento IMEDIATAMENTE
    if (espNowCommandId > 0) {
        addCommandMapping(espNowCommandId, cmd.id);
    }
}
```

### **Vantagens**

✅ **Simples:** Mapeamento criado imediatamente após enviar
✅ **Confiável:** Sempre temos o mapeamento quando ACK chega
✅ **Rápido:** Não precisa buscar em outros lugares
✅ **Direto:** Lógica clara e fácil de entender

### **Desvantagens**

❌ **Mudança de API:** Precisa modificar assinatura da função
❌ **Retorno diferente:** Muda de `bool` para `uint32_t`
❌ **Compatibilidade:** Pode quebrar código que já usa a função
❌ **Casos especiais:** Se comando vai para fila (slave offline), commandId pode não ser útil imediatamente

### **Complexidade: BAIXA** ⭐⭐

---

## 🎯 Opção 2: Usar `setSupabaseCommandCallback` Existente

### **Como Funciona Atualmente**

```cpp
// MasterSlaveManager já tem callback que recebe supabaseCommandId
masterManager->setSupabaseCommandCallback([this](int supabaseCommandId, 
                                                  bool success, 
                                                  const String& errorMessage) {
    // Este callback é chamado quando comando é processado
    // Já recebe supabaseCommandId diretamente!
});
```

### **Implementação**

```cpp
// HydroSystemCore.cpp - begin()
masterManager->setSupabaseCommandCallback([this](int supabaseCommandId, 
                                                  bool success, 
                                                  const String& errorMessage) {
    if (supabaseCommandId > 0 && supabaseConnected) {
        if (success) {
            bool currentState = (errorMessage == "true" || errorMessage == "1");
            
            // ✅ Marcar como completed
            supabase.markCommandCompleted(supabaseCommandId, currentState, true);
            
            // ✅ Buscar commandId do ESP-NOW do retry queue ou outro lugar
            // OU: Usar relayAckCallback para obter commandId e criar mapeamento reverso
        } else {
            supabase.markCommandFailed(supabaseCommandId, errorMessage, true);
        }
    }
});

// ✅ NOVO: Criar mapeamento REVERSO quando recebemos ACK
masterManager->setRelayAckCallback([this](const uint8_t* senderMac, 
                                           uint32_t commandId, 
                                           bool success, 
                                           uint8_t relayNumber, 
                                           uint8_t currentState) {
    // Buscar supabaseCommandId do retry queue ou usar callback acima
    // ...
});
```

### **Problema: Como Conectar os Dois Callbacks?**

**Solução A:** Usar retry queue para buscar supabaseCommandId

```cpp
// MasterSlaveManager mantém retry queue com ambos IDs
struct PendingCommand {
    uint32_t espNowCommandId;
    int supabaseCommandId;
    // ...
};

// Quando recebe ACK, busca na fila
PendingCommand* cmd = findInRetryQueue(commandId);
if (cmd) {
    // Temos supabaseCommandId!
    supabase.markCommandCompleted(cmd->supabaseCommandId, ...);
}
```

**Solução B:** Criar mapeamento no callback `setSupabaseCommandCallback`

```cpp
// Quando setSupabaseCommandCallback é chamado, já temos supabaseCommandId
// Mas não temos commandId do ESP-NOW ainda...

// ❌ PROBLEMA: Não sabemos qual commandId do ESP-NOW corresponde
```

### **Vantagens**

✅ **Não muda API:** Mantém assinatura atual
✅ **Compatibilidade:** Não quebra código existente
✅ **Já existe:** Callback já está implementado
✅ **Flexível:** Pode usar retry queue como fonte de verdade

### **Desvantagens**

❌ **Complexo:** Precisa conectar dois callbacks diferentes
❌ **Indireto:** Mapeamento não é explícito
❌ **Depende de retry queue:** Se comando não vai para fila, pode não funcionar
❌ **Timing:** Pode haver race condition entre callbacks

### **Complexidade: ALTA** ⭐⭐⭐⭐

---

## 🏆 Recomendação: Opção 1 (Modificar sendRelayCommandToSlave)

### **Por quê?**

1. **Mais Simples:** Lógica direta e fácil de entender
2. **Mais Confiável:** Mapeamento sempre criado quando necessário
3. **Mais Rápido:** Não precisa buscar em múltiplos lugares
4. **Menos Bugs:** Menos pontos de falha

### **Implementação Recomendada**

```cpp
// 1. Modificar assinatura (compatibilidade retroativa)
uint32_t sendRelayCommandToSlave(..., int supabaseCommandId = 0, ...);
// Retorna: commandId do ESP-NOW (0 se falhou)

// 2. Criar mapeamento imediatamente
uint32_t espNowCommandId = masterManager->sendRelayCommandToSlave(...);
if (espNowCommandId > 0 && cmd.id > 0) {
    addCommandMapping(espNowCommandId, cmd.id);
}

// 3. Callback usa mapeamento
void relayAckCallback(uint32_t commandId, ...) {
    int supabaseId = findSupabaseCommandId(commandId);  // ✅ Sempre encontra!
    // ...
}
```

### **Compatibilidade Retroativa**

```cpp
// Código antigo ainda funciona (supabaseCommandId = 0)
bool success = sendRelayCommandToSlave(mac, relay, "on", 0);
// Retorna commandId, mas código antigo ignora

// Código novo usa retorno
uint32_t cmdId = sendRelayCommandToSlave(mac, relay, "on", 0, supabaseId);
if (cmdId > 0) {
    addCommandMapping(cmdId, supabaseId);
}
```

---

## 📊 Comparação Final

| Critério | Opção 1 (Retornar commandId) | Opção 2 (Usar Callback) |
|----------|------------------------------|-------------------------|
| **Simplicidade** | ⭐⭐⭐⭐⭐ Muito Simples | ⭐⭐ Complexo |
| **Confiabilidade** | ⭐⭐⭐⭐⭐ Sempre funciona | ⭐⭐⭐ Pode falhar |
| **Performance** | ⭐⭐⭐⭐⭐ Rápido | ⭐⭐⭐ Médio |
| **Compatibilidade** | ⭐⭐⭐ Requer mudança | ⭐⭐⭐⭐⭐ Mantém API |
| **Manutenibilidade** | ⭐⭐⭐⭐⭐ Fácil | ⭐⭐ Difícil |
| **Complexidade** | ⭐⭐ Baixa | ⭐⭐⭐⭐ Alta |

---

## ✅ Conclusão

**Recomendação:** Implementar **Opção 1** (modificar `sendRelayCommandToSlave` para retornar `commandId`)

**Razões:**
1. Mais simples e direto
2. Mais confiável (sempre tem mapeamento)
3. Mais fácil de manter
4. Compatibilidade retroativa possível

**Próximos Passos:**
1. Modificar `sendRelayCommandToSlave()` para retornar `uint32_t`
2. Criar mapeamento imediatamente após enviar
3. Callback sempre encontra mapeamento
4. ✅ Sistema completo e funcional!


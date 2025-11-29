# 🔄 FLUXO COMPLETO: Comando Slave Relay (Do Clique ao Relé Físico)

## 📋 **VISÃO GERAL**

Este documento mapeia **TODO o caminho** de um comando de relay slave, desde o clique no botão no frontend até a execução física no ESP32 Slave.

---

## 🎯 **FLUXO COMPLETO (Passo a Passo)**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ FRONTEND - Clique no Botão                                   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ onClick={async () => {
                    │   fetch('/api/esp-now/command', {
                    │     method: 'POST',
                    │     body: JSON.stringify({
                    │       master_device_id: "ESP32_HIDRO_F44738",
                    │       slave_mac_address: "14:33:5C:38:BF:60",
                    │       relay_number: 0,
                    │       action: "on",
                    │       command_type: "manual",
                    │       triggered_by: "manual"
                    │     })
                    │   })
                    │ }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ API ROUTE - /api/esp-now/command                             │
│    Arquivo: src/app/api/esp-now/command/route.ts                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Valida dados recebidos
                    │ 2. Busca master_mac_address e user_email de device_status
                    │ 3. Prepara commandData com todos os campos
                    │ 4. Chama createRelayCommand(commandData)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ AUTOMATION LIB - createRelayCommand()                        │
│    Arquivo: src/lib/automation.ts                                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Detecta se é Slave (slave_mac_address existe)
                    │ 2. Converte relay_number → relay_numbers[] (array)
                    │ 3. Converte action → actions[] (array)
                    │ 4. Converte duration_seconds → duration_seconds[] (array)
                    │ 5. Prepara payload completo
                    │
                    │ SE (servidor):
                    │   → createSlaveCommandDirect(payload) ⚡ DIRETO
                    │ SE (cliente):
                    │   → fetch('/api/relay-commands/slave') 🌐 HTTP
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣ API ROUTE - /api/relay-commands/slave                        │
│    Arquivo: src/app/api/relay-commands/slave/route.ts           │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Valida arrays (relay_numbers, actions, duration_seconds)
                    │ 2. Chama createSlaveCommandDirect(payload)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣ AUTOMATION LIB - createSlaveCommandDirect()                  │
│    Arquivo: src/lib/automation.ts                                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Valida campos obrigatórios:
                    │    - master_device_id ✅
                    │    - user_email ✅
                    │    - master_mac_address ✅
                    │    - slave_device_id ✅
                    │    - slave_mac_address ✅
                    │    - relay_numbers[] ✅
                    │    - actions[] ✅
                    │
                    │ 2. Insere em Supabase:
                    │    supabase.from('relay_commands_slave').insert({
                    │      master_device_id,
                    │      user_email,
                    │      master_mac_address,
                    │      slave_device_id,
                    │      slave_mac_address,
                    │      relay_numbers: [0],      // ✅ ARRAY
                    │      actions: ['on'],          // ✅ ARRAY
                    │      duration_seconds: [0],   // ✅ ARRAY
                    │      command_type: 'manual',
                    │      priority: 10,
                    │      status: 'pending',        // ⏳ AGUARDANDO
                    │      triggered_by: 'manual'
                    │    })
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6️⃣ SUPABASE - Tabela relay_commands_slave                      │
│    Status: 'pending'                                             │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ⏳ Comando aguardando processamento...
                    │
                    │ ESP32 Master verifica a cada 10s (basePollingInterval)
                    │ via RPC: get_and_lock_slave_commands()
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7️⃣ ESP32 MASTER - Polling Supabase                              │
│    Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp          │
│    Função: checkSupabaseCommands()                               │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ A cada 10 segundos:
                    │
                    │ 1. Verifica se há memória suficiente para SSL
                    │ 2. Chama supabase.checkForSlaveCommands()
                    │
                    │ Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp
                    │ Função: checkForSlaveCommands()
                    │
                    │ 3. Faz POST para RPC:
                    │    POST /rest/v1/rpc/get_and_lock_slave_commands
                    │    {
                    │      "p_master_device_id": "ESP32_HIDRO_F44738",
                    │      "p_limit": 5,
                    │      "p_timeout_seconds": 30
                    │    }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8️⃣ SUPABASE RPC - get_and_lock_slave_commands()                 │
│    Função SQL (PostgreSQL)                                      │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Busca comandos pendentes:
                    │    WHERE master_device_id = p_master_device_id
                    │      AND status = 'pending'
                    │      AND expires_at > NOW()
                    │
                    │ 2. Ordena por:
                    │    - command_type (manual, rule, peristaltic)
                    │    - priority DESC
                    │    - created_at ASC
                    │
                    │ 3. Atualiza status para 'processing' (LOCK)
                    │    UPDATE relay_commands_slave
                    │    SET status = 'processing'
                    │    WHERE id IN (...)
                    │
                    │ 4. Retorna array JSON:
                    │    [
                    │      {
                    │        "id": 123,
                    │        "relay_numbers": [0],      // ✅ ARRAY
                    │        "actions": ["on"],        // ✅ ARRAY
                    │        "duration_seconds": [0],   // ✅ ARRAY
                    │        "slave_mac_address": "14:33:5C:38:BF:60",
                    │        "slave_device_id": "ESP32_SLAVE_14_33_5C_38_BF_60",
                    │        ...
                    │      }
                    │    ]
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9️⃣ ESP32 MASTER - Parse JSON Response                          │
│    Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp           │
│    Função: checkForSlaveCommands()                              │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Parseia JSON array recebido
                    │ 2. Para cada comando no array:
                    │    - Extrai relay_numbers[] → std::vector<int>
                    │    - Extrai actions[] → std::vector<String>
                    │    - Extrai duration_seconds[] → std::vector<int>
                    │    - Preenche RelayCommand struct
                    │
                    │ 3. Retorna array de RelayCommand para HydroSystemCore
                    │
                    │ RelayCommand {
                    │   int id;
                    │   std::vector<int> relayNumbers;      // ✅ BATCH
                    │   std::vector<String> actions;        // ✅ BATCH
                    │   std::vector<int> durationSecondsArray; // ✅ BATCH
                    │   String slave_mac_address;
                    │   String slave_device_id;
                    │   ...
                    │ }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 🔟 ESP32 MASTER - Processar Comando                             │
│    Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp          │
│    Função: processRelayCommand()                                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Detecta que é Slave (slave_mac_address existe)
                    │ 2. Chama processManualCommand(cmd, isSlave=true)
                    │
                    │ Arquivo: ESP-HIDROWAVE-main/src/HydroSystemCore.cpp
                    │ Função: processManualCommand()
                    │
                    │ 3. Itera sobre arrays BATCH:
                    │    for (int i = 0; i < cmd.relayNumbers.size(); i++) {
                    │      int relayNum = cmd.relayNumbers[i];
                    │      String action = cmd.actions[i];
                    │      int duration = cmd.durationSecondsArray[i];
                    │
                    │      // Enviar para cada relé no batch
                    │      masterManager->sendRelayCommandToSlave(
                    │        targetMac,
                    │        relayNum,
                    │        action,
                    │        duration,
                    │        cmd.id,
                    │        false
                    │      );
                    │    }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣1️⃣ ESP32 MASTER - MasterSlaveManager                        │
│    Arquivo: ESP-HIDROWAVE-main/src/MasterSlaveManager.cpp       │
│    Função: sendRelayCommandToSlave()                            │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Verifica se slave está na lista confiável
                    │ 2. Verifica se slave está ONLINE
                    │
                    │ SE (slave OFFLINE):
                    │   → Adiciona à fila de retry
                    │   → Retorna commandId (será enviado quando voltar online)
                    │
                    │ SE (slave ONLINE):
                    │   3. Gera commandId único (uint32_t)
                    │   4. Cria ESPNowRelayCommand struct:
                    │      {
                    │        uint32_t commandId,
                    │        uint8_t relayNumber,
                    │        uint8_t action,  // 1=ON, 0=OFF
                    │        uint16_t duration
                    │      }
                    │
                    │   5. Envia via ESP-NOW:
                    │      espNowController->sendRelayCommand(
                    │        slaveMacAddress,
                    │        espCmd
                    │      )
                    │
                    │   6. Cria mapeamento:
                    │      ESP-NOW commandId → Supabase commandId
                    │      (para atualizar status quando receber ACK)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣2️⃣ ESP-NOW - Transmissão Wireless                            │
│    Protocolo: ESP-NOW (802.11)                                   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 📡 Pacote ESP-NOW enviado:
                    │    - Destino: MAC 14:33:5C:38:BF:60
                    │    - Comando: Relay 0 → ON
                    │    - Duração: 0 (permanente)
                    │
                    │ ⚡ Transmissão instantânea (< 10ms)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣3️⃣ ESP32 SLAVE - Recebe Comando ESP-NOW                      │
│    Arquivo: ESP32-SLAVE (firmware do slave)                     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Recebe pacote ESP-NOW
                    │ 2. Valida origem (Master confiável)
                    │ 3. Extrai comando:
                    │    - relayNumber: 0
                    │    - action: ON (1)
                    │    - duration: 0
                    │
                    │ 4. Executa comando físico:
                    │    digitalWrite(relayPin[0], HIGH)  // Liga relé
                    │
                    │ 5. Atualiza estado local do relé
                    │
                    │ 6. Envia ACK via ESP-NOW de volta para Master:
                    │    {
                    │      commandId: 12345,
                    │      success: true,
                    │      relayNumber: 0,
                    │      currentState: 1  // ON
                    │    }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣4️⃣ ESP32 MASTER - Recebe ACK                                  │
│    Arquivo: ESP-HIDROWAVE-main/src/MasterSlaveManager.cpp       │
│    Função: onRelayAckReceived()                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Recebe ACK do Slave
                    │ 2. Busca mapeamento:
                    │    ESP-NOW commandId → Supabase commandId
                    │
                    │ 3. Atualiza estado do relé no cache local:
                    │    slave->relayStates[relayNumber].state = true
                    │
                    │ 4. Chama callback para atualizar Supabase:
                    │    supabaseRelayStateCallback(
                    │      masterDeviceId,
                    │      slaveMac,
                    │      slaveDeviceId,
                    │      relayNumber,
                    │      newState,
                    │      false,  // hasTimer
                    │      0       // remainingTime
                    │    )
                    │
                    │ 5. Marca comando como completed:
                    │    supabase.markCommandCompleted(
                    │      supabaseCommandId,
                    │      currentState,
                    │      true  // isSlave
                    │    )
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣5️⃣ ESP32 MASTER - Atualizar Supabase                         │
│    Arquivo: ESP-HIDROWAVE-main/src/SupabaseClient.cpp           │
│    Função: markCommandCompleted()                               │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Atualiza relay_commands_slave:
                    │    PATCH /rest/v1/relay_commands_slave?id=eq.123
                    │    {
                    │      "status": "completed",
                    │      "completed_at": "2024-01-15T10:30:00Z",
                    │      "execution_time_ms": 150
                    │    }
                    │
                    │ 2. Atualiza relay_slaves (estado do relé):
                    │    PATCH /rest/v1/relay_slaves?device_id=eq.ESP32_SLAVE_...
                    │    {
                    │      "relay_states": [true, false, false, ...],
                    │      "last_update": "2024-01-15T10:30:00Z"
                    │    }
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣6️⃣ SUPABASE - Tabelas Atualizadas                           │
│    - relay_commands_slave: status = 'completed'                 │
│    - relay_slaves: relay_states[0] = true                      │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ ✅ Comando finalizado com sucesso!
                    │
                    │ Frontend pode buscar estado atualizado:
                    │   - Via polling (a cada 30s)
                    │   - Via WebSocket (quando implementado)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣7️⃣ FRONTEND - Atualizar UI                                   │
│    Arquivo: src/app/automacao/page.tsx                          │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ 1. Busca estado atualizado de relay_slaves
                    │ 2. Atualiza indicador visual (ponto verde/cinza)
                    │ 3. Atualiza botão (ON/OFF desabilitado)
                    │
                    │ ✅ UI reflete estado real do relé físico!
```

---

## 📊 **RESUMO DOS COMPONENTES**

### **Frontend (Next.js)**
1. **Botão ON/OFF** → `src/app/automacao/page.tsx`
2. **API Route** → `src/app/api/esp-now/command/route.ts`
3. **Automation Lib** → `src/lib/automation.ts`
   - `createRelayCommand()` - Orquestrador
   - `createSlaveCommandDirect()` - Inserção direta no Supabase

### **Backend (Supabase)**
1. **Tabela** → `relay_commands_slave`
2. **RPC Function** → `get_and_lock_slave_commands()`
3. **Tabela de Estados** → `relay_slaves`

### **ESP32 Master (Firmware)**
1. **Polling** → `HydroSystemCore::checkSupabaseCommands()`
2. **RPC Call** → `SupabaseClient::checkForSlaveCommands()`
3. **Processamento** → `HydroSystemCore::processRelayCommand()`
4. **ESP-NOW** → `MasterSlaveManager::sendRelayCommandToSlave()`
5. **ACK Handler** → `MasterSlaveManager::onRelayAckReceived()`
6. **Update Supabase** → `SupabaseClient::markCommandCompleted()`

### **ESP32 Slave (Firmware)**
1. **Recebe ESP-NOW** → Handler de pacotes
2. **Executa Relé** → `digitalWrite(relayPin, HIGH/LOW)`
3. **Envia ACK** → Resposta ESP-NOW para Master

---

## ⏱️ **TEMPOS ESTIMADOS**

| Etapa | Tempo Estimado |
|-------|----------------|
| Frontend → API | < 50ms |
| API → Supabase | < 100ms |
| Supabase Insert | < 50ms |
| ESP32 Polling | 0-10s (intervalo) |
| RPC Call | < 500ms |
| ESP-NOW Transmissão | < 10ms |
| Slave Execução | < 50ms |
| ACK → Master | < 10ms |
| Master → Supabase | < 500ms |
| **TOTAL** | **~1-12 segundos** |

---

## 🔍 **PONTOS DE DEBUG**

### **1. Frontend não envia comando**
- Verificar console do navegador
- Verificar se `user_email` e `master_mac_address` estão presentes
- Verificar logs em `createRelayCommand()`

### **2. Comando não aparece no Supabase**
- Verificar `relay_commands_slave` table
- Verificar se `user_email` e `master_mac_address` são válidos
- Verificar FOREIGN KEY constraints

### **3. ESP32 não busca comando**
- Verificar Serial Monitor do ESP32
- Verificar se `checkForSlaveCommands()` está sendo chamado
- Verificar logs de RPC: `[RPC SLAVE]`

### **4. Comando não é enviado via ESP-NOW**
- Verificar se slave está na lista confiável
- Verificar se slave está ONLINE
- Verificar logs: `[ESP-NOW] Enviando comando...`

### **5. Slave não recebe comando**
- Verificar Serial Monitor do Slave
- Verificar se Master está na lista confiável do Slave
- Verificar se ESP-NOW está inicializado

### **6. ACK não chega no Master**
- Verificar Serial Monitor do Master
- Verificar logs: `[ACK] Recebido...`
- Verificar timeout de ACK

### **7. Status não atualiza no Supabase**
- Verificar logs: `[SUPABASE] Atualizando status...`
- Verificar se `markCommandCompleted()` está sendo chamado
- Verificar se `relay_slaves` está sendo atualizado

---

## ✅ **CHECKLIST DE VALIDAÇÃO**

- [ ] Frontend envia comando com todos os campos obrigatórios
- [ ] API valida dados antes de inserir
- [ ] Comando é inserido em `relay_commands_slave` com `status='pending'`
- [ ] ESP32 Master busca comandos via RPC a cada 10s
- [ ] RPC retorna comandos e atualiza status para `'processing'`
- [ ] ESP32 Master processa arrays batch corretamente
- [ ] Master envia comando via ESP-NOW para Slave
- [ ] Slave recebe comando e executa relé físico
- [ ] Slave envia ACK de volta para Master
- [ ] Master recebe ACK e atualiza estado local
- [ ] Master atualiza Supabase: `status='completed'`
- [ ] Master atualiza `relay_slaves` com estado do relé
- [ ] Frontend reflete estado atualizado na UI

---

## 🎯 **PRÓXIMOS PASSOS PARA MVP**

1. ✅ **Fluxo básico funcionando** (já implementado)
2. ⏳ **WebSocket para atualização em tempo real** (Phase 3)
3. ⏳ **Adaptive polling** (Phase 4)
4. ⏳ **Decision Engine** (regras de automação)
5. ⏳ **EC Controller** (dosagem automática)

---

**Status Atual:** ✅ **Fluxo completo implementado e funcional!**


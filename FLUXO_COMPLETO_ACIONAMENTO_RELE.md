# 🔄 Fluxo Completo: Acionamento de Relé ESP-NOW Slave

## 📊 **DIAGRAMA DO FLUXO:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1️⃣ FRONTEND (Next.js)                                                   │
│    /automacao → Botão ON/OFF                                             │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ POST /api/esp-now/command
                     │ {
                     │   master_device_id: "ESP32_HIDRO_6447D0",
                     │   slave_mac_address: "14:33:5C:38:BF:60",
                     │   slave_name: "ESP-NOW-SLAVE",
                     │   relay_number: 0,
                     │   action: "on",
                     │   duration_seconds: 0
                     │ }
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2️⃣ API ROUTE (Next.js)                                                  │
│    /api/esp-now/command/route.ts                                        │
│                                                                          │
│    ✅ Valida dados                                                      │
│    ✅ Cria registro em relay_commands (Supabase)                        │
│    │   - device_id: "ESP32_HIDRO_6447D0" (Master)                     │
│    │   - target_device_id: "ESP-NOW-SLAVE" (nome do Slave)            │
│    │   - relay_number: 0                                               │
│    │   - action: "on"                                                   │
│    │   - status: "pending"                                              │
│    │   - created_by: "web_interface"                                   │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ INSERT INTO relay_commands
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3️⃣ SUPABASE DATABASE                                                    │
│    Tabela: relay_commands                                               │
│                                                                          │
│    id | device_id          | target_device_id | relay_number | action | │
│    ───┼────────────────────┼──────────────────┼──────────────┼────────┤ │
│    1  | ESP32_HIDRO_6447D0 | ESP-NOW-SLAVE    | 0            | on     | │
│                                                                          │
│    Status: "pending"                                                    │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ ESP32 Master busca comandos pendentes
                     │ (a cada 30 segundos)
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4️⃣ ESP32 MASTER - SupabaseClient                                       │
│    HydroSystemCore::update()                                            │
│                                                                          │
│    ✅ SupabaseClient::checkForCommands()                               │
│    │   - Query: SELECT * FROM relay_commands                           │
│    │     WHERE device_id = 'ESP32_HIDRO_6447D0'                        │
│    │     AND status = 'pending'                                        │
│    │     ORDER BY created_at ASC                                       │
│    │     LIMIT 5                                                       │
│    │                                                                   │
│    ✅ Retorna array de RelayCommand                                    │
│    │   - cmd.id = 1                                                    │
│    │   - cmd.device_id = "ESP32_HIDRO_6447D0"                          │
│    │   - cmd.target_device_id = "ESP-NOW-SLAVE"                        │
│    │   - cmd.relayNumber = 0                                           │
│    │   - cmd.action = "on"                                             │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ HydroSystemCore::processRelayCommand(cmd)
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5️⃣ ESP32 MASTER - HydroSystemCore                                      │
│    processRelayCommand()                                                │
│                                                                          │
│    ✅ Verifica se é comando remoto:                                    │
│    │   isRemoteCommand = (target_device_id != "local" &&              │
│    │                      target_device_id != "MASTER" &&             │
│    │                      target_device_id != getDeviceID())            │
│    │                                                                    │
│    ✅ Se SIM → Busca Slave na lista confiável:                         │
│    │   - trustedSlaves = masterManager->getAllTrustedSlaves()          │
│    │   - Procura por: slave.deviceName == "ESP-NOW-SLAVE"              │
│    │   - Obtém MAC: targetMac = slave.macAddress                       │
│    │                                                                    │
│    ✅ Envia via ESP-NOW:                                               │
│    │   masterManager->sendRelayCommandToSlave(                        │
│    │       targetMac,      // 14:33:5C:38:BF:60                        │
│    │       0,              // relay_number                             │
│    │       "on",           // action                                    │
│    │       0,              // duration                                  │
│    │       cmd.id          // Supabase command ID                       │
│    │   )                                                                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ MasterSlaveManager::sendRelayCommandToSlave()
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6️⃣ ESP32 MASTER - MasterSlaveManager                                   │
│    sendRelayCommandToSlave()                                            │
│                                                                          │
│    ✅ Verifica se Slave está ONLINE                                    │
│    │   - Se OFFLINE → Adiciona à fila de retry                         │
│    │   - Se ONLINE → Continua                                          │
│    │                                                                    │
│    ✅ Gera Command ID único (uint32_t)                                 │
│    │                                                                    │
│    ✅ Envia via ESP-NOW:                                               │
│    │   espNowController->sendRelayCommand(                             │
│    │       macAddress,     // 14:33:5C:38:BF:60                         │
│    │       relayNumber,    // 0                                         │
│    │       action,         // "on"                                      │
│    │       duration         // 0                                        │
│    │   )                                                                │
│    │                                                                    │
│    ✅ Cria mensagem ESP-NOW:                                           │
│    │   MessageType::RELAY_COMMAND                                      │
│    │   RelayCommandData {                                               │
│    │       relayNumber: 0,                                              │
│    │       action: "on",                                                │
│    │       duration: 0                                                  │
│    │   }                                                                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ ESP-NOW Protocol (2.4GHz)
                     │ Broadcast/Unicast
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7️⃣ ESP32 SLAVE (RelayCommandBox)                                       │
│    ESPNowController::onDataReceived()                                   │
│                                                                          │
│    ✅ Recebe mensagem ESP-NOW                                          │
│    │   - Tipo: MessageType::RELAY_COMMAND                              │
│    │   - Dados: RelayCommandData                                       │
│    │                                                                    │
│    ✅ Chama callback:                                                  │
│    │   relayCommandCallback(                                            │
│    │       senderMac,      // MAC do Master                             │
│    │       relayNumber,    // 0                                         │
│    │       action,         // "on"                                      │
│    │       duration         // 0                                        │
│    │   )                                                                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ Callback configurado em main.cpp
                     │ (RelayCommandBox::onRelayCommand())
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 8️⃣ ESP32 SLAVE - RelayCommandBox                                       │
│    onRelayCommand()                                                     │
│                                                                          │
│    ✅ Processa comando:                                                │
│    │   - Se action == "on" → relayBox->setRelay(0, true)              │
│    │   - Se action == "off" → relayBox->setRelay(0, false)             │
│    │   - Se duration > 0 → relayBox->setRelayWithTimer(0, true, dur)  │
│    │                                                                    │
│    ✅ RelayCommandBox::setRelay()                                       │
│    │   - Atualiza estado: relayStates[0].isOn = true                   │
│    │   - Escreve no hardware: writeToRelay(0, true)                   │
│    │   - PCF8574::write() → I2C → PCF8574                              │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ I2C Protocol
                     │ SDA/SCL
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 9️⃣ HARDWARE - PCF8574 (I/O Expander)                                   │
│                                                                          │
│    ✅ Recebe comando I2C                                                │
│    │   - Endereço: 0x20 (ou configurado)                                │
│    │   - Pino: 0 (relay_number)                                        │
│    │   - Estado: HIGH (ligado)                                          │
│    │                                                                    │
│    ✅ Ativa saída digital                                               │
│    │   - PCF8574 Pin 0 → HIGH                                           │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ Sinal elétrico
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔟 RELÉ FÍSICO (Hardware)                                               │
│                                                                          │
│    ✅ Relé mecânico acionado                                           │
│    │   - Contato fecha                                                  │
│    │   - Circuito elétrico conectado                                   │
│    │   - Dispositivo ligado (bomba, luz, etc)                          │
└─────────────────────────────────────────────────────────────────────────┘
                     │
                     │ (Opcional: Confirmação de volta)
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔄 CONFIRMAÇÃO (Opcional)                                                │
│                                                                          │
│    ESP32 SLAVE → ESP-NOW → ESP32 MASTER                                 │
│    │                                                                     │
│    ✅ Envia ACK:                                                        │
│    │   RelayCommandAck {                                                │
│    │       commandId: 12345,                                            │
│    │       success: true,                                               │
│    │       relayNumber: 0,                                               │
│    │       currentState: 1 (ON)                                         │
│    │   }                                                                 │
│    │                                                                     │
│    ESP32 MASTER → Supabase                                              │
│    │                                                                     │
│    ✅ Atualiza status:                                                  │
│    │   UPDATE relay_commands                                            │
│    │   SET status = 'completed'                                         │
│    │   WHERE id = 1                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 **RESUMO DO FLUXO:**

### **1. Frontend (Usuário)**
- Usuário clica em botão ON/OFF no `/automacao`
- Frontend faz POST para `/api/esp-now/command`

### **2. API Route (Next.js)**
- Valida dados
- Cria registro em `relay_commands` (Supabase)
- Status: `pending`

### **3. Supabase Database**
- Armazena comando com:
  - `device_id`: ID do Master
  - `target_device_id`: Nome do Slave
  - `relay_number`: Número do relé
  - `action`: "on" ou "off"

### **4. ESP32 Master - Busca Comandos**
- A cada 30 segundos, busca comandos pendentes
- `SupabaseClient::checkForCommands()`

### **5. ESP32 Master - Processa Comando**
- `HydroSystemCore::processRelayCommand()`
- Identifica que é comando remoto (tem `target_device_id`)
- Busca Slave na lista confiável por nome

### **6. ESP32 Master - Envia via ESP-NOW**
- `MasterSlaveManager::sendRelayCommandToSlave()`
- `ESPNowController::sendRelayCommand()`
- Cria mensagem `RELAY_COMMAND` e envia via ESP-NOW

### **7. ESP32 Slave - Recebe Comando**
- `ESPNowController::onDataReceived()`
- Detecta tipo `RELAY_COMMAND`
- Chama callback `relayCommandCallback`

### **8. ESP32 Slave - Processa Comando**
- `RelayCommandBox::onRelayCommand()`
- `RelayCommandBox::setRelay(relayNumber, state)`
- Atualiza estado e escreve no hardware

### **9. Hardware - PCF8574**
- Recebe comando I2C
- Ativa pino correspondente ao relé

### **10. Relé Físico**
- Relé mecânico aciona
- Circuito elétrico conecta
- Dispositivo liga

---

## 🔑 **PONTOS CRÍTICOS:**

### **1. Identificação do Slave:**
- Frontend envia `slave_name` (ex: "ESP-NOW-SLAVE")
- API cria `target_device_id = slave_name`
- Master busca Slave por `deviceName == target_device_id`

### **2. Status do Comando:**
- `pending` → Criado no Supabase
- `sent` → Enviado via ESP-NOW (opcional)
- `completed` → Confirmado pelo Slave (ACK)
- `failed` → Timeout ou erro

### **3. Fila de Retry:**
- Se Slave está OFFLINE, comando vai para fila
- Master tenta reenviar quando Slave volta ONLINE

### **4. Confirmação (ACK):**
- Slave pode enviar ACK via ESP-NOW
- Master atualiza status no Supabase

---

## 🐛 **POSSÍVEIS PROBLEMAS:**

### **1. Slave não aparece no Frontend:**
- Master não descobriu o Slave
- Slave não está na lista confiável
- Endpoint `/api/slaves` não retorna o Slave

### **2. Comando não chega no Slave:**
- Slave está OFFLINE
- Canal WiFi diferente
- MAC address incorreto
- ESP-NOW não inicializado

### **3. Relé não aciona:**
- PCF8574 não inicializado
- I2C não conectado
- Pino incorreto
- Hardware com defeito

---

## 💡 **DICAS DE DEBUG:**

### **1. Verificar Serial do Master:**
```
📡 [ESP-NOW] Comando para slave remoto: ESP-NOW-SLAVE
✅ Slave encontrado: ESP-NOW-SLAVE
   MAC: 14:33:5C:38:BF:60
📤 ENVIANDO COMANDO DE RELÉ
✅ Comando enviado com sucesso!
```

### **2. Verificar Serial do Slave:**
```
📥 Comando recebido de AA:BB:CC:DD:EE:FF: Relé 0 -> on
🔌 Relé 0 LIGADO
```

### **3. Verificar Supabase:**
```sql
SELECT * FROM relay_commands 
WHERE device_id = 'ESP32_HIDRO_6447D0' 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## ✅ **CHECKLIST:**

- [ ] Frontend cria comando no Supabase
- [ ] Master busca comandos pendentes
- [ ] Master identifica comando remoto
- [ ] Master encontra Slave na lista
- [ ] Master envia via ESP-NOW
- [ ] Slave recebe comando
- [ ] Slave processa comando
- [ ] PCF8574 recebe I2C
- [ ] Relé físico aciona
- [ ] (Opcional) ACK enviado de volta

---

**Pronto! Agora você entende todo o fluxo! 🚀**


# 🔄 FLUXO COMPLETO: ESP32 Master → Supabase

## 📊 ESTRUTURA DE ENVIO E ATUALIZAÇÃO DE DADOS

---

## 🏗️ **ARQUITETURA DO SISTEMA**

### **Por que não usamos mensagens entrantes (Push/Webhooks)?**

O sistema foi projetado para funcionar com **infinitos clientes**, cada um com seu próprio ESP32 Master conectado a uma rede WiFi privada. Isso cria limitações arquiteturais importantes:

#### **1. ESP32 em IP Privado (NAT)**

```
┌─────────────────────────────────────────┐
│         INTERNET (IP Público)           │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │    Supabase (Cloud)              │  │
│  │    IP: 35.xxx.xxx.xxx            │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ▲
              │ HTTPS (Saliente - ✅ Funciona)
              │
┌─────────────┴─────────────────────────────┐
│      ROTEADOR DOMÉSTICO (NAT)             │
│      IP Público: 200.xxx.xxx.xxx          │
│      IP Privado: 192.168.1.1              │
└─────────────┬─────────────────────────────┘
              │
              │ WiFi
              │
┌─────────────▼─────────────────────────────┐
│      ESP32 MASTER                         │
│      IP Privado: 192.168.1.100            │
│      MAC: FC:B4:67:F4:47:38               │
│                                           │
│      ❌ NÃO PODE RECEBER CONEXÕES         │
│         DE FORA (Incoming)                │
└───────────────────────────────────────────┘
```

**Problemas:**
- ESP32 está atrás de um roteador (NAT)
- Não tem IP público acessível da internet
- Não pode receber conexões de fora (incoming connections)
- Webhooks/Push notifications não funcionam

#### **2. Escalabilidade para Infinitos Clientes**

```
Cliente 1: ESP32 → WiFi Casa 1 → NAT → Internet → Supabase
Cliente 2: ESP32 → WiFi Casa 2 → NAT → Internet → Supabase
Cliente 3: ESP32 → WiFi Empresa → NAT → Internet → Supabase
...
Cliente N: ESP32 → WiFi Qualquer → NAT → Internet → Supabase
```

**Implicações:**
- Cada cliente tem seu próprio roteador/NAT
- Não podemos configurar port forwarding para cada cliente
- Não podemos dar IP público para cada ESP32
- Solução: **Polling (busca ativa)** ao invés de **Push (notificações)**

#### **3. Fluxo Unidirecional (Apenas Saliente)**

```
ESP32 → Supabase ✅ (Pode fazer - Conexão saliente)
  - Buscar comandos (GET)
  - Enviar dados (POST/PATCH)
  - Atualizar status (PATCH)

Supabase → ESP32 ❌ (Não pode fazer - Conexão entrante)
  - Webhooks não funcionam
  - Push notifications não funcionam
  - Cron jobs não podem acionar ESP32
```

#### **4. Por isso usamos Polling:**

- ESP32 **busca** comandos do Supabase a cada 5 segundos
- ESP32 **envia** dados para Supabase (sensor data, status)
- Cleanup deve ser **manual** (não pode ser acionado automaticamente)

---

## 1️⃣ **BUSCA DE COMANDOS (ESP32 → Supabase)**

### **Localização:** `HydroSystemCore.cpp` → `checkSupabaseCommands()`

```cpp
// Executado a cada 5 segundos (SUPABASE_CHECK_INTERVAL)
void HydroSystemCore::checkSupabaseCommands() {
    RelayCommand commands[5];
    int commandCount = 0;
    
    // ✅ Busca comandos pendentes usando função SQL get_pending_commands()
    if (supabase.checkForCommands(commands, 5, commandCount)) {
        for (int i = 0; i < commandCount; i++) {
            processRelayCommand(commands[i]);
        }
    }
}
```

### **Função SQL:** `get_pending_master_commands()` ou `get_pending_slave_commands()`

```sql
-- ✅ RECOMENDADO: Usar função SQL (já implementada)
SELECT * FROM get_pending_master_commands('ESP32_HIDRO_F44738', 5);

-- A função SQL faz:
-- 1. status = 'pending'
-- 2. expires_at > NOW() (TTL check)
-- 3. Ordenação: command_type → priority DESC → created_at ASC
-- 4. Retorna arrays: relay_numbers[], actions[], duration_seconds[]
```

### **⚠️ ATUAL: ESP32 usa query direta (precisa atualizar)**

**Localização:** `SupabaseClient.cpp:558`

```cpp
// ⚠️ ATUAL: Ainda usa tabela antiga relay_commands
String endpoint = String(SUPABASE_RELAY_TABLE)  // relay_commands (antiga)
  + "?device_id=eq." + getDeviceID() 
  + "&status=eq.pending"
  + "&order=priority.desc,created_at.asc"
  + "&limit=" + maxCommands;

// ✅ DEVERIA SER: Usar função SQL RPC
String endpoint = "rpc/get_pending_master_commands"
  + "?p_device_id=" + getDeviceID()
  + "&p_limit=" + maxCommands;
```

---

## 2️⃣ **PROCESSAMENTO DE COMANDOS (ESP32)**

### **Localização:** `HydroSystemCore.cpp` → `processRelayCommand()`

```cpp
void HydroSystemCore::processRelayCommand(const RelayCommand& cmd) {
    // ✅ FORK: Processa diferente por tipo
    if (cmd.command_type == "rule") {
        processRuleCommand(cmd);
    } else if (cmd.command_type == "peristaltic") {
        processPeristalticCommand(cmd);
    } else {
        processManualCommand(cmd);
    }
}
```

### **Tipos de Comandos:**

1. **`manual`**: Comando do usuário (botão)
2. **`rule`**: Comando de automação (regra)
3. **`peristaltic`**: Comando de dosagem (bomba peristáltica)

---

## 3️⃣ **ATUALIZAÇÃO DE STATUS (ESP32 → Supabase)**

### **Fluxo de Status:**

```
pending → sent → completed/failed
```

### **3.1. Marcar como SENT (enviado)**

**Localização:** `SupabaseClient.cpp` → `markCommandSent()`

```cpp
// Quando comando é enviado para hardware (relé local ou ESP-NOW)
bool SupabaseClient::markCommandSent(int commandId) {
    String payload = "{\"status\": \"sent\", \"sent_at\": \"now()\"}";
    // PATCH para relay_commands_master ou relay_commands_slave
    http.PATCH(payload);
}
```

**Chamado em:**
- `HydroSystemCore.cpp:495` - Após enviar comando local
- `MasterSlaveManager.cpp:2178` - Após enviar comando ESP-NOW

### **3.2. Marcar como COMPLETED (completado)**

**Localização:** `SupabaseClient.cpp` → `markCommandCompleted()`

```cpp
// Quando comando é executado com sucesso
bool SupabaseClient::markCommandCompleted(int commandId, bool currentState) {
    DynamicJsonDocument doc(256);
    doc["status"] = "completed";
    doc["completed_at"] = "now()";
    doc["current_state"] = currentState;  // ✅ Estado final do relé
    // PATCH para Supabase
    http.PATCH(payload);
}
```

**Chamado em:**
- `HydroSystemCore.cpp:98` - Após executar comando local com sucesso
- `MasterSlaveManager.cpp:1679` - Após receber ACK do Slave

### **3.3. Marcar como FAILED (falhou)**

**Localização:** `SupabaseClient.cpp` → `markCommandFailed()`

```cpp
// Quando comando falha
bool SupabaseClient::markCommandFailed(int commandId, const String& errorMessage) {
    DynamicJsonDocument doc(256);
    doc["status"] = "failed";
    doc["error_message"] = errorMessage;
    doc["completed_at"] = "now()";
    // PATCH para Supabase
    http.PATCH(payload);
}
```

**Chamado em:**
- `HydroSystemCore.cpp:100` - Quando comando local falha
- `HydroSystemCore.cpp:502` - Quando relé é inválido
- `HydroSystemCore.cpp:536` - Quando Slave não encontrado

---

## 4️⃣ **TTL (TIME TO LIVE) - EXPIRAÇÃO AUTOMÁTICA**

### **Como Funciona:**

1. **Frontend cria comando com `expires_at`:**
   ```typescript
   {
     expires_at: "2025-11-27T00:00:00Z"  // Expira em 24h
   }
   ```

2. **ESP32 verifica TTL ao buscar:**
   ```sql
   WHERE (expires_at IS NULL OR expires_at > NOW())
   ```
   - Se `expires_at` for NULL → nunca expira
   - Se `expires_at < NOW()` → comando expirado (não é retornado)

3. **Função SQL marca como expired:**
   ```sql
   UPDATE relay_commands_master
   SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < NOW();
   ```

---

## 5️⃣ **CLEANUP AUTOMÁTICO - REMOÇÃO DE COMANDOS ANTIGOS**

### **Função SQL:** `cleanup_expired_commands()`

**Localização:** `MIGRACAO_COMPLETA_RELAY_COMMANDS_V2.sql`

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_commands()
RETURNS TABLE (
  deleted_expired_master INTEGER,
  deleted_expired_slave INTEGER,
  deleted_completed_master INTEGER,
  deleted_completed_slave INTEGER,
  deleted_failed_master INTEGER,
  deleted_failed_slave INTEGER
) 
AS $$
BEGIN
  -- 1. Deletar comandos expirados (TTL)
  DELETE FROM relay_commands_master 
  WHERE status = 'pending' 
    AND expires_at < NOW();
  
  -- 2. Deletar completados há mais de 1 hora
  DELETE FROM relay_commands_master 
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '1 hour';
  
  -- 3. Deletar falhados há mais de 24 horas
  DELETE FROM relay_commands_master 
  WHERE status = 'failed' 
    AND failed_at < NOW() - INTERVAL '24 hours';
  
  -- (Mesmo para relay_commands_slave)
END;
$$;
```

### **Como Executar Cleanup:**

**⚠️ IMPORTANTE: Cleanup Manual (SQL Editor)**

**Por que manual?** O ESP32 está em IP privado (NAT) e não pode receber conexões entrantes. O sistema foi projetado para escalar para infinitos clientes, cada um com seu próprio WiFi privado. Por isso, não podemos usar webhooks/cron jobs automáticos que acionem o cleanup.

**Solução:** Executar **manualmente** via SQL Editor:

```sql
-- Executar periodicamente (ex: uma vez por semana)
SELECT * FROM cleanup_expired_commands();
```

**Recomendação:**
- Executar manualmente quando necessário
- Criar um lembrete para executar periodicamente (ex: toda segunda-feira)
- A função retorna estatísticas de quantos registros foram removidos

---

## 6️⃣ **FLUXO COMPLETO (DIAGRAMA)**

```
┌─────────────────┐
│   FRONTEND      │
│  (Next.js)      │
└────────┬─────────┘
         │ POST /api/relay-commands/master
         │ { relay_numbers: [0,1], actions: ["on","on"], expires_at: "..." }
         ▼
┌─────────────────┐
│    SUPABASE     │
│ relay_commands_ │
│    _master      │
│ status: pending │
└────────┬─────────┘
         │
         │ GET (a cada 5s)
         │ get_pending_master_commands()
         │ WHERE expires_at > NOW()
         ▼
┌─────────────────┐
│  ESP32 MASTER   │
│ checkSupabase   │
│ Commands()      │
└────────┬─────────┘
         │
         │ processRelayCommand()
         │
         ├─► markCommandSent() ──┐
         │   status: "sent"      │
         │                       │
         │ executeRelayCommand() │
         │                       │
         ├─► markCommandCompleted() ──┐
         │   status: "completed"      │
         │   current_state: true      │
         │                            │
         └─► markCommandFailed() ─────┤
             status: "failed"         │
             error_message: "..."     │
                                      │
                                      ▼
                            ┌─────────────────┐
                            │    SUPABASE     │
                            │ relay_commands_ │
                            │    _master      │
                            │ status: sent/   │
                            │ completed/failed│
                            └─────────────────┘
                                      │
                                      │ (após 1h)
                                      ▼
                            ┌─────────────────┐
                            │ cleanup_expired │
                            │ _commands()     │
                            │ DELETE          │
                            └─────────────────┘
```

---

## 7️⃣ **ESTRUTURA DE DADOS**

### **Tabela: `relay_commands_master`**

```sql
CREATE TABLE relay_commands_master (
  id bigint,
  device_id text,              -- ESP32_HIDRO_F44738
  user_email text,             -- ✅ Lastreado
  master_mac_address text,     -- ✅ Lastreado
  relay_numbers integer[],     -- ✅ ARRAY [0, 1, 2]
  actions text[],              -- ✅ ARRAY ["on", "on", "off"]
  duration_seconds integer[],  -- ✅ ARRAY [0, 0, 0]
  command_type text,           -- 'manual' | 'rule' | 'peristaltic'
  priority integer,            -- 0-100
  status text,                 -- 'pending' | 'sent' | 'completed' | 'failed' | 'expired'
  expires_at timestamptz,      -- ✅ TTL
  created_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text
);
```

### **Tabela: `relay_commands_slave`**

```sql
CREATE TABLE relay_commands_slave (
  id bigint,
  master_device_id text,       -- ESP32_HIDRO_F44738
  slave_device_id text,        -- ESP32_SLAVE_14_33_5C_38_BF_60
  slave_mac_address text,      -- 14:33:5C:38:BF:60
  relay_numbers integer[],     -- ✅ ARRAY [0, 1]
  actions text[],              -- ✅ ARRAY ["on", "off"]
  -- ... (mesma estrutura)
);
```

---

## 8️⃣ **INTERVALOS DE EXECUÇÃO (ESP32)**

```cpp
// HydroSystemCore.cpp → loop()

// ✅ Buscar comandos: A cada 5 segundos
if (now - lastSupabaseCheck >= 5000) {
    checkSupabaseCommands();
}

// ✅ Sincronizar estados: A cada 5 segundos
if (now - lastRelayStatesSync >= 5000) {
    syncAllRelayStatesToSupabase();
}

// ✅ Enviar sensores: A cada 30 segundos
if (now - lastSensorSend >= 30000) {
    sendSensorDataToSupabase();
}

// ✅ Status do device: A cada 60 segundos
if (now - lastStatusSend >= 60000) {
    sendDeviceStatusToSupabase();
}
```

---

## 9️⃣ **RESUMO: O QUE O ESP32 FAZ**

1. **Busca comandos** do Supabase a cada 5s
2. **Filtra por TTL** (expires_at > NOW())
3. **Ordena por prioridade** (command_type → priority → created_at)
4. **Processa comandos** (local ou ESP-NOW)
5. **Atualiza status** no Supabase:
   - `pending` → `sent` (quando envia)
   - `sent` → `completed` (quando executa com sucesso)
   - `sent` → `failed` (quando falha)
6. **Cleanup automático** remove comandos antigos (SQL)

---

## ✅ **VANTAGENS DESTA ESTRUTURA**

1. **✅ Arrays**: Múltiplos relés por comando
2. **✅ TTL**: Comandos expiram automaticamente
3. **✅ Cleanup**: Remove comandos antigos automaticamente
4. **✅ Priorização**: command_type + priority
5. **✅ Rastreamento**: Status completo (pending → sent → completed/failed)
6. **✅ Lastreado**: user_email, MAC, device_id sempre presentes

---

## 📝 **PRÓXIMOS PASSOS**

1. ✅ Tabelas criadas (`relay_commands_master` e `relay_commands_slave`)
2. ✅ Funções SQL criadas (`get_pending_*_commands`, `cleanup_expired_commands`)
3. ⏳ Atualizar ESP32 para usar novas tabelas (ainda usa `relay_commands` antiga)
4. ⏳ Atualizar Frontend para usar novas APIs
5. ✅ Cleanup manual via SQL Editor (modelo não permite mensagens entrantes)

### **⚠️ NOTA IMPORTANTE SOBRE CLEANUP E ARQUITETURA:**

#### **Por que não podemos usar mensagens entrantes (Push/Webhooks)?**

O sistema foi projetado para funcionar com **infinitos clientes**, cada um com seu próprio ESP32 Master conectado a uma rede WiFi privada (NAT). Isso significa:

1. **ESP32 em IP Privado (NAT):**
   - Cada ESP32 está atrás de um roteador doméstico
   - IP privado (ex: `192.168.1.100`)
   - Não tem IP público acessível da internet
   - Não pode receber conexões de fora (incoming connections)

2. **Arquitetura Escalável:**
   - Sistema deve funcionar para milhares de clientes
   - Cada cliente tem seu próprio WiFi/IP privado
   - Não podemos configurar port forwarding ou IP público para cada cliente
   - Solução: **Polling (busca ativa)** ao invés de **Push (notificações)**

3. **Fluxo Unidirecional (Apenas Saliente):**
   ```
   ESP32 → Supabase ✅ (Pode fazer)
   Supabase → ESP32 ❌ (Não pode fazer - ESP32 está em NAT)
   ```

4. **Por isso:**
   - ESP32 **busca** comandos do Supabase (polling a cada 5s)
   - ESP32 **envia** dados para Supabase (sensor data, status)
   - Supabase **não pode enviar** notificações para ESP32
   - Cleanup deve ser **manual** (não pode ser acionado automaticamente pelo Supabase)

#### **Cleanup Manual:**

Como não podemos usar webhooks/cron jobs que acionem automaticamente, o cleanup deve ser executado **manualmente** via SQL Editor:

```sql
-- Executar quando necessário (ex: uma vez por semana)
SELECT * FROM cleanup_expired_commands();
```

A função retorna estatísticas:
- `deleted_expired_master`: Comandos Master expirados removidos
- `deleted_expired_slave`: Comandos Slave expirados removidos
- `deleted_completed_master`: Comandos Master completados removidos (> 1h)
- `deleted_completed_slave`: Comandos Slave completados removidos (> 1h)
- `deleted_failed_master`: Comandos Master falhados removidos (> 24h)
- `deleted_failed_slave`: Comandos Slave falhados removidos (> 24h)


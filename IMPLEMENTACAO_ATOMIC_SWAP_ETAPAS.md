# 🚀 IMPLEMENTAÇÃO: Atomic Swap com Status "processing" - ETAPAS ENUMERADAS

## 📋 VISÃO GERAL

Este documento enumera **TODAS as etapas** para implementar o sistema de Atomic Swap que previne duplicação de comandos.

**Por que é seguro?**
- ✅ Cada ESP32 Master tem seu `device_id` único (baseado no MAC)
- ✅ Comandos Master são segregados por `device_id`
- ✅ Comandos Slave são segregados por `master_device_id` + `slave_mac_address`
- ✅ A função SQL é **atômica** (executa tudo ou nada)
- ✅ O PostgreSQL garante **row-level locking**

---

## 🎯 ETAPA 1: SUPABASE (SQL) - ⏱️ 5 minutos

### **1.1. Abrir SQL Editor no Supabase**
- Acessar: https://supabase.com/dashboard
- Selecionar seu projeto
- Ir em **SQL Editor** (menu lateral)

### **1.2. Copiar e Colar Script SQL**
- Abrir arquivo: `HIDROWAVE-main/scripts/IMPLEMENTAR_STATUS_PROCESSING_COMPLETO.sql`
- **Copiar TODO o conteúdo**
- Colar no SQL Editor do Supabase
- Clicar em **RUN** (ou F5)

### **1.3. Verificar Execução**
- ✅ Deve aparecer: "Success. No rows returned"
- ✅ Ou mensagens de NOTICE confirmando criação das funções

### **1.4. Testar Funções (Opcional)**
```sql
-- Teste 1: Verificar função master
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1, 30);

-- Teste 2: Verificar função slave
SELECT * FROM get_and_lock_slave_commands('ESP32_HIDRO_F44738', 1, 30);
```

**✅ ETAPA 1 CONCLUÍDA quando:**
- Script executado sem erros
- Funções `get_and_lock_master_commands()` e `get_and_lock_slave_commands()` criadas
- Status "processing" adicionado às constraints

---

## 🎯 ETAPA 2: FRONTEND (TypeScript/Next.js) - ⏱️ 30 minutos

### **2.1. Criar API para Comandos Master**

**Arquivo:** `HIDROWAVE-main/src/app/api/relay-commands/master/route.ts`

**Ação:** Criar arquivo novo com o código fornecido no checklist.

**Campos importantes:**
- ✅ `relay_numbers` → ARRAY (não `relay_number`)
- ✅ `actions` → ARRAY
- ✅ `duration_seconds` → ARRAY
- ✅ `status: 'pending'` → padrão

### **2.2. Criar API para Comandos Slave**

**Arquivo:** `HIDROWAVE-main/src/app/api/relay-commands/slave/route.ts`

**Ação:** Criar arquivo novo com o código fornecido no checklist.

**Campos importantes:**
- ✅ `slave_device_id` → obrigatório
- ✅ `slave_mac_address` → obrigatório
- ✅ Arrays para `relay_numbers`, `actions`, `duration_seconds`

### **2.3. Atualizar `createRelayCommand()` em `automation.ts`**

**Arquivo:** `HIDROWAVE-main/src/lib/automation.ts`

**Mudança:**
- ❌ **ANTES:** Usava `/api/esp-now/command` (tabela antiga)
- ✅ **DEPOIS:** Usa `/api/relay-commands/master` ou `/api/relay-commands/slave`

**Lógica:**
```typescript
const isSlave = !!command.slave_mac_address;
const endpoint = isSlave 
  ? '/api/relay-commands/slave'
  : '/api/relay-commands/master';
```

### **2.4. Atualizar `DeviceControlPanel.tsx`**

**Arquivo:** `HIDROWAVE-main/src/components/DeviceControlPanel.tsx`

**Mudança:**
- ❌ **ANTES:** `fetch('/api/esp-now/command', ...)`
- ✅ **DEPOIS:** `fetch('/api/relay-commands/slave', ...)` ou `/api/relay-commands/master`

**Campos a enviar:**
```typescript
{
  master_device_id: device.device_id,
  user_email: user?.email,
  master_mac_address: device.mac_address,
  slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
  slave_mac_address: slave.macAddress,
  relay_numbers: [relay.id],      // ✅ ARRAY
  actions: ['on'],                 // ✅ ARRAY
  duration_seconds: [0],            // ✅ ARRAY
  command_type: 'manual',
  priority: 10,
  expires_at: null,
}
```

**✅ ETAPA 2 CONCLUÍDA quando:**
- APIs `/api/relay-commands/master` e `/api/relay-commands/slave` criadas
- `createRelayCommand()` atualizado
- `DeviceControlPanel.tsx` atualizado
- Testar criação de comando via interface web

---

## 🎯 ETAPA 3: ESP32 (C++) - ⏱️ 45 minutos

### **3.1. Atualizar `checkForCommands()` em `SupabaseClient.cpp`**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

**Localização:** Linha ~558

**Mudança:**

❌ **ANTES:**
```cpp
String endpoint = String(SUPABASE_RELAY_TABLE) 
  + "?device_id=eq." + getDeviceID() 
  + "&status=eq.pending"
  + "&order=priority.desc,created_at.asc"
  + "&limit=" + maxCommands;
```

✅ **DEPOIS:**
```cpp
// ✅ Usar função RPC atômica
String endpoint = "rpc/get_and_lock_master_commands"
  + "?p_device_id=" + getDeviceID()
  + "&p_limit=1"  // ✅ Processar 1 por vez (recomendado)
  + "&p_timeout_seconds=30";
```

**Nota:** A função RPC retorna JSON diretamente, não precisa filtrar por status.

### **3.2. Atualizar Parsing JSON para Arrays**

**Localização:** `SupabaseClient.cpp:650-750` (aproximadamente)

**Mudança:**

❌ **ANTES:**
```cpp
commands[i].relayNumber = cmd["relay_number"] | -1;
commands[i].action = cmd["action"].as<String>();
commands[i].durationSeconds = cmd["duration_seconds"] | 0;
```

✅ **DEPOIS:**
```cpp
// ✅ Parse de arrays
if (cmd.containsKey("relay_numbers") && cmd["relay_numbers"].is<JsonArray>()) {
    JsonArray relayNumbers = cmd["relay_numbers"];
    if (relayNumbers.size() > 0) {
        commands[i].relayNumber = relayNumbers[0];
    }
}

// ✅ Parse de actions (array)
if (cmd.containsKey("actions") && cmd["actions"].is<JsonArray>()) {
    JsonArray actions = cmd["actions"];
    if (actions.size() > 0) {
        commands[i].action = actions[0].as<String>();
    }
}

// ✅ Parse de duration_seconds (array)
if (cmd.containsKey("duration_seconds") && cmd["duration_seconds"].is<JsonArray>()) {
    JsonArray durations = cmd["duration_seconds"];
    if (durations.size() > 0) {
        commands[i].durationSeconds = durations[0];
    }
}
```

**Nota:** Por enquanto, processar apenas o primeiro elemento do array. Implementação completa de arrays pode vir depois.

### **3.3. Atualizar `HydroSystemCore.cpp` para Processar 1 Comando por Vez**

**Arquivo:** `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp`

**Localização:** Linha ~423

**Mudança:**

❌ **ANTES:**
```cpp
RelayCommand commands[5];
int commandCount = 0;

if (supabase.checkForCommands(commands, 5, commandCount)) {
    for (int i = 0; i < commandCount; i++) {
        processRelayCommand(commands[i]);
    }
}
```

✅ **DEPOIS:**
```cpp
// ✅ Processar apenas 1 comando por vez
RelayCommand command;
int commandCount = 0;

if (supabase.checkForCommands(&command, 1, commandCount)) {
    if (commandCount > 0) {
        processRelayCommand(command);
        // ✅ Aguardar um pouco para garantir atualização de status
        delay(500);  // 500ms
    }
}
```

**Por quê?**
- Evita sobrecarga no ESP32
- Garante que cada comando seja processado completamente antes do próximo
- Facilita debug e monitoramento

### **3.4. Atualizar `markCommandSent()` para Usar Tabela Correta**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

**Localização:** Linha ~876

**Verificar:**
- Se está usando `relay_commands_master` ou `relay_commands_slave`
- Pode precisar de lógica para determinar qual tabela usar baseado no tipo de comando

**Exemplo:**
```cpp
// Determinar tabela baseado no comando
String tableName = command.target_device_id.isEmpty() 
  ? "relay_commands_master" 
  : "relay_commands_slave";

String endpoint = String(tableName) + "?id=eq." + String(command.id);
```

**✅ ETAPA 3 CONCLUÍDA quando:**
- `checkForCommands()` usa função RPC
- Parsing JSON atualizado para arrays
- `HydroSystemCore.cpp` processa 1 comando por vez
- `markCommandSent()` usa tabela correta
- Compilar e testar no ESP32

---

## 🎯 ETAPA 4: TESTES E VALIDAÇÃO - ⏱️ 30 minutos

### **4.1. Teste 1: Atomicidade (SQL)**

**Objetivo:** Verificar que dois ESP32s não recebem o mesmo comando.

**Passos:**
1. Criar 2 comandos simultâneos no Supabase:
```sql
INSERT INTO relay_commands_master (device_id, user_email, master_mac_address, relay_numbers, actions, status)
VALUES 
  ('ESP32_HIDRO_F44738', 'test@example.com', 'AA:BB:CC:DD:EE:FF', ARRAY[0], ARRAY['on'], 'pending'),
  ('ESP32_HIDRO_F44738', 'test@example.com', 'AA:BB:CC:DD:EE:FF', ARRAY[1], ARRAY['on'], 'pending');
```

2. Chamar função duas vezes rapidamente:
```sql
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1);
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1);
```

**✅ Resultado esperado:**
- Primeira chamada retorna comando ID=1
- Segunda chamada retorna comando ID=2 (diferente)
- **Sem duplicação!**

### **4.2. Teste 2: Timeout de Comandos "processing"**

**Objetivo:** Verificar que comandos "processing" expirados voltam para "pending".

**Passos:**
1. Marcar comando como "processing" manualmente:
```sql
UPDATE relay_commands_master 
SET status='processing', updated_at=NOW()-INTERVAL '31 seconds'
WHERE id = 1;
```

2. Chamar função:
```sql
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1, 30);
```

**✅ Resultado esperado:**
- Comando volta para "pending" automaticamente
- Função retorna o comando (agora disponível)

### **4.3. Teste 3: Fluxo Completo (Frontend → ESP32)**

**Objetivo:** Verificar que comando criado no frontend é processado pelo ESP32.

**Passos:**
1. Criar comando via interface web (`DeviceControlPanel.tsx`)
2. Verificar no Supabase que comando foi criado com `status='pending'`
3. ESP32 deve buscar comando e marcar como `status='processing'`
4. ESP32 processa comando e marca como `status='sent'` ou `status='completed'`

**✅ Resultado esperado:**
- Comando criado → `pending`
- ESP32 busca → `processing`
- ESP32 processa → `sent` ou `completed`
- **Sem duplicação!**

### **4.4. Teste 4: Múltiplos Comandos Simultâneos**

**Objetivo:** Verificar que múltiplos comandos são processados em ordem correta.

**Passos:**
1. Criar 5 comandos com diferentes prioridades
2. ESP32 deve processar em ordem: peristaltic > rule > manual, depois priority DESC

**✅ Resultado esperado:**
- Comandos processados na ordem correta
- Sem duplicação
- Sem comandos perdidos

**✅ ETAPA 4 CONCLUÍDA quando:**
- Todos os testes passam
- Não há duplicação de comandos
- Timeout funciona corretamente
- Fluxo completo funciona

---

## 📝 RESUMO DAS ETAPAS

| Etapa | Descrição | Tempo | Status |
|-------|-----------|-------|--------|
| **1** | Supabase (SQL) - Executar script | 5 min | ⏳ |
| **2** | Frontend - Criar APIs e atualizar componentes | 30 min | ⏳ |
| **3** | ESP32 - Atualizar código C++ | 45 min | ⏳ |
| **4** | Testes e Validação | 30 min | ⏳ |
| **TOTAL** | | **~110 min** | |

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. ✅ **Fase 1: Supabase** (SQL) - Base de tudo
2. ✅ **Fase 2: Frontend** (APIs) - Criar comandos
3. ✅ **Fase 3: ESP32** (C++) - Processar comandos
4. ✅ **Fase 4: Testes** - Validar tudo

**⚠️ IMPORTANTE:** Implementar na ordem acima. Não pular etapas!

---

## 🔍 VERIFICAÇÕES FINAIS

Antes de considerar a implementação completa, verificar:

- [ ] Script SQL executado sem erros
- [ ] Funções RPC criadas e testadas
- [ ] APIs frontend criadas e funcionando
- [ ] ESP32 atualizado e compilando
- [ ] Teste de atomicidade passou
- [ ] Teste de timeout passou
- [ ] Fluxo completo funcionando
- [ ] Sem duplicação de comandos
- [ ] Logs do ESP32 mostrando processamento correto

---

## 📚 ARQUIVOS MODIFICADOS

### **Supabase (SQL):**
- ✅ `HIDROWAVE-main/scripts/IMPLEMENTAR_STATUS_PROCESSING_COMPLETO.sql`

### **Frontend (TypeScript):**
- ✅ `HIDROWAVE-main/src/app/api/relay-commands/master/route.ts` (NOVO)
- ✅ `HIDROWAVE-main/src/app/api/relay-commands/slave/route.ts` (NOVO)
- ✅ `HIDROWAVE-main/src/lib/automation.ts` (ATUALIZAR)
- ✅ `HIDROWAVE-main/src/components/DeviceControlPanel.tsx` (ATUALIZAR)

### **ESP32 (C++):**
- ✅ `ESP-HIDROWAVE-main/src/SupabaseClient.cpp` (ATUALIZAR)
- ✅ `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp` (ATUALIZAR)

---

## 🆘 TROUBLESHOOTING

### **Erro: "function does not exist"**
- ✅ Verificar que script SQL foi executado completamente
- ✅ Verificar permissões (GRANT EXECUTE)

### **Erro: "status check constraint violation"**
- ✅ Verificar que constraint foi atualizada com "processing"
- ✅ Verificar que status está na lista permitida

### **Comandos não são processados**
- ✅ Verificar que ESP32 está chamando função RPC correta
- ✅ Verificar logs do ESP32
- ✅ Verificar que comando está com `status='pending'`

### **Duplicação ainda ocorre**
- ✅ Verificar que está usando função RPC (não query direta)
- ✅ Verificar que está processando 1 comando por vez
- ✅ Verificar logs do ESP32 para race conditions

---

## ✅ CONCLUSÃO

Após completar todas as etapas, o sistema terá:

- ✅ **Atomicidade garantida** (sem duplicação)
- ✅ **Timeout automático** (comandos travados são resetados)
- ✅ **Priorização correta** (peristaltic > rule > manual)
- ✅ **Isolamento total** (cada ESP32 processa apenas seus comandos)
- ✅ **Escalabilidade** (suporta múltiplos ESP32s simultaneamente)

**🎉 Sistema pronto para produção!**


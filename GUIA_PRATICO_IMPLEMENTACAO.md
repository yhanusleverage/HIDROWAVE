# 🚀 GUIA PRÁTICO: Implementação Atomic Swap

## 📋 CHECKLIST RÁPIDO

- [ ] **1. Supabase:** Executar script SQL
- [ ] **2. ESP32:** Atualizar `SupabaseClient.cpp`
- [ ] **3. ESP32:** Atualizar `HydroSystemCore.cpp`
- [ ] **4. Frontend:** Criar novas APIs
- [ ] **5. Frontend:** Atualizar `DeviceControlPanel.tsx`

---

## 1️⃣ SUPABASE (SQL) - 5 MINUTOS

### ✅ **Arquivo:** `scripts/IMPLEMENTAR_STATUS_PROCESSING.sql`

**O que fazer:**
1. Abrir Supabase Dashboard → SQL Editor
2. Copiar todo o conteúdo de `IMPLEMENTAR_STATUS_PROCESSING.sql`
3. Colar e executar
4. ✅ Pronto! Funções criadas

**Resultado esperado:**
- ✅ Status "processing" adicionado às tabelas
- ✅ Função `get_and_lock_master_commands()` criada
- ✅ Função `get_and_lock_slave_commands()` criada

---

## 2️⃣ ESP32 (C++) - 15 MINUTOS

### **Mudança 1: Atualizar `checkForCommands()`**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

**Localização:** Linha ~558

**SUBSTITUIR:**
```cpp
String endpoint = String(SUPABASE_RELAY_TABLE) 
  + "?device_id=eq." + getDeviceID() 
  + "&status=eq.pending"
  + "&order=priority.desc,created_at.asc"
  + "&limit=" + maxCommands;
```

**POR:**
```cpp
// ✅ Usar função RPC atômica
String endpoint = "rpc/get_and_lock_master_commands"
  + "?p_device_id=" + getDeviceID()
  + "&p_limit=1"  // ✅ Processar 1 por vez
  + "&p_timeout_seconds=30";
```

---

### **Mudança 2: Atualizar Parsing JSON (Arrays)**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

**Localização:** Onde faz parse do JSON (linha ~650-750)

**ADICIONAR/ATUALIZAR:**
```cpp
// ✅ Parse de arrays (relay_numbers, actions, duration_seconds)
if (cmd.containsKey("relay_numbers") && cmd["relay_numbers"].is<JsonArray>()) {
    JsonArray relayNumbers = cmd["relay_numbers"];
    if (relayNumbers.size() > 0) {
        commands[i].relayNumber = relayNumbers[0];  // Processar primeiro
    }
} else if (cmd.containsKey("relay_number")) {
    // Fallback para formato antigo
    commands[i].relayNumber = cmd["relay_number"] | -1;
}

if (cmd.containsKey("actions") && cmd["actions"].is<JsonArray>()) {
    JsonArray actions = cmd["actions"];
    if (actions.size() > 0) {
        commands[i].action = actions[0].as<String>();
    }
} else if (cmd.containsKey("action")) {
    commands[i].action = cmd["action"] | "off";
}

if (cmd.containsKey("duration_seconds") && cmd["duration_seconds"].is<JsonArray>()) {
    JsonArray durations = cmd["duration_seconds"];
    if (durations.size() > 0) {
        commands[i].durationSeconds = durations[0];
    }
} else if (cmd.containsKey("duration_seconds")) {
    commands[i].durationSeconds = cmd["duration_seconds"] | 0;
}
```

---

### **Mudança 3: Processar 1 Comando por Vez**

**Arquivo:** `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp`

**Localização:** Onde chama `checkForCommands()` (linha ~423)

**SUBSTITUIR:**
```cpp
RelayCommand commands[5];
int commandCount = 0;

if (supabase.checkForCommands(commands, 5, commandCount)) {
    for (int i = 0; i < commandCount; i++) {
        processRelayCommand(commands[i]);
    }
}
```

**POR:**
```cpp
// ✅ Processar apenas 1 comando por vez
RelayCommand command;
int commandCount = 0;

if (supabase.checkForCommands(&command, 1, commandCount)) {
    if (commandCount > 0) {
        processRelayCommand(command);
        delay(500);  // ✅ Aguardar para garantir atualização de status
    }
}
```

---

### **Mudança 4: Atualizar `markCommandSent()`**

**Arquivo:** `ESP-HIDROWAVE-main/src/SupabaseClient.cpp`

**Localização:** Função `markCommandSent()` (linha ~876)

**VERIFICAR se está usando tabela correta:**
```cpp
// ✅ Deve usar relay_commands_master (não relay_commands)
String endpoint = String("relay_commands_master") + "?id=eq." + String(commandId);
```

---

## 3️⃣ FRONTEND (TypeScript) - 20 MINUTOS

### **Mudança 1: Criar API para Master**

**Arquivo:** `HIDROWAVE-main/src/app/api/relay-commands/master/route.ts` (NOVO)

**Criar arquivo com:**
```typescript
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,
      user_email,
      master_mac_address,
      relay_numbers,      // ✅ ARRAY
      actions,            // ✅ ARRAY
      duration_seconds,   // ✅ ARRAY
      command_type = 'manual',
      priority = 50,
      expires_at = null,
      triggered_by = 'manual',
      rule_id,
      rule_name,
    } = body;

    // Validações
    if (!master_device_id || !user_email || !master_mac_address) {
      return NextResponse.json(
        { error: 'master_device_id, user_email e master_mac_address são obrigatórios' },
        { status: 400 }
      );
    }

    if (!Array.isArray(relay_numbers) || relay_numbers.length === 0) {
      return NextResponse.json(
        { error: 'relay_numbers deve ser um array não vazio' },
        { status: 400 }
      );
    }

    // Criar comando
    const { data, error } = await supabase
      .from('relay_commands_master')
      .insert({
        device_id: master_device_id,
        user_email,
        master_mac_address,
        relay_numbers,
        actions,
        duration_seconds: duration_seconds || relay_numbers.map(() => 0),
        command_type,
        priority,
        expires_at,
        triggered_by,
        rule_id,
        rule_name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comando criado com sucesso',
      command: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar comando' },
      { status: 500 }
    );
  }
}
```

---

### **Mudança 2: Criar API para Slave**

**Arquivo:** `HIDROWAVE-main/src/app/api/relay-commands/slave/route.ts` (NOVO)

**Criar arquivo com:**
```typescript
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,
      user_email,
      master_mac_address,
      slave_device_id,
      slave_mac_address,
      relay_numbers,      // ✅ ARRAY
      actions,            // ✅ ARRAY
      duration_seconds,   // ✅ ARRAY
      command_type = 'manual',
      priority = 50,
      expires_at = null,
      triggered_by = 'manual',
      rule_id,
      rule_name,
    } = body;

    // Validações
    if (!master_device_id || !slave_device_id || !slave_mac_address) {
      return NextResponse.json(
        { error: 'master_device_id, slave_device_id e slave_mac_address são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar comando
    const { data, error } = await supabase
      .from('relay_commands_slave')
      .insert({
        master_device_id,
        user_email,
        master_mac_address,
        slave_device_id,
        slave_mac_address,
        relay_numbers,
        actions,
        duration_seconds: duration_seconds || relay_numbers.map(() => 0),
        command_type,
        priority,
        expires_at,
        triggered_by,
        rule_id,
        rule_name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comando criado com sucesso',
      command: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar comando' },
      { status: 500 }
    );
  }
}
```

---

### **Mudança 3: Atualizar `DeviceControlPanel.tsx`**

**Arquivo:** `HIDROWAVE-main/src/components/DeviceControlPanel.tsx`

**Localização:** Onde envia comando para slave (linha ~1190)

**SUBSTITUIR:**
```typescript
const response = await fetch('/api/esp-now/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    master_device_id: device.device_id,
    slave_mac_address: slave.macAddress,
    slave_name: slave.name,
    relay_number: relay.id,
    action: 'on',
    duration_seconds: 0,
    // ...
  }),
});
```

**POR:**
```typescript
// ✅ Usar nova API para slaves
const response = await fetch('/api/relay-commands/slave', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    master_device_id: device.device_id,
    user_email: user?.email,
    master_mac_address: device.mac_address,
    slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
    slave_mac_address: slave.macAddress,
    relay_numbers: [relay.id],      // ✅ ARRAY
    actions: ['on'],                 // ✅ ARRAY
    duration_seconds: [0],           // ✅ ARRAY
    command_type: 'manual',
    priority: 10,
    expires_at: null,
    triggered_by: 'manual',
  }),
});
```

**Fazer o mesmo para o botão OFF** (linha ~1220)

---

### **Mudança 4: Atualizar `createRelayCommand()` (Opcional)**

**Arquivo:** `HIDROWAVE-main/src/lib/automation.ts`

**Se a função `createRelayCommand()` for usada, atualizar para usar novas APIs:**

```typescript
export async function createRelayCommand(command: RelayCommand): Promise<RelayCommand> {
  const isSlave = !!command.slave_mac_address;
  const endpoint = isSlave 
    ? '/api/relay-commands/slave'
    : '/api/relay-commands/master';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      master_device_id: command.master_device_id,
      user_email: command.user_email,
      master_mac_address: command.master_mac_address,
      ...(isSlave && {
        slave_device_id: command.slave_device_id,
        slave_mac_address: command.slave_mac_address,
      }),
      relay_numbers: Array.isArray(command.relay_numbers) 
        ? command.relay_numbers 
        : [command.relay_number],
      actions: Array.isArray(command.actions) 
        ? command.actions 
        : [command.action],
      duration_seconds: Array.isArray(command.duration_seconds)
        ? command.duration_seconds
        : [command.duration_seconds || 0],
      command_type: command.command_type || 'manual',
      priority: command.priority || 50,
      expires_at: command.expires_at || null,
      triggered_by: command.triggered_by || 'manual',
      rule_id: command.rule_id,
      rule_name: command.rule_name,
    }),
  });
  
  // ... resto do código
}
```

---

## ✅ TESTE RÁPIDO

### **1. Testar SQL:**
```sql
-- No Supabase SQL Editor
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1, 30);
```

### **2. Testar Frontend:**
- Abrir página de dispositivos
- Clicar em um relé de slave
- Verificar no Supabase que comando foi criado em `relay_commands_slave`

### **3. Testar ESP32:**
- Verificar Serial Monitor
- Deve mostrar: `🔍 Verificando comandos: .../rpc/get_and_lock_master_commands...`
- Comando deve ser processado e marcado como "sent"

---

## 🎯 ORDEM DE EXECUÇÃO

1. **Supabase** (5 min) → Executar SQL
2. **Frontend** (20 min) → Criar APIs e atualizar componentes
3. **ESP32** (15 min) → Atualizar código C++
4. **Teste** (10 min) → Verificar fluxo completo

**Total:** ~50 minutos

---

## ⚠️ NOTAS IMPORTANTES

1. **Processar 1 comando por vez:** Recomendado para evitar sobrecarga
2. **Timeout de 30s:** Comandos "processing" expirados voltam para "pending"
3. **Arrays:** Por enquanto, processar apenas primeiro elemento do array
4. **Backward compatibility:** Manter suporte para formato antigo (relay_number único)

---

## 🐛 TROUBLESHOOTING

### **Erro: "function get_and_lock_master_commands does not exist"**
- ✅ Verificar se script SQL foi executado
- ✅ Verificar se função existe: `SELECT * FROM pg_proc WHERE proname = 'get_and_lock_master_commands';`

### **Erro: "column relay_numbers does not exist"**
- ✅ Verificar se tabela `relay_commands_master` tem coluna `relay_numbers`
- ✅ Executar script de migração se necessário

### **Comandos não são processados**
- ✅ Verificar Serial Monitor do ESP32
- ✅ Verificar se endpoint RPC está correto
- ✅ Verificar se status está como "pending" no Supabase





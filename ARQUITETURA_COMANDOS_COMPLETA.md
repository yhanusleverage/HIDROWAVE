# 🎯 ARQUITETURA COMPLETA: Camada de Comandos e Atuação

## 📊 PROBLEMA IDENTIFICADO

### **Questão Crítica:**

> **"O ESP32 busca comandos a cada 5 segundos. Se há vários comandos acumulados, como saber qual já foi processado? Como evitar processar o mesmo comando duas vezes?"**

### **Cenário Problemático:**

```
T=0s:   Frontend cria 3 comandos → Supabase (status: pending)
T=1s:   ESP32 busca → Recebe 3 comandos
T=1.5s: ESP32 processa comando #1 → Marca como "sent"
T=2s:   ESP32 processa comando #2 → Marca como "sent"
T=3s:   ESP32 processa comando #3 → Marca como "sent"
T=5s:   ESP32 busca NOVAMENTE → ❌ Ainda recebe os 3 comandos se status não foi atualizado!
```

**Problema:** Se o status não for atualizado rápido o suficiente, o ESP32 pode processar o mesmo comando múltiplas vezes.

---

## 🏗️ ARQUITETURA ATUAL

### **Fluxo Atual:**

```
1. ESP32 busca comandos (status='pending')
2. ESP32 processa cada comando
3. ESP32 marca como "sent" (PATCH)
4. ESP32 executa comando
5. ESP32 marca como "completed" (PATCH)
```

### **Problemas Identificados:**

1. **❌ Race Condition:** Entre buscar e marcar como "sent", outro processo pode buscar o mesmo comando
2. **❌ Sem Atomicidade:** Busca e atualização não são atômicas
3. **❌ Sem Cache Local:** Não há memória de comandos já processados
4. **❌ Processamento em Lote:** Processa todos os comandos de uma vez (pode causar sobrecarga)

---

## ✅ SOLUÇÕES PROPOSTAS

### **OPÇÃO 1: Marcar como "processing" Imediatamente (RECOMENDADO)**

**Conceito:** Ao buscar comandos, marcar como "processing" imediatamente usando SQL UPDATE atômico.

#### **Implementação:**

**1. Adicionar status "processing" à tabela:**

```sql
ALTER TABLE relay_commands_master 
  ADD CONSTRAINT status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

ALTER TABLE relay_commands_slave 
  ADD CONSTRAINT status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));
```

**2. Função SQL que marca e retorna (ATÔMICA):**

```sql
CREATE OR REPLACE FUNCTION get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. Buscar IDs de comandos pendentes (com TTL e priorização)
  SELECT ARRAY_AGG(rc.id ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  )
  INTO v_command_ids
  FROM public.relay_commands_master rc
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  LIMIT p_limit;
  
  -- 2. Marcar como "processing" ATÔMICAMENTE (UPDATE)
  UPDATE public.relay_commands_master
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';  -- ✅ Double-check: só atualiza se ainda está pending
  
  -- 3. Retornar comandos marcados como "processing"
  RETURN QUERY
  SELECT 
    rc.id,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    rc.created_at
  FROM public.relay_commands_master rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'  -- ✅ Só retorna os que foram marcados
  ORDER BY rc.created_at ASC;
END;
$$;
```

**3. ESP32 usa função RPC:**

```cpp
// SupabaseClient.cpp
String endpoint = "rpc/get_and_lock_master_commands"
  + "?p_device_id=" + getDeviceID()
  + "&p_limit=" + maxCommands;

// ✅ Agora os comandos já estão marcados como "processing"
// Nenhum outro processo pode pegá-los
```

**4. Fluxo atualizado:**

```
1. ESP32 chama get_and_lock_master_commands() → Comandos marcados como "processing" ATÔMICAMENTE
2. ESP32 processa cada comando
3. ESP32 marca como "sent" (quando envia para hardware)
4. ESP32 executa comando
5. ESP32 marca como "completed" (quando executa com sucesso)
```

**Vantagens:**
- ✅ **Atomicidade:** UPDATE é atômico no PostgreSQL
- ✅ **Sem Race Condition:** Nenhum outro processo pode pegar o mesmo comando
- ✅ **Rastreamento:** Status "processing" mostra comandos em andamento
- ✅ **Timeout:** Se ESP32 morrer, comandos ficam "processing" (pode adicionar timeout)

---

### **OPÇÃO 2: Cache Local de IDs Processados**

**Conceito:** ESP32 mantém cache local de IDs já processados.

#### **Implementação:**

```cpp
// HydroSystemCore.h
class HydroSystemCore {
private:
    // ✅ Cache de comandos processados (últimos 100)
    std::vector<int> processedCommandIds;
    static const int MAX_CACHE_SIZE = 100;
    
    bool isCommandProcessed(int commandId);
    void markCommandAsProcessed(int commandId);
};

// HydroSystemCore.cpp
bool HydroSystemCore::isCommandProcessed(int commandId) {
    return std::find(processedCommandIds.begin(), 
                     processedCommandIds.end(), 
                     commandId) != processedCommandIds.end();
}

void HydroSystemCore::markCommandAsProcessed(int commandId) {
    processedCommandIds.push_back(commandId);
    
    // Limitar tamanho do cache
    if (processedCommandIds.size() > MAX_CACHE_SIZE) {
        processedCommandIds.erase(processedCommandIds.begin());
    }
}

void HydroSystemCore::checkSupabaseCommands() {
    RelayCommand commands[5];
    int commandCount = 0;
    
    if (supabase.checkForCommands(commands, 5, commandCount)) {
        for (int i = 0; i < commandCount; i++) {
            // ✅ Verificar se já foi processado
            if (isCommandProcessed(commands[i].id)) {
                Serial.printf("⏭️ Comando #%d já foi processado - pulando\n", commands[i].id);
                continue;
            }
            
            // Processar comando
            processRelayCommand(commands[i]);
            
            // ✅ Marcar como processado
            markCommandAsProcessed(commands[i].id);
        }
    }
}
```

**Vantagens:**
- ✅ **Simples:** Fácil de implementar
- ✅ **Rápido:** Verificação em memória (O(1) com hash map)
- ✅ **Sem mudanças no SQL:** Não precisa alterar banco

**Desvantagens:**
- ❌ **Perde cache ao reiniciar:** ESP32 reinicia → cache perdido
- ❌ **Não resolve race condition:** Ainda pode haver duplicação entre ESP32s diferentes

---

### **OPÇÃO 3: Processar Um Comando Por Vez**

**Conceito:** ESP32 processa apenas 1 comando por ciclo, garantindo que status seja atualizado antes de buscar o próximo.

#### **Implementação:**

```cpp
void HydroSystemCore::checkSupabaseCommands() {
    // ✅ Buscar apenas 1 comando por vez
    RelayCommand command;
    int commandCount = 0;
    
    if (supabase.checkForCommands(&command, 1, commandCount)) {
        if (commandCount > 0) {
            // ✅ Processar e aguardar atualização de status
            processRelayCommand(command);
            
            // ✅ Aguardar um pouco para garantir que status foi atualizado
            delay(500);  // 500ms de delay
            
            // ✅ Buscar próximo comando (se houver)
            // (será buscado no próximo ciclo de 5s)
        }
    }
}
```

**Vantagens:**
- ✅ **Simples:** Fácil de implementar
- ✅ **Garante atualização:** Delay garante que status seja atualizado

**Desvantagens:**
- ❌ **Lento:** Processa apenas 1 comando a cada 5s
- ❌ **Não resolve race condition:** Ainda pode haver duplicação

---

### **OPÇÃO 4: Híbrida (RECOMENDADA PARA PRODUÇÃO)**

**Conceito:** Combinar Opção 1 (status "processing") + Opção 2 (cache local) + Opção 3 (processar um por vez).

#### **Implementação Completa:**

**1. SQL: Função atômica com timeout:**

```sql
CREATE OR REPLACE FUNCTION get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 1,  -- ✅ Processar 1 por vez
  p_timeout_seconds integer DEFAULT 30  -- Timeout para comandos "processing"
)
RETURNS TABLE (
  id bigint,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. Resetar comandos "processing" que expiraram (timeout)
  UPDATE public.relay_commands_master
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. Buscar IDs de comandos pendentes
  SELECT ARRAY_AGG(rc.id ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  )
  INTO v_command_ids
  FROM public.relay_commands_master rc
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  LIMIT p_limit;
  
  -- 3. Marcar como "processing" ATÔMICAMENTE
  UPDATE public.relay_commands_master
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';
  
  -- 4. Retornar comandos marcados
  RETURN QUERY
  SELECT 
    rc.id,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    rc.created_at
  FROM public.relay_commands_master rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'
  ORDER BY rc.created_at ASC;
END;
$$;
```

**2. ESP32: Cache local + Processar 1 por vez:**

```cpp
// HydroSystemCore.cpp
void HydroSystemCore::checkSupabaseCommands() {
    // ✅ Buscar apenas 1 comando por vez
    RelayCommand command;
    int commandCount = 0;
    
    if (supabase.checkForCommands(&command, 1, commandCount)) {
        if (commandCount > 0) {
            // ✅ Verificar cache local (backup)
            if (isCommandProcessed(command.id)) {
                Serial.printf("⏭️ Comando #%d já foi processado (cache) - pulando\n", command.id);
                // ✅ Marcar como failed no Supabase (já foi processado)
                supabase.markCommandFailed(command.id, "Comando já processado (cache local)");
                return;
            }
            
            // ✅ Processar comando
            processRelayCommand(command);
            
            // ✅ Marcar no cache local
            markCommandAsProcessed(command.id);
            
            // ✅ Aguardar atualização de status
            delay(500);
        }
    }
}
```

**Vantagens:**
- ✅ **Atomicidade:** UPDATE atômico no SQL
- ✅ **Sem Race Condition:** Status "processing" previne duplicação
- ✅ **Timeout:** Comandos "processing" expirados voltam para "pending"
- ✅ **Cache Local:** Backup adicional (evita reprocessar mesmo comando)
- ✅ **Processamento Sequencial:** 1 comando por vez garante ordem

**Desvantagens:**
- ⚠️ **Mais lento:** Processa 1 comando a cada 5s (mas é mais seguro)
- ⚠️ **Complexidade:** Mais código para manter

---

## 📊 COMPARAÇÃO DAS SOLUÇÕES

| Solução | Atomicidade | Race Condition | Performance | Complexidade | Recomendado |
|---------|-------------|---------------|-------------|-------------|-------------|
| **Opção 1: Status "processing"** | ✅ Sim | ✅ Resolve | ⚡ Alta | 🟡 Média | ✅ Sim |
| **Opção 2: Cache Local** | ❌ Não | ❌ Não resolve | ⚡ Alta | 🟢 Baixa | ⚠️ Parcial |
| **Opção 3: 1 por vez** | ❌ Não | ❌ Não resolve | 🐌 Baixa | 🟢 Baixa | ❌ Não |
| **Opção 4: Híbrida** | ✅ Sim | ✅ Resolve | ⚡ Média | 🔴 Alta | ✅✅ Sim |

---

## 🎯 RECOMENDAÇÃO FINAL

### **Usar OPÇÃO 4 (Híbrida)** porque:

1. **✅ Atomicidade:** UPDATE atômico previne race condition
2. **✅ Timeout:** Comandos "processing" expirados voltam para "pending"
3. **✅ Cache Local:** Backup adicional (segurança extra)
4. **✅ Processamento Sequencial:** Garante ordem e evita sobrecarga
5. **✅ Rastreamento:** Status "processing" mostra comandos em andamento

### **Latência Aceitável:**

- **5 segundos** é aceitável para automação hidropônica
- Comandos críticos podem ter **prioridade alta** (serão processados primeiro)
- Comandos de dosagem podem ter **TTL curto** (expiração rápida)

---

## 📝 IMPLEMENTAÇÃO RECOMENDADA

### **Fase 1: Adicionar Status "processing"**

```sql
-- Adicionar constraint
ALTER TABLE relay_commands_master 
  DROP CONSTRAINT IF EXISTS relay_commands_master_status_check;
  
ALTER TABLE relay_commands_master 
  ADD CONSTRAINT relay_commands_master_status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

-- Criar função atômica
CREATE OR REPLACE FUNCTION get_and_lock_master_commands(...)
-- (código acima)
```

### **Fase 2: Atualizar ESP32**

```cpp
// Usar função RPC ao invés de query direta
String endpoint = "rpc/get_and_lock_master_commands"
  + "?p_device_id=" + getDeviceID()
  + "&p_limit=1"
  + "&p_timeout_seconds=30";
```

### **Fase 3: Adicionar Cache Local (Opcional)**

```cpp
// Adicionar cache como backup adicional
std::vector<int> processedCommandIds;
```

---

## ✅ VANTAGENS DA SOLUÇÃO FINAL

1. **✅ Sem Duplicação:** Status "processing" previne processamento duplo
2. **✅ Atomicidade:** UPDATE atômico no PostgreSQL
3. **✅ Timeout:** Comandos travados voltam para "pending" após 30s
4. **✅ Priorização:** Mantém ordem de prioridade
5. **✅ Rastreamento:** Status "processing" mostra comandos em andamento
6. **✅ Escalável:** Funciona com múltiplos ESP32s (se necessário)

---

## 🚀 PRÓXIMOS PASSOS

1. ⏳ Adicionar status "processing" às tabelas
2. ⏳ Criar função `get_and_lock_*_commands()`
3. ⏳ Atualizar ESP32 para usar função RPC
4. ⏳ Adicionar cache local (opcional)
5. ⏳ Testar com múltiplos comandos simultâneos





# 🎯 PROPOSTA: REDESIGN DE `relay_commands`

## 📊 ANÁLISE DA ESTRUTURA ATUAL

### ❌ Problemas Identificados:

1. **Um comando = um relé**: Não permite comandos em lote
2. **Sem segregação Master/Slave**: Mistura tudo na mesma tabela
3. **Acumulação de comandos**: Comandos antigos ficam pendentes
4. **Sem arrays**: Não suporta múltiplos relés por comando
5. **Sem validação de device**: Não verifica se device existe antes

---

## 🏭 PADRÕES DA INDÚSTRIA

### 1. **Message Queue Pattern** (RabbitMQ, AWS SQS, Azure Service Bus)
- ✅ **Fila única por tipo**: `master_commands`, `slave_commands`
- ✅ **TTL (Time To Live)**: Comandos expiram automaticamente
- ✅ **Ack/Nack**: Confirmação de processamento
- ✅ **Dead Letter Queue**: Comandos falhados vão para DLQ

### 2. **IoT Command Pattern** (MQTT, CoAP)
- ✅ **Topic-based**: `device/{device_id}/commands`
- ✅ **QoS Levels**: 0 (fire-and-forget), 1 (at-least-once), 2 (exactly-once)
- ✅ **Retain Flag**: Último comando fica retido
- ✅ **Will Message**: Última vontade se desconectar

### 3. **Event Sourcing Pattern**
- ✅ **Comandos são eventos**: Cada comando é um evento imutável
- ✅ **Estado derivado**: Estado atual = soma de eventos
- ✅ **Replay**: Pode reprocessar eventos

---

## ✅ PROPOSTA: NOVA ESTRUTURA

### **Opção 1: Tabelas Separadas (RECOMENDADO)**

```sql
-- =====================================================
-- MASTER COMMANDS (Relés locais do Master)
-- =====================================================
CREATE TABLE public.relay_commands_master (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,  -- Master device_id
  user_email text NOT NULL,  -- ✅ Lastreado ao user
  master_mac_address text NOT NULL,  -- ✅ MAC do Master
  
  -- ✅ ARRAY de relés (permite múltiplos relés por comando)
  relay_numbers integer[] NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
  actions text[] NOT NULL CHECK (array_length(actions, 1) = array_length(relay_numbers, 1)),
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  -- ✅ OU: JSONB para mais flexibilidade
  -- relay_config jsonb NOT NULL,  -- [{relay: 0, action: "on", duration: 0}, ...]
  
  command_type text DEFAULT 'manual' CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  triggered_by text DEFAULT 'manual',
  rule_id text,
  rule_name text,
  
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'expired')),
  
  -- ✅ TTL: Comando expira após X segundos
  expires_at timestamp with time zone,
  
  -- ✅ Timestamps
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  
  error_message text,
  execution_time_ms integer,
  
  CONSTRAINT relay_commands_master_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_commands_master_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_master_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- =====================================================
-- SLAVE COMMANDS (Comandos para ESP-NOW Slaves)
-- =====================================================
CREATE TABLE public.relay_commands_slave (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  master_device_id text NOT NULL,  -- Master que vai executar
  user_email text NOT NULL,  -- ✅ Lastreado ao user
  master_mac_address text NOT NULL,  -- ✅ MAC do Master
  
  slave_device_id text NOT NULL,  -- ✅ Device ID do Slave
  slave_mac_address text NOT NULL,  -- ✅ MAC do Slave
  
  -- ✅ ARRAY de relés (permite múltiplos relés por comando)
  relay_numbers integer[] NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
  actions text[] NOT NULL CHECK (array_length(actions, 1) = array_length(relay_numbers, 1)),
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  command_type text DEFAULT 'manual' CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  triggered_by text DEFAULT 'manual',
  rule_id text,
  rule_name text,
  
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'expired')),
  
  -- ✅ TTL: Comando expira após X segundos
  expires_at timestamp with time zone,
  
  -- ✅ Timestamps
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  
  error_message text,
  execution_time_ms integer,
  
  CONSTRAINT relay_commands_slave_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_commands_slave_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_slave_slave FOREIGN KEY (slave_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_slave_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);
```

### **Opção 2: Tabela Única com Discriminação**

```sql
CREATE TABLE public.relay_commands_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  
  -- ✅ Discriminação Master/Slave
  command_target text NOT NULL CHECK (command_target IN ('master', 'slave')),
  
  -- ✅ Master (sempre presente)
  master_device_id text NOT NULL,
  user_email text NOT NULL,
  master_mac_address text NOT NULL,
  
  -- ✅ Slave (apenas se command_target = 'slave')
  slave_device_id text,
  slave_mac_address text,
  
  -- ✅ ARRAY de relés
  relay_numbers integer[] NOT NULL,
  actions text[] NOT NULL,
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  -- Resto igual...
);
```

---

## 🔧 FUNÇÕES SQL OTIMIZADAS

### **1. Buscar Comandos Pendentes (com TTL)**

```sql
CREATE OR REPLACE FUNCTION get_pending_master_commands(
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
STABLE
AS $$
BEGIN
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
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())  -- ✅ TTL check
  ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  LIMIT p_limit;
END;
$$;
```

### **2. Cleanup Automático (TTL + Old)**

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_commands()
RETURNS TABLE (
  deleted_expired INTEGER,
  deleted_completed INTEGER,
  deleted_failed INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_expired INTEGER := 0;
  v_deleted_completed INTEGER := 0;
  v_deleted_failed INTEGER := 0;
BEGIN
  -- 1. Deletar comandos expirados (TTL)
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'pending' 
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_expired FROM deleted;
  
  -- 2. Deletar completados há mais de 1 hora
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'completed' 
      AND completed_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_completed FROM deleted;
  
  -- 3. Deletar falhados há mais de 24 horas
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'failed' 
      AND failed_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_failed FROM deleted;
  
  RETURN QUERY SELECT v_deleted_expired, v_deleted_completed, v_deleted_failed;
END;
$$;
```

---

## 📝 EXEMPLOS DE USO

### **Frontend: Comando para Múltiplos Relés**

```typescript
// Comando para 3 relés do Master ao mesmo tempo
POST /api/relay-commands/master
{
  master_device_id: "ESP32_HIDRO_F44738",
  relay_numbers: [0, 1, 2],  // ✅ Array
  actions: ["on", "on", "off"],  // ✅ Array correspondente
  duration_seconds: [0, 0, 0],
  command_type: "manual",
  priority: 10,
  expires_at: "2025-11-27T00:00:00Z"  // ✅ TTL: expira em 24h
}

// Comando para Slave
POST /api/relay-commands/slave
{
  master_device_id: "ESP32_HIDRO_F44738",
  slave_mac_address: "14:33:5C:38:BF:60",
  relay_numbers: [0, 1],  // ✅ Array
  actions: ["on", "off"],
  duration_seconds: [0, 0],
  command_type: "manual",
  priority: 10
}
```

### **ESP32: Processar Array de Relés**

```cpp
// Processar todos os relés do comando de uma vez
for (int i = 0; i < cmd.relayNumbers.size(); i++) {
    int relayNum = cmd.relayNumbers[i];
    String action = cmd.actions[i];
    int duration = cmd.durationSeconds[i];
    
    executeRelayCommand(relayNum, action, duration);
}
```

---

## ✅ VANTAGENS

1. **✅ Arrays**: Suporta múltiplos relés por comando
2. **✅ Segregação**: Master e Slave separados
3. **✅ TTL**: Comandos expiram automaticamente (evita acumulação)
4. **✅ Lastreado**: user_email, MAC, device_id em todos os comandos
5. **✅ Padrões**: Baseado em Message Queue (RabbitMQ, AWS SQS)
6. **✅ Performance**: Índices otimizados por device_id + status
7. **✅ Cleanup**: Função automática remove comandos antigos

---

## 🚀 MIGRAÇÃO

### **Fase 1: Criar Novas Tabelas**
```sql
-- Criar relay_commands_master
-- Criar relay_commands_slave
-- Criar funções get_pending_*_commands
-- Criar função cleanup_expired_commands
```

### **Fase 2: Migrar Dados**
```sql
-- Migrar comandos antigos para novas tabelas
INSERT INTO relay_commands_master (...)
SELECT ... FROM relay_commands WHERE slave_mac_address IS NULL;

INSERT INTO relay_commands_slave (...)
SELECT ... FROM relay_commands WHERE slave_mac_address IS NOT NULL;
```

### **Fase 3: Atualizar Código**
- Frontend: Usar novas APIs `/api/relay-commands/master` e `/api/relay-commands/slave`
- ESP32: Processar arrays de relés
- Deprecar `relay_commands` antiga

---

## 📊 COMPARAÇÃO

| Aspecto | Atual | Proposta |
|---------|-------|----------|
| **Múltiplos relés** | ❌ Não | ✅ Sim (array) |
| **Segregação** | ❌ Não | ✅ Sim (tabelas separadas) |
| **TTL** | ❌ Não | ✅ Sim (expires_at) |
| **Acumulação** | ⚠️ Sim | ✅ Não (TTL + cleanup) |
| **Padrões** | ❌ Não | ✅ Sim (Message Queue) |
| **Performance** | ⚠️ Média | ✅ Alta (índices otimizados) |

---

## 🎯 RECOMENDAÇÃO

**Usar Opção 1 (Tabelas Separadas)** porque:
- ✅ Mais simples de entender
- ✅ Melhor performance (menos JOINs)
- ✅ Facilita manutenção
- ✅ Segue padrão de Message Queue (fila por tipo)





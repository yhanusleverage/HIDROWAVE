# 🏗️ ARQUITETURA COMPLETA: Decision Rules → Supabase → ESP32

## 📋 **FLUXO ESTRUTURAL PROCEDURAL (Setup do Usuário até Supabase)**

### **1. FRONTEND → SUPABASE (Criação de Regra)**

```typescript
// Frontend: SequentialScriptEditor.tsx o CreateRuleModal.tsx
const ruleData = {
  device_id: "ESP32_HIDRO_F44738",
  rule_id: `RULE_${Date.now()}`,
  rule_name: "Ajustar pH quando baixo",
  rule_description: "Liga bomba de pH quando pH < 6.5",
  rule_json: {
    script: {
      instructions: [
        {
          type: 'while',
          condition: { sensor: 'ph', operator: '<', value: 6.5 },
          body: [
            {
              type: 'relay_action',
              relay_number: 0,
              action: 'on',
              target: 'slave',
              slave_mac: '14:33:5C:38:BF:60'
            }
          ]
        }
      ],
      loop_interval_ms: 5000,
      max_iterations: 0,
      cooldown: 60,
      max_executions_per_hour: 10
    }
  },
  enabled: true,
  priority: 50,
  created_by: userProfile?.email || 'system'
};

// ✅ FETCH DIRETO AO SUPABASE (sin backend intermedio)
const { data, error } = await supabase
  .from('decision_rules')
  .insert(ruleData)
  .select()
  .single();
```

### **2. ESTRUTURA DA TABELA `decision_rules`**

```sql
CREATE TABLE decision_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,              -- Master Device ID
  rule_id text NOT NULL,                -- "RULE_001", "RULE_002", etc.
  rule_name text NOT NULL,              -- "Ajustar pH quando baixo"
  rule_description text,                -- Descrição opcional
  rule_json jsonb NOT NULL,              -- JSON com script completo
  enabled boolean DEFAULT true,         -- Regra ativa?
  priority integer DEFAULT 50,           -- Prioridade (0-100)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system',     -- ✅ Email do usuário
  
  CONSTRAINT fk_decision_rules_device 
    FOREIGN KEY (device_id) REFERENCES device_status(device_id)
);

-- ✅ Índices para performance
CREATE INDEX idx_decision_rules_device_id ON decision_rules(device_id);
CREATE INDEX idx_decision_rules_enabled ON decision_rules(enabled);
CREATE INDEX idx_decision_rules_priority ON decision_rules(priority DESC);
CREATE INDEX idx_decision_rules_created_by ON decision_rules(created_by);
```

### **3. ESTRUTURA DO `rule_json` (Empaquetado)**

```json
{
  "script": {
    "instructions": [
      {
        "type": "while",
        "condition": {
          "sensor": "ph",
          "operator": "<",
          "value": 6.5
        },
        "body": [
          {
            "type": "relay_action",
            "relay_number": 0,
            "action": "on",
            "target": "slave",
            "slave_mac": "14:33:5C:38:BF:60"
          }
        ],
        "delay_ms": 1000
      }
    ],
    "loop_interval_ms": 5000,
    "max_iterations": 0,
    "chained_events": [],
    "cooldown": 60,
    "max_executions_per_hour": 10
  }
}
```

---

## 🔄 **FLUXO COMPLETO: Usuário → Supabase → ESP32 → Comando**

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ USUÁRIO (Frontend)                                       │
│    - Cria regra no SequentialScriptEditor                   │
│    - Preenche condições, ações, configurações              │
│    - Clica em "Salvar"                                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ POST /rest/v1/decision_rules
                    │ (Fetch directo desde frontend)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ SUPABASE - Tabela decision_rules                        │
│    - Regra guardada com rule_json completo                  │
│    - enabled = true                                         │
│    - created_by = email do usuário                          │
│    - Filtrada por device_id + created_by                   │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ ⏳ Aguardando avaliação pelo ESP32...
                    │
                    │ ESP32 busca regras ativas (cada 30s)
                    │ SELECT * FROM decision_rules
                    │ WHERE device_id = ? 
                    │   AND enabled = true
                    │   AND created_by = ? (futuro: RLS)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ ESP32 MASTER - Decision Engine                          │
│    - Lê regras do Supabase                                  │
│    - Avalia condições (sensor readings)                     │
│    - Se condição = true:                                   │
│      → Cria comando em relay_commands_slave                │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ INSERT em relay_commands_slave
                    │ {
                    │   command_type: 'rule',
                    │   triggered_by: 'rule',
                    │   rule_id: 'RULE_001',
                    │   rule_name: 'Ajustar pH quando baixo',
                    │   status: 'pending'
                    │ }
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ SUPABASE - Tabela relay_commands_slave                 │
│    - Comando criado pelo ESP32                             │
│    - status: 'pending' → 'processing' → 'sent' → 'completed'│
└─────────────────────────────────────────────────────────────┘
                    │
                    │ ESP32 busca comandos pending
                    │ RPC: get_and_lock_slave_commands()
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ ESP32 MASTER - Processa Comando                         │
│    - Envia via ESP-NOW ao Slave                             │
│    - Atualiza status: 'sent' → 'completed'                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **ESTRUTURA DA TABELA `relay_commands_slave`**

```sql
CREATE TABLE relay_commands_slave (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  master_device_id text NOT NULL,
  user_email text NOT NULL,              -- ✅ Filtrado por usuário
  master_mac_address text NOT NULL,
  slave_device_id text NOT NULL,
  slave_mac_address text NOT NULL,
  
  -- ✅ ARRAYS: Múltiplos relés por comando
  relay_numbers integer[] NOT NULL,
  actions text[] NOT NULL,
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  -- ✅ ORIGEM DO COMANDO
  command_type text DEFAULT 'manual' 
    CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  triggered_by text DEFAULT 'manual',
  rule_id text,                          -- NULL para manual, "RULE_001" para rule
  rule_name text,                        -- NULL para manual, "Ajustar pH" para rule
  
  priority integer DEFAULT 50,
  
  -- ✅ STATUS: pending → processing → sent → completed
  status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired')),
  
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  execution_time_ms integer,
  created_by text DEFAULT 'web_interface',
  
  CONSTRAINT fk_relay_commands_slave_master 
    FOREIGN KEY (master_device_id) REFERENCES device_status(device_id),
  CONSTRAINT fk_relay_commands_slave_user 
    FOREIGN KEY (user_email) REFERENCES users(email)
);

-- ✅ Índices para performance
CREATE INDEX idx_relay_commands_slave_status 
  ON relay_commands_slave(device_id, status) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_relay_commands_slave_user 
  ON relay_commands_slave(user_email, status);
```

---

## 👁️ **VIEWS RECOMENDADAS**

### **View 1: Comandos Pendentes/Processando/Enviados**

```sql
CREATE OR REPLACE VIEW v_relay_commands_status AS
SELECT 
  id,
  master_device_id,
  user_email,
  slave_mac_address,
  relay_numbers,
  actions,
  command_type,
  triggered_by,
  rule_id,
  rule_name,
  priority,
  status,
  created_at,
  sent_at,
  completed_at,
  CASE 
    WHEN status = 'pending' THEN 'Aguardando'
    WHEN status = 'processing' THEN 'Processando'
    WHEN status = 'sent' THEN 'Enviado'
    WHEN status = 'completed' THEN 'Completado'
    WHEN status = 'failed' THEN 'Falhou'
    WHEN status = 'expired' THEN 'Expirado'
    ELSE 'Desconhecido'
  END as status_label,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))::integer as duration_seconds
FROM relay_commands_slave
WHERE status IN ('pending', 'processing', 'sent')
ORDER BY 
  CASE status
    WHEN 'processing' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'sent' THEN 3
    ELSE 4
  END,
  priority DESC,
  created_at ASC;
```

### **View 2: Regras Ativas com Estatísticas**

```sql
CREATE OR REPLACE VIEW v_decision_rules_active AS
SELECT 
  dr.id,
  dr.device_id,
  dr.rule_id,
  dr.rule_name,
  dr.rule_description,
  dr.rule_json,
  dr.enabled,
  dr.priority,
  dr.created_by,
  dr.created_at,
  dr.updated_at,
  COUNT(rc.id) FILTER (WHERE rc.status = 'pending') as commands_pending,
  COUNT(rc.id) FILTER (WHERE rc.status = 'processing') as commands_processing,
  COUNT(rc.id) FILTER (WHERE rc.status = 'sent') as commands_sent,
  COUNT(rc.id) FILTER (WHERE rc.status = 'completed') as commands_completed,
  COUNT(rc.id) FILTER (WHERE rc.status = 'failed') as commands_failed,
  MAX(rc.created_at) as last_command_at
FROM decision_rules dr
LEFT JOIN relay_commands_slave rc 
  ON rc.rule_id = dr.rule_id 
  AND rc.master_device_id = dr.device_id
WHERE dr.enabled = true
GROUP BY dr.id, dr.device_id, dr.rule_id, dr.rule_name, 
         dr.rule_description, dr.rule_json, dr.enabled, 
         dr.priority, dr.created_by, dr.created_at, dr.updated_at
ORDER BY dr.priority DESC, dr.created_at ASC;
```

---

## 🎯 **RESPOSTA: Nest.js vs Supabase Directo**

### **✅ RECOMENDAÇÃO: MANEJAR DESDE SUPABASE (Sin Nest.js)**

**Razões:**

1. **✅ Menos Complejidade**
   - Frontend → Supabase directo (menos capas)
   - Menos servidores para manter
   - Menos custos de infraestrutura

2. **✅ Supabase já oferece:**
   - ✅ Row Level Security (RLS) para filtrar por usuário
   - ✅ RPC Functions para lógica complexa
   - ✅ Real-time subscriptions (se necessário)
   - ✅ Edge Functions (para tareas programadas)
   - ✅ Triggers automáticos

3. **✅ Flujo Actual Funciona:**
   ```typescript
   // Frontend → Supabase (directo)
   await supabase.from('decision_rules').insert(ruleData);
   
   // ESP32 → Supabase (directo via RPC)
   await supabase.rpc('get_active_decision_rules', { 
     p_device_id: deviceId 
   });
   ```

4. **✅ Quando considerar Nest.js:**
   - Si necesitas lógica de negocio muy compleja
   - Si necesitas integración con múltiples servicios externos
   - Si necesitas procesamiento pesado en servidor
   - Si necesitas rate limiting avanzado

### **❌ NO NECESITAS Nest.js SI:**
   - ✅ Solo necesitas CRUD básico (Supabase lo hace)
   - ✅ La lógica está en el ESP32 (evaluación de reglas)
   - ✅ El frontend es simple (formularios + listas)
   - ✅ Ya tienes RPC functions en Supabase

---

## 📝 **EJEMPLO DE FETCH COMPLETO**

### **Frontend: Crear Regra**

```typescript
// SequentialScriptEditor.tsx
const handleSave = async () => {
  const ruleData = {
    device_id: deviceId,
    rule_id: scriptId || `RULE_${Date.now()}`,
    rule_name: ruleName,
    rule_description: ruleDescription,
    rule_json: {
      script: {
        instructions,
        loop_interval_ms: loopInterval,
        max_iterations: maxIterations,
        chained_events: chainedEvents.length > 0 ? chainedEvents : undefined,
        cooldown,
        max_executions_per_hour: maxExecutionsPerHour,
      },
    },
    enabled,
    priority,
    created_by: userProfile?.email || 'system',
  };

  // ✅ FETCH DIRETO AO SUPABASE
  const { data, error } = await supabase
    .from('decision_rules')
    .insert(ruleData)
    .select()
    .single();

  if (error) throw error;
  toast.success('Função criada com sucesso');
};
```

### **Frontend: Listar Regras (Filtrado por Usuário)**

```typescript
// DecisionEngineCard.tsx
const loadScripts = async () => {
  const { data, error } = await supabase
    .from('decision_rules')
    .select('*')
    .eq('device_id', deviceId)
    .eq('enabled', true)
    .eq('created_by', userProfile.email)  // ✅ Filtro por usuário
    .order('priority', { ascending: false });

  if (error) throw error;
  setScripts(data || []);
};
```

### **ESP32: Buscar Regras Ativas (Futuro RPC)**

```cpp
// ESP32 (futuro)
// Opción 1: Query directa
String query = "/rest/v1/decision_rules?device_id=eq." + deviceId 
             + "&enabled=eq.true"
             + "&order=priority.desc";

// Opción 2: RPC (recomendado)
String rpcCall = "/rest/v1/rpc/get_active_decision_rules";
String payload = "{\"p_device_id\":\"" + deviceId + "\",\"p_limit\":50}";
```

---

## 🔍 **CONSOLE LOG: Verificar Empaquetado**

```typescript
// En SequentialScriptEditor.tsx, antes de salvar:
console.log('📦 [DECISION RULE] Empaquetando regra:', {
  device_id: deviceId,
  rule_id: scriptId || `RULE_${Date.now()}`,
  rule_name: ruleName,
  rule_json: JSON.stringify(ruleJson, null, 2),  // ✅ Ver JSON completo
  enabled,
  priority,
  created_by: userProfile?.email
});

// Después de insertar:
console.log('✅ [DECISION RULE] Regra criada no Supabase:', {
  id: data.id,
  rule_id: data.rule_id,
  created_at: data.created_at
});
```

---

## 📊 **RESUMEN: Arquitectura Actual**

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                       │
│  - SequentialScriptEditor.tsx                           │
│  - CreateRuleModal.tsx                                  │
│  - DecisionEngineCard.tsx                               │
│                                                          │
│  ✅ Fetch directo: supabase.from('decision_rules')      │
│  ✅ Filtrado por: device_id + created_by (email)       │
└─────────────────────────────────────────────────────────┘
                    │
                    │ HTTP POST/GET/PATCH/DELETE
                    │ (Supabase REST API)
                    ▼
┌─────────────────────────────────────────────────────────┐
│ SUPABASE (Backend as a Service)                         │
│                                                          │
│  📊 Tabelas:                                            │
│    - decision_rules (regras)                            │
│    - relay_commands_slave (comandos)                   │
│                                                          │
│  🔧 RPC Functions:                                      │
│    - get_active_decision_rules()                        │
│    - get_and_lock_slave_commands()                      │
│                                                          │
│  👁️ Views (recomendadas):                               │
│    - v_relay_commands_status                            │
│    - v_decision_rules_active                            │
│                                                          │
│  🔒 Row Level Security (RLS):                           │
│    - Filtrar por created_by (email)                     │
└─────────────────────────────────────────────────────────┘
                    │
                    │ HTTP GET (RPC)
                    │ (cada 30 segundos)
                    ▼
┌─────────────────────────────────────────────────────────┐
│ ESP32 MASTER                                            │
│  - Busca regras ativas                                  │
│  - Avalia condições                                     │
│  - Cria comandos em relay_commands_slave                │
│  - Processa comandos via ESP-NOW                        │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **CONCLUSIÓN**

1. **✅ NO necesitas Nest.js**: Supabase maneja todo el backend
2. **✅ Fetch directo**: Frontend → Supabase (sin capa intermedia)
3. **✅ Filtrado por usuário**: `created_by` (email) en todas las queries
4. **✅ Views recomendadas**: Para monitorear comandos pending/processing/sent
5. **✅ Flujo simple**: Frontend → Supabase → ESP32 → Comandos
6. **✅ Sistema consolidado**: Usar el mismo patrón de `relay_commands_slave` + RPC

**Arquitectura actual es suficiente y eficiente!** 🎯

---

## 📚 **DOCUMENTOS RELACIONADOS**

- **`FLUXO_PANORAMICO_DECISION_RULES.md`**: Flujo completo panorámico desde Master hasta Supabase, comparación con alternativas, y confirmación de que el sistema actual es el mejor y más fácil.

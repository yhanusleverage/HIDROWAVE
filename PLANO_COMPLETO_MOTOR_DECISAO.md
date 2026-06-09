# 🎯 PLANO COMPLETO: Motor de Decisão e Melhorias

## 📋 **ENUMERAÇÃO COMPLETA DO QUE PRECISAMOS**

---

## **1. MOSTRAR MAIS INFORMAÇÕES RELEVANTES NOS RELAYS SLAVE ESP-NOW**

### **1.1 Informações Atuais que Já Existem:**
- ✅ MAC Address do Slave
- ✅ Nome do Slave (device_name)
- ✅ Estado do relé (ON/OFF)
- ✅ Número do relé (0-7)

### **1.2 Informações que DEVEM ser Adicionadas:**

#### **A) Informações do Relé:**
```typescript
interface RelayInfo {
  // ✅ JÁ EXISTE
  id: number;                    // 0-7
  name: string;                  // Nome do relé
  state: boolean;                // ON/OFF
  
  // ⚠️ ADICIONAR
  has_timer: boolean;            // Tem timer ativo?
  remaining_time: number;        // Tempo restante em segundos
  last_update: string;           // Última atualização (timestamp)
  slave_mac: string;             // MAC do slave (para identificação)
  slave_device_id: string;       // Device ID do slave
  slave_name: string;            // Nome do slave
  is_online: boolean;            // Slave está online?
  last_seen: string;             // Última vez que slave foi visto
}
```

#### **B) Indicadores Visuais:**
- 🟢 **Verde**: Relé ON + Slave Online
- 🟡 **Amarelo**: Relé ON + Slave Offline (estado pode estar desatualizado)
- 🔴 **Vermelho**: Relé OFF + Slave Offline
- ⚪ **Cinza**: Relé OFF + Slave Online
- ⏱️ **Timer**: Mostrar contador regressivo se `has_timer = true`

#### **C) Badges/Etiquetas:**
- `ESP-NOW SLAVE` - Identificar que é relay slave
- `ONLINE` / `OFFLINE` - Status do slave
- `TIMER: 30s` - Se tiver timer ativo

---

## **2. REPRODUZIR API DE EC CONTROLLER CONFIG PARA USAR RPC**

### **2.1 Situação Atual:**
- ✅ API existe: `/api/ec-controller/config`
- ✅ Usa Supabase diretamente (GET/POST)
- ⚠️ **NÃO usa RPC** (função PostgreSQL)

### **2.2 O Que Precisamos:**

#### **A) Criar Função RPC no Supabase:**
```sql
-- Função para buscar config do EC Controller
CREATE OR REPLACE FUNCTION get_ec_controller_config(
  p_device_id TEXT
)
RETURNS TABLE (
  device_id TEXT,
  base_dose NUMERIC,
  flow_rate NUMERIC,
  volume NUMERIC,
  total_ml NUMERIC,
  kp NUMERIC,
  ec_setpoint NUMERIC,
  auto_enabled BOOLEAN,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ec.device_id,
    ec.base_dose,
    ec.flow_rate,
    ec.volume,
    ec.total_ml,
    ec.kp,
    ec.ec_setpoint,
    ec.auto_enabled,
    ec.updated_at
  FROM ec_controller_config ec
  WHERE ec.device_id = p_device_id;
  
  -- Se não encontrou, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      p_device_id::TEXT,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      1.0::NUMERIC,
      0::NUMERIC,
      false::BOOLEAN,
      NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para salvar/atualizar config
CREATE OR REPLACE FUNCTION upsert_ec_controller_config(
  p_device_id TEXT,
  p_base_dose NUMERIC DEFAULT NULL,
  p_flow_rate NUMERIC DEFAULT NULL,
  p_volume NUMERIC DEFAULT NULL,
  p_total_ml NUMERIC DEFAULT NULL,
  p_kp NUMERIC DEFAULT NULL,
  p_ec_setpoint NUMERIC DEFAULT NULL,
  p_auto_enabled BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  device_id TEXT,
  base_dose NUMERIC,
  flow_rate NUMERIC,
  volume NUMERIC,
  total_ml NUMERIC,
  kp NUMERIC,
  ec_setpoint NUMERIC,
  auto_enabled BOOLEAN,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  INSERT INTO ec_controller_config (
    device_id,
    base_dose,
    flow_rate,
    volume,
    total_ml,
    kp,
    ec_setpoint,
    auto_enabled,
    updated_at
  ) VALUES (
    p_device_id,
    COALESCE(p_base_dose, 0),
    COALESCE(p_flow_rate, 0),
    COALESCE(p_volume, 0),
    COALESCE(p_total_ml, 0),
    COALESCE(p_kp, 1.0),
    COALESCE(p_ec_setpoint, 0),
    COALESCE(p_auto_enabled, false),
    NOW()
  )
  ON CONFLICT (device_id) DO UPDATE SET
    base_dose = COALESCE(p_base_dose, ec_controller_config.base_dose),
    flow_rate = COALESCE(p_flow_rate, ec_controller_config.flow_rate),
    volume = COALESCE(p_volume, ec_controller_config.volume),
    total_ml = COALESCE(p_total_ml, ec_controller_config.total_ml),
    kp = COALESCE(p_kp, ec_controller_config.kp),
    ec_setpoint = COALESCE(p_ec_setpoint, ec_controller_config.ec_setpoint),
    auto_enabled = COALESCE(p_auto_enabled, ec_controller_config.auto_enabled),
    updated_at = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
```

#### **B) Atualizar API para Usar RPC:**
```typescript
// GET /api/ec-controller/config
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');
  
  // ✅ USAR RPC
  const { data, error } = await supabase.rpc('get_ec_controller_config', {
    p_device_id: deviceId
  });
  
  // ...
}

// POST /api/ec-controller/config
export async function POST(request: Request) {
  const body = await request.json();
  
  // ✅ USAR RPC
  const { data, error } = await supabase.rpc('upsert_ec_controller_config', {
    p_device_id: body.device_id,
    p_base_dose: body.base_dose,
    p_flow_rate: body.flow_rate,
    // ... outros campos
  });
  
  // ...
}
```

**Vantagens do RPC:**
- ✅ Lógica centralizada no banco
- ✅ Validações no PostgreSQL
- ✅ Mais performático (menos queries)
- ✅ Padrão consistente com outras APIs

---

## **3. MODELAR INTERFACE DO MOTOR DE DECISÃO**

### **3.1 Estrutura de Regra (Baseada no ESP32):**

```typescript
interface DecisionRule {
  // Identificação
  id: string;                    // ID único (UUID)
  rule_id: string;              // ID legível (ex: "RULE_001")
  name: string;                 // Nome da regra
  description?: string;         // Descrição detalhada
  device_id: string;           // Device ID do Master
  
  // Controle
  enabled: boolean;             // Regra ativa?
  priority: number;             // Prioridade (0-100, maior = mais importante)
  
  // Condições
  condition: RuleCondition;     // Condição principal
  safety_checks?: SafetyCheck[]; // Verificações de segurança
  
  // Ações (MÚLTIPLAS - pode ativar 1+ relays slave)
  actions: RuleAction[];        // Array de ações
  
  // Trigger
  trigger_type: 'periodic' | 'on_change' | 'scheduled';
  trigger_interval_ms?: number; // Para periodic (ex: 30000 = 30s)
  schedule?: string;           // Para scheduled (ex: "08:00-18:00")
  
  // Controle de execução
  cooldown_seconds: number;     // Tempo mínimo entre execuções
  max_executions_per_hour?: number; // Limite por hora
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface RuleCondition {
  type: 'sensor_compare' | 'time_window' | 'relay_state' | 'composite';
  sensor_name?: string;          // 'ph', 'ec', 'temperature', etc.
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value?: number;               // Valor de comparação
  composite_operator?: 'AND' | 'OR';
  conditions?: RuleCondition[]; // Para composite
}

interface RuleAction {
  type: 'relay_on' | 'relay_off' | 'relay_pulse' | 'relay_pwm';
  slave_mac_address: string;    // ⚠️ CRÍTICO: MAC do slave (NÃO master!)
  relay_number: number;         // 0-7 (slave)
  duration_seconds?: number;    // 0 = permanente, >0 = temporário
  value?: number;               // Para PWM
}

interface SafetyCheck {
  name: string;
  condition: RuleCondition;
  error_message: string;
  is_critical: boolean;         // Se true, para todo o sistema
}
```

### **3.2 Interface de Criação/Edição:**

```typescript
// Componente React para criar/editar regra
interface RuleEditorProps {
  rule?: DecisionRule;
  deviceId: string;
  slaves: ESPNOWSlave[];        // Lista de slaves disponíveis
  onSave: (rule: DecisionRule) => void;
  onCancel: () => void;
}

// Campos do formulário:
// 1. Nome e Descrição
// 2. Prioridade (0-100)
// 3. Condição (sensor + operador + valor)
// 4. Ações (múltiplas):
//    - Selecionar Slave (dropdown)
//    - Selecionar Relé (0-7)
//    - Ação (ON/OFF/PULSE)
//    - Duração (se temporário)
// 5. Trigger (periodic/on_change/scheduled)
// 6. Cooldown
// 7. Limites de segurança
```

### **3.3 Interface de Visualização:**

```typescript
// Lista de regras ativas
interface RulesListProps {
  rules: DecisionRule[];
  onEdit: (rule: DecisionRule) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onDelete: (ruleId: string) => void;
}

// Card de regra mostra:
// - Nome + Status (ativa/inativa)
// - Prioridade (badge colorido)
// - Condição resumida (ex: "pH < 6.0")
// - Ações resumidas (ex: "Slave 1, Relé 0: ON por 30s")
// - Última execução
// - Contador de execuções
```

---

## **4. COMO O MOTOR DE DECISÃO VAI TRABALHAR**

### **4.1 Fluxo Completo:**

```
1. ESP32 Master avalia regras (a cada 5s ou on_change)
   │
   ▼
2. Para cada regra habilitada:
   │
   ├─ Verifica cooldown (tempo mínimo entre execuções)
   ├─ Verifica limite por hora
   ├─ Avalia condição (ex: pH < 6.0)
   ├─ Verifica safety checks
   │
   ▼
3. Se condição verdadeira:
   │
   ├─ Para CADA ação na regra:
   │   │
   │   ├─ Identifica Slave (por MAC address)
   │   ├─ Cria comando em relay_commands_slave
   │   │   {
   │   │     master_device_id: "ESP32_HIDRO_XXX",
   │   │     slave_mac_address: "14:33:5C:38:BF:60",
   │   │     relay_numbers: [0, 1],  // ⚠️ MÚLTIPLOS!
   │   │     actions: ["on", "on"],
   │   │     duration_seconds: [30, 30],
   │   │     command_type: "rule",
   │   │     priority: 80,  // Prioridade da regra
   │   │     rule_id: "RULE_001",
   │   │     rule_name: "Corrigir pH baixo"
   │   │   }
   │   │
   │   └─ ESP32 Master busca comando (polling)
   │       └─ Envia via ESP-NOW para Slave
   │           └─ Slave executa e envia ACK
   │
   └─ Atualiza estatísticas da regra
```

### **4.2 Regras Importantes:**

#### **A) NÃO USAR RELAYS MASTER:**
- ❌ **NÃO** usar relays master (0-15 do primeiro PCF8574)
- ✅ **SOMENTE** usar relays slave ESP-NOW (0-7 de cada slave)
- **Razão:**
  - Primeiros 8 relays do primeiro PCF8574 = Relays Master (uso específico)
  - Segundo PCF8574 = Sensores de nível (não são relays)
  - Relays Slave ESP-NOW = Para automações e dosagem

#### **B) Cada Regra Pode Ativar MÚLTIPLOS Relays:**
```typescript
// Exemplo: Regra "Corrigir pH e EC"
{
  condition: { sensor: 'ph', operator: '<', value: 6.0 },
  actions: [
    { slave_mac: "14:33:5C:38:BF:60", relay: 0, action: "on", duration: 30 },  // Bomba pH
    { slave_mac: "14:33:5C:38:BF:60", relay: 1, action: "on", duration: 30 },  // Bomba EC
    { slave_mac: "14:33:5C:38:BF:61", relay: 0, action: "on", duration: 60 }   // Agitador
  ]
}
```

#### **C) Prioridade:**
- Regras com maior `priority` são avaliadas primeiro
- Se duas regras querem ativar o mesmo relé, a de maior prioridade vence
- Comandos de regras têm `command_type: "rule"` e `priority` da regra

---

## **5. TEMPO DE ATUALIZAÇÃO DAS VIEWS DOS BOTÕES E ESTADOS**

### **5.1 Métodos de Atualização Atuais:**

#### **A) Polling Periódico:**
```typescript
// automacao/page.tsx - Linha 359-367
useEffect(() => {
  const interval = setInterval(() => {
    loadESPNOWSlaves();  // Recarrega TUDO (slaves + estados)
  }, 30000); // ⏱️ A cada 30 segundos
}, [selectedDeviceId]);
```

**Tempo:** 30 segundos (fixo)

#### **B) Atualização Otimizada (Apenas Estados):**
```typescript
// automacao/page.tsx - Linha 421-426
useEffect(() => {
  updateRelayStatesOnly();  // Busca apenas estados (mais leve)
  const interval = setInterval(() => {
    updateRelayStatesOnly();
  }, 5000); // ⏱️ A cada 5 segundos
}, [selectedDeviceId, updateRelayStatesOnly]);
```

**Tempo:** 5 segundos (fixo)

#### **C) Atualização Após Comando:**
```typescript
// DeviceControlPanel.tsx - Linha 1235-1239
setTimeout(() => {
  loadSlaves();  // Recarrega após criar comando
}, 2000); // ⏱️ 2 segundos após comando
```

**Tempo:** 2 segundos (fixo, após comando)

#### **D) Verificação de ACKs:**
```typescript
// automacao/page.tsx - Linha 370-410
useEffect(() => {
  const interval = setInterval(async () => {
    // Buscar ACKs dos comandos pendentes
    const response = await fetch(`/api/esp-now/command-acks?...`);
    // Atualizar estados baseado em ACKs
  }, 3000); // ⏱️ A cada 3 segundos
}, [selectedDeviceId]);
```

**Tempo:** 3 segundos (fixo, verifica ACKs)

### **5.2 Resumo dos Tempos:**

| Método | Intervalo | O Que Atualiza | Peso |
|--------|-----------|----------------|------|
| **Polling Completo** | 30s | Tudo (slaves + estados) | Pesado |
| **Polling Estados** | 5s | Apenas estados | Leve |
| **Após Comando** | 2s | Tudo (após criar comando) | Pesado |
| **Verificação ACKs** | 3s | Estados via ACKs | Leve |

### **5.3 Problemas Atuais:**

1. **Múltiplos métodos conflitantes:**
   - Polling completo (30s)
   - Polling estados (5s)
   - Verificação ACKs (3s)
   - Atualização após comando (2s)
   - **Resultado:** Muitas requisições desnecessárias

2. **Tempos fixos não adaptativos:**
   - Se ESP32 demorar mais de 2s, atualização após comando falha
   - Polling de 30s é muito lento para feedback visual

3. **Falta de feedback em tempo real:**
   - Não usa WebSocket Realtime do Supabase
   - Depende de polling (ineficiente)

### **5.4 Solução Proposta:**

#### **A) Unificar em Um Único Sistema:**
```typescript
// Sistema unificado de atualização
const useRelayStateSync = (deviceId: string) => {
  // 1. Atualização otimista (imediata ao clicar)
  // 2. Polling inteligente (5s quando há comandos pendentes, 30s quando não há)
  // 3. WebSocket Realtime (quando disponível)
  // 4. Verificação de ACKs (apenas para comandos pendentes)
};
```

#### **B) Tempos Adaptativos:**
- **Com comandos pendentes:** 2-3s (rápido)
- **Sem comandos pendentes:** 10-15s (economiza recursos)
- **Após criar comando:** 1s (feedback rápido)

#### **C) WebSocket Realtime (Futuro):**
- Atualização instantânea (<100ms)
- Elimina necessidade de polling
- Mais eficiente

---

## **6. CHECKLIST DE IMPLEMENTAÇÃO**

### **6.1 Fase 1: Informações dos Relays Slave**
- [ ] Adicionar `has_timer` e `remaining_time` na interface
- [ ] Mostrar indicadores visuais (verde/amarelo/vermelho)
- [ ] Adicionar badges (ESP-NOW SLAVE, ONLINE/OFFLINE)
- [ ] Mostrar contador regressivo se tiver timer

### **6.2 Fase 2: API EC Controller com RPC**
- [ ] Criar função RPC `get_ec_controller_config` no Supabase
- [ ] Criar função RPC `upsert_ec_controller_config` no Supabase
- [ ] Atualizar API `/api/ec-controller/config` para usar RPC
- [ ] Testar GET e POST

### **6.3 Fase 3: Interface do Motor de Decisão**
- [ ] Criar componente `RuleEditor` (criar/editar regra)
- [ ] Criar componente `RulesList` (listar regras)
- [ ] Criar API `/api/automation/rules` (CRUD de regras)
- [ ] Integrar com Supabase (tabela `decision_rules`)
- [ ] Validar que regras só usam relays slave (não master)

### **6.4 Fase 4: Motor de Decisão no ESP32**
- [ ] ESP32 busca regras do Supabase (polling)
- [ ] ESP32 avalia condições
- [ ] ESP32 cria comandos em `relay_commands_slave` quando condição verdadeira
- [ ] ESP32 envia comandos via ESP-NOW
- [ ] ESP32 atualiza estatísticas das regras

### **6.5 Fase 5: Otimização de Atualização**
- [ ] Unificar métodos de atualização
- [ ] Implementar tempos adaptativos
- [ ] Reduzir polling desnecessário
- [ ] (Futuro) Implementar WebSocket Realtime

---

## **7. ESTRUTURA DE DADOS NO SUPABASE**

### **7.1 Tabela `decision_rules`:**
```sql
CREATE TABLE decision_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  -- Condição (JSON)
  condition_json JSONB NOT NULL,
  
  -- Ações (JSON array)
  actions_json JSONB NOT NULL,  -- Array de RuleAction
  
  -- Trigger
  trigger_type TEXT DEFAULT 'periodic',
  trigger_interval_ms INTEGER,
  schedule TEXT,
  
  -- Controle
  cooldown_seconds INTEGER DEFAULT 0,
  max_executions_per_hour INTEGER,
  
  -- Estatísticas
  last_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  execution_count_hour INTEGER DEFAULT 0,
  hour_reset_time TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Índices
CREATE INDEX idx_decision_rules_device_id ON decision_rules(device_id);
CREATE INDEX idx_decision_rules_enabled ON decision_rules(enabled);
CREATE INDEX idx_decision_rules_priority ON decision_rules(priority DESC);
```

### **7.2 Exemplo de Regra no Banco:**
```json
{
  "rule_id": "RULE_001",
  "device_id": "ESP32_HIDRO_F44738",
  "name": "Corrigir pH Baixo",
  "enabled": true,
  "priority": 80,
  "condition_json": {
    "type": "sensor_compare",
    "sensor_name": "ph",
    "operator": "<",
    "value": 6.0
  },
  "actions_json": [
    {
      "type": "relay_on",
      "slave_mac_address": "14:33:5C:38:BF:60",
      "relay_number": 0,
      "duration_seconds": 30
    },
    {
      "type": "relay_on",
      "slave_mac_address": "14:33:5C:38:BF:60",
      "relay_number": 1,
      "duration_seconds": 30
    }
  ],
  "trigger_type": "on_change",
  "cooldown_seconds": 60
}
```

---

## **8. PRÓXIMOS PASSOS**

1. **Implementar Fase 1** (Informações dos Relays)
2. **Implementar Fase 2** (API EC Controller com RPC)
3. **Implementar Fase 3** (Interface do Motor de Decisão)
4. **Testar integração completa**
5. **Implementar Fase 4** (Motor no ESP32)
6. **Otimizar Fase 5** (Atualização)

---

## ✅ **RESUMO EXECUTIVO**

- **Relays Slave ESP-NOW:** Adicionar mais informações visuais e de status
- **API EC Controller:** Migrar para RPC (mais performático e consistente)
- **Motor de Decisão:** Cada regra pode ativar MÚLTIPLOS relays slave (NÃO master)
- **Atualização:** Unificar métodos, tempos adaptativos, futuramente WebSocket
- **Tempos Atuais:** 2s (após comando), 3s (ACKs), 5s (estados), 30s (completo)


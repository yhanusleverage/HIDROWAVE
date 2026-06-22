# ✅ VALIDAÇÃO: DECISION_RULES SCHEMA E IMPLEMENTAÇÃO

## 📋 **ANÁLISE DO SCHEMA FORNECIDO**

### **1. Tabela `decision_rules` (Schema Atual)**

```sql
CREATE TABLE public.decision_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL CHECK (length(rule_id) >= 3),
  rule_name text NOT NULL,
  rule_description text,
  rule_json jsonb NOT NULL,  -- ✅ JSONB permite arrays e estruturas complexas
  enabled boolean DEFAULT true,
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text DEFAULT 'system'::text,
  CONSTRAINT decision_rules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_decision_rules_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
);
```

**✅ Status:** Schema está correto e compatível!

---

## 🔍 **VERIFICAÇÃO: ARRAYS DE RELÉS**

### **Atual (rule_json):**
```json
{
  "actions": [
    {
      "relay_id": 0,
      "relay_name": "Aquecedor",
      "duration": 300
    }
  ]
}
```

### **Necessário (Arrays de Relés):**
```json
{
  "actions": [
    {
      "relay_ids": [0, 1, 2],  // ✅ Array de relés
      "relay_names": ["Aquecedor", "pH+", "Grow"],
      "duration": 300
    }
  ]
}
```

**✅ Suportado:** `rule_json` é JSONB, pode armazenar arrays!

---

## 🌍 **VERIFICAÇÃO: CICLOS CIRCADIANOS (24h = 86400000ms)**

### **Necessário:**
- Switch circadiano: 18h ligado (64800000ms) + 6h desligado (21600000ms) = 24h (86400000ms)
- Limite de 1 dia (86400000ms)

### **Estrutura Proposta:**
```json
{
  "conditions": [...],
  "actions": [...],
  "circadian_cycle": {
    "enabled": true,
    "on_duration_ms": 64800000,  // 18 horas ligado
    "off_duration_ms": 21600000,  // 6 horas desligado
    "total_cycle_ms": 86400000,   // 24 horas total
    "start_time": "00:00:00",     // Hora de início (opcional)
    "timezone": "America/Sao_Paulo"
  }
}
```

**✅ Suportado:** `rule_json` JSONB pode armazenar isso!

---

## 📊 **COMPARAÇÃO: SCHEMA ATUAL vs NECESSÁRIO**

| Recurso | Schema Atual | Necessário | Status |
|---------|--------------|------------|--------|
| **Arrays de relés** | ✅ JSONB suporta | ✅ Necessário | ✅ **OK** |
| **Ciclos circadianos** | ✅ JSONB suporta | ✅ Necessário | ✅ **OK** |
| **Timers (24h max)** | ✅ JSONB suporta | ✅ Necessário | ✅ **OK** |
| **Múltiplas ações** | ✅ JSONB suporta | ✅ Necessário | ✅ **OK** |

**✅ Conclusão:** Schema atual **SUPORTA TUDO** via `rule_json` JSONB!

---

## 🔧 **MELHORIAS RECOMENDADAS**

### **1. Adicionar Validação JSON (Opcional)**

```sql
-- Função de validação (opcional)
CREATE OR REPLACE FUNCTION validate_decision_rule_json(rule_json jsonb)
RETURNS boolean AS $$
BEGIN
  -- Validar estrutura básica
  IF NOT (rule_json ? 'conditions' AND rule_json ? 'actions') THEN
    RETURN false;
  END IF;
  
  -- Validar ciclo circadiano se presente
  IF rule_json ? 'circadian_cycle' THEN
    DECLARE
      cycle jsonb := rule_json->'circadian_cycle';
      on_duration bigint := (cycle->>'on_duration_ms')::bigint;
      off_duration bigint := (cycle->>'off_duration_ms')::bigint;
      total bigint := (cycle->>'total_cycle_ms')::bigint;
    BEGIN
      -- Validar que total = 24h (86400000ms)
      IF total != 86400000 THEN
        RETURN false;
      END IF;
      
      -- Validar que on + off = total
      IF (on_duration + off_duration) != total THEN
        RETURN false;
      END IF;
    END;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Adicionar constraint (opcional)
ALTER TABLE public.decision_rules
  ADD CONSTRAINT check_rule_json_valid
  CHECK (validate_decision_rule_json(rule_json));
```

**⚠️ Nota:** Validação opcional, pode ser feita no frontend/ESP32 também.

---

## 📝 **ESTRUTURA COMPLETA rule_json RECOMENDADA**

```json
{
  "conditions": [
    {
      "sensor": "temperature",
      "operator": ">",
      "value": 25.0,
      "logic": "AND"
    }
  ],
  "actions": [
    {
      "relay_ids": [0, 1],  // ✅ Array de relés
      "relay_names": ["Aquecedor", "pH+"],
      "duration": 300,
      "target_device_id": "ESP-NOW-SLAVE",
      "slave_mac_address": "14:33:5C:38:BF:60"
    }
  ],
  "circadian_cycle": {  // ✅ NOVO: Ciclo circadiano
    "enabled": true,
    "on_duration_ms": 64800000,   // 18 horas ligado
    "off_duration_ms": 21600000,  // 6 horas desligado
    "total_cycle_ms": 86400000,    // 24 horas total
    "start_time": "00:00:00",      // Hora de início (opcional)
    "timezone": "America/Sao_Paulo"
  },
  "delay_before_execution": 0,
  "interval_between_executions": 5,
  "priority": 50
}
```

---

## ✅ **VALIDAÇÃO DA IMPLEMENTAÇÃO PASSO 1**

### **1. Frontend (CreateRuleModal.tsx)** ✅
- ✅ pH e EC removidos
- ✅ Sensores: TDS, Temperature, Humidity, Water Level
- ✅ Valor padrão: Temperature > 25.0

### **2. Schema SQL** ✅
- ✅ Tabela `decision_rules` criada
- ✅ RPC `get_active_decision_rules()` criado
- ✅ Índices criados

### **3. Interface TypeScript** ⚠️ **PRECISA ATUALIZAR**

**Atual:**
```typescript
actions: Array<{
  relay_id: number;  // ❌ Só um relé
  relay_name: string;
  duration: number;
}>;
```

**Recomendado:**
```typescript
actions: Array<{
  relay_ids: number[];  // ✅ Array de relés
  relay_names: string[];
  duration: number;
  target_device_id?: string;
  slave_mac_address?: string;
}>;
circadian_cycle?: {  // ✅ NOVO
  enabled: boolean;
  on_duration_ms: number;
  off_duration_ms: number;
  total_cycle_ms: number;  // Deve ser 86400000 (24h)
  start_time?: string;
  timezone?: string;
};
```

---

## 🎯 **RECOMENDAÇÕES FINAIS**

### **1. Schema SQL** ✅
- ✅ **NÃO PRECISA MUDAR** - `rule_json` JSONB suporta tudo!

### **2. Interface TypeScript** ⚠️
- ⚠️ **ATUALIZAR** `DecisionRule` interface para suportar:
  - Arrays de relés (`relay_ids[]`)
  - Ciclo circadiano (`circadian_cycle`)

### **3. Frontend (CreateRuleModal)** ⚠️
- ⚠️ **ADICIONAR** UI para:
  - Selecionar múltiplos relés
  - Configurar ciclo circadiano (18h on / 6h off)

### **4. ESP32** ⚠️
- ⚠️ **IMPLEMENTAR** lógica para:
  - Processar arrays de relés
  - Processar ciclo circadiano (timers de 24h)

---

## ✅ **RESUMO**

| Item | Status | Observação |
|------|--------|------------|
| **Schema SQL** | ✅ **OK** | `rule_json` JSONB suporta arrays e ciclos |
| **Arrays de relés** | ✅ **SUPORTADO** | Via JSONB |
| **Ciclos circadianos** | ✅ **SUPORTADO** | Via JSONB |
| **Interface TypeScript** | ⚠️ **ATUALIZAR** | Adicionar `relay_ids[]` e `circadian_cycle` |
| **Frontend UI** | ⚠️ **ADICIONAR** | UI para múltiplos relés e ciclo circadiano |
| **ESP32** | ⚠️ **IMPLEMENTAR** | Lógica para processar arrays e ciclos |

**✅ Schema está PRONTO! Só precisa atualizar interfaces e implementação!**





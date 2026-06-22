# 🔍 COMO O ESP32 BUSCA COMANDOS E REGRAS

## 📋 **RESUMO RÁPIDO**

**Comandos Slave:** ✅ Busca via RPC `get_and_lock_slave_commands()`

**Decision Engine:** ⚠️ **NÃO busca ainda** (só tem TODO)

---

## 🎯 **COMO FUNCIONA A BUSCA DE COMANDOS**

### **1. Comandos Slave (Manual) - ✅ FUNCIONANDO**

```
ESP32 (a cada 10 segundos):
  ↓
Chama: checkForSlaveCommands()
  ↓
Faz POST para RPC:
  POST /rest/v1/rpc/get_and_lock_slave_commands
  {
    "p_master_device_id": "ESP32_HIDRO_F44738",
    "p_limit": 5,
    "p_timeout_seconds": 30
  }
  ↓
RPC retorna array de comandos:
  [
    {
      "id": 123,
      "relay_numbers": [0],
      "actions": ["on"],
      "command_type": "manual",
      "triggered_by": "manual"
    }
  ]
  ↓
ESP32 processa comandos
```

**Método:** RPC (função SQL no Supabase)

---

### **2. Decision Engine (Regras) - ⚠️ NÃO IMPLEMENTADO**

```
ESP32 (a cada 30 segundos):
  ↓
Chama: checkSupabaseRules()
  ↓
⚠️ ATUAL: Só imprime log "Verificando regras..."
  ↓
❌ NÃO busca regras do Supabase
❌ NÃO avalia condições
❌ NÃO cria comandos
```

**Método:** ⚠️ **FALTA IMPLEMENTAR**

---

## 🔄 **DIFERENÇAS NA BUSCA**

| Aspecto | **Comandos Slave** | **Decision Engine** |
|---------|-------------------|---------------------|
| **Função** | `checkForSlaveCommands()` | `checkSupabaseRules()` |
| **RPC** | `get_and_lock_slave_commands()` ✅ | `get_active_decision_rules()` ⚠️ **FALTA** |
| **Tabela** | `relay_commands_slave` | `decision_rules` |
| **Filtro** | `status='pending'` | `enabled=true` |
| **Retorna** | Array de comandos | Array de regras |
| **Frequência** | A cada 10s | A cada 30s (quando implementar) |
| **Status** | ✅ **FUNCIONANDO** | ⚠️ **NÃO IMPLEMENTADO** |

---

## 📊 **COMO DEVERIA FUNCIONAR (FUTURO)**

### **Decision Engine - Busca de Regras**

```
ESP32 (a cada 30 segundos):
  ↓
Chama: checkSupabaseRules()
  ↓
Faz POST para RPC:
  POST /rest/v1/rpc/get_active_decision_rules
  {
    "p_device_id": "ESP32_HIDRO_F44738",
    "p_limit": 10
  }
  ↓
RPC retorna array de regras:
  [
    {
      "id": "uuid",
      "rule_id": "RULE_001",
      "rule_name": "Ajustar pH",
      "rule_json": {
        "conditions": {...},
        "actions": [...]
      },
      "enabled": true,
      "priority": 50
    }
  ]
  ↓
ESP32 avalia condições
  ↓
Se condição = verdadeira:
  → ESP32 cria comando em relay_commands_slave
  ↓
Comando segue fluxo normal (RPC → ESP-NOW)
```

**Método:** RPC (igual aos comandos, mas busca regras)

---

## ✅ **RESPOSTA DIRETA**

### **Pergunta: O ESP32 busca da mesma forma?**

**Resposta:** 
- ✅ **Comandos Slave:** Sim, usa RPC `get_and_lock_slave_commands()`
- ⚠️ **Decision Engine:** Não implementado ainda (só tem TODO)

### **Pergunta: Como funciona a busca?**

**Resposta:**
1. ESP32 faz POST para RPC (função SQL no Supabase)
2. RPC busca na tabela (filtra por status/enabled)
3. RPC retorna array JSON
4. ESP32 parseia e processa

### **Pergunta: O ESP vai de forma diferente em cada busca?**

**Resposta:**
- ✅ **Mesma forma:** Ambos usam RPC (quando implementar)
- ⚠️ **Diferença:** Tabela diferente e filtro diferente
  - Comandos: `relay_commands_slave` + `status='pending'`
  - Regras: `decision_rules` + `enabled=true`

---

## 🎯 **RESUMO FINAL**

| | **Comandos Slave** | **Decision Engine** |
|---|---|---|
| **Busca?** | ✅ SIM (RPC) | ⚠️ NÃO (só TODO) |
| **Método** | RPC `get_and_lock_slave_commands()` | RPC `get_active_decision_rules()` (futuro) |
| **Tabela** | `relay_commands_slave` | `decision_rules` |
| **Filtro** | `status='pending'` | `enabled=true` |
| **Retorna** | Comandos prontos | Regras para avaliar |

**Conclusão:** Quando implementar, será **MESMA FORMA** (RPC), mas em **TABELAS DIFERENTES**! 🎯





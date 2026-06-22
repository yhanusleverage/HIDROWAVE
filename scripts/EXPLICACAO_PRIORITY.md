# 🎯 EXPLICAÇÃO: Priority em Relay Commands

## ✅ **RESPOSTAS DIRETAS:**

### **1. O ID retornado pelo Supabase é usado para deletar?**
**SIM!** O mesmo ID retornado quando cria o comando é usado para:
- ✅ Deletar após processar (ESP32)
- ✅ Atualizar status (sent → completed → deleted)

```typescript
// Frontend cria comando
const command = await createRelayCommand({...});
// command.id = 123 (retornado pelo Supabase)

// ESP32 processa e deleta
DELETE FROM relay_commands WHERE id = 123;
```

---

### **2. Priority deve ser deixada para o usuário criar?**
**SIM e NÃO!** 

**✅ SIM:** Usuário pode definir `priority` ao criar comando manual
**✅ NÃO:** Se não definir, sistema usa **defaults inteligentes**

---

### **3. Priority só existe na dimensão das rules?**
**NÃO!** Priority faz sentido para **TODOS os tipos:**

| Tipo | Priority Default | Quando Usar |
|------|-----------------|-------------|
| **manual** | 10 | Comando manual do usuário (baixa prioridade) |
| **rule** | 50 (ou da regra) | Comando de automação (média prioridade) |
| **peristaltic** | 80 | Dosagem de nutrientes (alta prioridade) |

**Mas o usuário pode sobrescrever:**
- `command_type: 'manual', priority: 95` → Emergência manual (alta prioridade)
- `command_type: 'rule', priority: 90` → Regra crítica
- `command_type: 'peristaltic', priority: 60` → Dosagem normal

---

## 🔧 **COMO FUNCIONA:**

### **1. Comando Manual (usuário define):**
```typescript
// Usuário pode definir priority
POST /api/esp-now/command
{
  command_type: 'manual',
  priority: 95, // ✅ Usuário define
  ...
}

// Se não definir, usa default: 10
POST /api/esp-now/command
{
  command_type: 'manual',
  // priority não definida → usa default: 10
  ...
}
```

### **2. Comando de Rule (busca da regra):**
```typescript
// Se rule_id fornecido, busca priority da regra
POST /api/esp-now/command
{
  command_type: 'rule',
  rule_id: 'RULE_123',
  // ✅ Sistema busca priority da regra em decision_rules
  // Se regra tem priority: 90 → usa 90
  // Se regra não tem → usa default: 50
  ...
}
```

### **3. Comando Peristaltic (default alto):**
```typescript
// Dosagem sempre tem priority alta (default: 80)
POST /api/esp-now/command
{
  command_type: 'peristaltic',
  // priority não definida → usa default: 80
  ...
}
```

---

## 📊 **ORDEM DE PRIORIZAÇÃO:**

```sql
ORDER BY 
  -- 1. command_type (categoria)
  CASE command_type
    WHEN 'peristaltic' THEN 1
    WHEN 'rule' THEN 2
    WHEN 'manual' THEN 3
  END,
  -- 2. priority (numérico, maior = mais importante)
  priority DESC,
  -- 3. created_at (mais antigo primeiro)
  created_at ASC
```

**Resultado:**
1. `peristaltic` priority 95 → Mais importante
2. `peristaltic` priority 80 (default)
3. `rule` priority 90 (da regra)
4. `rule` priority 50 (default)
5. `manual` priority 95 (emergência)
6. `manual` priority 10 (default)

---

## ✅ **IMPLEMENTAÇÃO ATUAL:**

### **Frontend pode enviar:**
```typescript
{
  command_type: 'manual',
  priority: 95, // ✅ Opcional: usuário define
  ...
}
```

### **Sistema define defaults:**
- `manual` → 10 (se não fornecido)
- `rule` → 50 ou da regra (se rule_id fornecido)
- `peristaltic` → 80 (se não fornecido)

### **ESP32 deleta usando ID:**
```cpp
// Após processar comando
DELETE FROM relay_commands WHERE id = commandId;
```

---

## 🎯 **CONCLUSÃO:**

- ✅ **ID é usado para deletar** (mesmo ID retornado)
- ✅ **Priority é opcional** (usuário pode definir)
- ✅ **Defaults inteligentes** (baseados em command_type)
- ✅ **Rules herdam priority** (da tabela decision_rules)
- ✅ **Priority faz sentido para TODOS os tipos**



# 🎯 RESUMO: PRIORIZAÇÃO DE COMANDOS

## 📊 ORDEM DE PRIORIZAÇÃO (3 NÍVEIS)

```
1. command_type (categoria)
   └── peristaltic (1) > rule (2) > manual (3)

2. priority (numérico 0-100)
   └── Maior valor = maior prioridade
   └── Default: peristaltic=80, rule=50, manual=10

3. created_at (temporal)
   └── Mais antigo primeiro (dentro da mesma prioridade)
```

---

## 🔄 FLUXO POR CAMADA

### **1. FRONTEND** → Define Priority
```
POST /api/esp-now/command
{
  command_type: 'manual',
  priority: 10  ← Default se não enviar
}
```

### **2. SUPABASE** → Armazena e Ordena
```sql
-- Função get_pending_commands() ordena:
ORDER BY 
  command_type (peristaltic > rule > manual),
  priority DESC,
  created_at ASC
```

### **3. ESP32** → Busca e Processa
```
Query: ?order=priority.desc,created_at.asc
Parse: commands[i].priority = cmd["priority"] | 50
Log:  📊 Comando #136: type=manual, priority=10
```

---

## ✅ IMPLEMENTAÇÃO ATUAL

| Camada | Status | Detalhes |
|--------|--------|----------|
| **Frontend** | ✅ **OK** | Define priority com defaults inteligentes |
| **Supabase** | ✅ **OK** | Função SQL ordena corretamente |
| **ESP32** | ⚠️ **PARCIAL** | Ordena por priority, mas não por command_type |

---

## 📝 EXEMPLO PRÁTICO

**Comandos no Supabase:**
```
ID | type        | priority | created_at
---|-------------|----------|------------
1  | manual      | 10       | 10:00:00
2  | peristaltic | 80       | 10:01:00
3  | rule        | 50       | 10:02:00
4  | manual      | 95       | 10:03:00  ← Emergência
5  | peristaltic | 90       | 10:04:00
```

**Ordem de processamento (IDEAL):**
1. ID 5 - `peristaltic` priority 90
2. ID 2 - `peristaltic` priority 80
3. ID 4 - `manual` priority 95 (emergência)
4. ID 3 - `rule` priority 50
5. ID 1 - `manual` priority 10

**Ordem atual (ESP32):**
- Ordena apenas por `priority.desc`
- Não diferencia `command_type`
- Resultado: ID 4, ID 5, ID 2, ID 3, ID 1

---

## 🔧 MELHORIAS NECESSÁRIAS

### Opção 1: ESP32 usar função SQL (RECOMENDADO)
```cpp
// Usar RPC call
String endpoint = "rpc/get_pending_commands";
String payload = "{\"p_device_id\":\"" + getDeviceID() + "\",\"p_limit\":5}";
```

### Opção 2: Ordenar no código após receber
```cpp
// Ordenar array de comandos por:
// 1. command_type (peristaltic > rule > manual)
// 2. priority DESC
// 3. created_at ASC
```

---

## 📊 LOGS DE DEBUG

**Frontend:**
```
📊 Priority default para manual: 10
📤 Criando comando: { command_type: "manual", priority: 10, ... }
```

**ESP32:**
```
📥 Recebidos 3 comandos de relé pendentes
📊 Ordem de processamento (priorizada):
   1. ID=136 | type=manual | priority=10 | relay=4 | action=off
   2. ID=135 | type=peristaltic | priority=80 | relay=1 | action=on
   3. ID=134 | type=rule | priority=50 | relay=2 | action=on
```

---

## ✅ CONCLUSÃO

A priorização está **parcialmente implementada**:
- ✅ Frontend define priority corretamente
- ✅ Supabase ordena corretamente (função SQL)
- ⚠️ ESP32 ordena por priority, mas não por command_type
- ✅ Logs de debug adicionados para rastreamento

**Próximo passo:** Implementar ordenação completa no ESP32 (usar função SQL ou ordenar no código).





# 🔄 EXPLICAÇÃO: Atomic Swap via REST API

## 🎯 SUA DÚVIDA

> **"O ESP32 faz uma request no Supabase via REST API. Ele consegue trigger um atomic swap? É isso enquanto ele processa na boa o comando, certo?"**

**Resposta:** ✅ **SIM!** Mas vamos entender **COMO** funciona.

---

## 🔍 COMO FUNCIONA

### **1. ESP32 faz Requisição REST (HTTP GET)**

```cpp
// SupabaseClient.cpp
String endpoint = "rpc/get_and_lock_master_commands"
  + "?p_device_id=ESP32_HIDRO_F44738"
  + "&p_limit=1"
  + "&p_timeout_seconds=30";

// ✅ Requisição HTTP GET
http.GET();
```

**O que acontece:**
- ESP32 envia: `GET https://supabase.co/rest/v1/rpc/get_and_lock_master_commands?p_device_id=...&p_limit=1`
- Supabase recebe a requisição HTTP
- Supabase chama a função SQL `get_and_lock_master_commands()`

---

### **2. Função SQL Executa no Servidor (ATÔMICA)**

```sql
CREATE OR REPLACE FUNCTION get_and_lock_master_commands(...)
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. Buscar IDs de comandos pendentes
  SELECT ARRAY_AGG(rc.id ...) INTO v_command_ids
  FROM relay_commands_master
  WHERE status = 'pending' ...
  LIMIT 1;
  
  -- 2. ✅ UPDATE ATÔMICO (acontece no servidor PostgreSQL)
  UPDATE relay_commands_master
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';  -- ✅ Double-check atômico
  
  -- 3. Retornar comandos marcados
  RETURN QUERY SELECT ... WHERE status = 'processing';
END;
$$;
```

**O que acontece:**
- ✅ Tudo acontece **dentro de uma transação** no PostgreSQL
- ✅ O `UPDATE` é **atômico** (ou atualiza tudo ou não atualiza nada)
- ✅ O `WHERE status = 'pending'` garante que só atualiza se ainda está pending
- ✅ Se dois ESP32s chamarem ao mesmo tempo, apenas **um** consegue marcar como "processing"

---

### **3. Supabase Retorna JSON para ESP32**

```json
[
  {
    "id": 142,
    "relay_numbers": [0],
    "actions": ["on"],
    "command_type": "manual",
    "priority": 50
  }
]
```

**O que acontece:**
- Supabase retorna apenas comandos que foram **marcados com sucesso** como "processing"
- Se nenhum comando foi marcado (já estava "processing"), retorna array vazio `[]`

---

## 🔒 POR QUE É ATÔMICO?

### **Atomicidade no PostgreSQL:**

1. **Transação Implícita:**
   - A função SQL executa dentro de uma transação
   - Se algo falhar, tudo é revertido (ROLLBACK)

2. **UPDATE com WHERE:**
   ```sql
   UPDATE relay_commands_master
   SET status = 'processing'
   WHERE id = ANY(v_command_ids)
     AND status = 'pending';  -- ✅ Condição atômica
   ```
   - Só atualiza se `status = 'pending'`
   - Se outro processo já marcou como "processing", o UPDATE não afeta nada (0 linhas atualizadas)

3. **Lock de Linha:**
   - PostgreSQL usa **row-level locking**
   - Quando um UPDATE acontece, a linha fica "locked"
   - Outro UPDATE na mesma linha espera ou falha

---

## 📊 CENÁRIO: Dois ESP32s Chamam ao Mesmo Tempo

### **Timeline:**

```
T=0ms:  ESP32-A chama get_and_lock_master_commands()
T=1ms:  ESP32-B chama get_and_lock_master_commands() (quase simultâneo)

T=2ms:  Supabase executa função para ESP32-A:
        - Busca comando ID=142 (status='pending')
        - UPDATE: status='processing' ✅ SUCESSO (1 linha atualizada)
        - Retorna comando ID=142

T=3ms:  Supabase executa função para ESP32-B:
        - Busca comando ID=142 (status='pending') ← Ainda vê como pending
        - UPDATE: status='processing' ❌ FALHA (0 linhas atualizadas)
              Porque ESP32-A já marcou como 'processing'
        - Retorna array vazio [] (nenhum comando)
```

**Resultado:**
- ✅ ESP32-A recebe o comando e processa
- ✅ ESP32-B não recebe nada (comando já está "processing")
- ✅ **Sem duplicação!**

---

## 🔄 FLUXO COMPLETO (PASSO A PASSO)

```
┌─────────────────┐
│   ESP32         │
│                 │
│ 1. HTTP GET     │
│    /rpc/        │
│    get_and_     │
│    lock_...     │
└────────┬────────┘
         │
         │ HTTPS Request
         ▼
┌─────────────────┐
│   SUPABASE       │
│   (Servidor)     │
│                 │
│ 2. Recebe GET    │
│ 3. Chama função │
│    SQL          │
└────────┬────────┘
         │
         │ Executa SQL
         ▼
┌─────────────────┐
│   POSTGRESQL    │
│   (Banco)       │
│                 │
│ 4. BEGIN        │
│    (transação)  │
│                 │
│ 5. SELECT       │
│    (busca IDs)  │
│                 │
│ 6. UPDATE       │
│    (marca como  │
│     processing) │
│    ✅ ATÔMICO   │
│                 │
│ 7. SELECT       │
│    (retorna)    │
│                 │
│ 8. COMMIT       │
│    (confirma)   │
└────────┬────────┘
         │
         │ JSON Response
         ▼
┌─────────────────┐
│   ESP32         │
│                 │
│ 9. Recebe JSON  │
│    [comando]    │
│                 │
│ 10. Processa    │
│     comando     │
│                 │
│ 11. PATCH       │
│     status=     │
│     "sent"      │
│                 │
│ 12. Executa     │
│     hardware    │
│                 │
│ 13. PATCH       │
│     status=     │
│     "completed" │
└─────────────────┘
```

---

## ✅ POR QUE FUNCIONA?

### **1. Atomicidade no Banco de Dados:**

- O `UPDATE` acontece **no servidor PostgreSQL**, não no ESP32
- PostgreSQL garante atomicidade (ACID)
- Mesmo que dois ESP32s chamem ao mesmo tempo, apenas um consegue atualizar

### **2. Double-Check no WHERE:**

```sql
WHERE id = ANY(v_command_ids)
  AND status = 'pending'  -- ✅ Verifica novamente antes de atualizar
```

- Mesmo que o SELECT tenha encontrado como "pending"
- O UPDATE verifica novamente antes de atualizar
- Se já está "processing", o UPDATE não afeta nada

### **3. Transação Implícita:**

- Toda função SQL executa em uma transação
- Se algo falhar, tudo é revertido
- Garante consistência

---

## 🎯 RESPOSTA DIRETA À SUA PERGUNTA

> **"O ESP32 faz uma request no Supabase via REST API. Ele consegue trigger um atomic swap?"**

**✅ SIM!** Mas não é o ESP32 que faz o "atomic swap". É assim:

1. **ESP32:** Faz HTTP GET para função RPC
2. **Supabase:** Recebe a requisição e chama a função SQL
3. **PostgreSQL:** Executa o UPDATE **ATÔMICAMENTE** no servidor
4. **Resultado:** Comando marcado como "processing" de forma atômica

> **"É isso enquanto ele processa na boa o comando, certo?"**

**✅ SIM!** O fluxo é:

```
1. ESP32 chama função → Comando marcado como "processing" (atômico)
2. ESP32 recebe comando → Processa tranquilamente
3. ESP32 marca como "sent" → Quando envia para hardware
4. ESP32 executa → Hardware executa
5. ESP32 marca como "completed" → Quando termina
```

**Durante todo esse tempo:**
- Comando está como "processing" no Supabase
- Nenhum outro ESP32 pode pegá-lo
- Se ESP32 morrer, comando fica "processing" (timeout de 30s resolve)

---

## 🔒 GARANTIAS

1. **✅ Atomicidade:** UPDATE é atômico no PostgreSQL
2. **✅ Isolamento:** Transações isoladas (um não vê mudanças do outro até COMMIT)
3. **✅ Consistência:** Double-check no WHERE garante estado correto
4. **✅ Durabilidade:** COMMIT garante que mudança é permanente

---

## 💡 RESUMO VISUAL

```
ESP32 → HTTP GET → Supabase → Função SQL → PostgreSQL
                                    │
                                    │ UPDATE ATÔMICO
                                    │ (status='processing')
                                    ▼
                              Comando "locked"
                                    │
                                    │ Retorna JSON
                                    ▼
                              ESP32 recebe comando
                                    │
                                    │ Processa (tranquilo)
                                    │ Ninguém mais pode pegar
                                    ▼
                              Marca como "completed"
```

**A mágica acontece no servidor PostgreSQL, não no ESP32!** 🎩✨





# 🔍 ONDE O RPC ENTRA E COMO VERIFICAR ESTADOS

## 📋 **RESUMO RÁPIDO**

**RPC = Função SQL no Supabase** que o ESP32 chama via POST

**POST = Método HTTP** que permite executar RPC e receber dados

---

## 🎯 **ONDE O RPC ENTRA?**

### **Fluxo Completo:**

```
1. ESP32 (código C++):
   checkForSlaveCommands()
   ↓
2. ESP32 faz POST HTTP:
   POST /rest/v1/rpc/get_and_lock_slave_commands
   {
     "p_master_device_id": "ESP32_HIDRO_F44738",
     "p_limit": 5
   }
   ↓
3. Supabase recebe POST:
   "Alguém quer executar a função RPC get_and_lock_slave_commands"
   ↓
4. Supabase executa função SQL (RPC):
   CREATE FUNCTION get_and_lock_slave_commands(...)
   BEGIN
     SELECT * FROM relay_commands_slave
     WHERE status = 'pending'
     UPDATE status = 'processing'
     RETURN comandos
   END
   ↓
5. Supabase retorna resultado:
   [
     {"id": 123, "relay_number": 0, "action": "on"}
   ]
   ↓
6. ESP32 recebe resposta:
   "Ah! Tenho comandos para processar!"
```

**RPC entra no passo 4:** É a função SQL que busca e atualiza os comandos!

---

## 🔍 **O QUE É RPC?**

### **RPC = Remote Procedure Call (Chamada de Procedimento Remoto)**

**É uma função SQL no Supabase que:**
- ✅ Busca dados (SELECT)
- ✅ Atualiza dados (UPDATE)
- ✅ Retorna resultado (RETURN)

**Exemplo de RPC no Supabase:**

```sql
CREATE FUNCTION get_and_lock_slave_commands(
  p_master_device_id TEXT,
  p_limit INTEGER
)
RETURNS TABLE (
  id INTEGER,
  relay_numbers INTEGER[],
  actions TEXT[],
  ...
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Buscar comandos pendentes
  SELECT * FROM relay_commands_slave
  WHERE master_device_id = p_master_device_id
    AND status = 'pending'
  LIMIT p_limit;
  
  -- 2. Atualizar status para 'processing' (LOCK)
  UPDATE relay_commands_slave
  SET status = 'processing'
  WHERE id IN (comandos_encontrados);
  
  -- 3. Retornar comandos
  RETURN QUERY SELECT ...;
END;
$$;
```

**RPC = Função SQL que faz tudo de uma vez (atômico)**

---

## 📡 **COMO O ESP32 CHAMA O RPC?**

### **Código no ESP32:**

```cpp
// ESP32 faz POST para RPC
String endpoint = "rpc/get_and_lock_slave_commands";

DynamicJsonDocument payloadDoc(256);
payloadDoc["p_master_device_id"] = "ESP32_HIDRO_F44738";
payloadDoc["p_limit"] = 5;

String payload;
serializeJson(payloadDoc, payload);

// POST para Supabase
httpClient->POST(payload);
```

**POST = Método HTTP que executa a função RPC**

---

## ✅ **SIM! POST PERMITE VERIFICAR ESTADOS**

### **Como funciona:**

```
ESP32 → POST /rpc/get_and_lock_slave_commands
      → Supabase executa função SQL
      → Função SQL busca estados na tabela
      → Supabase retorna estados para ESP32
      → ESP32 recebe e processa
```

**POST não é só "enviar", também pode "receber"!**

---

## 🔄 **DIFERENÇA: GET vs POST vs RPC**

### **1. GET (Read-only):**
```
GET /rest/v1/relay_commands_slave?status=eq.pending
→ Retorna dados (só leitura)
→ Não pode fazer UPDATE
```

### **2. POST (Create/Execute):**
```
POST /rest/v1/relay_commands_slave
→ Cria novo registro
→ OU executa RPC (função SQL)
```

### **3. RPC (Função SQL):**
```
POST /rest/v1/rpc/get_and_lock_slave_commands
→ Executa função SQL no Supabase
→ Pode fazer SELECT + UPDATE + RETURN
→ Tudo de uma vez (atômico)
```

---

## 📊 **EXEMPLO PRÁTICO: VERIFICAR ESTADOS**

### **Cenário: ESP32 quer verificar se há comandos pendentes**

**Opção 1: GET (não funciona bem)**
```
GET /rest/v1/relay_commands_slave?status=eq.pending
→ Retorna comandos
→ Mas não pode marcar como 'processing'
→ Outro ESP32 pode pegar o mesmo comando
❌ Problema: Race condition
```

**Opção 2: RPC (funciona perfeitamente)**
```
POST /rest/v1/rpc/get_and_lock_slave_commands
{
  "p_master_device_id": "ESP32_HIDRO_F44738"
}
→ Busca comandos
→ Marca como 'processing' (LOCK)
→ Retorna comandos
✅ Funciona: Atômico, sem race condition
```

---

## 🎯 **RESPOSTA DIRETA**

### **Pergunta 1: Onde o RPC entra?**

**Resposta:**
- RPC é a **função SQL no Supabase**
- ESP32 chama RPC via **POST HTTP**
- RPC faz: **SELECT + UPDATE + RETURN** (tudo de uma vez)
- RPC entra no **passo 4** do fluxo (execução no Supabase)

### **Pergunta 2: No método POST o ESP consegue verificar estados?**

**Resposta:**
- ✅ **SIM!** POST pode executar RPC
- ✅ RPC pode **buscar estados** (SELECT)
- ✅ RPC pode **retornar estados** para ESP32
- ✅ ESP32 **recebe estados** na resposta do POST

**POST não é só "enviar", também pode "receber" dados!**

---

## 📊 **FLUXO COMPLETO COM RPC**

```
ESP32:
  "Quero verificar se há comandos"
  ↓
POST /rpc/get_and_lock_slave_commands
{
  "p_master_device_id": "ESP32_HIDRO_F44738"
}
  ↓
Supabase:
  "Vou executar função SQL get_and_lock_slave_commands"
  ↓
Função SQL (RPC):
  1. SELECT * FROM relay_commands_slave WHERE status='pending'
  2. UPDATE relay_commands_slave SET status='processing'
  3. RETURN comandos
  ↓
Supabase retorna:
  [
    {"id": 123, "relay_number": 0, "action": "on"}
  ]
  ↓
ESP32 recebe:
  "Ah! Tenho 1 comando para processar!"
```

---

## ✅ **RESUMO FINAL**

1. **RPC = Função SQL no Supabase**
2. **ESP32 chama RPC via POST**
3. **RPC busca e atualiza estados**
4. **RPC retorna estados para ESP32**
5. **POST permite "verificar" e "receber" estados**

**RPC entra como a "função inteligente" que faz tudo de uma vez!** 🎯





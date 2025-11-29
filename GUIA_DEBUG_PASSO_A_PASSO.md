# 🚀 Guia de Debug Passo a Passo - Slaves Não Aparecem

## 📊 **SITUAÇÃO ATUAL:**

Console mostra:
- ✅ Master está acessível (`http://192.168.1.10/api/slaves`)
- ✅ API proxy funciona
- ❌ **Master retorna 0 slaves**

**Problema:** Master não tem slaves na lista confiável!

---

## 🎯 **TESTE 1: Endpoint do Master (MAIS IMPORTANTE)**

### **Abra no navegador:**
```
http://192.168.1.10/api/slaves
```

**O que você deve ver:**

✅ **SE FUNCIONAR:**
```json
{
  "slaves": [
    {
      "device_id": "ESP32_SLAVE_14_33_5C_38_BF_60",
      "device_name": "ESP-NOW-SLAVE",
      "mac_address": "14:33:5C:38:BF:60",
      "is_online": true,
      "num_relays": 8
    }
  ]
}
```

❌ **SE RETORNAR VAZIO (seu caso):**
```json
{
  "slaves": []
}
```

**👉 COMPARTILHE O RESULTADO!**

---

## 🎯 **TESTE 2: Serial do Master**

### **No Serial Monitor do ESP32 Master:**

Quando você acessar `http://192.168.1.10/api/slaves`, deve aparecer:

```
📡 [API] /api/slaves solicitado
📡 [API] Encontrados X slave(s)
```

**O que procurar:**

✅ **SE TEM SLAVES:**
```
📡 [API] Encontrados 1 slave(s)
   ✅ Slave: ESP-NOW-SLAVE | 8 relés | ONLINE
```

❌ **SE NÃO TEM SLAVES (seu caso):**
```
📡 [API] Encontrados 0 slave(s)
```

**👉 COMPARTILHE O QUE APARECE!**

---

## 🎯 **TESTE 3: Verificar se Slave foi Descoberto**

### **No Serial do Master, procurar por:**

```
🎉 SLAVE ADICIONADO À LISTA CONFIÁVEL!
📥 MAC: 14:33:5C:38:BF:60
📝 Nome: ESP-NOW-SLAVE
```

**Se NÃO aparecer:**
- ❌ Slave não foi descoberto
- ❌ Slave não está na lista confiável

**Se aparecer:**
- ✅ Slave foi descoberto
- ✅ Deve aparecer no `/api/slaves`

**👉 COMPARTILHE SE APARECE ESSA MENSAGEM!**

---

## 🎯 **TESTE 4: Serial do Slave**

### **No Serial Monitor do ESP32 Slave:**

**O que procurar:**

✅ **SE ESTÁ ENVIANDO BROADCAST:**
```
📢 Broadcast enviado: ESP-NOW-SLAVE
🔔 Aguardando resposta do Master...
```

✅ **SE FOI DESCOBERTO:**
```
✅ Handshake recebido do Master
✅ Conectado ao Master
```

❌ **SE NÃO ESTÁ ENVIANDO:**
```
(Nenhuma mensagem de broadcast)
```

**👉 COMPARTILHE O QUE APARECE NO SERIAL DO SLAVE!**

---

## 🎯 **TESTE 5: Verificar Supabase**

### **Query SQL no Supabase SQL Editor:**

```sql
-- 1. Verificar Master
SELECT device_id, device_name, user_email, ip_address, is_online
FROM device_status
WHERE device_id = 'ESP32_HIDRO_6447D0';
```

**Resultado esperado:**
```
device_id          | device_name      | user_email                              | ip_address   | is_online
-------------------|------------------|------------------------------------------|--------------|----------
ESP32_HIDRO_6447D0 | ESP32_HIDRO      | yago.lima@aluno.faculdadeimpacta.com.br | 192.168.1.10 | true
```

---

```sql
-- 2. Verificar Slaves (TODOS, sem filtro)
SELECT device_id, device_name, device_type, mac_address, user_email, is_online, last_seen
FROM device_status
WHERE device_type ILIKE '%slave%' 
   OR device_type ILIKE '%relaybox%'
   OR device_id LIKE 'ESP32_SLAVE_%'
   OR device_name ILIKE '%SLAVE%'
ORDER BY last_seen DESC;
```

**Resultado esperado:**
```
device_id                    | device_name    | device_type      | mac_address      | user_email                              | is_online | last_seen
-----------------------------|----------------|------------------|------------------|------------------------------------------|-----------|------------------
ESP32_SLAVE_14_33_5C_38_BF_60| ESP-NOW-SLAVE  | RelayCommandBox  | 14:33:5C:38:BF:60| yago.lima@aluno.faculdadeimpacta.com.br | true      | 2024-01-XX...
```

**Se retornar vazio:**
- ❌ Slave não está registrado no Supabase
- ❌ Precisa registrar manualmente

**👉 COMPARTILHE OS RESULTADOS DAS QUERIES!**

---

## 🔧 **SOLUÇÃO 1: Slave Não Foi Descoberto pelo Master**

### **Causa:**
- Slave não está enviando broadcast
- Master não está escutando broadcasts
- Estão em canais WiFi diferentes

### **Solução:**

1. **Verificar Serial do Slave:**
   - Deve mostrar: "📢 Broadcast enviado"
   - Se não aparecer, Slave não está inicializado

2. **Verificar Serial do Master:**
   - Deve mostrar: "📢 Broadcast recebido de: 14:33:5C:38:BF:60"
   - Se não aparecer, Master não está recebendo

3. **Verificar Canal WiFi:**
   - Ambos devem estar no mesmo canal
   - Verificar Serial de ambos

4. **Reiniciar Ambos:**
   - Reiniciar Slave primeiro
   - Depois reiniciar Master
   - Aguardar descoberta

---

## 🔧 **SOLUÇÃO 2: Slave Não Está Registrado no Supabase**

### **Causa:**
- Master não registrou automaticamente
- Slave não foi descoberto

### **Solução:**

**Registrar manualmente no Supabase:**

```sql
-- Substituir valores se necessário
INSERT INTO device_status (
    device_id,
    device_name,
    device_type,
    mac_address,
    user_email,
    is_online,
    last_seen
) VALUES (
    'ESP32_SLAVE_14_33_5C_38_BF_60',  -- ⚠️ Substituir MAC se necessário
    'ESP-NOW-SLAVE',
    'RelayCommandBox',
    '14:33:5C:38:BF:60',              -- ⚠️ Substituir MAC se necessário
    'yago.lima@aluno.faculdadeimpacta.com.br',  -- ⚠️ Mesmo email do Master!
    true,
    NOW()
)
ON CONFLICT (device_id) DO UPDATE SET
    user_email = EXCLUDED.user_email,
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen;
```

**Depois:**
- Atualizar página `/automacao`
- Clicar em "🔄 Tentar Novamente"

---

## 🔧 **SOLUÇÃO 3: Master Não Está Escutando Broadcasts**

### **Causa:**
- MasterSlaveManager não inicializado
- ESP-NOW não configurado

### **Solução:**

1. **Verificar Serial do Master:**
   - Procurar por: "✅ MasterSlaveManager inicializado"
   - Procurar por: "✅ ESP-NOW inicializado"

2. **Se não aparecer:**
   - Verificar código de inicialização
   - Reiniciar Master

---

## 📋 **CHECKLIST DE DEBUG:**

Execute estes testes e compartilhe os resultados:

- [ ] **Teste 1:** `http://192.168.1.10/api/slaves` → O que aparece?
- [ ] **Teste 2:** Serial do Master → Quantos slaves encontrados?
- [ ] **Teste 3:** Serial do Master → Aparece "SLAVE ADICIONADO"?
- [ ] **Teste 4:** Serial do Slave → Aparece "Broadcast enviado"?
- [ ] **Teste 5:** Supabase Query → Slaves existem?

---

## 💡 **PRÓXIMOS PASSOS:**

1. **Testar endpoint:** `http://192.168.1.10/api/slaves`
2. **Verificar Serial do Master:** Quantos slaves?
3. **Verificar Serial do Slave:** Está enviando broadcast?
4. **Verificar Supabase:** Slaves existem?
5. **Compartilhar resultados:** O que aparece em cada passo?

---

## 🚀 **VAMOS RESOLVER ISSO!**

Execute os testes acima e compartilhe os resultados. Com essas informações, vamos identificar exatamente onde está o problema! 💪

**Comece pelo Teste 1 (endpoint no navegador) - é o mais rápido!** 🎯


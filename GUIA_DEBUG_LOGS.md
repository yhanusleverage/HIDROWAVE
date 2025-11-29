# 🔍 GUIA DE DEBUG: Como Usar os Logs

## 📊 **LOGS IMPLEMENTADOS**

Agora você tem logs detalhados em **todos os pontos críticos** do fluxo de criação de comandos. Os logs funcionam tanto em **localhost** quanto em **Vercel (produção)**.

---

## 🏷️ **PREFIXOS DOS LOGS**

Cada log tem um prefixo para facilitar a filtragem:

- `🔍 [DEBUG-API-ESP-NOW]` - API route principal (`/api/esp-now/command`)
- `🔍 [DEBUG-CREATE-RELAY]` - Função `createRelayCommand()` (orquestradora)
- `🔍 [DEBUG-MASTER-DIRECT]` - Função `createMasterCommandDirect()` (comandos master)
- `🔍 [DEBUG-SLAVE-DIRECT]` - Função `createSlaveCommandDirect()` (comandos slave)

---

## 📋 **O QUE CADA LOG MOSTRA**

### **1. Logs da API Route (`/api/esp-now/command`)**

```
🔍 [DEBUG-API-ESP-NOW] Recebendo comando
   Ambiente: production | Vercel: SIM
   Master: ESP32_HIDRO_F44738 | Slave: 14:33:5C:38:BF:60 | Relay: 1 | Action: on
   Master MAC: FC:B4:67:F4:47:38 | User: maoirzezibho@gmail.com.br
```

**Mostra:**
- Ambiente (development/production)
- Se está rodando no Vercel
- Dados do comando recebido
- Tempo total de execução

---

### **2. Logs da Função Orquestradora (`createRelayCommand`)**

```
🔍 [DEBUG-CREATE-RELAY] Iniciando createRelayCommand
   Ambiente: SERVIDOR | production | Vercel: SIM
   Tipo: SLAVE
   Payload resumido: device_id=ESP32_HIDRO_F44738, relays=[1], actions=[on]
🚀 [DEBUG-CREATE-RELAY] Usando função DIRETA (servidor)
   ⏱️ [DEBUG-CREATE-RELAY] Função direta executada em: 45ms
✅ [DEBUG-CREATE-RELAY] Comando criado com sucesso!
   ID: 123 | Status: pending
   ⏱️ Tempo total: 50ms
```

**Mostra:**
- Se está rodando no **SERVIDOR** ou **CLIENTE**
- Qual método está usando (função direta vs fetch HTTP)
- Tempo de execução de cada etapa
- Resultado final

---

### **3. Logs das Funções Diretas (Master)**

```
🔍 [DEBUG-MASTER-DIRECT] Iniciando criação de comando Master
   Ambiente: production | Vercel: SIM
   Payload: {"master_device_id":"ESP32_HIDRO_F44738","relay_numbers":[0],"actions":["on"]...}
🔍 [DEBUG-MASTER-DIRECT] Verificando device_status para: ESP32_HIDRO_F44738
   ⏱️ [DEBUG-MASTER-DIRECT] Query device_status: 15ms
🔍 [DEBUG-MASTER-DIRECT] Inserindo comando no Supabase...
✅ [DEBUG-MASTER-DIRECT] Comando criado com sucesso!
   ID: 123 | Relays: 0 | Actions: on
   ⏱️ Tempos: Query=15ms | Insert=25ms | Total=40ms
```

**Mostra:**
- Tempo de cada query ao Supabase
- Tempo de inserção
- Tempo total
- Dados do comando criado

---

### **4. Logs das Funções Diretas (Slave)**

```
🔍 [DEBUG-SLAVE-DIRECT] Iniciando criação de comando Slave
   Ambiente: production | Vercel: SIM
   Payload: {"master_device_id":"ESP32_HIDRO_F44738","slave_mac_address":"14:33:5C:38:BF:60"...}
🔍 [DEBUG-SLAVE-DIRECT] Verificando device_status para master: ESP32_HIDRO_F44738
   ⏱️ [DEBUG-SLAVE-DIRECT] Query device_status: 18ms
🔍 [DEBUG-SLAVE-DIRECT] Inserindo comando no Supabase...
✅ [DEBUG-SLAVE-DIRECT] Comando criado com sucesso!
   ID: 124 | Master: ESP32_HIDRO_F44738 | Slave: 14:33:5C:38:BF:60
   Relays: 1 | Actions: on
   ⏱️ Tempos: Query=18ms | Insert=30ms | Total=48ms
```

**Mostra:**
- Mesmas informações do Master, mas para comandos de Slave
- Inclui informações do Slave (MAC address, device_id)

---

## 🔍 **COMO DEBUGGAR**

### **1. Em Localhost (Desenvolvimento)**

**Terminal onde roda `npm run dev`:**

```bash
# Você verá todos os logs no console
🔍 [DEBUG-API-ESP-NOW] Recebendo comando
   Ambiente: development | Vercel: NÃO
...
```

**Filtrar logs específicos:**
```bash
# Ver apenas logs de criação de comandos
npm run dev | grep "DEBUG-CREATE-RELAY"

# Ver apenas logs de funções diretas
npm run dev | grep "DEBUG-.*-DIRECT"

# Ver apenas erros
npm run dev | grep "❌"
```

---

### **2. Em Vercel (Produção)**

**Vercel Dashboard → Seu Projeto → Logs:**

1. Acesse: https://vercel.com/seu-projeto/logs
2. Os logs aparecem em tempo real
3. Use os filtros do Vercel para buscar por:
   - `DEBUG-API-ESP-NOW`
   - `DEBUG-CREATE-RELAY`
   - `DEBUG-MASTER-DIRECT`
   - `DEBUG-SLAVE-DIRECT`

**Ou via CLI:**
```bash
vercel logs --follow
```

---

## 📊 **ANÁLISE DE PERFORMANCE**

### **Tempos Esperados:**

| Ambiente | Função Direta | Fetch HTTP | Total Esperado |
|----------|---------------|------------|----------------|
| **Localhost** | 5-15ms | 20-50ms | 25-65ms |
| **Vercel** | 15-40ms | 50-150ms | 65-190ms |

### **O Que Observar:**

✅ **Bom:**
- Tempo total < 100ms (Vercel)
- Função direta < 50ms
- Query device_status < 30ms
- Insert < 50ms

⚠️ **Atenção:**
- Tempo total > 200ms
- Query device_status > 50ms (pode indicar problema de conexão)
- Insert > 100ms (pode indicar problema no Supabase)

❌ **Problema:**
- Erros 401, 403, 500
- Timeouts
- "device_id não existe" (verificar se Master está registrado)

---

## 🐛 **CENÁRIOS COMUNS DE DEBUG**

### **Cenário 1: Comando não está sendo criado**

**Logs esperados:**
```
🔍 [DEBUG-API-ESP-NOW] Recebendo comando
🔍 [DEBUG-CREATE-RELAY] Iniciando createRelayCommand
❌ [DEBUG-CREATE-RELAY] Resultado inválido: { success: false, error: "..." }
```

**O que verificar:**
1. Ver o erro específico no log
2. Verificar se `master_device_id` existe em `device_status`
3. Verificar se `user_email` e `master_mac_address` estão preenchidos

---

### **Cenário 2: Muito lento**

**Logs esperados:**
```
🔍 [DEBUG-CREATE-RELAY] Iniciando createRelayCommand
   ⏱️ [DEBUG-CREATE-RELAY] Função direta executada em: 500ms  ← PROBLEMA!
```

**O que verificar:**
1. Ver qual etapa está lenta (Query ou Insert)
2. Verificar conexão com Supabase
3. Verificar se há muitos comandos pendentes

---

### **Cenário 3: Erro 401 (não deveria mais acontecer)**

**Logs esperados:**
```
🌐 [DEBUG-CREATE-RELAY] Usando FETCH HTTP (cliente) → /api/relay-commands/slave
   ⏱️ [DEBUG-CREATE-RELAY] Fetch HTTP executado em: 150ms | Status: 401
❌ [DEBUG-CREATE-RELAY] Erro no fetch: { error: "..." }
```

**O que verificar:**
1. Se está realmente no cliente (navegador)
2. Se a API route está acessível
3. Se há problemas de CORS

---

## 🎯 **DICAS DE DEBUG**

### **1. Ativar/Desativar Logs**

Para desativar logs em produção (economizar espaço), você pode:

```typescript
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGS === 'true';

if (DEBUG) {
  console.log(`🔍 [DEBUG-...] ...`);
}
```

### **2. Logs Estruturados (JSON)**

Para análise mais fácil, você pode usar logs estruturados:

```typescript
console.log(JSON.stringify({
  type: 'DEBUG-CREATE-RELAY',
  timestamp: new Date().toISOString(),
  environment: env,
  isVercel: isVercel,
  isServer: isServer,
  time: totalTime,
  data: { ... }
}));
```

### **3. Filtrar no Vercel**

No Vercel Dashboard, use:
- `DEBUG-API-ESP-NOW` - Ver apenas API route
- `DEBUG-CREATE-RELAY` - Ver apenas função orquestradora
- `❌` - Ver apenas erros
- `⏱️` - Ver apenas tempos

---

## ✅ **CHECKLIST DE DEBUG**

Quando algo não funciona, verifique:

- [ ] Logs aparecem no console/Vercel?
- [ ] Qual ambiente está rodando? (development/production)
- [ ] Está usando função direta ou fetch HTTP?
- [ ] Quanto tempo está levando cada etapa?
- [ ] Há algum erro específico nos logs?
- [ ] `master_device_id` existe em `device_status`?
- [ ] Dados do payload estão corretos?

---

## 📝 **EXEMPLO COMPLETO DE LOGS**

```
🔍 [DEBUG-API-ESP-NOW] Recebendo comando
   Ambiente: production | Vercel: SIM
   Master: ESP32_HIDRO_F44738 | Slave: 14:33:5C:38:BF:60 | Relay: 1 | Action: on

🔍 [DEBUG-CREATE-RELAY] Iniciando createRelayCommand
   Ambiente: SERVIDOR | production | Vercel: SIM
   Tipo: SLAVE
   Payload resumido: device_id=ESP32_HIDRO_F44738, relays=[1], actions=[on]

🚀 [DEBUG-CREATE-RELAY] Usando função DIRETA (servidor)

🔍 [DEBUG-SLAVE-DIRECT] Iniciando criação de comando Slave
   Ambiente: production | Vercel: SIM
   Payload: {"master_device_id":"ESP32_HIDRO_F44738"...}

🔍 [DEBUG-SLAVE-DIRECT] Verificando device_status para master: ESP32_HIDRO_F44738
   ⏱️ [DEBUG-SLAVE-DIRECT] Query device_status: 18ms

🔍 [DEBUG-SLAVE-DIRECT] Inserindo comando no Supabase...
✅ [DEBUG-SLAVE-DIRECT] Comando criado com sucesso!
   ID: 124 | Master: ESP32_HIDRO_F44738 | Slave: 14:33:5C:38:BF:60
   Relays: 1 | Actions: on
   ⏱️ Tempos: Query=18ms | Insert=30ms | Total=48ms

   ⏱️ [DEBUG-CREATE-RELAY] Função direta executada em: 48ms

✅ [DEBUG-CREATE-RELAY] Comando criado com sucesso!
   ID: 124 | Status: pending
   ⏱️ Tempo total: 50ms

✅ [DEBUG-API-ESP-NOW] Comando criado com sucesso!
   ID: 124 | on relé 1 no slave 14:33:5C:38:BF:60
   ⏱️ Tempo total da API: 55ms
```

---

## 🎉 **PRONTO!**

Agora você tem visibilidade completa do fluxo de criação de comandos, tanto em localhost quanto em produção no Vercel!


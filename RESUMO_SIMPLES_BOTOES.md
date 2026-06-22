# ✅ Resumo Simples: Botões de Acionamento Manual

## 🎯 **O QUE VOCÊ TEM:**

### **Componente: `/automacao/page.tsx`**

**Botões ON/OFF para cada relé do Slave:**

```tsx
{slave.relays.map(relay => (
  <div>
    <h6>{relay.name}</h6>
    <button onClick={handleOn}>ON</button>
    <button onClick={handleOff}>OFF</button>
  </div>
))}
```

**O que cada botão faz:**
1. ✅ Clica → Faz POST para `/api/esp-now/command`
2. ✅ API cria comando no Supabase
3. ✅ ESP32 Master busca comando (a cada 30s)
4. ✅ Master envia via ESP-NOW para Slave
5. ✅ Slave aciona relé físico

---

## 📊 **FLUXO SIMPLIFICADO:**

```
👤 USUÁRIO
   │
   │ Clica botão ON/OFF
   ▼
🌐 FRONTEND (/automacao)
   │
   │ POST /api/esp-now/command
   │ {
   │   master_device_id: "ESP32_HIDRO_6447D0",
   │   slave_mac_address: "14:33:5C:38:BF:60",
   │   slave_name: "ESP-NOW-SLAVE",
   │   relay_number: 0,
   │   action: "on"
   │ }
   ▼
📡 API ROUTE
   │
   │ Cria registro em relay_commands (Supabase)
   │ Status: "pending"
   ▼
☁️ SUPABASE
   │
   │ ESP32 Master busca comandos (a cada 30s)
   ▼
🔧 ESP32 MASTER
   │
   │ Envia via ESP-NOW para Slave
   ▼
📦 ESP32 SLAVE
   │
   │ Aciona relé físico
   ▼
⚡ RELÉ LIGA!
```

---

## ✅ **O QUE ESTÁ FUNCIONANDO:**

1. ✅ **Botões renderizados** - Cada relé tem botão ON/OFF
2. ✅ **Estado local** - Rastreia se relé está ON/OFF
3. ✅ **Loading** - Mostra ⏳ durante requisição
4. ✅ **Feedback** - Toast "ligado/desligado"
5. ✅ **Validação** - API valida dados antes de criar comando
6. ✅ **Fluxo completo** - Do botão até o relé físico

---

## 🎨 **ESTRUTURA DOS BOTÕES:**

### **Cada Relé tem:**
- **Nome**: `relay.name` ou `Relé ${id + 1}`
- **Indicador visual**: Ponto verde (ON) ou cinza (OFF)
- **Botão ON**: Verde, desabilitado se já estiver ON
- **Botão OFF**: Vermelho, desabilitado se já estiver OFF
- **Loading**: Mostra ⏳ durante requisição

### **Estados:**
```typescript
relayStates: Map<string, boolean>
// Chave: "14:33:5C:38:BF:60-0" → Valor: true (ON) ou false (OFF)

loadingRelays: Map<string, boolean>
// Chave: "14:33:5C:38:BF:60-0" → Valor: true (loading) ou false
```

---

## 🔧 **CÓDIGO DOS BOTÕES:**

### **Botão ON:**
```typescript
onClick={async () => {
  // 1. Marcar como loading
  setLoadingRelays(prev => new Map(prev).set(relayKey, true));
  
  // 2. Fazer POST
  const response = await fetch('/api/esp-now/command', {
    method: 'POST',
    body: JSON.stringify({
      master_device_id: selectedDeviceId,
      slave_mac_address: slave.macAddress,
      slave_name: slave.name,
      relay_number: relay.id,
      action: 'on',
      duration_seconds: 0,
      triggered_by: 'manual',
    }),
  });
  
  // 3. Se sucesso, atualizar estado
  if (response.ok) {
    setRelayStates(prev => new Map(prev).set(relayKey, true));
    toast.success(`${relay.name} ligado`);
  }
  
  // 4. Remover loading
  setLoadingRelays(prev => {
    const next = new Map(prev);
    next.delete(relayKey);
    return next;
  });
}}
```

### **Botão OFF:**
```typescript
// Mesmo código, mas:
action: 'off'
setRelayStates(prev => new Map(prev).set(relayKey, false));
```

---

## 📋 **CHECKLIST:**

- [x] Botões ON/OFF funcionando
- [x] Estado local rastreado
- [x] Loading durante requisição
- [x] Feedback visual (toast)
- [x] API valida e cria comando
- [x] Comando criado no Supabase
- [x] Master busca e processa
- [x] Slave recebe e aciona
- [x] Relé físico funciona

---

## 💡 **CONCLUSÃO:**

**O sistema está SIMPLES e FUNCIONAL!** ✅

**Você tem:**
- ✅ Botões ON/OFF para cada relé
- ✅ Feedback visual imediato
- ✅ Estado local rastreado
- ✅ Fluxo completo funcionando

**Não precisa de mais nada para acionar manualmente os relés!** 🚀

---

## 🐛 **SE NÃO FUNCIONAR:**

### **1. Verificar se Slave aparece:**
- Abrir `/automacao`
- Verificar se Slave está listado
- Se não aparecer, verificar Serial do Master

### **2. Verificar se comando é criado:**
- Abrir Supabase → `relay_commands`
- Verificar se registro foi criado
- Status deve ser `pending`

### **3. Verificar se Master processa:**
- Ver Serial do Master
- Deve mostrar: "📡 [ESP-NOW] Comando para slave remoto"
- Deve mostrar: "✅ Comando enviado com sucesso!"

### **4. Verificar se Slave recebe:**
- Ver Serial do Slave
- Deve mostrar: "📥 Comando recebido"
- Deve mostrar: "🔌 Relé X LIGADO"

---

**Tudo pronto! Os botões estão funcionando! 🎉**


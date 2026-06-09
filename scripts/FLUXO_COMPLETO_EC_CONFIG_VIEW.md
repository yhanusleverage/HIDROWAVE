# 🔄 FLUXO COMPLETO: EC Config View (Similar a Relay Commands Slave)

## 📋 **RESUMO DO FLUXO**

**SIM!** O fluxo é similar ao padrão `relay_commands_slave`, mas adaptado para configuração:

1. **Frontend** → Salva/atualiza em `ec_config_view` (view table)
2. **RPC `activate_auto_ec`** → Busca com `FOR UPDATE SKIP LOCKED` (lock atômico)
3. **ESP32** → Faz POST lock (chama RPC) e recebe config com `auto_enabled = true`
4. **Tudo em uma "bala" atômica** → Similar ao padrão `get_and_lock_slave_commands`

---

## 🔄 **FLUXO DETALHADO**

### **1. FRONTEND → Salva em `ec_config_view`**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│                                                          │
│  Usuário configura parâmetros EC                        │
│  ↓                                                       │
│  Clica "Salvar Parâmetros"                             │
│  ↓                                                       │
│  POST /api/ec-controller/config                        │
│  ↓                                                       │
│  Salva em ec_config_view:                              │
│  {                                                       │
│    device_id: "ESP32_HIDRO_F44738",                    │
│    base_dose: 666,                                      │
│    flow_rate: 1.0,                                      │
│    volume: 10,                                          │
│    ec_setpoint: 1400,                                   │
│    nutrients: [...],                                    │
│    distribution: {...},                                 │
│    auto_enabled: false  ← Ainda desativado             │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
                          ↓
                    (Salva no Supabase)
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│                                                          │
│  ec_config_view (view table)                            │
│  ├── device_id: "ESP32_HIDRO_F44738"                   │
│  ├── auto_enabled: false  ← Pendente de ativação       │
│  ├── nutrients: JSONB                                   │
│  ├── distribution: JSONB                                │
│  └── ... outros parâmetros                             │
└─────────────────────────────────────────────────────────┘
```

### **2. FRONTEND → Ativa via RPC (Comando Procedural Atômico)**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│                                                          │
│  Usuário clica "Ativar Auto EC"                         │
│  ↓                                                       │
│  supabase.rpc('activate_auto_ec', {                    │
│    p_device_id: "ESP32_HIDRO_F44738"                   │
│  })                                                      │
│  ↓                                                       │
│  RPC executa:                                           │
│  1. SELECT ... FOR UPDATE SKIP LOCKED  ← Lock atômico  │
│  2. UPDATE auto_enabled = true  ← Ativação atômica    │
│  3. RETURNS config completa                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (RPC)                        │
│                                                          │
│  activate_auto_ec(p_device_id)                          │
│  ├── Busca ec_config_view com FOR UPDATE SKIP LOCKED  │
│  ├── Atualiza auto_enabled = true  ← ATÔMICO          │
│  └── Retorna config completa com auto_enabled = true  │
│                                                          │
│  ✅ Tudo em uma transação atômica (uma "bala")        │
└─────────────────────────────────────────────────────────┘
```

### **3. ESP32 → Busca Config Ativada (POST Lock)**

```
┌─────────────────────────────────────────────────────────┐
│                    ESP32 (C++)                           │
│                                                          │
│  Loop principal (a cada intervalo_auto_ec segundos)    │
│  ↓                                                       │
│  POST /rest/v1/rpc/activate_auto_ec                    │
│  {                                                       │
│    "p_device_id": "ESP32_HIDRO_F44738"                 │
│  }                                                       │
│  ↓                                                       │
│  RPC retorna:                                           │
│  {                                                       │
│    device_id: "ESP32_HIDRO_F44738",                   │
│    base_dose: 666,                                      │
│    flow_rate: 1.0,                                      │
│    volume: 10,                                          │
│    ec_setpoint: 1400,                                   │
│    nutrients: [...],                                    │
│    distribution: {                                      │
│      totalUt: 15.50,                                   │
│      intervalo: 5,                                     │
│      distribution: [                                    │
│        { name: "Grow", relay: 2, dosage: 6.20, duration: 6.37 }
│      ]                                                  │
│    },                                                   │
│    auto_enabled: true  ← ✅ ATIVADO                    │
│  }                                                       │
│  ↓                                                       │
│  ESP32 usa distribution para dosagem                  │
│  hydroControl->executeWebDosage(distribution, intervalo)│
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 **COMPARAÇÃO: EC Config vs Relay Commands**

### **Relay Commands Slave (Múltiplos Comandos)**

```
┌─────────────────────────────────────────────────────────┐
│  relay_commands_slave (Tabela de Comandos)              │
│                                                          │
│  id | status      | relay_numbers | actions            │
│  1  | pending     | [2, 3]       | [true, false]      │
│  2  | pending     | [1]           | [true]             │
│  3  | processing  | [4]           | [true]             │
│                                                          │
│  RPC: get_and_lock_slave_commands()                     │
│  ├── Busca status='pending'                            │
│  ├── Marca como 'processing' (ATÔMICO)                 │
│  └── Retorna comandos marcados                         │
│                                                          │
│  Estados: pending → processing → sent → completed      │
└─────────────────────────────────────────────────────────┘
```

### **EC Config View (Configuração Única)**

```
┌─────────────────────────────────────────────────────────┐
│  ec_config_view (View Table de Configuração)            │
│                                                          │
│  device_id          | auto_enabled | distribution      │
│  ESP32_HIDRO_XXX    | false        | {...}             │
│                                                          │
│  RPC: activate_auto_ec()                                │
│  ├── Busca com FOR UPDATE SKIP LOCKED                  │
│  ├── Atualiza auto_enabled = true (ATÔMICO)            │
│  └── Retorna config completa                           │
│                                                          │
│  Estados: auto_enabled = false → true                   │
│  (Mais simples: apenas on/off, não precisa de fila)    │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **DIFERENÇAS IMPORTANTES**

### **Relay Commands:**
- ✅ **Múltiplos comandos** em fila (pending, processing, sent, completed)
- ✅ **RPC busca vários** comandos pendentes
- ✅ **Estados de progresso** (pending → processing → sent → completed)
- ✅ **Priorização** (peristaltic > rule > manual)

### **EC Config:**
- ✅ **Configuração única** por device_id (UNIQUE)
- ✅ **RPC busca uma config** e ativa
- ✅ **Estado binário** (auto_enabled: false/true)
- ✅ **Sem fila** (sempre a última config salva)

---

## 🎯 **RESPOSTA À SUA PERGUNTA**

**SIM! O fluxo é correto:**

1. ✅ **Frontend registra/atualiza** em `ec_config_view` (view table)
2. ✅ **RPC `activate_auto_ec`** busca com `FOR UPDATE SKIP LOCKED` (lock atômico)
3. ✅ **ESP32 faz POST lock** (chama RPC) e recebe config com `auto_enabled = true`
4. ✅ **Comando procedural atômico** na mesma "bala" (transação única)
5. ✅ **Similar ao padrão** `get_and_lock_slave_commands`

**Diferença:** EC Config não precisa de estados `pending/processing/sent` porque:
- É uma **configuração única** (não múltiplos comandos)
- O RPC já faz o **lock atômico** com `FOR UPDATE SKIP LOCKED`
- O estado é simples: `auto_enabled = false/true`

---

## 📊 **FLUXO VISUAL COMPLETO**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│                                                          │
│  1. "Salvar Parâmetros"                                 │
│     → POST /api/ec-controller/config                   │
│     → Salva em ec_config_view                          │
│     → auto_enabled = false                             │
│                                                          │
│  2. "Ativar Auto EC"                                    │
│     → supabase.rpc('activate_auto_ec')                 │
│     → RPC faz lock + ativação atômica                  │
│     → Retorna config com auto_enabled = true           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│                                                          │
│  ec_config_view (view table)                            │
│  ├── device_id: UNIQUE                                 │
│  ├── auto_enabled: false → true (via RPC)              │
│  ├── nutrients: JSONB                                   │
│  └── distribution: JSONB                                │
│                                                          │
│  RPC: activate_auto_ec(p_device_id)                     │
│  ├── SELECT ... FOR UPDATE SKIP LOCKED  ← Lock        │
│  ├── UPDATE auto_enabled = true  ← Ativação           │
│  └── RETURNS config completa  ← Tudo atômico           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    ESP32                                 │
│                                                          │
│  Loop periódico (a cada intervalo_auto_ec)              │
│  ↓                                                       │
│  POST /rpc/activate_auto_ec                            │
│  ↓                                                       │
│  Recebe config com auto_enabled = true                 │
│  ↓                                                       │
│  Usa distribution para dosagem                        │
│  executeWebDosage(distribution, intervalo)             │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **CONFIRMAÇÃO**

**SIM, você entendeu corretamente!**

- ✅ Frontend salva em `ec_config_view`
- ✅ RPC busca com POST lock (`FOR UPDATE SKIP LOCKED`)
- ✅ RPC ativa `auto_enabled = true` atômicamente
- ✅ ESP32 recebe config já ativada
- ✅ Tudo em uma transação atômica (uma "bala")
- ✅ Similar ao padrão `relay_commands_slave`, mas adaptado para configuração única

**Não precisa de estados `pending/processing/sent`** porque é uma configuração, não uma fila de comandos.

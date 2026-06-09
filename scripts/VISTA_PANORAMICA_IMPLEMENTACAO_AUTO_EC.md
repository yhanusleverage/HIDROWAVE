# 🎯 Vista Panorâmica: Implementação Auto EC Completa

## 📋 **RESUMO EXECUTIVO**

Implementação completa do sistema Auto EC que permite ao ESP32 buscar configuração do Supabase periodicamente e executar dosagem automática baseada em `distribution` calculada no frontend.

---

## 🏗️ **ARQUITETURA COMPLETA**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│                                                                  │
│  1. Usuário configura parâmetros EC                             │
│  2. Frontend calcula distribution (duration em SEGUNDOS)         │
│  3. Salva em ec_config_view (POST /api/ec-controller/config)   │
│  4. Usuário clica "Ativar Auto EC"                              │
│  5. Frontend chama RPC activate_auto_ec (ativação inicial)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                          │
│                                                                  │
│  Tabela: ec_config_view                                          │
│  ├── Parâmetros básicos (base_dose, flow_rate, volume, etc)    │
│  ├── intervalo_auto_ec (SEGUNDOS)                               │
│  ├── tempo_recirculacao (SEGUNDOS)                              │
│  ├── nutrients (JSONB array)                                    │
│  └── distribution (JSONB) ← Calculado no frontend               │
│                                                                  │
│  RPC: activate_auto_ec(p_device_id TEXT)                        │
│  ├── SELECT ... FOR UPDATE SKIP LOCKED  ← 🔒 LOCK              │
│  ├── UPDATE auto_enabled = true                                 │
│  └── RETURN config completa                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ESP32 (Firmware)                              │
│                                                                  │
│  1. Loop periódico (a cada intervalo_auto_ec segundos)          │
│  2. POST /rpc/activate_auto_ec                                  │
│  3. Recebe config com distribution                              │
│  4. Salva em NVS (opcional, para persistência)                  │
│  5. Atualiza parâmetros do ECController                         │
│  6. Se tem distribution → executeWebDosage(distribution)         │
│  7. Se não tem → calcula localmente                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 **TÓPICOS POR COMPONENTE**

### **1. FRONTEND (Next.js)**

#### **1.1. Página de Automação**
- **Arquivo:** `src/app/automacao/page.tsx`
- **Funções:**
  - `loadECControllerConfig()` - Carrega config do Supabase
  - `saveECControllerConfig()` - Salva config em `ec_config_view`
  - `calculateDistribution()` - Calcula distribution (duration em SEGUNDOS)
  - Botão "Ativar Auto EC" → Chama `supabase.rpc('activate_auto_ec')`

#### **1.2. API Route**
- **Arquivo:** `src/app/api/ec-controller/config/route.ts`
- **Endpoints:**
  - `GET /api/ec-controller/config` - Busca config de `ec_config_view`
  - `POST /api/ec-controller/config` - Salva/atualiza em `ec_config_view`

#### **1.3. Cálculo de Distribution**
- **Localização:** `src/app/automacao/page.tsx` (função `calculateDistribution`)
- **Input:**
  - `nutrients` (array com mlPerLiter)
  - `total_ml` (total ml/L)
  - `flow_rate` (ml/s)
  - `volume` (litros)
- **Output:**
  ```json
  {
    "totalUt": 384.7,
    "intervalo": 300,
    "distribution": [
      {
        "name": "Grow",
        "relay": 0,
        "dosage": 168.62,    // ml
        "duration": 172.06   // SEGUNDOS
      }
    ]
  }
  ```

---

### **2. SUPABASE (PostgreSQL)**

#### **2.1. Tabela ec_config_view**
- **Arquivo:** `scripts/CREATE_EC_CONFIG_VIEW.sql`
- **Campos principais:**
  - `intervalo_auto_ec` INTEGER (SEGUNDOS) - Default: 300
  - `tempo_recirculacao` INTEGER (SEGUNDOS) - Default: 60
  - `nutrients` JSONB - Array de nutrientes
  - `distribution` JSONB - Distribuição calculada (pode ser NULL)

#### **2.2. RPC activate_auto_ec**
- **Arquivo:** `scripts/CREATE_RPC_ACTIVATE_AUTO_EC.sql`
- **Funcionalidade:**
  - Lock atômico (`FOR UPDATE SKIP LOCKED`)
  - Ativa `auto_enabled = true`
  - Retorna config completa incluindo `distribution`
- **Uso:**
  - Frontend: Ativação inicial
  - ESP32: Busca periódica

---

### **3. ESP32 (Firmware)**

#### **3.1. Estrutura de Dados**
- **Arquivo:** `include/SupabaseClient.h` ou `HydroControl.h`
```cpp
struct ECConfig {
    // Parâmetros básicos
    double base_dose, flow_rate, volume, total_ml, kp, ec_setpoint;
    bool auto_enabled;
    int intervalo_auto_ec;  // ✅ SEGUNDOS
    unsigned long tempo_recirculacao;  // ✅ SEGUNDOS
    
    // Nutrients
    struct Nutrient { ... } nutrients[8];
    int nutrientsCount;
    
    // Distribution
    struct Distribution { ... } distribution;
    bool hasDistribution;
};
```

#### **3.2. Função de Busca (SupabaseClient)**
- **Arquivo:** `src/SupabaseClient.cpp`
- **Função:** `getECConfigFromSupabase(ECConfig& config)`
- **Funcionalidade:**
  - POST `/rest/v1/rpc/activate_auto_ec`
  - Parse JSON response
  - Retorna config completa (tempo_recirculacao já em SEGUNDOS)

#### **3.3. Integração no HydroControl**
- **Arquivo:** `src/HydroControl.cpp`
- **Função:** `checkAutoEC()`
- **Fluxo:**
  1. Verifica se `autoECEnabled == true`
  2. Verifica intervalo (não verificar muito frequente)
  3. Chama `getECConfigFromSupabase()`
  4. Atualiza parâmetros do `ecController`
  5. Se tem `distribution` → `executeWebDosage(distribution)`
  6. Se não tem → calcula localmente

#### **3.4. Loop Principal**
- **Arquivo:** `src/HydroSystemCore.cpp`
- **Função:** `loop()`
- **Chamada:**
```cpp
if (hydroControl.isAutoECEnabled()) {
    hydroControl.checkAutoEC();
}
```

---

## 📡 **CHAMADAS ESP32 → SUPABASE**

### **1. Auto EC (Principal)**

| Método | Endpoint | Frequência | Lock? | Payload |
|--------|----------|------------|-------|---------|
| `POST` | `/rest/v1/rpc/activate_auto_ec` | A cada `intervalo_auto_ec` segundos | ✅ SIM | `{"p_device_id": "ESP32_XXX"}` |

**Response:**
```json
[
  {
    "device_id": "ESP32_XXX",
    "base_dose": 1525.0,
    "flow_rate": 0.98,
    "ec_setpoint": 1400.0,
    "auto_enabled": true,
    "intervalo_auto_ec": 300,
    "tempo_recirculacao": 4500,  // ✅ SEGUNDOS (4500s = 75 minutos)
    "nutrients": [...],
    "distribution": {...}
  }
]
```

### **2. Outras Chamadas (Não relacionadas a Auto EC)**

| Método | Endpoint | Frequência | Propósito |
|--------|----------|------------|-----------|
| `PATCH` | `/rest/v1/device_status` | 10-30s | Heartbeat |
| `POST` | `/rest/v1/rpc/get_and_lock_slave_commands` | 10-30s | Comandos slaves |
| `POST` | `/rest/v1/rpc/get_and_lock_master_commands` | 10-30s | Comandos master |
| `PATCH` | `/rest/v1/relay_commands_*` | Após executar | Atualizar status |

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **Frontend** ✅ **COMPLETO**

- [x] Página de automação com campos EC
- [x] Cálculo de distribution (duration em SEGUNDOS)
- [x] Salvar em `ec_config_view` (POST /api/ec-controller/config)
- [x] Botão "Ativar Auto EC" → RPC `activate_auto_ec`
- [x] Carregar config do Supabase

### **Supabase** ✅ **COMPLETO**

- [x] Tabela `ec_config_view` criada
- [x] RPC `activate_auto_ec` criado com lock
- [x] Campo `distribution` JSONB na tabela
- [x] Campo `tempo_recirculacao` em MILISEGUNDOS

### **ESP32** ⚠️ **FALTA IMPLEMENTAR**

- [ ] Estrutura `ECConfig` definida
- [ ] Função `getECConfigFromSupabase()` implementada
- [ ] Integração em `checkAutoEC()` para buscar config do Supabase
- [ ] Conversão `tempo_recirculacao` (ms → segundos)
- [ ] Uso de `distribution` quando disponível
- [ ] **Salvar em NVS (opcional, mas recomendado)**
- [ ] Chamada periódica no `loop()`

---

## 💾 **PERSISTÊNCIA EM NVS (Recomendado)**

### **Por quê salvar em NVS?**

1. **Resiliência:**
   - Se Supabase estiver offline, ESP32 usa última config válida
   - Evita perda de configuração após reboot

2. **Performance:**
   - Não precisa buscar do Supabase a cada verificação
   - Busca apenas quando `intervalo_auto_ec` expira

3. **Funcionamento Offline:**
   - ESP32 continua funcionando mesmo sem internet
   - Usa última config salva

### **O que salvar em NVS?**

```cpp
// Estrutura mínima para NVS
struct ECConfigNVS {
    double base_dose;
    double flow_rate;
    double volume;
    double total_ml;
    double kp;
    double ec_setpoint;
    bool auto_enabled;
    int intervalo_auto_ec;
    unsigned long tempo_recirculacao;
    // Não salvar nutrients/distribution (muito grande)
    // Buscar do Supabase quando necessário
};
```

### **Estratégia Híbrida (Recomendada):**

```
┌─────────────────────────────────────────────────────────┐
│ ESP32 checkAutoEC()                                      │
│                                                           │
│ 1. Verificar intervalo (usar millis(), não NVS)         │
│ 2. Se intervalo expirou:                                 │
│    a. Buscar do Supabase (RPC activate_auto_ec)          │
│    b. Se sucesso → Salvar parâmetros básicos em NVS     │
│    c. Se falhou → Carregar de NVS (fallback)            │
│ 3. Se tem distribution → usar do Supabase (não salvar)  │
│ 4. Se não tem → calcular localmente                      │
└─────────────────────────────────────────────────────────┘
```

### **Implementação NVS:**

```cpp
// Salvar parâmetros básicos (não distribution)
bool saveECConfigToNVS(const ECConfig& config) {
    Preferences prefs;
    prefs.begin("ec_config", false);
    
    prefs.putDouble("base_dose", config.base_dose);
    prefs.putDouble("flow_rate", config.flow_rate);
    prefs.putDouble("volume", config.volume);
    prefs.putDouble("total_ml", config.total_ml);
    prefs.putDouble("kp", config.kp);
    prefs.putDouble("ec_setpoint", config.ec_setpoint);
    prefs.putBool("auto_enabled", config.auto_enabled);
    prefs.putInt("intervalo_auto_ec", config.intervalo_auto_ec);
    prefs.putULong("tempo_recirculacao", config.tempo_recirculacao);
    
    prefs.end();
    return true;
}

// Carregar parâmetros básicos (fallback)
bool loadECConfigFromNVS(ECConfig& config) {
    Preferences prefs;
    prefs.begin("ec_config", false);
    
    config.base_dose = prefs.getDouble("base_dose", 0.0);
    config.flow_rate = prefs.getDouble("flow_rate", 1.0);
    config.volume = prefs.getDouble("volume", 10.0);
    config.total_ml = prefs.getDouble("total_ml", 0.0);
    config.kp = prefs.getDouble("kp", 1.0);
    config.ec_setpoint = prefs.getDouble("ec_setpoint", 0.0);
    config.auto_enabled = prefs.getBool("auto_enabled", false);
    config.intervalo_auto_ec = prefs.getInt("intervalo_auto_ec", 300);
    config.tempo_recirculacao = prefs.getULong("tempo_recirculacao", 60);  // Default: 60 segundos
    
    prefs.end();
    return true;
}
```

---

## 🎯 **VISTA PANORÂMICA: O QUE FALTA?**

### **✅ JÁ TEMOS:**

1. **Frontend:**
   - ✅ Interface completa
   - ✅ Cálculo de distribution
   - ✅ Salvar em Supabase
   - ✅ Ativar Auto EC via RPC

2. **Supabase:**
   - ✅ Tabela `ec_config_view`
   - ✅ RPC `activate_auto_ec` com lock
   - ✅ Campo `distribution` JSONB

3. **ESP32:**
   - ✅ Função `checkAutoEC()` (mas não busca do Supabase ainda)
   - ✅ Função `executeWebDosage()` (já recebe distribution)
   - ✅ ECController com cálculo local

### **⚠️ FALTA IMPLEMENTAR NO ESP32:**

1. **Estrutura de Dados:**
   - [ ] Definir `struct ECConfig` em header

2. **Função de Busca:**
   - [ ] `getECConfigFromSupabase()` em `SupabaseClient.cpp`
   - [ ] Parse JSON completo
   - [ ] Parse `tempo_recirculacao` (já em SEGUNDOS, sem conversão)

3. **Integração:**
   - [ ] Modificar `checkAutoEC()` para buscar do Supabase
   - [ ] Usar `distribution` quando disponível
   - [ ] Fallback para cálculo local se não tem distribution

4. **Persistência (Opcional mas Recomendado):**
   - [ ] Salvar parâmetros básicos em NVS
   - [ ] Carregar de NVS como fallback
   - [ ] Não salvar `distribution` (muito grande, buscar sempre do Supabase)

5. **Loop:**
   - [ ] Garantir que `checkAutoEC()` é chamado periodicamente

---

## 📊 **FLUXO COMPLETO DETALHADO**

### **Cenário 1: Primeira Ativação (Frontend)**

```
1. Usuário configura parâmetros EC no frontend
2. Frontend calcula distribution
3. Frontend salva em ec_config_view (POST /api/ec-controller/config)
4. Usuário clica "Ativar Auto EC"
5. Frontend chama RPC activate_auto_ec (ativação inicial)
6. Supabase retorna config completa
7. ESP32 ainda não está buscando (aguardando intervalo)
```

### **Cenário 2: ESP32 Busca Periódica**

```
1. ESP32 loop() verifica se autoECEnabled == true
2. checkAutoEC() verifica intervalo (ex: 300 segundos)
3. Se intervalo expirou:
   a. POST /rpc/activate_auto_ec
   b. Supabase retorna config com distribution
   c. ESP32 parse JSON
   d. Parse tempo_recirculacao (já em SEGUNDOS, sem conversão)
   e. Salva parâmetros básicos em NVS (opcional)
   f. Atualiza ECController
   g. Se tem distribution → executeWebDosage(distribution)
   h. Se não tem → calcula localmente
4. Aguarda próximo intervalo
```

### **Cenário 3: Fallback (Supabase Offline)**

```
1. ESP32 tenta buscar do Supabase
2. Falha (timeout/erro HTTP)
3. Carrega parâmetros básicos de NVS (se existir)
4. Usa parâmetros salvos para cálculo local
5. Não usa distribution (só vem do Supabase)
6. Continua funcionando com última config válida
```

---

## 🔧 **IMPLEMENTAÇÃO RECOMENDADA (Passo a Passo)**

### **Passo 1: Estrutura de Dados**
- Criar `struct ECConfig` em `include/HydroControl.h`

### **Passo 2: Função de Busca**
- Implementar `getECConfigFromSupabase()` em `SupabaseClient.cpp`
- Testar parse JSON completo

### **Passo 3: Integração**
- Modificar `checkAutoEC()` para usar config do Supabase
- Implementar uso de `distribution` quando disponível

### **Passo 4: NVS (Opcional)**
- Implementar `saveECConfigToNVS()` e `loadECConfigFromNVS()`
- Integrar em `checkAutoEC()` (salvar após buscar, carregar se falhar)

### **Passo 5: Testes**
- Testar busca do Supabase
- Testar uso de distribution
- Testar fallback para NVS
- Testar cálculo local quando não tem distribution

---

## ✅ **RESPOSTA FINAL**

### **"Não falta nada do lado ESP32?"**

**Falta implementar:**
1. ✅ Função `getECConfigFromSupabase()` - **CRÍTICO**
2. ✅ Integração em `checkAutoEC()` - **CRÍTICO**
3. ⚠️ Salvar em NVS - **RECOMENDADO** (resiliência)

### **"Precisamos salvar dados de ec_config em NVS?"**

**SIM, RECOMENDADO!** Mas apenas:
- ✅ **Parâmetros básicos** (base_dose, flow_rate, volume, etc.)
- ❌ **NÃO salvar** `distribution` (muito grande, buscar sempre do Supabase)
- ❌ **NÃO salvar** `nutrients` array completo (buscar do Supabase)

**Estratégia:**
- Salvar parâmetros básicos em NVS após buscar do Supabase
- Usar NVS como fallback se Supabase estiver offline
- `distribution` sempre vem do Supabase (não persistir)

---

**Data:** 2025-01-12  
**Status:** ✅ **VISTA PANORÂMICA COMPLETA - PRONTO PARA IMPLEMENTAR**

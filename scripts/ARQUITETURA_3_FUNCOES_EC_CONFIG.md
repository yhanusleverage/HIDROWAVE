ETURA: 3 FUNÇÕES EM 3 LUGARES - EC CONFIG

## 📋 **RESUMO**

Trabalhamos com **3 funções em 3 lugares diferentes**:

1. **🔵 RPC na Base de Dados (Supabase)** → Função SQL com lock
2. **🟢 POST Lock no Frontend/API** → Endpoint que salva em `ec_config_view`
3. **🟡 Fetch no Embebido (ESP32)** → Código C++ que chama RPC

---

## 🎯 **ARQUITETURA COMPLETA**

```
┌─────────────────────────────────────────────────────────────┐
│                    🟢 FRONTEND / API                        │
│                                                              │
│  POST /api/ec-controller/config                            │
│  ├── Recebe payload do frontend                            │
│  ├── Calcula distribution (se necessário)                 │
│  └── Salva em ec_config_view (view table)                  │
│                                                              │
│  Função: saveECControllerConfig()                          │
│  Local: src/app/api/ec-controller/config/route.ts          │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    (Salva dados)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    🔵 BASE DE DADOS (SUPABASE)               │
│                                                              │
│  Tabela: ec_config_view                                     │
│  ├── Armazena parâmetros EC                                │
│  ├── nutrients: JSONB                                      │
│  └── auto_enabled: BOOLEAN                                  │
│                                                              │
│  RPC: activate_auto_ec(p_device_id TEXT)                     │
│  ├── SELECT ... FOR UPDATE SKIP LOCKED                     │
│  ├── UPDATE auto_enabled = true                            │
│  └── RETURNS TABLE (config completa)                       │
│                                                              │
│  Função SQL: CREATE FUNCTION activate_auto_ec(...)          │
│  Local: scripts/CREATE_RPC_ACTIVATE_AUTO_EC.sql            │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    (ESP32 chama RPC)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    🟡 EMBEBIDO (ESP32)                        │
│                                                              │
│  Função: fetchECConfig() ou activateAutoEC()               │
│  ├── POST /rest/v1/rpc/activate_auto_ec                    │
│  ├── Payload: {"p_device_id": "ESP32_HIDRO_XXX"}           │
│  ├── Recebe JSON com config completa                       │
│  └── Usa config para dosagem                               │
│                                                              │
│  Código C++: SupabaseClient.cpp ou HydroSystemCore.cpp     │
│  Local: ESP32 firmware (Hydro-Controller-main)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔵 **1. RPC NA BASE DE DADOS (SUPABASE)**

### **Localização:**
- **Arquivo SQL:** `scripts/CREATE_RPC_ACTIVATE_AUTO_EC.sql`
- **Tabela:** `ec_config_view` (view table)
- **Função:** `activate_auto_ec(p_device_id TEXT)`

### **O que faz:**
```sql
CREATE FUNCTION activate_auto_ec(p_device_id TEXT)
RETURNS TABLE (
  id BIGINT,
  device_id TEXT,
  base_dose DOUBLE PRECISION,
  flow_rate DOUBLE PRECISION,
  volume DOUBLE PRECISION,
  -- ... outros campos
  nutrients JSONB,
  -- ...
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Buscar e BLOQUEAR config (FOR UPDATE SKIP LOCKED)
  SELECT * INTO config_record
  FROM public.ec_config_view
  WHERE device_id = p_device_id
  FOR UPDATE SKIP LOCKED;  -- 🔒 LOCK aqui!
  
  -- 2. Atualizar auto_enabled = true
  UPDATE public.ec_config_view
  SET auto_enabled = true,
      updated_at = now()
  WHERE device_id = p_device_id;
  
  -- 3. Retornar config completa
  RETURN QUERY SELECT ...;
END;
$$;
```

### **Características:**
- ✅ **Lock atômico** (`FOR UPDATE SKIP LOCKED`) - evita race conditions
- ✅ **Ativação automática** (`auto_enabled = true`)
- ✅ **Retorna config completa** para ESP32
- ✅ **Idempotente** - pode ser chamado múltiplas vezes

### **Quando é chamado:**
1. **Frontend:** Botão "Ativar Auto EC" → `supabase.rpc('activate_auto_ec')`
2. **ESP32:** Periodicamente (a cada X segundos) → `POST /rpc/activate_auto_ec`

---

## 🟢 **2. POST LOCK NO FRONTEND/API**

### **Localização:**
- **Arquivo:** `src/app/api/ec-controller/config/route.ts`
- **Endpoint:** `POST /api/ec-controller/config`
- **Função:** `POST(request: Request)`

### **O que faz:**
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const { device_id, ...config } = body;
  
  // ✅ Salva em ec_config_view (view table)
  const { data, error } = await supabase
    .from('ec_config_view')
    .upsert({
      device_id,
      ...config,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'device_id'  // 🔒 "Lock" via upsert
    })
    .select()
    .single();
  
  return NextResponse.json({ success: true, data });
}
```

### **Características:**
- ✅ **Upsert** (`onConflict: 'device_id'`) - cria ou atualiza
- ✅ **Validação** de `device_id` obrigatório
- ✅ **Tratamento de erros** detalhado
- ✅ **Retorna dados salvos** para confirmação

### **Quando é chamado:**
1. **Frontend:** Botão "Salvar Parâmetros" → `saveECControllerConfig()`
2. **Payload inclui:**
   - `base_dose`, `flow_rate`, `volume`, `ec_setpoint`
   - `nutrients` (JSONB array)
   - `tempo_recirculacao` (INTEGER em milisegundos)
   - `intervalo_auto_ec` (INTEGER em segundos)

---

## 🟡 **3. FETCH NO EMBEBIDO (ESP32)**

### **Localização:**
- **Arquivo C++:** `SupabaseClient.cpp` ou `HydroSystemCore.cpp`
- **Função:** `fetchECConfig()` ou `activateAutoEC()`
- **Endpoint:** `POST /rest/v1/rpc/activate_auto_ec`

### **O que faz (pseudo-código C++):**
```cpp
// ESP32 chama RPC activate_auto_ec
String endpoint = "/rest/v1/rpc/activate_auto_ec";
String payload = "{\"p_device_id\":\"" + deviceId + "\"}";

HTTPClient http;
http.begin(SUPABASE_URL + endpoint);
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_ANON_KEY);
http.addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

int httpCode = http.POST(payload);
String response = http.getString();

// Parsear JSON retornado
DynamicJsonDocument doc(2048);
deserializeJson(doc, response);

// Extrair config
double baseDose = doc[0]["base_dose"];
double flowRate = doc[0]["flow_rate"];
double volume = doc[0]["volume"];
double ecSetpoint = doc[0]["ec_setpoint"];
JsonArray nutrients = doc[0]["nutrients"];

// Usar config para dosagem
// ...
```

### **Características:**
- ✅ **Polling** - ESP32 chama periodicamente (a cada X segundos)
- ✅ **Parse JSON** - Extrai todos os parâmetros
- ✅ **Usa config** - Aplica para controle EC
- ✅ **Tratamento de erro** - Se RPC falhar, usa config local (NVS)

### **Quando é chamado:**
1. **Inicialização:** Ao ligar ESP32 (se `auto_enabled = true`)
2. **Periodicamente:** A cada `intervalo_auto_ec` segundos (ex: 5s)
3. **Após dosagem:** Para verificar se config mudou

---

## 🔄 **FLUXO COMPLETO**

### **Cenário 1: Usuário configura EC no Frontend**

```
1. Usuário preenche campos no frontend
   ↓
2. Clica "Salvar Parâmetros"
   ↓
3. Frontend calcula distribution (se necessário)
   ↓
4. POST /api/ec-controller/config
   ↓
5. API salva em ec_config_view
   ↓
6. ✅ Config salva (mas auto_enabled = false)
```

### **Cenário 2: Usuário ativa Auto EC**

```
1. Usuário clica "Ativar Auto EC"
   ↓
2. Frontend chama: supabase.rpc('activate_auto_ec', {p_device_id})
   ↓
3. RPC busca ec_config_view (com lock)
   ↓
4. RPC atualiza auto_enabled = true
   ↓
5. RPC retorna config completa
   ↓
6. Frontend atualiza UI (mostra "✅ Ativado")
```

### **Cenário 3: ESP32 busca config**

```
1. ESP32 loop principal (a cada 5 segundos)
   ↓
2. ESP32 chama: POST /rpc/activate_auto_ec
   ↓
3. RPC busca ec_config_view (com lock)
   ↓
4. RPC retorna config completa (se auto_enabled = true)
   ↓
5. ESP32 parseia JSON
   ↓
6. ESP32 usa config para dosagem
   ↓
7. ESP32 executa controle EC
```

---

## 📊 **COMPARAÇÃO: 3 FUNÇÕES**

| Aspecto | 🔵 RPC (BD) | 🟢 POST (API) | 🟡 Fetch (ESP32) |
|--------|-------------|--------------|------------------|
| **Local** | Supabase SQL | Next.js API Route | ESP32 C++ |
| **Método** | `CREATE FUNCTION` | `POST /api/...` | `http.POST()` |
| **Lock** | `FOR UPDATE SKIP LOCKED` | `upsert onConflict` | N/A (chama RPC) |
| **Quando** | Frontend ou ESP32 | Apenas Frontend | Apenas ESP32 |
| **Retorna** | Config completa | `{success: true}` | Recebe JSON |
| **Propósito** | Ativar + retornar | Salvar parâmetros | Obter config |

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **🔵 RPC na BD:**
- [x] Script `CREATE_RPC_ACTIVATE_AUTO_EC.sql` criado
- [x] Função `activate_auto_ec(p_device_id TEXT)` definida
- [x] Lock implementado (`FOR UPDATE SKIP LOCKED`)
- [x] Retorna config completa
- [ ] **PENDENTE:** Executar script no Supabase

### **🟢 POST no Frontend/API:**
- [x] Endpoint `POST /api/ec-controller/config` implementado
- [x] Salva em `ec_config_view`
- [x] Tratamento de erros
- [x] Validação de `device_id`
- [x] Frontend calcula `distribution` antes de salvar

### **🟡 Fetch no ESP32:**
- [ ] **PENDENTE:** Implementar função `fetchECConfig()` ou `activateAutoEC()`
- [ ] **PENDENTE:** Chamar RPC `activate_auto_ec` periodicamente
- [ ] **PENDENTE:** Parsear JSON retornado
- [ ] **PENDENTE:** Usar config para dosagem
- [ ] **PENDENTE:** Integrar com EC Controller existente

---

## 🎯 **PRÓXIMOS PASSOS**

1. **✅ Executar script SQL no Supabase:**
   - `CREATE_EC_CONFIG_VIEW.sql`
   - `CREATE_RPC_ACTIVATE_AUTO_EC.sql`

2. **✅ Testar Frontend:**
   - Salvar parâmetros → Verificar se salva em `ec_config_view`
   - Ativar Auto EC → Verificar se RPC retorna config

3. **⚠️ Implementar ESP32:**
   - Criar função `fetchECConfig()` em `SupabaseClient.cpp`
   - Chamar RPC periodicamente
   - Parsear e usar config

---

## 📚 **DOCUMENTAÇÃO RELACIONADA**

- `CREATE_EC_CONFIG_VIEW.sql` - Cria tabela view
- `CREATE_RPC_ACTIVATE_AUTO_EC.sql` - Cria função RPC
- `RESUMO_IMPLEMENTACAO_DISTRIBUTION.md` - Resumo completo
- `MAPEAMENTO_COMPLETO_ESP32_SUPABASE.md` - Padrão de comunicação ESP32

---

## 🎉 **RESUMO FINAL**

**SIM! Trabalhamos com 3 funções em 3 lugares:**

1. **🔵 RPC na BD** → Lock + ativação + retorno
2. **🟢 POST na API** → Salvar parâmetros
3. **🟡 Fetch no ESP32** → Obter config para usar

**Cada uma tem seu papel específico e trabalham juntas!** 🚀

# 🔍 DIAGNÓSTICO: Dados dos Sensores Não Atualizam

## 📋 **CHECKLIST DE VERIFICAÇÃO:**

### **1. ESP32 - Verificar Envio de Dados**

#### **A. Verificar se está chamando `sendSensorDataToSupabase()`**
```cpp
// Em HydroSystemCore.cpp, linha 172:
if (now - lastSensorSend >= SENSOR_SEND_INTERVAL) {  // 30 segundos
    sendSensorDataToSupabase();
    lastSensorSend = now;
}
```

**Verificar no Serial Monitor:**
- ✅ Deve aparecer: `"📤 Dados ambientais enviados ao Supabase"`
- ✅ Deve aparecer: `"📤 Dados hidropônicos enviados ao Supabase"`
- ❌ Se aparecer: `"❌ Temperatura inválida"` → Valores fora dos limites
- ❌ Se não aparecer nada → Função não está sendo chamada

#### **B. Verificar Condições de Bloqueio**
```cpp
// Em sendSensorDataToSupabase(), linha 651:
if (!supabaseConnected || !hasEnoughMemoryForHTTPS()) {
    return;  // ❌ BLOQUEADO
}
```

**Possíveis causas:**
- ❌ `supabaseConnected = false` → WiFi desconectado ou Supabase não inicializado
- ❌ `hasEnoughMemoryForHTTPS() = false` → Memória insuficiente (< 30KB)

#### **C. Verificar Validações de Valores**
```cpp
// Em SupabaseClient.cpp, linhas 308-342:
// Validações que podem bloquear envio:
- Temperatura: MIN_TEMP a MAX_TEMP (verificar Config.h)
- pH: MIN_PH a MAX_PH (0-14)
- TDS: MIN_TDS a MAX_TDS (0-5000)
```

**Se valores estiverem fora dos limites:**
- ❌ Dados não são enviados
- ❌ Mensagem no Serial: `"❌ Temperatura inválida para Supabase"`

---

### **2. SUPABASE - Verificar Recepção de Dados**

#### **A. Verificar Tabelas**
```sql
-- Verificar últimos dados recebidos:
SELECT * FROM hydro_measurements 
ORDER BY created_at DESC 
LIMIT 5;

SELECT * FROM environment_data 
ORDER BY created_at DESC 
LIMIT 5;
```

**Se não houver dados recentes:**
- ❌ ESP32 não está enviando
- ❌ Erro na inserção (verificar logs do Supabase)

#### **B. Verificar Constraints**
```sql
-- Verificar se há constraints que podem bloquear:
SELECT 
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('hydro_measurements', 'environment_data');
```

---

### **3. FRONTEND - Verificar Busca de Dados**

#### **A. Verificar API Routes**
```typescript
// /api/hydro-data/route.ts
// /api/environment-data/route.ts
```

**Testar manualmente:**
```bash
curl http://localhost:3000/api/hydro-data
curl http://localhost:3000/api/environment-data
```

#### **B. Verificar Dashboard Polling**
```typescript
// Em dashboard/page.tsx, linha 59:
const interval = setInterval(fetchData, 30000); // ✅ 30 segundos
```

**Verificar no Console do Navegador:**
- ✅ Deve aparecer requisições a cada 30s
- ❌ Se não aparecer → Polling não está funcionando

#### **C. Verificar Erro de Sintaxe**
```typescript
// ❌ PROBLEMA ENCONTRADO:
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 30000);
  return () => clearInterval(interval);
}, []); // ✅ Array de dependências está correto
```

---

## 🔧 **SOLUÇÕES:**

### **Solução 1: Verificar Valores dos Sensores**

**No ESP32, adicionar logs:**
```cpp
void HydroSystemCore::sendSensorDataToSupabase() {
    Serial.println("🔍 [DEBUG] Tentando enviar dados dos sensores...");
    Serial.printf("   supabaseConnected: %s\n", supabaseConnected ? "SIM" : "NÃO");
    Serial.printf("   hasEnoughMemory: %s\n", hasEnoughMemoryForHTTPS() ? "SIM" : "NÃO");
    Serial.printf("   supabase.isReady(): %s\n", supabase.isReady() ? "SIM" : "NÃO");
    
    // ... resto do código ...
    
    Serial.printf("   Temp: %.2f, pH: %.2f, TDS: %.2f\n", 
        hydroData.temperature, hydroData.ph, hydroData.tds);
}
```

### **Solução 2: Verificar Limites em Config.h**

**Verificar se os limites estão corretos:**
```cpp
#define MIN_TEMP -10.0
#define MAX_TEMP 100.0
#define MIN_PH 0.0
#define MAX_PH 14.0
#define MIN_TDS 0.0
#define MAX_TDS 5000.0
```

### **Solução 3: Adicionar Logs no Frontend**

**No dashboard/page.tsx:**
```typescript
const fetchData = async () => {
  console.log('🔄 [DASHBOARD] Buscando dados...');
  try {
    const hydroRes = await fetch('/api/hydro-data');
    const hydroData = await hydroRes.json();
    console.log('✅ [DASHBOARD] Dados hidropônicos:', hydroData);
    
    // ... resto do código ...
  } catch (err) {
    console.error('❌ [DASHBOARD] Erro:', err);
  }
};
```

---

## 🎯 **PRÓXIMOS PASSOS:**

1. ✅ Verificar Serial Monitor do ESP32
2. ✅ Verificar Console do Navegador
3. ✅ Verificar Tabelas no Supabase
4. ✅ Adicionar logs de debug
5. ✅ Verificar limites de validação



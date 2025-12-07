# 🔄 Estratégia de Redundância Distributiva: NVS como Fallback

## 🎯 **CONCEITO**

**Persistência Bruta Baseada em Redundância Distributiva** - O ESP32 mantém uma cópia local (NVS) dos parâmetros críticos de EC como fallback quando o Supabase está offline ou indisponível.

---

## 🏗️ **ARQUITETURA DE REDUNDÂNCIA SIMPLIFICADA**

```
┌─────────────────────────────────────────────────────────────┐
│                    FONTE PRIMÁRIA                            │
│                    SUPABASE (Cloud)                          │
│  └─ ec_config_view (fonte de verdade)                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ POST /rpc/activate_auto_ec
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 (Edge Device)                       │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │  NVS (ÚNICA FONTE DE VERDADE)          │                │
│  │  └─ Parâmetros básicos                 │                │
│  │     (Internet → NVS diretamente)        │                │
│  └────────────────────────────────────────┘                │
│                         │                                    │
│                         │ Controlador sempre lê de NVS      │
│                         ▼                                    │
│  ┌────────────────────────────────────────┐                │
│  │  ECController                          │                │
│  │  └─ Lê de NVS e executa                │                │
│  └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 **FLUXO SIMPLIFICADO: INTERNET → NVS → CONTROLADOR**

### **🎯 PRINCÍPIO: NVS É A ÚNICA FONTE DE VERDADE NO ESP32**

**El controlador siempre lee de NVS. Internet solo actualiza NVS.**

### **Cenário 1: Supabase Online (Normal)**

```
1. ESP32 busca do Supabase
   └─ POST /rpc/activate_auto_ec
   
2. Supabase retorna config completa
   └─ Parâmetros + distribution
   
3. ESP32 parse JSON e salva DIRETAMENTE em NVS
   └─ saveECConfigToNVS(config)
   └─ ✅ APENAS parâmetros básicos (9 campos)
   └─ ❌ NÃO salva distribution (só usa em tempo real se vier do Supabase)
   
4. ESP32 carrega de NVS (única fonte)
   └─ loadECConfigFromNVS(config)
   
5. ESP32 usa config do NVS
   └─ Atualiza ECController
   └─ Executa dosagem
```

### **Cenário 2: Supabase Offline (Fallback)**

```
1. ESP32 tenta buscar do Supabase
   └─ POST /rpc/activate_auto_ec
   └─ ❌ FALHA (timeout/erro HTTP)
   
2. ESP32 detecta falha
   └─ Log: "Supabase offline, usando NVS existente"
   
3. ESP32 carrega de NVS (já tem dados salvos)
   └─ loadECConfigFromNVS(config)
   └─ Carrega última config válida
   
4. ESP32 usa config do NVS
   └─ Atualiza ECController
   └─ Calcula localmente (sem distribution)
   └─ Continua funcionando offline
```

**✅ VENTAJA:** Flujo más simple, menos código, más robusto. El controlador siempre hace lo mismo: leer de NVS.

---

## 💾 **O QUE É SALVO EM NVS (Redundância)**

### **✅ SALVAR (Parâmetros Básicos):**

```cpp
// Estrutura mínima para redundância
struct ECConfigNVS {
    double base_dose;        // ✅ Crítico para cálculo
    double flow_rate;        // ✅ Crítico para cálculo
    double volume;           // ✅ Crítico para cálculo
    double total_ml;         // ✅ Crítico para cálculo
    double kp;               // ✅ Crítico para controle
    double ec_setpoint;      // ✅ Crítico para controle
    bool auto_enabled;       // ✅ Estado do sistema
    int intervalo_auto_ec;   // ✅ Intervalo de verificação
    unsigned long tempo_recirculacao; // ✅ Tempo de recirculação
};
```

**Tamanho aproximado:** ~50 bytes

### **❌ NÃO SALVAR EM NVS (Muito Grande ou Dinâmico):**

```cpp
// ❌ NÃO salvar em NVS:
- nutrients[] array completo     // Muito grande (~200 bytes)
- distribution JSONB completo    // ❌ NÃO SE GUARDA - Só usa em tempo real
- Timestamps (created_at, etc)   // Não crítico para funcionamento
```

**Razão:** NVS tem espaço limitado (~512KB total), e esses dados são grandes e podem mudar frequentemente.

---

## 🔧 **IMPLEMENTAÇÃO SIMPLIFICADA: INTERNET → NVS → CONTROLADOR**

### **🎯 CÓDIGO SIMPLIFICADO (Mejor Enfoque):**

```cpp
void HydroControl::checkAutoEC() {
    if (!autoECEnabled) return;
    
    // Verificar intervalo
    unsigned long currentMillis = millis();
    unsigned long checkInterval = autoECIntervalSeconds > 0 ? 
        (autoECIntervalSeconds * 1000) : EC_CHECK_INTERVAL;
    
    if (currentMillis - lastECCheck < checkInterval) {
        return;
    }
    
    lastECCheck = currentMillis;
    
    // ✅ PASSO 1: TENTAR ATUALIZAR NVS DO SUPABASE (si hay internet)
    if (supabaseClient && supabaseClient->isConnected()) {
        ECConfig tempConfig;
        if (supabaseClient->getECConfigFromSupabase(tempConfig)) {
            // ✅ INTERNET → NVS (guardar directamente)
            saveECConfigToNVS(tempConfig);
            Serial.println("✅ [AUTO EC] NVS actualizado desde Supabase");
        } else {
            Serial.println("⚠️ [AUTO EC] Supabase offline, usando NVS existente");
        }
    }
    
    // ✅ PASSO 2: CONTROLADOR SIEMPRE LEE DE NVS (única fuente)
    ECConfig config;
    if (!loadECConfigFromNVS(config)) {
        Serial.println("❌ [AUTO EC] NVS vacío, no hay config disponible");
        return;  // No hay config, no puede continuar
    }
    
    // ✅ PASSO 3: ACTUALIZAR CONTROLLER (siempre desde NVS)
    ecController.setParameters(
        config.base_dose,
        config.flow_rate,
        config.volume,
        config.total_ml
    );
    ecController.setKp(config.kp);
    ecSetpoint = config.ec_setpoint;
    autoECEnabled = config.auto_enabled;
    autoECIntervalSeconds = config.intervalo_auto_ec;
    
    // ✅ PASSO 4: EJECUTAR DOSAGEM
    // Si tenemos distribution del Supabase (en memoria temporal), usarla
    // Si no, calcular localmente
    if (config.hasDistribution) {
        executeWebDosage(config.distribution, config.distribution.intervalo);
    } else {
        // Calcular localmente (fallback cuando no hay distribution)
        if (ecController.needsAdjustment(ecSetpoint, ec, 50.0)) {
            float dosageML = ecController.calculateDosage(ecSetpoint, ec);
            if (dosageML > 0.1) {
                startSimpleSequentialDosage(dosageML, ecSetpoint, ec);
            }
        }
    }
}
```

**✅ VENTAJAS DE ESTE ENFOQUE:**
- **Más simple:** Una sola fuente de verdad (NVS)
- **Más robusto:** Controlador siempre hace lo mismo (leer de NVS)
- **Menos código:** No necesitas mantener config en RAM
- **Más consistente:** Siempre lee de NVS, sin excepciones

---

## 📊 **VANTAGENS DA REDUNDÂNCIA DISTRIBUTIVA**

### **1. Resiliência:**
- ✅ ESP32 continua funcionando mesmo sem internet
- ✅ Não perde configuração após reboot
- ✅ Funciona em modo offline

### **2. Performance:**
- ✅ Não precisa buscar do Supabase a cada verificação
- ✅ Busca apenas quando intervalo expira
- ✅ NVS é muito rápido (acesso local)

### **3. Confiabilidade:**
- ✅ Redundância: 2 fontes (Supabase + NVS)
- ✅ Fallback automático
- ✅ Última config válida sempre disponível

### **4. Eficiência:**
- ✅ Salva apenas parâmetros críticos (~50 bytes)
- ✅ Não salva dados grandes (distribution, nutrients)
- ✅ Atualiza NVS apenas após sucesso do Supabase

---

## 🔄 **ESTRATÉGIA DE SINCRONIZAÇÃO SIMPLIFICADA**

### **Regra de Ouro (Simplificada):**

```
SIEMPRE que buscar del Supabase con ÉXITO:
  └─ Guardar DIRECTAMENTE en NVS (Internet → NVS)

SIEMPRE que el controlador necesite config:
  └─ Leer de NVS (única fuente de verdad)

NVS es la única fuente de verdad en el ESP32:
  └─ Internet solo actualiza NVS
  └─ Controlador siempre lee de NVS
```

### **Fluxo de Sincronização Simplificado:**

```
┌─────────────────────────────────────────┐
│  ESP32 Inicia                           │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Intentar actualizar NVS desde Supabase │
└─────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐       ┌─────────┐
│ ÉXITO   │       │  FALLA  │
│         │       │         │
│ Internet│       │ NVS ya   │
│ → NVS   │       │ tiene    │
│         │       │ datos    │
└─────────┘       └─────────┘
    │                   │
    └─────────┬─────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Controlador lee de NVS (siempre)       │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Controlador ejecuta dosagem            │
└─────────────────────────────────────────┘
```

**✅ SIMPLICIDAD:** Un solo flujo, una sola fuente (NVS), menos código, más robusto.

---

## 🎯 **CARACTERÍSTICAS DA PERSISTÊNCIA BRUTA**

### **O que significa "Persistência Bruta"?**

1. **Simples e Direta:**
   - Não usa criptografia
   - Não usa compressão
   - Apenas salva valores brutos

2. **Baseada em Redundância:**
   - 2 cópias dos dados (Supabase + NVS)
   - Se uma falha, usa a outra
   - Distributiva (cloud + edge)

3. **Foco em Funcionalidade:**
   - Prioriza funcionamento sobre otimização
   - Garante que sistema sempre funcione
   - Fallback automático

---

## 📋 **RESUMO DA ESTRATÉGIA SIMPLIFICADA**

### **✅ SÍ, ES EXACTAMENTE ESO! (Mejor Enfoque)**

**Flujo Simplificado:**
1. **Internet → NVS:** Cuando hay conexión, actualizar NVS directamente
2. **NVS → Controlador:** El controlador siempre lee de NVS (única fuente)

**El controlador siempre hace lo mismo:**
- ✅ Leer de NVS (única fuente de verdad en ESP32)
- ✅ No importa si viene de Internet o ya está en NVS
- ✅ Más simple, más robusto, menos código

**Método de Persistência:**
- ✅ **Bruta:** Valores directos, sin procesamiento complejo
- ✅ **Redundância Distributiva:** 2 fuentes (Cloud + Edge)
- ✅ **Fallback Automático:** Transparente para el usuario
- ✅ **Simplificado:** Internet actualiza NVS, controlador lee de NVS

**Vantagens:**
- ✅ Sistema siempre funcional
- ✅ Resiliência a falhas de rede
- ✅ Performance (NVS é rápido)
- ✅ **Simplicidad máxima:** Un solo flujo, una sola fuente
- ✅ **Menos código:** No necesitas mantener config en RAM
- ✅ **Más robusto:** Controlador siempre hace lo mismo

---

**Data:** 2025-01-12  
**Status:** ✅ **ESTRATÉGIA DE REDUNDÂNCIA DOCUMENTADA**

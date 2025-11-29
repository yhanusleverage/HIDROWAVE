# 🚀 PLANO DE INTEGRAÇÃO COMPLETA - MVP HIDROWAVE

## 📋 FEEDBACK E ANÁLISE DO SISTEMA ATUAL

### ✅ **PONTOS FORTES IDENTIFICADOS**

1. **Arquitetura bem estruturada:**
   - Decision Engine completo com suporte a condições complexas
   - ESP-NOW Master-Slave funcional com ACKs e retry
   - Integração Supabase já implementada
   - Sistema de autenticação de usuários pronto

2. **Componentes existentes:**
   - `DecisionEngine` - Motor de decisões robusto
   - `MasterSlaveManager` - Gerenciamento ESP-NOW bidirecional
   - `RelayController` - Controle PCF8574 (16 relés)
   - `ESPNowController` - Comunicação ESP-NOW completa
   - Schema Supabase completo e normalizado

3. **Funcionalidades avançadas:**
   - Sistema de retry automático
   - Handshake bidirecional
   - Monitoramento de status online/offline
   - Callbacks para integração

---

## 🎯 ARQUITETURA PROPOSTA - MVP COMPLETO

### **FLUXO DE DADOS COMPLETO**

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERFACE WEB (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │  Automação   │  │  Dispositivos│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                          │                                     │
│                    ┌─────▼─────┐                               │
│                    │  Supabase │                               │
│                    │  Database │                               │
│                    └─────┬─────┘                               │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           │ (HTTP/WebSocket)
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│              ESP32 MASTER (HIDROWAVE)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Decision Engine Integration                              │  │
│  │  - Carrega regras do Supabase (decision_rules)           │  │
│  │  - Avalia condições em tempo real                        │  │
│  │  - Executa ações locais (PCF8574) e remotas (ESP-NOW)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐           │
│  │  RelayController │         │ MasterSlaveManager│           │
│  │  (PCF8574 Local) │         │  (ESP-NOW)        │           │
│  │                  │         │                   │           │
│  │  Relés 0-7:      │         │  Gerencia Slaves: │           │
│  │  - pH+           │         │  - Descoberta     │           │
│  │  - pH-           │         │  - Handshake      │           │
│  │  - Grow          │         │  - Comandos       │           │
│  │  - Micro         │         │  - Status         │           │
│  │  - Bloom         │         │  - ACKs/Retry     │           │
│  │  - Bomba Principal│        │                   │           │
│  │  - Luz UV        │         │                   │           │
│  │  - Aerador       │         │                   │           │
│  └──────────────────┘         └─────────┬─────────┘           │
│                                          │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │ ESP-NOW Protocol
                                           │
┌──────────────────────────────────────────▼──────────────────────┐
│              ESP32 SLAVE (RelayBox - Dosagem)                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  RelayController (PCF8574)                                │ │
│  │  - Relés 0-7: Dosagem de nutrientes                       │ │
│  │  - Relés 8-15: Dispositivos de carga (bombas, etc)       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  - Recebe comandos via ESP-NOW                                 │
│  - Envia ACKs de confirmação                                   │
│  - Reporta status dos relés                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 COMPONENTES DE INTEGRAÇÃO NECESSÁRIOS

### **1. DECISION ENGINE INTEGRATION (ESP32 Master)**

**Arquivo:** `src/DecisionEngineIntegration.cpp`

```cpp
// Responsabilidades:
// - Sincronizar regras do Supabase (decision_rules)
// - Avaliar condições em tempo real
// - Executar ações locais (PCF8574) e remotas (ESP-NOW)
// - Registrar execuções no Supabase (rule_executions)
// - Enviar alertas (system_alerts)
```

**Fluxo:**
1. Carregar regras do Supabase a cada 30s
2. Avaliar condições a cada 5s
3. Executar ações quando condições atendidas
4. Registrar execuções no Supabase
5. Atualizar `device_status` com estatísticas

---

### **2. WEB API - COMANDOS PARA ESP32**

**Arquivo:** `src/app/api/decision-engine/route.ts`

```typescript
// Endpoints:
// POST /api/decision-engine/execute-rule
// POST /api/decision-engine/force-evaluation
// GET /api/decision-engine/status
// POST /api/decision-engine/command-relay
```

**Funcionalidades:**
- Enviar comandos diretos para ESP32 Master
- Forçar avaliação de regras
- Obter status do Decision Engine
- Comandos manuais de relés (local e remoto)

---

### **3. SUPABASE REALTIME SYNC**

**Arquivo:** `src/lib/realtime-sync.ts`

```typescript
// Sincronização em tempo real:
// - decision_rules (quando criadas/atualizadas no web)
// - relay_commands (comandos pendentes para ESP32)
// - device_status (status dos dispositivos)
// - system_alerts (alertas em tempo real)
```

---

### **4. MÉTODOS DE AUTOMAÇÃO HIDROPÔNICA**

**Baseado em estudos e práticas padrão:**

#### **A. Controle de pH**
- **Faixa ideal:** 5.5 - 6.5
- **Ação:** Dosagem proporcional de pH+ ou pH-
- **Segurança:** Não dosar se nível de água baixo

#### **B. Controle de TDS/EC**
- **Faixa ideal:** 800-1200 ppm (vegetativo), 1200-1800 ppm (floração)
- **Ação:** Dosagem de nutrientes (Grow/Micro/Bloom)
- **Cálculo:** ml/L baseado em volume do reservatório

#### **C. Controle de Temperatura**
- **Água:** 18-26°C
- **Ambiente:** 20-28°C
- **Ações:** Chiller (água), Ventilação (ambiente)

#### **D. Ciclos de Irrigação**
- **Frequência:** A cada 2-4 horas
- **Duração:** 5-15 minutos
- **Condição:** Nível de água OK

#### **E. Fotoperíodo**
- **Vegetativo:** 18h luz / 6h escuro
- **Floração:** 12h luz / 12h escuro
- **Ação:** Controle de luz via relé

---

## 📦 IMPLEMENTAÇÃO - FASE POR FASE

### **FASE 1: INTEGRAÇÃO DECISION ENGINE ↔ SUPABASE** ⏱️ 2-3 dias

**Objetivo:** ESP32 Master carrega e executa regras do Supabase

**Tarefas:**
1. ✅ Criar `DecisionEngineIntegration.cpp`
2. ✅ Implementar sincronização de regras (polling a cada 30s)
3. ✅ Converter `DecisionRule` (Supabase) → `DecisionRule` (ESP32)
4. ✅ Executar regras e registrar no Supabase
5. ✅ Testar com regras simples

**Arquivos a criar/modificar:**
- `src/DecisionEngineIntegration.cpp` (novo)
- `include/DecisionEngineIntegration.h` (novo)
- `src/main.cpp` (integrar)

---

### **FASE 2: COMUNICAÇÃO WEB → ESP32** ⏱️ 2 dias

**Objetivo:** Interface web envia comandos para ESP32 Master

**Tarefas:**
1. ✅ Criar API endpoint `/api/decision-engine/command`
2. ✅ Implementar WebSocket ou HTTP polling no ESP32
3. ✅ Processar comandos de `relay_commands` (Supabase)
4. ✅ Atualizar status de comandos (pending → sent → completed)
5. ✅ Testar fluxo completo

**Arquivos a criar/modificar:**
- `src/app/api/decision-engine/route.ts` (novo)
- `src/APIClient.cpp` (modificar para polling de comandos)
- `include/APIClient.h` (adicionar métodos)

---

### **FASE 3: ESP-NOW SLAVE INTEGRATION** ⏱️ 2-3 dias

**Objetivo:** ESP32 Master controla relés remotos via ESP-NOW

**Tarefas:**
1. ✅ Integrar `DecisionEngine` com `MasterSlaveManager`
2. ✅ Mapear ações remotas (target_device_id)
3. ✅ Enviar comandos ESP-NOW quando regra executar
4. ✅ Receber ACKs e atualizar status
5. ✅ Testar com ESP32 Slave real

**Arquivos a modificar:**
- `src/DecisionEngine.cpp` (integrar MasterSlaveManager)
- `src/DecisionEngineIntegration.cpp` (suporte a ações remotas)

---

### **FASE 4: REGRAS PADRÃO HIDROPÔNICAS** ⏱️ 1-2 dias

**Objetivo:** Criar regras de automação baseadas em métodos padrão

**Tarefas:**
1. ✅ Regra: Controle de pH automático
2. ✅ Regra: Dosagem de nutrientes por TDS
3. ✅ Regra: Ciclo de irrigação programado
4. ✅ Regra: Controle de temperatura (água e ambiente)
5. ✅ Regra: Fotoperíodo automático
6. ✅ Regra: Segurança (nível de água, emergência)

**Arquivos a criar:**
- `data/default-hydroponic-rules.json` (novo)
- Função para carregar regras padrão

---

### **FASE 5: INTERFACE WEB - MONITORAMENTO** ⏱️ 2-3 dias

**Objetivo:** Dashboard mostra status em tempo real

**Tarefas:**
1. ✅ Exibir regras ativas do Supabase
2. ✅ Mostrar status de execuções (rule_executions)
3. ✅ Alertas em tempo real (system_alerts)
4. ✅ Status dos dispositivos (device_status)
5. ✅ Histórico de comandos (relay_commands)

**Arquivos a modificar:**
- `src/app/dashboard/page.tsx` (adicionar seções)
- `src/app/automacao/page.tsx` (mostrar execuções)
- `src/lib/realtime-sync.ts` (novo)

---

## 🎨 ESTRUTURA DE DADOS

### **DECISION RULE (Supabase → ESP32)**

```json
{
  "id": "uuid",
  "device_id": "ESP32_MASTER_001",
  "rule_id": "RULE_PH_CONTROL",
  "rule_name": "Controle Automático de pH",
  "rule_description": "Ajusta pH quando fora da faixa ideal",
  "rule_json": {
    "conditions": [
      {
        "sensor": "ph",
        "operator": "<",
        "value": 5.5
      }
    ],
    "actions": [
      {
        "relay_id": 1,
        "relay_name": "pH+",
        "duration": 5,
        "target_device": "local"  // ou "SLAVE_001"
      }
    ],
    "delay_before_execution": 0,
    "interval_between_executions": 300,
    "priority": 80
  },
  "enabled": true,
  "priority": 80
}
```

### **RELAY COMMAND (Web → ESP32)**

```json
{
  "device_id": "ESP32_MASTER_001",
  "relay_number": 5,
  "action": "on",
  "duration_seconds": 60,
  "status": "pending",
  "created_by": "user@email.com",
  "triggered_by": "manual"
}
```

---

## 🔐 SEGURANÇA E VALIDAÇÕES

### **1. Validações de Segurança**
- ✅ Verificar nível de água antes de ativar bombas
- ✅ Limite de execuções por hora
- ✅ Cooldown entre execuções
- ✅ Verificação de emergência (emergency_mode)
- ✅ Modo dry-run para testes

### **2. Interlocks**
- ✅ Não dosar pH se bomba principal desligada
- ✅ Não ligar chiller se nível baixo
- ✅ Não executar múltiplas ações simultâneas no mesmo relé

---

## 📊 MÉTRICAS E MONITORAMENTO

### **Telemetria (engine_telemetry)**
- Execuções de regras por hora
- Tempo médio de avaliação
- Uso de memória
- Alertas enviados
- Bloqueios de segurança

### **Dashboard Web**
- Regras ativas/inativas
- Últimas execuções
- Status dos dispositivos
- Alertas não reconhecidos
- Estatísticas de uso

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

### **1. Implementar DecisionEngineIntegration** (PRIORIDADE ALTA)
```cpp
// src/DecisionEngineIntegration.cpp
class DecisionEngineIntegration {
    // Carregar regras do Supabase
    // Converter formato
    // Executar via DecisionEngine
    // Registrar execuções
}
```

### **2. Criar API de Comandos** (PRIORIDADE ALTA)
```typescript
// src/app/api/decision-engine/route.ts
// Endpoints para comunicação Web → ESP32
```

### **3. Integrar ESP-NOW no Decision Engine** (PRIORIDADE MÉDIA)
```cpp
// Modificar DecisionEngine para suportar ações remotas
// target_device_id: "" = local, "SLAVE_001" = remoto
```

### **4. Criar Regras Padrão** (PRIORIDADE MÉDIA)
```json
// data/default-hydroponic-rules.json
// Regras baseadas em métodos padrão de hidroponia
```

---

## 📚 REFERÊNCIAS E MÉTODOS

### **Métodos de Automação Hidropônica Padrão:**

1. **Nutrient Film Technique (NFT)**
   - Fluxo contínuo de solução
   - pH: 5.5-6.5
   - EC: 1.2-2.0 mS/cm

2. **Deep Water Culture (DWC)**
   - Oxigenação constante
   - Temperatura: 18-22°C
   - TDS: 800-1200 ppm

3. **Ebb and Flow (Flood & Drain)**
   - Ciclos de irrigação
   - 4-6 vezes por dia
   - Duração: 15-30 min

4. **Drip System**
   - Dosagem precisa
   - Controle de vazão
   - Monitoramento de drenagem

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] ESP32 Master carrega regras do Supabase
- [ ] Decision Engine avalia condições corretamente
- [ ] Ações locais (PCF8574) funcionam
- [ ] Ações remotas (ESP-NOW) funcionam
- [ ] Execuções são registradas no Supabase
- [ ] Interface web cria regras
- [ ] Interface web envia comandos manuais
- [ ] Alertas são gerados e exibidos
- [ ] Sistema de segurança funciona
- [ ] Retry automático funciona
- [ ] Status online/offline é atualizado

---

## 🎯 RESULTADO ESPERADO

**MVP Funcional Completo:**
- ✅ Interface web cria regras de automação
- ✅ ESP32 Master executa regras automaticamente
- ✅ Controle local (PCF8574) e remoto (ESP-NOW)
- ✅ Monitoramento em tempo real
- ✅ Sistema de segurança robusto
- ✅ Baseado em métodos padrão de hidroponia

---

**Pronto para implementação! 🚀**

Este plano integra todos os componentes existentes em um sistema completo e funcional, seguindo métodos procedurais padrão de automação hidropônica.

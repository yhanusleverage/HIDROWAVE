# 🔍 ANÁLISE DE ALINHAMENTO - DeviceControlPanel.tsx

## ✅ **O QUE ESTÁ CORRETO**

### 1. **DeviceStatus Interface**
✅ **PERFEITO** - Todos os campos do schema `device_status` estão presentes:
- `device_id`, `device_name`, `location`, `is_online`, `last_seen`
- `ip_address`, `mac_address`, `firmware_version`
- `decision_engine_enabled`, `dry_run_mode`, `emergency_mode`
- `relay_states`, `total_rules`, `total_evaluations`
- `user_email`, `registered_at`

### 2. **Estrutura de Tabs**
✅ **BOM** - Organização lógica:
- Status: Mostra dados do `device_status`
- Regras: Preparado para `decision_rules`
- Relés Locais: Preparado para PCF8574 (HydroControl)
- Slaves ESP-NOW: Preparado para controle remoto

### 3. **Menus Colapsáveis Recursivos**
✅ **EXCELENTE** - Implementação correta:
- Slaves são colapsáveis
- Relés dentro de slaves são colapsáveis
- UX intuitiva

---

## ⚠️ **O QUE PRECISA SER AJUSTADO**

### 1. **Slaves ESP-NOW - Dados Hardcoded**
❌ **PROBLEMA**: Slaves estão hardcoded no componente
```typescript
const [slaves, setSlaves] = useState<SlaveDevice[]>([
  {
    macAddress: 'AA:BB:CC:DD:EE:01',
    name: 'ESP32 Slave - Dosagem',
    // ...
  },
]);
```

✅ **SOLUÇÃO**: 
- Slaves devem vir do `device_status` (campo `mac_address` de outros dispositivos)
- OU criar tabela `esp_now_slaves` no Supabase
- OU usar `MasterSlaveManager.getAllTrustedSlaves()` via API

### 2. **Comandos ESP-NOW - Não Salvam no Supabase**
❌ **PROBLEMA**: Comandos não criam registro em `relay_commands`
```typescript
onClick={() => {
  // TODO: Enviar comando ESP-NOW para ligar relé
  console.log(`Ligar relé ${relay.id} do slave ${slave.macAddress}`);
}}
```

✅ **SOLUÇÃO**: 
- Criar registro em `relay_commands` com:
  - `device_id`: MAC do slave ou device_id do master
  - `relay_number`: ID do relé
  - `action`: 'on' ou 'off'
  - `duration_seconds`: do schedule
  - `status`: 'pending'
  - `triggered_by`: 'manual' ou 'automation'
  - `target_device_id`: MAC do slave (novo campo ou usar `rule_id`)

### 3. **Schedule de Automação - Não Persiste**
❌ **PROBLEMA**: Schedule não é salvo no Supabase
```typescript
const updateRelaySchedule = (...) => {
  // Apenas atualiza estado local
  setSlaves(prev => ...);
}
```

✅ **SOLUÇÃO**: 
- Criar regra em `decision_rules` com:
  - `rule_json.conditions`: `[{ sensor: 'time', operator: '==', value: intervalMinutes }]`
  - `rule_json.actions`: `[{ relay_id, relay_name, duration: durationMinutes }]`
  - `rule_json.interval_between_executions`: intervalMinutes * 60
  - `target_device_id`: MAC do slave (dentro de `rule_json.actions`)

### 4. **Falta Integração com MasterSlaveManager**
❌ **PROBLEMA**: Não há API para comunicar com ESP32 Master

✅ **SOLUÇÃO**: 
- Criar API `/api/esp-now/command` que:
  1. Cria registro em `relay_commands`
  2. Envia comando para ESP32 Master via HTTP/WebSocket
  3. ESP32 Master envia via ESP-NOW usando `MasterSlaveManager.sendRelayCommandToSlave()`

### 5. **Nomes de Relés - Não Persistem**
❌ **PROBLEMA**: Nomes personalizados não são salvos

✅ **SOLUÇÃO**: 
- Criar tabela `relay_configurations` OU
- Usar campo `relay_states` em `device_status` (JSONB) OU
- Salvar em `decision_rules.rule_json.actions[].relay_name`

---

## 🔧 **AJUSTES NECESSÁRIOS**

### **1. Estrutura de Dados para Slaves**

**Opção A: Usar device_status (RECOMENDADO)**
```typescript
// Buscar dispositivos que são slaves do master atual
const slaves = await supabase
  .from('device_status')
  .select('*')
  .eq('device_type', 'ESP32_SLAVE')
  .eq('user_email', userProfile.email);
```

**Opção B: Criar tabela esp_now_slaves**
```sql
CREATE TABLE esp_now_slaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_device_id text NOT NULL,
  slave_mac_address text NOT NULL,
  slave_name text,
  relay_configurations jsonb,
  created_at timestamptz DEFAULT now()
);
```

### **2. API para Comandos ESP-NOW**

**Criar:** `src/app/api/esp-now/command/route.ts`
```typescript
export async function POST(request: Request) {
  const { masterDeviceId, slaveMacAddress, relayNumber, action, duration } = await request.json();
  
  // 1. Criar relay_command
  const command = await createRelayCommand({
    device_id: masterDeviceId, // ou slaveMacAddress
    relay_number: relayNumber,
    action: action,
    duration_seconds: duration,
    triggered_by: 'manual',
    // Adicionar campo target_device_id ou usar rule_id para MAC
  });
  
  // 2. Enviar para ESP32 Master (HTTP/WebSocket)
  // ESP32 Master processa e envia via ESP-NOW
  
  return NextResponse.json({ success: true, command_id: command.id });
}
```

### **3. Salvar Schedule como Decision Rule**

**Modificar:** `updateRelaySchedule` em DeviceControlPanel
```typescript
const updateRelaySchedule = async (...) => {
  // Criar regra de automação temporal
  const rule: DecisionRule = {
    device_id: device.device_id,
    rule_id: `SCHEDULE_${slaveMac}_${relayId}`,
    rule_name: `Automação: ${relayName}`,
    rule_json: {
      conditions: [
        { sensor: 'time_interval', operator: '==', value: intervalMinutes * 60 }
      ],
      actions: [
        {
          relay_id: relayId,
          relay_name: relayName,
          duration: durationMinutes * 60,
          target_device: slaveMac // MAC do slave
        }
      ],
      interval_between_executions: intervalMinutes * 60,
    },
    enabled: true,
    priority: 50,
  };
  
  await createDecisionRule(rule);
};
```

### **4. Carregar Slaves do Supabase**

**Adicionar:** Função para buscar slaves
```typescript
const loadSlaves = async () => {
  // Buscar slaves conhecidos do master
  // Via API ou Supabase direto
  const response = await fetch(`/api/esp-now/slaves?master=${device.device_id}`);
  const slaves = await response.json();
  setSlaves(slaves);
};
```

---

## 📊 **COMPARAÇÃO COM SCHEMA**

### **device_status** ✅
- Todos os campos usados corretamente
- `relay_states` pode ser usado para mostrar estado dos relés locais

### **relay_commands** ⚠️
- Estrutura correta, mas não está sendo usada para comandos ESP-NOW
- Precisa adicionar campo `target_device_id` ou usar `rule_id` para MAC do slave

### **decision_rules** ⚠️
- Estrutura correta
- Precisa usar para salvar schedules de automação
- `rule_json.actions[].target_device` deve conter MAC do slave

### **Faltando** ❌
- Tabela ou campo para configuração de relés (nomes personalizados)
- API para comunicação Web → ESP32 Master → ESP-NOW Slave

---

## ✅ **RECOMENDAÇÕES FINAIS**

### **PRIORIDADE ALTA:**
1. ✅ Criar API `/api/esp-now/command` para enviar comandos
2. ✅ Salvar comandos em `relay_commands` antes de enviar
3. ✅ Carregar slaves do Supabase (não hardcoded)
4. ✅ Salvar schedules como `decision_rules`

### **PRIORIDADE MÉDIA:**
5. ✅ Salvar nomes de relés personalizados
6. ✅ Mostrar estado real dos relés (via `relay_states` ou polling)
7. ✅ Integrar com tab "Regras" para mostrar regras criadas

### **PRIORIDADE BAIXA:**
8. ✅ Adicionar validações de segurança
9. ✅ Adicionar feedback visual de comandos pendentes
10. ✅ Histórico de comandos executados

---

## 🎯 **CONCLUSÃO**

**O componente está 85% alinhado!**

✅ **Estrutura correta**
✅ **UI/UX excelente**
✅ **Menus colapsáveis funcionais**
⚠️ **Falta integração com Supabase para slaves**
⚠️ **Falta API para comandos ESP-NOW**
⚠️ **Falta persistência de configurações**

**Próximos passos:** Implementar as APIs e integrações faltantes.


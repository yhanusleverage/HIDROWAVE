# 🔄 Migração: Tabela Unificada `relay_states`

## 🎯 Objetivo

Unificar todos os estados de relés em uma única tabela `relay_states`, eliminando a confusão entre:
- `device_status.relay_states` (array para relés locais)
- `slave_relay_states` (tabela separada para slaves)

## ✅ Benefícios

1. **Uma única fonte de verdade** para todos os relés
2. **Consultas mais simples** - não precisa verificar múltiplas tabelas
3. **Sem duplicação de lógica** - mesmo código para locais e slaves
4. **Escalável** - fácil adicionar novos tipos de relés no futuro
5. **Melhor performance** - índices otimizados

## 📋 Estrutura da Nova Tabela

```sql
CREATE TABLE relay_states (
  id BIGINT PRIMARY KEY,
  device_id TEXT NOT NULL,           -- Master ou Slave device_id
  relay_type TEXT NOT NULL,           -- 'local' ou 'slave'
  master_device_id TEXT,              -- NULL para locais, Master ID para slaves
  slave_mac_address TEXT,             -- NULL para locais, MAC para slaves
  relay_number INTEGER NOT NULL,     -- 0-15 (local) ou 0-7 (slave)
  state BOOLEAN NOT NULL,
  has_timer BOOLEAN DEFAULT false,
  remaining_time INTEGER DEFAULT 0,
  relay_name TEXT,
  last_update TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## 🔧 Passos de Migração

### 1. Executar SQL de Migração

```bash
# Executar o arquivo SQL no Supabase
psql -h [HOST] -U [USER] -d [DATABASE] -f SCHEMA_RELAY_STATES_UNIFICADO.sql
```

Ou via Supabase Dashboard:
1. Ir em SQL Editor
2. Colar o conteúdo de `SCHEMA_RELAY_STATES_UNIFICADO.sql`
3. Executar

### 2. Verificar Migração

```sql
-- Verificar quantos relés foram migrados
SELECT relay_type, COUNT(*) 
FROM relay_states 
GROUP BY relay_type;

-- Verificar relés de um Master específico
SELECT * FROM relay_states 
WHERE master_device_id = 'ESP32_HIDRO_XXXXX' 
ORDER BY device_id, relay_number;
```

### 3. Atualizar Código Frontend ✅

**Já atualizado:**
- ✅ `src/lib/automation.ts` - Funções `updateRelayState()` e `getRelayStates()`
- ✅ `src/lib/esp32-api.ts` - Leitura de `relay_states` (com fallback)
- ✅ `src/app/api/esp-now/slaves/route.ts` - Leitura de `relay_states` (com fallback)

### 4. Atualizar Código ESP32 ⚠️

**Pendente:** Atualizar `SupabaseClient.cpp` para escrever em `relay_states`:

```cpp
// ANTES (slave_relay_states):
bool SupabaseClient::updateSlaveRelayState(...) {
  String endpoint = "slave_relay_states";
  // ...
}

// DEPOIS (relay_states):
bool SupabaseClient::updateRelayState(
  const String& deviceId,
  const String& relayType,  // "local" ou "slave"
  const String& masterDeviceId,  // NULL para locais
  const String& slaveMacAddress,  // NULL para locais
  int relayNumber,
  bool state,
  bool hasTimer,
  int remainingTime
) {
  String endpoint = "relay_states";
  // Payload com relay_type, device_id, etc.
}
```

**Arquivos a modificar no ESP32:**
- `src/SupabaseClient.cpp` - Método `updateSlaveRelayState()` → `updateRelayState()`
- `src/MasterSlaveManager.cpp` - Chamadas para `updateRelayState()`
- `src/HydroSystemCore.cpp` - Atualizar estados de relés locais

## 📊 Comparação: Antes vs Depois

### ANTES (Confuso)
```typescript
// Relés locais: device_status.relay_states (array)
const localRelays = device.relay_states; // [true, false, ...]

// Relés slaves: slave_relay_states (tabela separada)
const slaveRelays = await supabase
  .from('slave_relay_states')
  .select('*')
  .eq('master_device_id', masterId);
```

### DEPOIS (Unificado)
```typescript
// Todos os relés: relay_states (tabela unificada)
const allRelays = await supabase
  .from('relay_states')
  .select('*')
  .eq('master_device_id', masterId);

// Filtrar por tipo se necessário
const localRelays = allRelays.filter(r => r.relay_type === 'local');
const slaveRelays = allRelays.filter(r => r.relay_type === 'slave');
```

## 🔄 Compatibilidade

### Fallback Automático

O código frontend inclui fallback automático:
- Tenta ler de `relay_states` primeiro
- Se falhar, tenta `slave_relay_states` (compatibilidade)
- Isso permite migração gradual sem quebrar o sistema

### Tabela `slave_relay_states`

**Recomendação:** Manter por 30 dias após migração completa, depois remover:

```sql
-- Após 30 dias, remover tabela antiga
DROP TABLE IF EXISTS public.slave_relay_states;
```

## ✅ Checklist de Migração

- [x] Criar schema SQL (`SCHEMA_RELAY_STATES_UNIFICADO.sql`)
- [x] Criar funções helper no frontend (`updateRelayState`, `getRelayStates`)
- [x] Atualizar leitura de estados no frontend
- [x] Adicionar fallback para compatibilidade
- [ ] Executar SQL de migração no Supabase
- [ ] Verificar migração de dados
- [ ] Atualizar código ESP32 para escrever em `relay_states`
- [ ] Testar sistema completo
- [ ] Remover `slave_relay_states` após 30 dias

## 🎯 Próximos Passos

1. **Executar SQL no Supabase** - Migrar dados existentes
2. **Atualizar ESP32** - Modificar `SupabaseClient.cpp`
3. **Testar** - Verificar que estados são atualizados corretamente
4. **Monitorar** - Acompanhar por 30 dias
5. **Limpar** - Remover `slave_relay_states` após confirmação

## 📝 Notas

- A migração é **não-destrutiva** - dados antigos são preservados
- O fallback garante que o sistema continue funcionando durante a migração
- A nova estrutura é mais escalável e fácil de manter


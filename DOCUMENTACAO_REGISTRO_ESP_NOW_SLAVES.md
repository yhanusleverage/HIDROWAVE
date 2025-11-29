# 📡 Documentação: Registro de Dispositivos ESP-NOW Slaves no Supabase

## 🎯 Objetivo

Este documento explica como o **ESP32 Master** deve registrar os dispositivos **ESP-NOW Slaves** no Supabase quando os descobre via ESP-NOW.

## 📋 Estrutura Existente

### ✅ O que JÁ EXISTE:

1. **Função RPC no Supabase**: `register_device_with_email`
   - Já está implementada no banco de dados
   - Aceita: `device_id`, `mac_address`, `user_email`, `device_name`, `location`, `ip_address`

2. **Tabela `device_status`**:
   - Campo `device_type` pode ser `'ESP32_HYDROPONIC'` (Master) ou `'ESP32_SLAVE'` (Slave)
   - Campo `user_email` para vincular ao usuário
   - Campo `mac_address` para identificar o dispositivo

3. **API Frontend**: `/api/device/register`
   - Criada para facilitar o registro
   - Aceita `device_type` para diferenciar Master de Slave

## 🔧 Implementação no ESP32 Master

### Quando Registrar um Slave:

O ESP32 Master deve registrar um Slave no Supabase quando:

1. **Descoberta via ESP-NOW**: Quando recebe um pacote ESP-NOW de um novo slave
2. **Primeira Comunicação**: Na primeira vez que se comunica com um slave desconhecido
3. **Reconexão**: Quando um slave que estava offline volta a se comunicar

### Como Registrar:

#### Opção 1: Via API REST (Recomendado)

```cpp
// Exemplo de código C++ para o ESP32 Master
bool registerESPNOWSlave(const String& slaveMac, const String& userEmail) {
  HTTPClient http;
  http.begin("https://mbrwdpqndasborhosewl.supabase.co/rest/v1/rpc/register_device_with_email");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", "SUA_SUPABASE_ANON_KEY");
  http.addHeader("Authorization", "Bearer SUA_SUPABASE_ANON_KEY");

  // Criar device_id único baseado no MAC
  String deviceId = "ESP32_SLAVE_" + slaveMac;
  deviceId.replace(":", "_");

  // Payload JSON
  String payload = "{";
  payload += "\"p_device_id\":\"" + deviceId + "\",";
  payload += "\"p_mac_address\":\"" + slaveMac + "\",";
  payload += "\"p_user_email\":\"" + userEmail + "\",";
  payload += "\"p_device_name\":\"ESP-NOW Slave " + slaveMac + "\",";
  payload += "\"p_location\":\"Estufa\",";
  payload += "\"p_ip_address\":null";
  payload += "}";

  int httpCode = http.POST(payload);
  bool success = (httpCode == 200 || httpCode == 201);

  if (success) {
    // Atualizar device_type para ESP32_SLAVE
    http.end();
    http.begin("https://mbrwdpqndasborhosewl.supabase.co/rest/v1/device_status");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", "SUA_SUPABASE_ANON_KEY");
    http.addHeader("Authorization", "Bearer SUA_SUPABASE_ANON_KEY");
    http.addHeader("Prefer", "return=minimal");

    String updatePayload = "{\"device_type\":\"ESP32_SLAVE\"}";
    String filter = "?device_id=eq." + deviceId;
    http.PATCH(filter, updatePayload);
    http.end();
  } else {
    Serial.println("Erro ao registrar slave: " + String(httpCode));
    http.end();
  }

  return success;
}
```

#### Opção 2: Via API do Frontend (Alternativa)

```cpp
// Usar a API do frontend (mais simples, mas requer que o frontend esteja acessível)
bool registerESPNOWSlave(const String& slaveMac, const String& userEmail) {
  HTTPClient http;
  http.begin("https://seu-dominio.com/api/device/register");
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"device_id\":\"ESP32_SLAVE_" + slaveMac + "\",";
  payload += "\"mac_address\":\"" + slaveMac + "\",";
  payload += "\"user_email\":\"" + userEmail + "\",";
  payload += "\"device_type\":\"ESP32_SLAVE\",";
  payload += "\"device_name\":\"ESP-NOW Slave " + slaveMac + "\"";
  payload += "}";

  int httpCode = http.POST(payload);
  http.end();
  return (httpCode == 200);
}
```

### Fluxo Completo:

```
1. ESP32 Master descobre novo Slave via ESP-NOW
   ↓
2. Master obtém MAC address do Slave
   ↓
3. Master verifica se Slave já está registrado no Supabase
   ↓
4. Se NÃO está registrado:
   - Master chama register_device_with_email
   - device_id = "ESP32_SLAVE_" + MAC (sem :)
   - device_type = "ESP32_SLAVE"
   - user_email = email do usuário (do Master)
   ↓
5. Slave aparece automaticamente no frontend
   ↓
6. Usuário pode nomear os relés do Slave
```

## 🔍 Verificação no Frontend

O frontend busca slaves assim:

```typescript
// Busca dispositivos com:
// - device_type = 'ESP32_SLAVE'
// - user_email = email do usuário logado
const { data } = await supabase
  .from('device_status')
  .select('*')
  .eq('user_email', userEmail)
  .eq('device_type', 'ESP32_SLAVE');
```

## 📝 Checklist de Implementação

### No ESP32 Master:

- [ ] Implementar função para registrar slaves quando descobertos
- [ ] Obter `user_email` do usuário (já deve estar salvo nas Preferences)
- [ ] Chamar `register_device_with_email` com `device_type = 'ESP32_SLAVE'`
- [ ] Atualizar `device_type` após registro (se necessário)
- [ ] Implementar verificação para não registrar o mesmo slave duas vezes
- [ ] Atualizar `last_seen` periodicamente para manter status online

### No Supabase:

- [x] Função `register_device_with_email` existe
- [x] Tabela `device_status` tem campo `device_type`
- [x] Campo `user_email` existe e está sendo usado

### No Frontend:

- [x] API `/api/device/register` criada
- [x] Busca de slaves implementada em `getESPNOWSlaves()`
- [x] Gerenciador de nomes de relés implementado

## 🚀 Próximos Passos

1. **Implementar no ESP32 Master**: Adicionar código para registrar slaves quando descobertos
2. **Testar**: Descobrir um slave e verificar se aparece no frontend
3. **Atualizar last_seen**: Implementar heartbeat para manter status online

## 📌 Notas Importantes

- O `device_id` deve ser único e baseado no MAC address
- O `user_email` deve ser o mesmo do Master (para vincular ao mesmo usuário)
- O `device_type` deve ser `'ESP32_SLAVE'` para aparecer no gerenciador
- O `mac_address` é usado como identificador principal do slave


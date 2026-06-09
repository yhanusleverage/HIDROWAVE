import { supabase } from './supabase';
import {
  isMasterDeviceType,
  isSimulationDevice,
  isSlaveDeviceType,
  isTestEmail,
  isValidMac,
  normalizeEmail,
} from './db-schema';

export interface DecisionRule {
  id?: string;
  device_id: string;
  rule_id: string;
  rule_name: string;
  rule_description?: string;
  rule_json: {
    conditions: Array<{
      sensor: string;
      operator: string;
      value: number;
      logic?: 'AND' | 'OR';
    }>;
    actions: Array<{
      relay_ids: number[];  // ✅ Array de relés (suporta múltiplos)
      relay_names: string[];  // ✅ Array de nomes
      duration: number;  // Duração em segundos
      target_device_id?: string;  // 'local' ou 'ESP-NOW-SLAVE'
      slave_mac_address?: string;  // MAC do slave (se remoto)
    }>;
    circadian_cycle?: {  // ✅ NOVO: Ciclo circadiano (24h = 86400000ms)
      enabled: boolean;
      on_duration_ms: number;  // Tempo ligado (ex: 64800000 = 18h)
      off_duration_ms: number;  // Tempo desligado (ex: 21600000 = 6h)
      total_cycle_ms: number;  // Total do ciclo (deve ser 86400000 = 24h)
      start_time?: string;  // Hora de início (ex: "00:00:00")
      timezone?: string;  // Timezone (ex: "America/Sao_Paulo")
    };
    delay_before_execution?: number;
    interval_between_executions?: number;
    priority?: number;
  };
  enabled: boolean;
  priority: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface DeviceStatus {
  id?: number;
  device_id: string;
  last_seen?: string;
  wifi_rssi?: number;
  free_heap?: number;
  uptime_seconds?: number;
  relay_states?: boolean[];
  is_online?: boolean;
  firmware_version?: string;
  ip_address?: string;
  mac_address?: string;
  device_name?: string;
  location?: string;
  device_type?: string;
  user_email?: string;
  decision_engine_enabled?: boolean;
  dry_run_mode?: boolean;
  emergency_mode?: boolean;
  manual_override?: boolean;
  locked_relays?: number[];
  reboot_count?: number; // ✅ Contador de reinicios/reboots
  total_rules?: number;
  total_evaluations?: number;
  total_actions?: number;
  total_safety_blocks?: number;
  last_evaluation?: string;
  engine_uptime_seconds?: number;
  registered_at?: string;
  registration_source?: string;
  master_device_id?: string; // ✅ ID do dispositivo Master (para slaves)
  status?: 'active' | 'replaced' | 'decommissioned' | 'inactive'; // ✅ Status do dispositivo
  replaced_by_device_id?: string; // ✅ ID do dispositivo que substituiu este
  decommissioned_at?: string; // ✅ Data de descomissionamento
  previous_user_email?: string; // ✅ Email do usuário anterior
  previous_master_device_id?: string; // ✅ ID do Master anterior
  last_reassignment_at?: string; // ✅ Data da última reatribuição
  user_settings?: Record<string, unknown>; // ✅ Configurações do usuário (JSONB)
}

export interface RelayCommand {
  id?: number;
  device_id: string;
  relay_number: number;
  action: 'on' | 'off';
  duration_seconds?: number;
  status?: 'pending' | 'sent' | 'completed' | 'failed';
  created_at?: string;
  sent_at?: string;
  completed_at?: string;
  created_by?: string;
  error_message?: string;
  rule_id?: string;
  rule_name?: string;
  execution_time_ms?: number;
  triggered_by?: string;
  target_device_id?: string; // ✅ ID do dispositivo destino ("" = local, "ESP-NOW-SLAVE" = slave remoto)
  slave_mac_address?: string | null; // ✅ MAC do slave (null se for relé local)
  
  // ✅ FORK: Tipo de comando (bifurcação)
  command_type?: 'manual' | 'rule' | 'peristaltic'; // Tipo de comando
  priority?: number; // ✅ Prioridade numérica (0-100). Maior = mais importante. Default: 50
}

// ✅ Tipos para valores válidos de triggered_by y command_type
export type TriggeredByType = 'manual' | 'automation' | 'rule' | 'peristaltic';
export type CommandType = 'manual' | 'rule' | 'peristaltic';

// ✅ Función helper para validar triggered_by de forma type-safe
function validateTriggeredBy(value: string | undefined): TriggeredByType {
  const validValues: readonly TriggeredByType[] = ['manual', 'automation', 'rule', 'peristaltic'];
  
  // Type guard: verificar si el valor es uno de los válidos
  if (value && validValues.includes(value as TriggeredByType)) {
    return value as TriggeredByType;
  }
  
  // Valor por defecto seguro
  return 'manual';
}

// ✅ Función helper para validar command_type de forma type-safe
function validateCommandType(value: string | undefined): CommandType {
  const validValues: readonly CommandType[] = ['manual', 'rule', 'peristaltic'];
  
  // Type guard: verificar si el valor es uno de los válidos
  if (value && validValues.includes(value as CommandType)) {
    return value as CommandType;
  }
  
  // Valor por defecto seguro
  return 'manual';
}

// ===== DECISION RULES =====

export async function getDecisionRules(deviceId?: string): Promise<DecisionRule[]> {
  let query = supabase.from('decision_rules').select('*').order('priority', { ascending: false });

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching decision rules:', error);
    return [];
  }

  return data || [];
}

export async function createDecisionRule(rule: DecisionRule): Promise<DecisionRule | null> {
  // ✅ Validar campos requeridos
  if (!rule.device_id) {
    console.error('❌ [CREATE ERROR] device_id é obrigatório');
    return null;
  }
  if (!rule.rule_id || rule.rule_id.length < 3) {
    console.error('❌ [CREATE ERROR] rule_id deve ter pelo menos 3 caracteres:', rule.rule_id);
    return null;
  }
  if (!rule.rule_name) {
    console.error('❌ [CREATE ERROR] rule_name é obrigatório');
    return null;
  }
  if (!rule.rule_json) {
    console.error('❌ [CREATE ERROR] rule_json é obrigatório');
    return null;
  }

  // ✅ Limpar campos undefined para evitar problemas com Supabase
  const cleanRule: Partial<DecisionRule> = {
    device_id: rule.device_id,
    rule_id: rule.rule_id,
    rule_name: rule.rule_name,
    rule_description: rule.rule_description || undefined,
    rule_json: rule.rule_json,
    enabled: rule.enabled !== undefined ? rule.enabled : true,
    priority: rule.priority !== undefined ? rule.priority : 50,
    created_by: rule.created_by || 'system',
  };

  console.log('📤 [CREATE] Enviando para Supabase:', {
    device_id: cleanRule.device_id,
    rule_id: cleanRule.rule_id,
    rule_name: cleanRule.rule_name,
    enabled: cleanRule.enabled,
    priority: cleanRule.priority,
    has_rule_json: !!cleanRule.rule_json,
  });

  const { data, error } = await supabase
    .from('decision_rules')
    .insert(cleanRule)
    .select()
    .single();

  if (error) {
    console.error('❌ [CREATE ERROR] Erro do Supabase:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fullError: error,
    });
    console.error('❌ [CREATE ERROR] Regra enviada:', JSON.stringify(cleanRule, null, 2));
    console.error('❌ [CREATE ERROR] rule_json:', JSON.stringify(cleanRule.rule_json, null, 2));
    
    // ✅ Mostrar erro mais detalhado no toast
    const errorMessage = error.message || error.details || error.hint || 'Erro desconhecido ao criar regra';
    throw new Error(errorMessage);
  }

  console.log('✅ [CREATE] Regra criada com sucesso:', data?.rule_id);
  return data;
}

export async function updateDecisionRule(id: string, updates: Partial<DecisionRule>): Promise<boolean> {
  const { error } = await supabase
    .from('decision_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating decision rule:', error);
    return false;
  }

  return true;
}

export async function deleteDecisionRule(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('decision_rules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting decision rule:', error);
    return false;
  }

  return true;
}

// ===== DEVICE STATUS =====

export async function getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
  const { data, error } = await supabase
    .from('device_status')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error) {
    console.error('Error fetching device status:', error);
    return null;
  }

  return data;
}

export async function getUserDevices(userEmail: string): Promise<DeviceStatus[]> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return [];

  const { data, error } = await supabase
    .from('device_status')
    .select('*')
    .eq('user_email', normalizedEmail)
    .order('last_seen', { ascending: false });

  if (error) {
    console.error('❌ Error fetching devices:', error);
    return [];
  }

  return (data || []).filter(
    (device) =>
      isValidMac(device.mac_address) &&
      !isTestEmail(device.user_email || '') &&
      !isSimulationDevice(device)
  );
}

// ✅ Función para descubrir dispositivos disponibles (sin asignar o con email diferente)
export async function discoverAvailableDevices(userEmail: string): Promise<DeviceStatus[]> {
  console.log('🔍 Descobrindo dispositivos disponíveis...');
  console.log('📧 Email do usuário:', userEmail);
  
  // ✅ Buscar TODOS os dispositivos
  const { data, error } = await supabase
    .from('device_status')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) {
    console.error('❌ Error fetching devices:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('⚠️ Nenhum dispositivo encontrado na tabela device_status');
    return [];
  }

  console.log(`📊 Total de dispositivos na tabela: ${data.length}`);

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('email')
    .eq('is_active', true);

  const usersTableAvailable = !usersError;
  const validEmails = new Set(
    (usersData || []).map(u => u.email?.toLowerCase().trim()).filter(Boolean)
  );

  const normalizedUserEmail = userEmail?.toLowerCase().trim() || '';

  // ✅ Filtrar dispositivos disponíveis para adicionar:
  // 1. Tem mac_address válido (obrigatório)
  // 2. NÃO é simulação
  // 3. É Master ou Slave
  // 4. Sem email OU com email diferente do usuário atual OU com email válido
  const availableDevices = data.filter(device => {
    // ✅ OBRIGATÓRIO: Tem mac_address válido
    if (!device.mac_address || device.mac_address.trim() === '' || device.mac_address === '00:00:00:00:00:00') {
      return false;
    }

    // ✅ Excluir dispositivos de simulação/teste
    const deviceId = device.device_id?.toLowerCase() || '';
    const deviceName = device.device_name?.toLowerCase() || '';
    const deviceType = device.device_type?.toLowerCase() || '';
    
    const isSimulation = 
      deviceId.includes('simul') || deviceId.includes('test') || deviceId.includes('mock') || deviceId.includes('demo') ||
      deviceName.includes('simul') || deviceName.includes('test') || deviceName.includes('mock') || deviceName.includes('demo') ||
      deviceType.includes('simul') || deviceType.includes('test') || deviceType.includes('mock') || deviceType.includes('demo');

    if (isSimulation) {
      return false;
    }

    // Filtrar por tipo de dispositivo (Master ou Slave)
    const isMaster = deviceType.includes('hydroponic') || deviceType.includes('master');
    const isSlave = deviceType.includes('slave') || deviceType.includes('relaybox') || deviceType.includes('relay');
    
    if (!isMaster && !isSlave && device.device_type) {
      return false; // Não é Master nem Slave
    }

    // ✅ Se não tem email, está disponível para atribuir
    if (!device.user_email || device.user_email.trim() === '') {
      return true; // Disponível para atribuir
    }

    const deviceEmail = device.user_email.toLowerCase().trim();
    
    // Excluir emails temporários/teste
    if (deviceEmail === 'temp@local.dev' || deviceEmail.includes('test') || deviceEmail.includes('temp')) {
      return false; // Email temporário, não mostrar
    }

    // ✅ CORRIGIDO: NÃO mostrar dispositivos que já pertencem a outros usuários
    // - Se o email é do próprio usuário, não mostrar (já está atribuído a ele)
    if (deviceEmail === normalizedUserEmail) {
      return false; // Já pertence ao usuário atual
    }

    if (usersTableAvailable && validEmails.has(deviceEmail)) {
      return false;
    }

    return false;
  });

  // ✅ Filtrar apenas Masters (device_type exato: "ESP32_HYDROPONIC")
  const masters = availableDevices.filter(d => {
    const deviceType = d.device_type?.toLowerCase() || '';
    return (
      deviceType === 'esp32_hydroponic' ||
      deviceType.includes('hydroponic') ||
      deviceType.includes('master')
    );
  });
  const slaves = availableDevices.filter(d => 
    d.device_type?.toLowerCase().includes('slave') || 
    d.device_type?.toLowerCase().includes('relay')
  );
  const withoutEmail = availableDevices.filter(d => !d.user_email || d.user_email.trim() === '');
  const withValidEmail = availableDevices.filter(d => {
    if (!d.user_email) return false;
    const email = d.user_email.toLowerCase().trim();
    return validEmails.has(email);
  });

  console.log(`✅ Total de dispositivos disponíveis: ${availableDevices.length}`);
  console.log(`   - Masters: ${masters.length}`);
  console.log(`   - Slaves: ${slaves.length}`);
  console.log(`   - Sem email (disponíveis): ${withoutEmail.length}`);
  console.log(`   - Com email válido: ${withValidEmail.length}`);
  
  return availableDevices;
}

/**
 * Interface para resposta da função de registro de dispositivo
 */
interface RegisterDeviceResponse {
  success: boolean;
  device_id: string;
  mac_address: string;
  user_email: string;
  message?: string;
  [key: string]: unknown;
}

export async function registerDeviceWithEmail(
  deviceId: string,
  macAddress: string,
  userEmail: string,
  deviceName?: string,
  location?: string,
  ipAddress?: string
): Promise<RegisterDeviceResponse | null> {
  const normalizedEmail = userEmail?.trim().toLowerCase() || '';

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    console.error('❌ Email inválido para registrar dispositivo');
    return null;
  }

  // ✅ VALIDAR: MAC address deve ser válido
  if (!macAddress || macAddress.trim() === '' || macAddress === '00:00:00:00:00:00') {
    console.error('❌ MAC address inválido:', macAddress);
    return null;
  }

  // ✅ Se todas as validações passaram, registrar dispositivo
  const { data, error } = await supabase.rpc('register_device_with_email', {
    p_device_id: deviceId,
    p_mac_address: macAddress,
    p_user_email: normalizedEmail,
    p_device_name: deviceName,
    p_location: location,
    p_ip_address: ipAddress,
  });

  if (error) {
    console.error('Error registering device:', error);
    return null;
  }

  console.log(`✅ Dispositivo ${deviceId} registrado com sucesso para ${normalizedEmail}`);
  return data;
}

// ✅ Función para registrar slaves ESP-NOW en device_status
export async function registerSlaveDevice(
  deviceId: string,
  macAddress: string,
  deviceName: string,
  deviceType: string,
  userEmail: string,
  location?: string
): Promise<boolean> {
  try {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('device_status')
      .select('device_id')
      .eq('device_id', deviceId)
      .single();

    if (existing) {
      // Atualizar existente
      const { error } = await supabase
        .from('device_status')
        .update({
          device_name: deviceName,
          device_type: deviceType,
          mac_address: macAddress,
          user_email: userEmail,
          location: location || null,
          last_seen: new Date().toISOString(),
          is_online: true,
        })
        .eq('device_id', deviceId);

      if (error) {
        console.error('Error updating slave device:', error);
        return false;
      }
      return true;
    } else {
      // Criar novo
      const { error } = await supabase
        .from('device_status')
        .insert({
          device_id: deviceId,
          device_name: deviceName,
          device_type: deviceType,
          mac_address: macAddress,
          user_email: userEmail,
          location: location || null,
          is_online: true,
          last_seen: new Date().toISOString(),
        });

      if (error) {
        console.error('Error creating slave device:', error);
        return false;
      }
      return true;
    }
  } catch (error) {
    console.error('Error registering slave device:', error);
    return false;
  }
}

// ===== RELAY COMMANDS =====

/**
 * ✅ FUNCIONES COMPARTIDAS: Crear comandos directamente sin fetch HTTP
 * Optimizado para mejor tiempo de respuesta del usuario
 */

/**
 * Crea un comando Master directamente en Supabase (sin fetch HTTP)
 * ⚡ OPTIMIZADO: Validaciones rápidas, menos queries, sin logs innecesarios
 */
export async function createMasterCommandDirect(payload: {
  master_device_id: string;
  user_email: string;
  master_mac_address: string;
  relay_numbers: number[];
  actions: ('on' | 'off')[];
  duration_seconds: number[];
  command_type?: 'manual' | 'rule' | 'peristaltic';
  priority?: number;
  expires_at?: string | null;
  triggered_by?: 'manual' | 'automation' | 'rule' | 'peristaltic';
  rule_id?: string | null;
  rule_name?: string | null;
}): Promise<{ success: boolean; command?: RelayCommand; error?: string } | null> {
  const startTime = Date.now();
  const env = process.env.NODE_ENV || 'development';
  const isVercel = !!process.env.VERCEL;
  
  console.log(`🔍 [DEBUG-MASTER-DIRECT] Iniciando criação de comando Master`);
  console.log(`   Ambiente: ${env} | Vercel: ${isVercel ? 'SIM' : 'NÃO'}`);
  console.log(`   Payload: ${JSON.stringify({ 
    master_device_id: payload.master_device_id,
    relay_numbers: payload.relay_numbers,
    actions: payload.actions,
    command_type: payload.command_type,
    priority: payload.priority
  })}`);
  
  try {
    // ⚡ OPTIMIZACIÓN 1: Validaciones rápidas (early returns)
    if (!payload.master_device_id || !payload.user_email || !payload.master_mac_address) {
      console.error(`❌ [DEBUG-MASTER-DIRECT] Validação falhou: Campos obrigatórios faltando`);
      return { success: false, error: 'Campos obrigatórios faltando' };
    }

    if (!Array.isArray(payload.relay_numbers) || payload.relay_numbers.length === 0) {
      return { success: false, error: 'relay_numbers deve ser um array não vazio' };
    }

    if (!Array.isArray(payload.actions) || payload.actions.length !== payload.relay_numbers.length) {
      return { success: false, error: 'actions deve ter mesmo tamanho de relay_numbers' };
    }

    // Validar actions y relay_numbers en un solo loop
    for (let i = 0; i < payload.actions.length; i++) {
      if (payload.actions[i] !== 'on' && payload.actions[i] !== 'off') {
        return { success: false, error: `action inválida: "${payload.actions[i]}"` };
      }
      if (typeof payload.relay_numbers[i] !== 'number' || payload.relay_numbers[i] < 0 || payload.relay_numbers[i] > 15) {
        return { success: false, error: `relay_number inválido: ${payload.relay_numbers[i]}` };
      }
    }

    // Preparar durations (optimizado)
    const durations = payload.duration_seconds || payload.relay_numbers.map(() => 0);
    if (durations.length !== payload.relay_numbers.length) {
      return { success: false, error: 'duration_seconds deve ter mesmo tamanho' };
    }

    // ⚡ OPTIMIZACIÓN 2: Verificar device_status solo si es necesario (puede ser cacheado)
    const checkStartTime = Date.now();
    console.log(`🔍 [DEBUG-MASTER-DIRECT] Verificando device_status para: ${payload.master_device_id}`);
    
    const { data: deviceCheck, error: deviceError } = await supabase
      .from('device_status')
      .select('device_id')
      .eq('device_id', payload.master_device_id)
      .single();

    const checkTime = Date.now() - checkStartTime;
    console.log(`   ⏱️ [DEBUG-MASTER-DIRECT] Query device_status: ${checkTime}ms`);

    if (deviceError || !deviceCheck) {
      console.error(`❌ [DEBUG-MASTER-DIRECT] device_id não existe: ${payload.master_device_id}`, deviceError);
      return { success: false, error: `device_id "${payload.master_device_id}" não existe` };
    }

    // ⚡ OPTIMIZACIÓN 3: Insert directo sin validaciones redundantes
    const insertStartTime = Date.now();
    console.log(`🔍 [DEBUG-MASTER-DIRECT] Inserindo comando no Supabase...`);
    
    const { data, error } = await supabase
      .from('relay_commands_master')
      .insert({
        device_id: payload.master_device_id,
        user_email: payload.user_email,
        master_mac_address: payload.master_mac_address,
        relay_numbers: payload.relay_numbers,
        actions: payload.actions,
        duration_seconds: durations,
        command_type: payload.command_type || 'manual',
        priority: payload.priority || 50,
        expires_at: payload.expires_at || null,
        triggered_by: payload.triggered_by || 'manual',
        rule_id: payload.rule_id || null,
        rule_name: payload.rule_name || null,
        status: 'pending',
      })
      .select()
      .single();

    const insertTime = Date.now() - insertStartTime;
    const totalTime = Date.now() - startTime;

    if (error) {
      console.error(`❌ [DEBUG-MASTER-DIRECT] Erro ao inserir:`, error);
      console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
      return { success: false, error: error.message || 'Erro ao criar comando' };
    }

    console.log(`✅ [DEBUG-MASTER-DIRECT] Comando criado com sucesso!`);
    console.log(`   ID: ${data.id} | Relays: ${payload.relay_numbers.join(',')} | Actions: ${payload.actions.join(',')}`);
    console.log(`   ⏱️ Tempos: Query=${checkTime}ms | Insert=${insertTime}ms | Total=${totalTime}ms`);

    return { success: true, command: data };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DEBUG-MASTER-DIRECT] Erro inesperado:`, error);
    console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado' };
  }
}

/**
 * Crea un comando Slave directamente en Supabase (sin fetch HTTP)
 * ⚡ OPTIMIZADO: Validaciones rápidas, menos queries, sin logs innecesarios
 */
export async function createSlaveCommandDirect(payload: {
  master_device_id: string;
  user_email: string;
  master_mac_address: string;
  slave_device_id: string;
  slave_mac_address: string;
  relay_numbers: number[];
  actions: ('on' | 'off')[];
  duration_seconds: number[];
  command_type?: 'manual' | 'rule' | 'peristaltic';
  priority?: number;
  expires_at?: string | null;
  triggered_by?: 'manual' | 'automation' | 'rule' | 'peristaltic';
  rule_id?: string | null;
  rule_name?: string | null;
}): Promise<{ success: boolean; command?: RelayCommand; error?: string } | null> {
  const startTime = Date.now();
  const env = process.env.NODE_ENV || 'development';
  const isVercel = !!process.env.VERCEL;
  
  console.log(`🔍 [DEBUG-SLAVE-DIRECT] Iniciando criação de comando Slave`);
  console.log(`   Ambiente: ${env} | Vercel: ${isVercel ? 'SIM' : 'NÃO'}`);
  console.log(`   Payload: ${JSON.stringify({ 
    master_device_id: payload.master_device_id,
    slave_device_id: payload.slave_device_id,
    slave_mac_address: payload.slave_mac_address,
    relay_numbers: payload.relay_numbers,
    actions: payload.actions,
    command_type: payload.command_type,
    priority: payload.priority
  })}`);
  
  try {
    // ⚡ OPTIMIZACIÓN 1: Validaciones rápidas (early returns)
    if (!payload.master_device_id || !payload.slave_device_id || !payload.slave_mac_address) {
      console.error(`❌ [DEBUG-SLAVE-DIRECT] Validação falhou: Campos obrigatórios faltando`);
      return { success: false, error: 'Campos obrigatórios faltando' };
    }

    if (!payload.user_email || !payload.master_mac_address) {
      return { success: false, error: 'user_email e master_mac_address são obrigatórios' };
    }

    if (!Array.isArray(payload.relay_numbers) || payload.relay_numbers.length === 0) {
      return { success: false, error: 'relay_numbers deve ser um array não vazio' };
    }

    if (!Array.isArray(payload.actions) || payload.actions.length !== payload.relay_numbers.length) {
      return { success: false, error: 'actions deve ter mesmo tamanho de relay_numbers' };
    }

    // Validar actions y relay_numbers en un solo loop (0-7 para slaves)
    for (let i = 0; i < payload.actions.length; i++) {
      if (payload.actions[i] !== 'on' && payload.actions[i] !== 'off') {
        return { success: false, error: `action inválida: "${payload.actions[i]}"` };
      }
      if (typeof payload.relay_numbers[i] !== 'number' || payload.relay_numbers[i] < 0 || payload.relay_numbers[i] > 7) {
        return { success: false, error: `relay_number inválido: ${payload.relay_numbers[i]} (0-7 para slaves)` };
      }
    }

    // Preparar durations (optimizado)
    const durations = payload.duration_seconds || payload.relay_numbers.map(() => 0);
    if (durations.length !== payload.relay_numbers.length) {
      return { success: false, error: 'duration_seconds deve ter mesmo tamanho' };
    }

    // ⚡ OPTIMIZACIÓN 2: Verificar solo master (slave es opcional, no bloquea)
    const checkStartTime = Date.now();
    console.log(`🔍 [DEBUG-SLAVE-DIRECT] Verificando device_status para master: ${payload.master_device_id}`);
    
    const { data: masterCheck, error: masterError } = await supabase
      .from('device_status')
      .select('device_id')
      .eq('device_id', payload.master_device_id)
      .single();

    const checkTime = Date.now() - checkStartTime;
    console.log(`   ⏱️ [DEBUG-SLAVE-DIRECT] Query device_status: ${checkTime}ms`);

    if (masterError || !masterCheck) {
      console.error(`❌ [DEBUG-SLAVE-DIRECT] master_device_id não existe: ${payload.master_device_id}`, masterError);
      return { success: false, error: `master_device_id "${payload.master_device_id}" não existe` };
    }

    // ⚡ OPTIMIZACIÓN 3: Insert directo sin validaciones redundantes
    const insertStartTime = Date.now();
    console.log(`🔍 [DEBUG-SLAVE-DIRECT] Inserindo comando no Supabase...`);
    
    const { data, error } = await supabase
      .from('relay_commands_slave')
      .insert({
        master_device_id: payload.master_device_id,
        user_email: payload.user_email,
        master_mac_address: payload.master_mac_address,
        slave_device_id: payload.slave_device_id,
        slave_mac_address: payload.slave_mac_address,
        relay_numbers: payload.relay_numbers,
        actions: payload.actions,
        duration_seconds: durations,
        command_type: payload.command_type || 'manual',
        priority: payload.priority || 50,
        expires_at: payload.expires_at || null,
        triggered_by: payload.triggered_by || 'manual',
        rule_id: payload.rule_id || null,
        rule_name: payload.rule_name || null,
        status: 'pending',
      })
      .select()
      .single();

    const insertTime = Date.now() - insertStartTime;
    const totalTime = Date.now() - startTime;

    if (error) {
      console.error(`❌ [DEBUG-SLAVE-DIRECT] Erro ao inserir:`, error);
      console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
      return { success: false, error: error.message || 'Erro ao criar comando' };
    }

    console.log(`✅ [DEBUG-SLAVE-DIRECT] Comando criado com sucesso!`);
    console.log(`   ID: ${data.id} | Master: ${payload.master_device_id} | Slave: ${payload.slave_mac_address}`);
    console.log(`   Relays: ${payload.relay_numbers.join(',')} | Actions: ${payload.actions.join(',')}`);
    console.log(`   ⏱️ Tempos: Query=${checkTime}ms | Insert=${insertTime}ms | Total=${totalTime}ms`);

    return { success: true, command: data };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DEBUG-SLAVE-DIRECT] Erro inesperado:`, error);
    console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado' };
  }
}

/**
 * ✅ SOLUCIÓN OPTIMIZADA PARA PRODUCCIÓN
 * 
 * ⚡ MEJORAS DE TIEMPO DE RESPUESTA:
 * 1. En SERVIDOR: Llama funciones directas (0ms latencia HTTP)
 * 2. En CLIENTE: Usa fetch HTTP (necesario desde navegador)
 * 3. Validaciones rápidas con early returns
 * 4. Menos queries a Supabase (solo las necesarias)
 * 5. Sin logs innecesarios en producción
 * 
 * Esto elimina el error 401 en Vercel y mejora significativamente el tiempo de respuesta
 */
export async function createRelayCommand(command: Omit<RelayCommand, 'id' | 'created_at'>): Promise<RelayCommand | null> {
  const startTime = Date.now();
  const isServer = typeof window === 'undefined';
  const env = process.env.NODE_ENV || 'development';
  const isVercel = !!process.env.VERCEL;
  
  console.log(`🔍 [DEBUG-CREATE-RELAY] Iniciando createRelayCommand`);
  console.log(`   Ambiente: ${isServer ? 'SERVIDOR' : 'CLIENTE'} | ${env} | Vercel: ${isVercel ? 'SIM' : 'NÃO'}`);
  
  try {
    // ✅ Determinar se é Master ou Slave
    const isSlave = !!command.slave_mac_address;
    console.log(`   Tipo: ${isSlave ? 'SLAVE' : 'MASTER'}`);
    
    // ✅ Preparar dados (optimizado - sin conversiones innecesarias)
    const relay_numbers: number[] = Array.isArray((command as RelayCommand & { relay_numbers?: number[] }).relay_numbers) 
      ? (command as RelayCommand & { relay_numbers?: number[] }).relay_numbers!
      : [command.relay_number];
    
    const actions: ('on' | 'off')[] = Array.isArray((command as RelayCommand & { actions?: ('on' | 'off')[] }).actions) 
      ? (command as RelayCommand & { actions?: ('on' | 'off')[] }).actions!
      : [command.action];
    
    const duration_seconds: number[] = Array.isArray((command as RelayCommand & { duration_seconds?: number[] }).duration_seconds)
      ? (command as RelayCommand & { duration_seconds?: number[] }).duration_seconds!
      : [command.duration_seconds || 0];
    
    // ✅ Tipo para resposta da API (pode ter campos adicionais)
    interface CommandFromAPI extends Partial<RelayCommand> {
      master_device_id?: string;
      slave_device_id?: string;
      user_email?: string;
      master_mac_address?: string;
      expires_at?: string | null;
      [key: string]: unknown;
    }

    // ✅ Tipo para payload enviado à API
    interface CommandPayload {
      master_device_id: string;
      user_email: string | null;
      master_mac_address: string | null;
      relay_numbers: number[];
      actions: ('on' | 'off')[];
      duration_seconds: number[];
      command_type: 'manual' | 'rule' | 'peristaltic';
      priority: number;
      expires_at: string | null;
      triggered_by: 'manual' | 'automation' | 'rule' | 'peristaltic';
      rule_id: string | null;
      rule_name: string | null;
      slave_device_id?: string;
      slave_mac_address?: string | null;
    }

    // ✅ Preparar payload base
    // ✅ Validar y convertir tipos de forma segura usando funciones helper
    const triggeredByValue = validateTriggeredBy(command.triggered_by);
    const commandTypeValue = validateCommandType(command.command_type);
    
    const payload: CommandPayload = {
      master_device_id: command.device_id,
      user_email: (command as RelayCommand & { user_email?: string }).user_email || null,
      master_mac_address: (command as RelayCommand & { master_mac_address?: string }).master_mac_address || null,
      relay_numbers,
      actions,
      duration_seconds,
      command_type: commandTypeValue,
      priority: command.priority || 50,
      expires_at: (command as RelayCommand & { expires_at?: string | null }).expires_at || null,
      triggered_by: triggeredByValue,
      rule_id: command.rule_id || null,
      rule_name: command.rule_name || null,
    };
    
    // ✅ Adicionar campos específicos de Slave
    if (isSlave) {
      payload.slave_device_id = (command as RelayCommand & { slave_device_id?: string }).slave_device_id || `ESP32_SLAVE_${command.slave_mac_address?.replace(/:/g, '_')}`;
      payload.slave_mac_address = command.slave_mac_address;
    }
    
    console.log(`   Payload resumido: device_id=${payload.master_device_id}, relays=[${relay_numbers.join(',')}], actions=[${actions.join(',')}]`);
    
    let result: { success: boolean; command?: CommandFromAPI; error?: string } | null = null;
    
    // ⚡ OPTIMIZACIÓN CRÍTICA: Si estamos en el servidor, usar funciones directas (0ms latencia)
    // Si estamos en el cliente, usar fetch HTTP (necesario desde navegador)
    if (isServer) {
      // 🚀 SERVIDOR: Llamada directa (SIN HTTP) - MUCHO MÁS RÁPIDO
      console.log(`🚀 [DEBUG-CREATE-RELAY] Usando função DIRETA (servidor)`);
      const directStartTime = Date.now();
      
      let directResult: { success: boolean; command?: RelayCommand; error?: string } | null = null;
      if (isSlave) {
        // ✅ Converter payload para formato esperado pela função (user_email não pode ser null)
        const slavePayload = {
          master_device_id: payload.master_device_id,
          user_email: payload.user_email || '',
          master_mac_address: payload.master_mac_address || '',
          slave_device_id: payload.slave_device_id || '',
          slave_mac_address: payload.slave_mac_address || '',
          relay_numbers: payload.relay_numbers,
          actions: payload.actions,
          duration_seconds: payload.duration_seconds,
          command_type: payload.command_type,
          priority: payload.priority,
          expires_at: payload.expires_at,
          triggered_by: payload.triggered_by,
          rule_id: payload.rule_id,
          rule_name: payload.rule_name,
        };
        directResult = await createSlaveCommandDirect(slavePayload);
      } else {
        // ✅ Converter payload para formato esperado pela função (user_email não pode ser null)
        const masterPayload = {
          master_device_id: payload.master_device_id,
          user_email: payload.user_email || '',
          master_mac_address: payload.master_mac_address || '',
          relay_numbers: payload.relay_numbers,
          actions: payload.actions,
          duration_seconds: payload.duration_seconds,
          command_type: payload.command_type,
          priority: payload.priority,
          expires_at: payload.expires_at,
          triggered_by: payload.triggered_by,
          rule_id: payload.rule_id,
          rule_name: payload.rule_name,
        };
        directResult = await createMasterCommandDirect(masterPayload);
      }
      
      // ✅ Converter RelayCommand para CommandFromAPI (compatibilidade)
      if (directResult && directResult.command) {
        result = {
          success: directResult.success,
          command: { ...directResult.command } as CommandFromAPI,
          error: directResult.error,
        };
      } else {
        result = directResult as { success: boolean; command?: CommandFromAPI; error?: string } | null;
      }
      
      const directTime = Date.now() - directStartTime;
      console.log(`   ⏱️ [DEBUG-CREATE-RELAY] Função direta executada em: ${directTime}ms`);
    } else {
      // 🌐 CLIENTE: Fetch HTTP (necesario desde navegador)
      const endpoint = isSlave 
        ? '/api/relay-commands/slave'
        : '/api/relay-commands/master';
      
      console.log(`🌐 [DEBUG-CREATE-RELAY] Usando FETCH HTTP (cliente) → ${endpoint}`);
      const fetchStartTime = Date.now();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const fetchTime = Date.now() - fetchStartTime;
      console.log(`   ⏱️ [DEBUG-CREATE-RELAY] Fetch HTTP executado em: ${fetchTime}ms | Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error(`❌ [DEBUG-CREATE-RELAY] Erro no fetch:`, errorData);
        return null;
      }
      
      result = await response.json();
    }
    
    const totalTime = Date.now() - startTime;

    if (!result || !result.success || !result.command) {
      console.error(`❌ [DEBUG-CREATE-RELAY] Resultado inválido:`, result);
      console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
      return null;
    }
    
    // ✅ Converter resposta para formato RelayCommand (compatibilidade)
    const commandFromAPI = result.command as CommandFromAPI;
    const deviceId = commandFromAPI.device_id || commandFromAPI.master_device_id || command.device_id;
    
    if (!deviceId) {
      console.error('❌ [DEBUG-CREATE-RELAY] device_id não encontrado no comando');
      return null;
    }
    
    const createdCommand: RelayCommand = {
      id: commandFromAPI.id,
      device_id: deviceId,
      relay_number: relay_numbers[0],
      action: actions[0] as 'on' | 'off',
      duration_seconds: duration_seconds[0],
      status: commandFromAPI.status || 'pending',
      created_at: commandFromAPI.created_at,
      command_type: commandFromAPI.command_type,
      priority: commandFromAPI.priority,
      triggered_by: commandFromAPI.triggered_by,
      rule_id: commandFromAPI.rule_id,
      rule_name: commandFromAPI.rule_name,
      slave_mac_address: isSlave ? command.slave_mac_address : null,
      target_device_id: isSlave ? (commandFromAPI.slave_device_id || payload.slave_device_id) : undefined,
    };
    
    console.log(`✅ [DEBUG-CREATE-RELAY] Comando criado com sucesso!`);
    console.log(`   ID: ${createdCommand.id} | Status: ${createdCommand.status}`);
    console.log(`   ⏱️ Tempo total: ${totalTime}ms`);
    
    return createdCommand;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DEBUG-CREATE-RELAY] Erro inesperado:`, error);
    console.error(`   ⏱️ Tempo total: ${totalTime}ms`);
    if (error instanceof Error) {
      console.error(`   Stack:`, error.stack);
    }
    return null;
  }
}

// ===== RELAY STATES (TABELA UNIFICADA) =====

/**
 * Interface para estado de relé unificado
 */
export interface RelayState {
  id?: number;
  device_id: string;
  relay_type: 'local' | 'slave';
  master_device_id?: string | null;
  slave_mac_address?: string | null;
  relay_number: number;
  state: boolean;
  has_timer: boolean;
  remaining_time: number;
  relay_name?: string | null;
  last_update?: string;
  updated_at?: string;
}

/**
 * ❌ DEPRECATED: Não usar mais relay_states
 * 
 * Use em vez disso:
 * - Para slaves: getSlaveRelayStates() de '@/lib/relay-slaves-api'
 * - Para master: getMasterLocalRelayStates() de '@/lib/relay-slaves-api'
 * 
 * @deprecated Esta função usa relay_states que não deve ser mais usado
 */
/*
export async function updateRelayState(relayState: Omit<RelayState, 'id' | 'last_update' | 'updated_at'>): Promise<boolean> {
  // ❌ DEPRECATED: Não usar mais
      return false;
    }

export async function getRelayStates(
  deviceId?: string,
  relayType?: 'local' | 'slave',
  masterDeviceId?: string
): Promise<RelayState[]> {
  // ❌ DEPRECATED: Não usar mais
  // Use getSlaveRelayStates() ou getMasterLocalRelayStates() de '@/lib/relay-slaves-api'
      return [];
    }
*/

/**
 * Interface para descoberta de slaves via Supabase
 */
export interface SlaveDiscovery {
  slave_device_id: string;
  slave_mac_address: string;
  slave_name: string;
  device_type: string;
  master_device_id: string;
  master_mac_address: string;
  user_email: string;
  is_online: boolean;
  last_seen: string;
  slave_device_mac: string;
  total_relays: number;
  active_relays: number;
  last_relay_update: string;
}

/**
 * Descobre slaves ESP-NOW via Supabase (sem fetch direto a ESP32)
 * 
 * @param masterDeviceId ID do Master (opcional)
 * @param userEmail Email do usuário (opcional)
 * @returns Array de slaves descobertos
 */
export async function discoverSlavesFromSupabase(
  masterDeviceId?: string,
  userEmail?: string
): Promise<SlaveDiscovery[]> {
  try {
    let query = supabase.from('slaves_discovery').select('*');

    if (masterDeviceId) {
      query = query.eq('master_device_id', masterDeviceId);
    }

    if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    query = query.order('last_relay_update', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao descobrir slaves via Supabase:', error);
      return [];
    }

    console.log(`✅ ${data?.length || 0} slave(s) descoberto(s) via Supabase`);
    return data || [];
  } catch (error) {
    console.error('Erro ao descobrir slaves:', error);
    return [];
  }
}

/**
 * Verifica se um slave existe no Supabase
 * 
 * @param slaveMacAddress MAC address do slave
 * @param masterDeviceId ID do Master
 * @returns true se existe, false caso contrário
 */
export async function checkSlaveExists(
  slaveMacAddress: string,
  masterDeviceId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('relay_states')
      .select('device_id')
      .eq('relay_type', 'slave')
      .eq('slave_mac_address', slaveMacAddress)
      .eq('master_device_id', masterDeviceId)
      .limit(1)
      .single();

    return !error && data !== null;
  } catch {
    return false;
  }
}

export async function getRelayCommands(deviceId?: string, status?: string): Promise<RelayCommand[]> {
  let query = supabase.from('relay_commands').select('*').order('created_at', { ascending: false });

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching relay commands:', error);
    return [];
  }

  return data || [];
}

// ===== RULE EXECUTIONS =====

export async function getRuleExecutions(deviceId?: string, limit: number = 50): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('rule_executions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching rule executions:', error);
    return [];
  }

  return data || [];
}

// ===== SYSTEM ALERTS =====

export async function getSystemAlerts(deviceId?: string, limit: number = 50): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('system_alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching system alerts:', error);
    return [];
  }

  return data || [];
}

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from('system_alerts')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledgedBy,
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error acknowledging alert:', error);
    return false;
  }

  return true;
}


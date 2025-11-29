import { supabase } from './supabase';
import { getDecisionRules, DecisionRule } from './automation';
import { 
  getSlavesFromMaster, 
  getRelayNamesFromSupabase,
  ESP32Slave 
} from './esp32-api';

/**
 * Interface para configuração de relé de slave ESP-NOW
 * 
 * Identificação:
 * - id: número do relé (0-7)
 * - name: nome personalizado (ex: "Bomba Água", "Chiller")
 * - enabled: se tem automação ativa
 * - schedule: automação temporal (ON a cada X minutos por Y minutos)
 */
export interface SlaveRelayConfig {
  id: number;
  name: string;
  enabled: boolean;
  schedule?: {
    intervalMinutes: number;
    durationMinutes: number;
  };
  rule_id?: string; // ID da regra no decision_rules (se houver)
  // ✅ Estados do relé (do Supabase)
  state?: boolean; // Estado atual (ON/OFF)
  has_timer?: boolean; // Se tem timer ativo
  remaining_time?: number; // Tempo restante em segundos
}

/**
 * Interface para dispositivo slave ESP-NOW
 * 
 * Identificação:
 * - macAddress: MAC address único do slave (chave primária)
 * - name: Nome do dispositivo (device_name do device_status)
 * - Ambos são usados pelo Decision Engine e MasterSlaveManager
 */
export interface ESPNowSlave {
  macAddress: string; // Identificador único (usado pelo ESP-NOW)
  name: string; // Nome do dispositivo (device_name)
  status: 'online' | 'offline';
  relays: SlaveRelayConfig[];
  device_id?: string; // ID do dispositivo no device_status
  last_seen?: string;
  ip_address?: string;
  firmware_version?: string;
}

/**
 * Busca slaves ESP-NOW associados a um master device
 * 
 * ✅ CORRIGIDO: Agora usa APENAS Supabase (sem fetch direto a IP privada)
 * Isso permite que o sistema funcione em produção (Vercel) de qualquer lugar do mundo
 * 
 * ESTRATÉGIA:
 * 1. Buscar slaves do Supabase (device_status)
 * 2. Buscar estados dos relés do Supabase (slave_relay_states)
 * 3. Buscar nomes personalizados da tabela relay_names (Supabase)
 * 4. Combinar todos os dados do Supabase
 * 
 * @param masterDeviceId ID do dispositivo master
 * @param userEmail Email do usuário (não usado mais, mantido para compatibilidade)
 * @returns Lista de slaves ESP-NOW
 */
export async function getESPNOWSlaves(
  masterDeviceId: string,
  userEmail: string
): Promise<ESPNowSlave[]> {
  try {
    // 1. Buscar slaves do Supabase (getSlavesFromMaster agora usa apenas Supabase)
    const esp32Slaves = await getSlavesFromMaster(masterDeviceId);
    
    if (esp32Slaves.length === 0) {
      console.log('Nenhum slave encontrado no Supabase');
      return [];
    }

    // 2. Buscar nomes personalizados da tabela relay_names
    const deviceIds = esp32Slaves.map(s => s.device_id);
    const relayNamesMap = await getRelayNamesFromSupabase(deviceIds);

    // 3. Converter ESP32Slave para ESPNowSlave, combinando com nomes do Supabase
    const slaves: ESPNowSlave[] = esp32Slaves.map((esp32Slave) => {
      const slaveMac = esp32Slave.mac_address;
      
      // Criar array de relés com quantidade EXATA do device_info
      const relays: SlaveRelayConfig[] = esp32Slave.relays.map((esp32Relay) => {
        // Buscar nome personalizado do Supabase
        const relayNamesForDevice = relayNamesMap.get(esp32Slave.device_id);
        const personalizedName = relayNamesForDevice?.get(esp32Relay.relay_number);
        
        return {
          id: esp32Relay.relay_number,
          name: personalizedName || esp32Relay.name || `Relé ${esp32Relay.relay_number}`,
          enabled: false, // Não usado mais para automação (usar decision_rules)
          // ✅ NOVO: Incluir informações completas do Master
          state: esp32Relay.state,
          has_timer: esp32Relay.has_timer,
          remaining_time: esp32Relay.remaining_time,
        };
      });

      return {
        macAddress: slaveMac,
        name: esp32Slave.device_name,
        status: esp32Slave.is_online ? 'online' : 'offline',
        relays,
        device_id: esp32Slave.device_id,
        last_seen: new Date(esp32Slave.last_seen).toISOString(),
        ip_address: undefined, // Não disponível do ESP32 Master
        firmware_version: undefined, // Não disponível do ESP32 Master
      };
    });

    return slaves;
  } catch (error) {
    console.error('Erro ao buscar slaves ESP-NOW:', error);
    return [];
  }
}

/**
 * Salva nome personalizado de relé de slave na tabela relay_names
 * 
 * NOVA ESTRATÉGIA: Usar tabela relay_names (não decision_rules)
 * 
 * @param masterDeviceId ID do master (não usado, mantido para compatibilidade)
 * @param slaveMac MAC do slave (não usado, mantido para compatibilidade)
 * @param slaveName Nome do slave (não usado, mantido para compatibilidade)
 * @param relayId ID do relé
 * @param relayName Nome personalizado do relé
 * @param deviceId Device ID do slave (ESP32_SLAVE_XX_XX_XX_XX_XX_XX)
 */
export async function saveSlaveRelayName(
  masterDeviceId: string,
  slaveMac: string,
  slaveName: string,
  relayId: number,
  relayName: string,
  deviceId?: string
): Promise<boolean> {
  try {
    // Se deviceId não foi fornecido, tentar buscar do ESP32 Master
    let slaveDeviceId = deviceId;
    
    if (!slaveDeviceId) {
      // Buscar slaves do Supabase para encontrar device_id pelo MAC
      const esp32Slaves = await getSlavesFromMaster(masterDeviceId);
      const slave = esp32Slaves.find(s => s.mac_address === slaveMac);
      slaveDeviceId = slave?.device_id;
    }

    if (!slaveDeviceId) {
      console.error('Device ID do slave não encontrado');
      return false;
    }

    // Salvar/atualizar na tabela relay_names
    const { error } = await supabase
      .from('relay_names')
      .upsert(
        {
          device_id: slaveDeviceId,
          relay_number: relayId,
          relay_name: relayName,
        },
        {
          onConflict: 'device_id,relay_number',
        }
      );

    if (error) {
      console.error('Erro ao salvar nome do relé na tabela relay_names:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao salvar nome do relé:', error);
    return false;
  }
}

/**
 * Carrega configurações de relés de um slave específico
 * 
 * Busca em decision_rules as regras que têm target_device = MAC ou nome do slave
 * 
 * @param masterDeviceId ID do master
 * @param slaveMac MAC do slave (identificador principal)
 * @param slaveName Nome do slave (identificador alternativo)
 * @returns Configurações dos relés ou null
 */
export async function loadSlaveRelayConfigs(
  masterDeviceId: string,
  slaveMac: string,
  slaveName?: string
): Promise<SlaveRelayConfig[] | null> {
  try {
    // Buscar regras do Decision Engine para este master
    const rules = await getDecisionRules(masterDeviceId);

    // Inicializar relés padrão
    const relays: SlaveRelayConfig[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      name: `Relay ${i + 1}`,
      enabled: false,
    }));

    // Filtrar regras que são para este slave
    const slaveRules = rules.filter((rule) => {
      const actions = rule.rule_json?.actions || [];
      return actions.some((action: any) => {
        // Identificar por MAC (prioritário) ou nome
        return action.target_device === slaveMac ||
               (slaveName && action.target_device === slaveName);
      });
    });

    // Processar cada regra
    slaveRules.forEach((rule) => {
      const actions = rule.rule_json?.actions || [];
      
      actions.forEach((action: any) => {
        const isForThisSlave = 
          action.target_device === slaveMac ||
          (slaveName && action.target_device === slaveName);

        if (isForThisSlave && action.relay_id !== undefined) {
          const relayId = action.relay_id;
          
          if (relayId >= 0 && relayId < 8) {
            // Atualizar ou criar configuração do relé
            relays[relayId] = {
              id: relayId,
              name: action.relay_name || `Relay ${relayId + 1}`,
              enabled: rule.enabled || false,
              schedule: rule.rule_json?.interval_between_executions
                ? {
                    intervalMinutes: Math.floor(rule.rule_json.interval_between_executions / 60),
                    durationMinutes: Math.floor((action.duration || 0) / 60),
                  }
                : undefined,
              rule_id: rule.rule_id,
            };
          }
        }
      });
    });

    return relays;
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return null;
  }
}


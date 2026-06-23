import { supabase } from './supabase';
import { getDecisionRules } from './automation';
import { patchSlaveRelayNamesArray } from './relay-names-prod';
import { 
  getSlavesFromMaster, 
  getRelayNamesFromSupabase,
} from './esp32-api';

function formatSlaveLastSeen(lastSeen: number | string | undefined): string | undefined {
  if (lastSeen == null) return undefined;
  if (typeof lastSeen === 'number') {
    const ms = lastSeen < 1e12 ? lastSeen * 1000 : lastSeen;
    return new Date(ms).toISOString();
  }
  const parsed = new Date(lastSeen);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

interface RuleAction {
  relay_ids?: number[];
  relay_names?: string[];
  relay_id?: number;
  relay_name?: string;
  duration?: number;
  target_device?: string;
  target_device_id?: string;
  slave_mac_address?: string;
  [key: string]: unknown;
}

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
 * 3. Buscar nomes de relay_slaves.relay_names (schema prod)
 * 4. Combinar todos os dados do Supabase
 * 
 * @param masterDeviceId ID do dispositivo master
 * @param userEmail Email do usuário (não usado mais, mantido para compatibilidade)
 * @returns Lista de slaves ESP-NOW
 */
export async function getESPNOWSlaves(
  masterDeviceId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        last_seen: formatSlaveLastSeen(esp32Slave.last_seen),
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

export type SaveSlaveRelayNameResult = {
  ok: boolean;
  error?: string;
  code?: string;
};

/**
 * Salva nome personalizado de relé de slave em relay_slaves.relay_names
 */
export async function saveSlaveRelayName(
  masterDeviceId: string,
  slaveMac: string,
  slaveName: string,
  relayId: number,
  relayName: string,
  deviceId?: string
): Promise<SaveSlaveRelayNameResult> {
  try {
    let slaveDeviceId = deviceId;

    if (!slaveDeviceId) {
      const esp32Slaves = await getSlavesFromMaster(masterDeviceId);
      const slave = esp32Slaves.find((s) => s.mac_address === slaveMac);
      slaveDeviceId = slave?.device_id;
    }

    if (!slaveDeviceId) {
      return { ok: false, error: 'Device ID do slave não encontrado' };
    }

    const { data: existing, error: fetchError } = await supabase
      .from('relay_slaves')
      .select('relay_names')
      .eq('device_id', slaveDeviceId)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar relay_slaves:', fetchError);
      return { ok: false, error: fetchError.message, code: fetchError.code };
    }

    if (!existing) {
      return {
        ok: false,
        error: `Slave ${slaveDeviceId} ainda não existe em relay_slaves (aguarde sync do firmware)`,
      };
    }

    const relay_names = patchSlaveRelayNamesArray(
      relayId,
      relayName,
      existing?.relay_names
    );

    const { data: updated, error } = await supabase
      .from('relay_slaves')
      .update({
        relay_names,
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', slaveDeviceId)
      .select('device_id')
      .maybeSingle();

    if (error) {
      console.error('Erro ao salvar nome do relé slave:', error);
      return { ok: false, error: error.message, code: error.code };
    }

    if (!updated) {
      return { ok: false, error: 'Nenhuma linha atualizada em relay_slaves' };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao salvar nome do relé:', error);
    return { ok: false, error: message };
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
      return actions.some((action: RuleAction) => {
        // Identificar por MAC (prioritário) ou nome
        return action.target_device === slaveMac ||
               (slaveName && action.target_device === slaveName);
      });
    });

    // Processar cada regra
    slaveRules.forEach((rule) => {
      const actions = (rule.rule_json?.actions || []) as RuleAction[];
      
      actions.forEach((action: RuleAction) => {
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


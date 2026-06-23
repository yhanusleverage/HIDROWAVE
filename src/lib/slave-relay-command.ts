import type { RelayCommandMode } from '@/lib/mqtt-relay-command-schema';

export type SlaveRelayCommandParams = {
  master_device_id: string;
  slave_mac_address: string;
  slave_name?: string;
  relay_number: number;
  mode?: RelayCommandMode;
  action?: 'on' | 'off';
  duration_seconds?: number;
  cycle_off_seconds?: number;
};

export type SlaveRelayCommandResult = {
  success: boolean;
  command_id?: number;
  error?: string;
};

/** Mapeia mode → action + duration para INSERT relay_commands (só on/off). */
export function resolveDbActionAndDuration(params: SlaveRelayCommandParams): {
  action: 'on' | 'off';
  duration_seconds: number | null;
  created_by: string;
} {
  const mode = params.mode ?? 'instant';

  switch (mode) {
    case 'timed_on':
      return {
        action: 'on',
        duration_seconds: params.duration_seconds ?? null,
        created_by: 'timer_on',
      };
    case 'timed_off':
      return {
        action: 'on',
        duration_seconds: params.duration_seconds ?? null,
        created_by: 'timer_off',
      };
    case 'cycle':
      return {
        action: 'on',
        duration_seconds: params.duration_seconds ?? null,
        created_by: 'cycle',
      };
    case 'cycle_stop':
      return {
        action: 'off',
        duration_seconds: null,
        created_by: 'cycle_stop',
      };
    case 'instant':
    default:
      return {
        action: params.action ?? 'on',
        duration_seconds: params.duration_seconds ?? null,
        created_by: 'web_interface',
      };
  }
}

export async function sendSlaveRelayCommand(
  params: SlaveRelayCommandParams
): Promise<SlaveRelayCommandResult> {
  const mode = params.mode ?? 'instant';
  const { action, duration_seconds, created_by } = resolveDbActionAndDuration(params);

  const response = await fetch('/api/esp-now/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      master_device_id: params.master_device_id,
      slave_mac_address: params.slave_mac_address,
      slave_name: params.slave_name,
      relay_number: params.relay_number,
      action,
      duration_seconds,
      cycle_off_seconds: params.cycle_off_seconds,
      mode,
      created_by,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return {
      success: false,
      error: (err as { error?: string }).error ?? `HTTP ${response.status}`,
    };
  }

  const result = await response.json();
  return {
    success: true,
    command_id: result.command_id as number | undefined,
  };
}

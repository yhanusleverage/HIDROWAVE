import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  HYDRAULIC_ROLE_DEFINITIONS,
  normalizeHydraulicRolesJson,
  validateHydraulicRolesMap,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import { saveSlaveRelayName } from '@/lib/esp-now-slaves';

export async function getHydraulicRolesForDevice(
  deviceId: string
): Promise<{ ok: true; roles: HydraulicRolesMap } | { ok: false; error: string }> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente' };
  }

  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from('relay_master')
    .select('hydraulic_roles_json')
    .eq('device_id', deviceId.trim())
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    roles: normalizeHydraulicRolesJson(data?.hydraulic_roles_json),
  };
}

export async function saveHydraulicRolesForDevice(
  deviceId: string,
  roles: HydraulicRolesMap
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente' };
  }

  const validationErrors = validateHydraulicRolesMap(roles);
  if (validationErrors.length > 0) {
    return { ok: false, error: validationErrors.join('; ') };
  }

  const sb = getSupabaseServerClient();

  const { data: existing, error: fetchErr } = await sb
    .from('relay_master')
    .select('device_id, user_email')
    .eq('device_id', deviceId.trim())
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const payload = {
    device_id: deviceId.trim(),
    hydraulic_roles_json: roles,
    updated_at: new Date().toISOString(),
  };

  if (existing?.device_id) {
    const { error } = await sb
      .from('relay_master')
      .update(payload)
      .eq('device_id', deviceId.trim());
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb.from('relay_master').insert({
      ...payload,
      user_email: 'system@hydrowave.local',
    });
    if (error) return { ok: false, error: error.message };
  }

  for (const def of HYDRAULIC_ROLE_DEFINITIONS) {
    const binding = roles[def.id];
    if (!binding) continue;
    const renameResult = await saveSlaveRelayName(
      deviceId.trim(),
      binding.slaveMac,
      '',
      binding.relayIndex,
      def.label
    );
    if (!renameResult.ok) {
      console.warn(
        `[hydraulic-roles] rename slave relay ${def.id}:`,
        renameResult.error
      );
    }
  }

  return { ok: true };
}

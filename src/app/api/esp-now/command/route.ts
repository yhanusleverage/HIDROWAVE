import { NextResponse } from 'next/server';
import { createRelayCommandProd } from '@/lib/automation';
import { notifyDeviceRelayCommand } from '@/lib/mqtt-command-publish';
import {
  normalizeRelayCommandMode,
  type RelayCommandMode,
} from '@/lib/mqtt-relay-command-schema';
import { resolveDbActionAndDuration } from '@/lib/slave-relay-command';
import { supabase } from '@/lib/supabase';

/**
 * API ESP-NOW — INSERT em relay_commands (schema prod) + push MQTT.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,
      slave_mac_address,
      slave_name,
      relay_number,
      action: rawAction,
      duration_seconds,
      cycle_off_seconds,
      mode: rawMode,
      rule_id,
      created_by: rawCreatedBy,
    } = body;

    if (!master_device_id) {
      return NextResponse.json({ error: 'master_device_id é obrigatório' }, { status: 400 });
    }

    if (typeof relay_number !== 'number' || relay_number < 0 || relay_number > 15) {
      return NextResponse.json({ error: 'relay_number inválido (0-15)' }, { status: 400 });
    }

    const mode = normalizeRelayCommandMode(rawMode as RelayCommandMode | undefined);
    const resolved = resolveDbActionAndDuration({
      master_device_id,
      slave_mac_address: slave_mac_address ?? '',
      slave_name,
      relay_number,
      mode,
      action: rawAction,
      duration_seconds,
      cycle_off_seconds,
    });

    if (resolved.action !== 'on' && resolved.action !== 'off') {
      return NextResponse.json({ error: "action deve ser 'on' ou 'off'" }, { status: 400 });
    }

    const { data: deviceData, error: deviceError } = await supabase
      .from('device_status')
      .select('device_id')
      .eq('device_id', master_device_id)
      .maybeSingle();

    if (deviceError || !deviceData) {
      return NextResponse.json(
        {
          error: `device_id "${master_device_id}" não existe em device_status`,
        },
        { status: 400 }
      );
    }

    if (rule_id) {
      await supabase
        .from('decision_rules')
        .select('priority')
        .eq('rule_id', rule_id)
        .eq('device_id', master_device_id)
        .maybeSingle();
    }

    const targetId = slave_mac_address || slave_name || null;
    const createdBy = rawCreatedBy ?? resolved.created_by;

    const command = await createRelayCommandProd({
      device_id: master_device_id,
      relay_number,
      action: resolved.action,
      duration_seconds: resolved.duration_seconds,
      target_device_id: targetId,
      created_by: createdBy,
    });

    if (!command) {
      return NextResponse.json(
        {
          error: 'Erro ao criar comando em relay_commands',
          hint: slave_mac_address
            ? 'Execute PRODUCTION_RELAY_COMMANDS_TARGET.sql para comandos slave'
            : undefined,
        },
        { status: 500 }
      );
    }

    await notifyDeviceRelayCommand({
      device_id: master_device_id,
      id: command.id as number,
      relay_index: relay_number,
      action: resolved.action,
      duration_s: resolved.duration_seconds,
      mode,
      cycle_off_s: cycle_off_seconds ?? null,
      target_device_id: targetId,
      command_type: body.command_type ?? 'manual',
      priority: typeof body.priority === 'number' ? body.priority : undefined,
      triggered_by: body.triggered_by ?? createdBy,
      rule_id: rule_id ?? null,
    });

    return NextResponse.json({
      success: true,
      message: `Comando ${mode} criado com sucesso`,
      command_id: command.id,
      command: {
        id: command.id,
        device_id: master_device_id,
        relay_number,
        action: resolved.action,
        mode,
        duration_seconds: resolved.duration_seconds,
        cycle_off_seconds: cycle_off_seconds ?? null,
        status: 'pending',
        is_local: !slave_mac_address,
        is_slave: !!slave_mac_address,
        slave_mac: slave_mac_address || null,
      },
    });
  } catch (error) {
    console.error('Error in ESP-NOW command API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

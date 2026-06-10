import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { masterRelayNamesToMap, slaveRelayNamesToMap } from '@/lib/relay-names-prod';

/**
 * Nomes personalizados dos relés — schema prod.
 * Master: relay_master (doser / level / reserved _relay_names)
 * Slave: relay_slaves.relay_names
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceIdsParam = searchParams.get('device_ids');

    if (!deviceIdsParam) {
      return NextResponse.json(
        { error: 'device_ids é obrigatório', relay_names: {} },
        { status: 400 }
      );
    }

    const deviceIds = deviceIdsParam.split(',').map((id) => id.trim()).filter(Boolean);

    if (deviceIds.length === 0) {
      return NextResponse.json({ relay_names: {} });
    }

    const relayNamesMap: Record<string, Record<number, string>> = {};

    const { data: masters, error: masterError } = await supabase
      .from('relay_master')
      .select('device_id, doser_relay_names, level_relay_names, reserved_relay_names')
      .in('device_id', deviceIds);

    if (masterError) {
      console.error('❌ relay-names relay_master:', masterError.message);
    } else {
      (masters || []).forEach((row) => {
        relayNamesMap[row.device_id] = masterRelayNamesToMap(row);
      });
    }

    const remainingIds = deviceIds.filter((id) => !relayNamesMap[id]);
    if (remainingIds.length > 0) {
      const { data: slaves, error: slaveError } = await supabase
        .from('relay_slaves')
        .select('device_id, relay_names')
        .in('device_id', remainingIds);

      if (slaveError) {
        console.error('❌ relay-names relay_slaves:', slaveError.message);
      } else {
        (slaves || []).forEach((row) => {
          relayNamesMap[row.device_id] = slaveRelayNamesToMap(row.relay_names);
        });
      }
    }

    return NextResponse.json({ relay_names: relayNamesMap });
  } catch (error) {
    console.error('❌ Erro em GET /api/relay-names:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        relay_names: {},
      },
      { status: 500 }
    );
  }
}

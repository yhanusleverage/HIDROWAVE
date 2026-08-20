import { NextResponse } from 'next/server';
import {
  getHydraulicRolesForDevice,
  saveHydraulicRolesForDevice,
} from '@/lib/hydraulic-roles-server';
import { normalizeHydraulicRolesJson } from '@/lib/hydraulic-relay-roles';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id')?.trim() ?? '';

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const result = await getHydraulicRolesForDevice(deviceId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ device_id: deviceId, roles: result.roles });
  } catch (error) {
    console.error('[hydraulic-roles] GET', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const roles = normalizeHydraulicRolesJson(body.roles);

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const result = await saveHydraulicRolesForDevice(deviceId, roles);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, device_id: deviceId, roles });
  } catch (error) {
    console.error('[hydraulic-roles] PATCH', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

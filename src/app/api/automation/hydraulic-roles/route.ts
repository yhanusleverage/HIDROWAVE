import { NextResponse } from 'next/server';
import {
  getHydraulicRolesForDevice,
  saveHydraulicRoleForDevice,
  saveHydraulicRolesForDevice,
} from '@/lib/hydraulic-roles-server';
import {
  HYDRAULIC_ROLE_DEFINITIONS,
  normalizeHydraulicRolesJson,
  type HydraulicRoleBinding,
  type HydraulicRoleId,
} from '@/lib/hydraulic-relay-roles';

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

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    // Tipagem por função: { device_id, role_id, binding }
    const roleId = body.role_id as HydraulicRoleId | undefined;
    if (roleId && HYDRAULIC_ROLE_DEFINITIONS.some((d) => d.id === roleId)) {
      let binding: HydraulicRoleBinding | null = null;
      if (body.binding && typeof body.binding === 'object') {
        const raw = normalizeHydraulicRolesJson({ [roleId]: body.binding });
        binding = raw[roleId] ?? null;
      } else if (body.binding === null) {
        binding = null;
      } else {
        return NextResponse.json(
          { error: 'binding é obrigatório (objeto ou null)' },
          { status: 400 }
        );
      }

      const authorization = request.headers.get('authorization');
      const result = await saveHydraulicRoleForDevice(deviceId, roleId, binding, {
        authorization,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 422 });
      }

      return NextResponse.json({
        success: true,
        device_id: deviceId,
        roles: result.roles,
        rule_id: result.ruleId,
        rule_action: result.ruleAction,
      });
    }

    // Legado: mapa completo
    const roles = normalizeHydraulicRolesJson(body.roles);
    const authorization = request.headers.get('authorization');
    const result = await saveHydraulicRolesForDevice(deviceId, roles, { authorization });
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

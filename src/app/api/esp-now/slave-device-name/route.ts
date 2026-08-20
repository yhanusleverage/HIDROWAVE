import { NextResponse } from 'next/server';
import { saveSlaveDeviceName } from '@/lib/esp-now-slaves';

/**
 * Renomeia um dispositivo slave ESP-NOW (device_status.device_name).
 * O MAC permanece como identificador interno — não é exposto na UI P1.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const deviceName = String(body.device_name ?? '').trim();

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }
    if (!deviceName) {
      return NextResponse.json({ error: 'device_name é obrigatório' }, { status: 400 });
    }

    const result = await saveSlaveDeviceName(deviceId, deviceName);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_name: deviceName,
    });
  } catch (error) {
    console.error('[esp-now/slave-device-name] PATCH', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

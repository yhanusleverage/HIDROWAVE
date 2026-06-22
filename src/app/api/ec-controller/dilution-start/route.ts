import { NextResponse } from 'next/server';
import { configApiErrorResponse } from '@/lib/controller-config-api';
import {
  mqttCommandTopic,
  validateDeviceId,
  MQTT_CMD_SCHEMA_VERSION,
} from '@/lib/mqtt-relay-command-schema';

/**
 * Inicia diluição manual — publica MQTT ec_dilution_start no tópico command.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id || '').trim();
    const volumeL = Number(body.volume_l);

    if (!validateDeviceId(deviceId)) {
      return NextResponse.json(
        configApiErrorResponse('device_id inválido', 400),
        { status: 400 }
      );
    }

    if (!Number.isFinite(volumeL) || volumeL < 0.1) {
      return NextResponse.json(
        configApiErrorResponse('volume_l inválido (mín. 0,1 L)', 400),
        { status: 400 }
      );
    }

    const host = process.env.MQTT_HOST;
    const user = process.env.MQTT_PUBLISH_USER || process.env.MQTT_USER;
    const pass = process.env.MQTT_PUBLISH_PASS || process.env.MQTT_PASS;
    const port = parseInt(process.env.MQTT_PORT || '1883', 10);

    if (!host || !user || !pass) {
      return NextResponse.json(
        configApiErrorResponse(
          'MQTT não configurado no servidor — defina MQTT_HOST e credenciais',
          503
        ),
        { status: 503 }
      );
    }

    const payload = {
      v: MQTT_CMD_SCHEMA_VERSION,
      action: 'ec_dilution_start',
      volume_l: Math.round(volumeL * 1000) / 1000,
      source: 'web',
    };

    const topic = mqttCommandTopic(deviceId);
    const mqtt = await import('mqtt');

    const published = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const client = mqtt.connect(`mqtt://${host}:${port}`, {
        username: user,
        password: pass,
        connectTimeout: 5000,
      });

      let settled = false;
      const finish = (result: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        try {
          client.end(true);
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      client.on('connect', () => {
        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) finish({ ok: false, error: err.message });
          else finish({ ok: true });
        });
      });

      client.on('error', (err) => finish({ ok: false, error: err.message }));
      setTimeout(() => finish({ ok: false, error: 'mqtt connect timeout' }), 6000);
    });

    if (!published.ok) {
      return NextResponse.json(
        configApiErrorResponse(published.error || 'Falha ao publicar MQTT', 502),
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, volume_l: payload.volume_l });
  } catch (error) {
    console.error('Erro em POST /api/ec-controller/dilution-start:', error);
    return NextResponse.json(
      configApiErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      ),
      { status: 500 }
    );
  }
}

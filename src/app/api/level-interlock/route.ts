import { NextResponse } from 'next/server';
import { configApiErrorResponse } from '@/lib/controller-config-api';
import {
  mqttCommandTopic,
  validateDeviceId,
  MQTT_CMD_SCHEMA_VERSION,
} from '@/lib/mqtt-relay-command-schema';
import { supabase } from '@/lib/supabase';

const MODES = new Set(['normal', 'carrera']);

/**
 * Define modo interlock Auto EC/pH — MQTT set_level_interlock + PATCH optimistic.
 * normal = libera se ≠ vazio; carrera = só libera no alto (4/4).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id || '').trim();
    const mode = String(body.mode || '').trim().toLowerCase();

    if (!validateDeviceId(deviceId)) {
      return NextResponse.json(
        configApiErrorResponse('device_id inválido', 400),
        { status: 400 }
      );
    }

    if (!MODES.has(mode)) {
      return NextResponse.json(
        configApiErrorResponse('mode inválido (normal|carrera)', 400),
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
      action: 'set_level_interlock',
      mode,
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

    // Optimistic UI — ESP confirmará via telemetry/levels interlock_mode
    const nowIso = new Date().toISOString();
    const { error: patchError } = await supabase
      .from('device_status')
      .update({
        level_interlock_mode: mode,
        updated_at: nowIso,
      })
      .eq('device_id', deviceId);

    if (patchError) {
      console.warn('[level-interlock] PATCH device_status:', patchError.message);
    }

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    console.error('Erro em POST /api/level-interlock:', error);
    return NextResponse.json(
      configApiErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      ),
      { status: 500 }
    );
  }
}

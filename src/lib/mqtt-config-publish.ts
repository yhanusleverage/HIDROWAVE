/**
 * Publish retained Auto EC/pH config após UPSERT na view.
 * Skip silencioso se MQTT_HOST/creds ausentes (ESP ainda pode GET).
 */
import {
  buildEcConfigMqttPayload,
  buildPhConfigMqttPayload,
  mqttControllerConfigTopic,
  type ControllerConfigKind,
} from '@/lib/mqtt-controller-config';

async function publishMqttRetained(
  topic: string,
  body: unknown
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const host = process.env.MQTT_HOST;
  const user = process.env.MQTT_PUBLISH_USER || process.env.MQTT_USER;
  const pass = process.env.MQTT_PUBLISH_PASS || process.env.MQTT_PASS;
  const port = parseInt(process.env.MQTT_PORT || '1883', 10);

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[MQTT CONFIG] skip — defina MQTT_HOST + MQTT_PUBLISH_USER/PASS'
      );
    }
    return { ok: false, skipped: true };
  }

  const mqtt = await import('mqtt');

  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtt://${host}:${port}`, {
      username: user,
      password: pass,
      connectTimeout: 5000,
    });

    let settled = false;
    const finish = (result: { ok: boolean; skipped?: boolean; error?: string }) => {
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
      client.publish(topic, JSON.stringify(body), { qos: 1, retain: true }, (err) => {
        if (err) {
          finish({ ok: false, error: err.message });
        } else {
          console.log(`[MQTT CONFIG] retained → ${topic}`);
          finish({ ok: true });
        }
      });
    });

    client.on('error', (err) => {
      finish({ ok: false, error: err.message });
    });

    setTimeout(() => finish({ ok: false, error: 'mqtt connect timeout' }), 6000);
  });
}

export async function notifyDeviceControllerConfig(
  kind: ControllerConfigKind,
  deviceId: string,
  row: Record<string, unknown>
): Promise<void> {
  let topic: string;
  let body: Record<string, unknown>;
  try {
    topic = mqttControllerConfigTopic(deviceId, kind);
    body =
      kind === 'ec'
        ? buildEcConfigMqttPayload(deviceId, row)
        : buildPhConfigMqttPayload(deviceId, row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[MQTT CONFIG] schema reject:', msg);
    return;
  }

  const result = await publishMqttRetained(topic, body);
  if (!result.ok && !result.skipped) {
    console.warn(
      `[MQTT CONFIG] falhou (${kind} ${deviceId}) — ESP usa GET HTTPS se MQTT cair:`,
      result.error
    );
  }
}

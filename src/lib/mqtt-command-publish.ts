/**
 * Fase 3 — push MQTT após INSERT relay_commands.
 * Schema: mqtt-relay-command-schema.ts (v1)
 * Se MQTT_HOST/credenciais ausentes, skip silencioso (fallback HTTPS poll no ESP).
 */
import {
  buildMqttRelayCommandMessageV1,
  mqttCommandTopic,
  type MqttRelayCommandNotifyInput,
} from '@/lib/mqtt-relay-command-schema';

export type { MqttRelayCommandNotifyInput as MqttRelayCommandPayload };

export async function publishRelayCommandMqtt(
  payload: MqttRelayCommandNotifyInput
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const host = process.env.MQTT_HOST;
  const user = process.env.MQTT_PUBLISH_USER || process.env.MQTT_USER;
  const pass = process.env.MQTT_PUBLISH_PASS || process.env.MQTT_PASS;
  const port = parseInt(process.env.MQTT_PORT || '1883', 10);

  if (!host || !user || !pass) {
    return { ok: false, skipped: true };
  }

  let body: ReturnType<typeof buildMqttRelayCommandMessageV1>;
  let topic: string;
  try {
    body = buildMqttRelayCommandMessageV1(payload);
    topic = mqttCommandTopic(payload.device_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[MQTT CMD] schema reject id=${payload.id}:`, msg);
    return { ok: false, error: msg };
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
      client.publish(topic, JSON.stringify(body), { qos: 1 }, (err) => {
        if (err) {
          finish({ ok: false, error: err.message });
        } else {
          console.log(
            `[MQTT CMD] published id=${payload.id} type=${body.command_type} pri=${body.priority} → ${topic}`
          );
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

export async function notifyDeviceRelayCommand(
  payload: MqttRelayCommandNotifyInput
): Promise<void> {
  const result = await publishRelayCommandMqtt(payload);
  if (!result.ok && !result.skipped) {
    console.warn(
      `[MQTT CMD] falhou (id=${payload.id}) — ESP usa poll HTTPS:`,
      result.error
    );
  }
}

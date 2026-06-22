import { NextResponse } from 'next/server';

/**
 * Diagnóstico: variáveis MQTT publish (Fase 3 — comandos rápidos UI → ESP).
 * Não expõe passwords.
 */
export async function GET() {
  const host = process.env.MQTT_HOST?.trim();
  const port = process.env.MQTT_PORT?.trim() || '1883';
  const user =
    process.env.MQTT_PUBLISH_USER?.trim() || process.env.MQTT_USER?.trim();
  const pass =
    process.env.MQTT_PUBLISH_PASS?.trim() || process.env.MQTT_PASS?.trim();

  const hasHost = Boolean(host && host !== '127.0.0.1');
  const hasUser = Boolean(user);
  const hasPass = Boolean(pass);
  const ready = hasHost && hasUser && hasPass;

  return NextResponse.json({
    ok: ready,
    mqttPublishConfigured: ready,
    host: host || null,
    port,
    publishUser: user || null,
    hasPublishPass: hasPass,
    warnings: [
      ...(!host ? ['MQTT_HOST ausente'] : []),
      ...(host === '127.0.0.1'
        ? ['MQTT_HOST=127.0.0.1 só funciona na VM — use IP público Lightsail no Railway']
        : []),
      ...(!hasUser ? ['MQTT_PUBLISH_USER ou MQTT_USER ausente'] : []),
      ...(!hasPass ? ['MQTT_PUBLISH_PASS ou MQTT_PASS ausente'] : []),
    ],
    fallback:
      'Sem MQTT publish, ESP usa poll HTTPS ~60s (MQTT online) ou ~10s (MQTT down)',
    doc: 'docs/RAILWAY_MQTT_ENV.md',
    slaveDoc: 'docs/MQTT_COMANDOS_RAPIDOS_SLAVES.md',
  });
}

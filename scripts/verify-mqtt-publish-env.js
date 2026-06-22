/**
 * Verifica variáveis MQTT publish para comandos rápidos (Fase 3).
 * Uso: node scripts/verify-mqtt-publish-env.js
 * Dev: carrega .env.local se existir (Next não carrega automaticamente neste script).
 */
const fs = require('fs');
const path = require('path');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnvLocal();

const host = process.env.MQTT_HOST?.trim();
const port = process.env.MQTT_PORT || '1883';
const user =
  process.env.MQTT_PUBLISH_USER?.trim() || process.env.MQTT_USER?.trim();
const pass =
  process.env.MQTT_PUBLISH_PASS?.trim() || process.env.MQTT_PASS?.trim();

let failed = 0;

function check(label, ok, hint) {
  if (ok) {
    console.log(`OK   ${label}`);
  } else {
    console.error(`FAIL ${label}${hint ? ` — ${hint}` : ''}`);
    failed++;
  }
}

check('MQTT_HOST definido', Boolean(host));
check(
  'MQTT_HOST não é 127.0.0.1 (Railway/dev remoto)',
  Boolean(host && host !== '127.0.0.1'),
  'use IP Lightsail ex. 99.79.36.220'
);
check('MQTT_PUBLISH_USER ou MQTT_USER', Boolean(user));
check('MQTT_PUBLISH_PASS ou MQTT_PASS', Boolean(pass));
console.log(`Porta: ${port}`);

if (failed > 0) {
  console.error(`\n${failed} verificação(ões) falharam. Ver docs/RAILWAY_MQTT_ENV.md`);
  process.exit(1);
}
console.log('\nMQTT publish env OK — UI pode publicar comandos <2s.');

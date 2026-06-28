/**
 * Verifica paridade relay_slaves (Supabase) + indica se bridge deve fazer upsert completo.
 * Uso: node scripts/verify-slave-relay-states-e2e.js
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou anon se RLS permitir SELECT)
 */
const slaveDeviceId = process.env.SLAVE_DEVICE_ID || 'ESP32_SLAVE_14_33_5C_38_BF_60';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou anon)');
    process.exit(1);
  }

  const res = await fetch(
    `${url}/rest/v1/relay_slaves?device_id=eq.${encodeURIComponent(slaveDeviceId)}&select=device_id,relay_states,last_update,updated_at`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );

  if (!res.ok) {
    console.error('HTTP', res.status, await res.text());
    process.exit(1);
  }

  const rows = await res.json();
  const row = rows[0];
  if (!row) {
    console.error('Sem linha relay_slaves para', slaveDeviceId);
    process.exit(1);
  }

  const states = row.relay_states || [];
  const onCount = states.filter(Boolean).length;
  const ageMs = Date.now() - new Date(row.last_update || row.updated_at).getTime();

  console.log('device_id:', row.device_id);
  console.log('relay_states:', JSON.stringify(states));
  console.log('relés ON:', onCount, '/ 8');
  console.log('last_update age:', Math.round(ageMs / 1000), 's');

  if (onCount === 0 && ageMs < 120000) {
    console.warn(
      '⚠️ UI provavelmente OFF: cloud tem 0 ON mas link recente — bridge pode estar só link-only.'
    );
    console.warn('   Lightsail: journalctl -u hidrowave-bridge -f | grep relay_slaves');
    console.warn('   Esperado após fix: PATCH relay_slaves (upsert) com relay_states[], não só link-only');
  }

  if (onCount > 0) {
    console.log('✅ G2 parcial: pelo menos 1 relé ON em Supabase — reload UI / Realtime WSS');
  }

  process.exit(onCount > 0 || ageMs > 300000 ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

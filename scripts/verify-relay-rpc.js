#!/usr/bin/env node
/**
 * Verifica cola relay_commands + RPC (somente leitura por defeito).
 * Uso:
 *   $env:VERIFY_DEVICE_ID="ESP32_HIDRO_1A575C"
 *   node scripts/verify-relay-rpc.js
 *   node scripts/verify-relay-rpc.js --lock   (PERIGOSO: chama RPC lock p_limit=1)
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '..', '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEVICE_ID = process.env.VERIFY_DEVICE_ID || 'ESP32_HIDRO_1A575C';
const lockRpc = process.argv.includes('--lock');
const readOnly = !lockRpc;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
}

if (!process.env.VERIFY_DEVICE_ID) {
  console.warn(`AVISO: VERIFY_DEVICE_ID não definido — usando default ${DEVICE_ID}`);
  console.warn('       Defina: $env:VERIFY_DEVICE_ID="ESP32_HIDRO_1A575C"\n');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  let ok = true;

  const pending = await supabase
    .from('relay_commands')
    .select('id, relay_number, status, action, duration_seconds, created_at, target_device_id')
    .eq('device_id', DEVICE_ID)
    .in('status', ['pending', 'sent'])
    .order('created_at', { ascending: true });

  if (pending.error) {
    console.error('FAIL pending query:', pending.error.message);
    process.exit(1);
  }

  console.log(`\n=== Pending/sent (${pending.data?.length ?? 0}) device=${DEVICE_ID} ===`);
  for (const row of pending.data || []) {
    console.log(
      `  id=${row.id} relay=${row.relay_number} status=${row.status} action=${row.action} dur=${row.duration_seconds} tgt=${row.target_device_id || 'local'}`
    );
  }

  if (readOnly) {
    console.log('\n(read-only — use --lock para chamar RPC; p_limit=1 quando lock)');
    console.log('MQTT path: UI INSERT → publish command → ESP command_ack → bridge RPC');
    process.exit(ok ? 0 : 1);
  }

  console.log('\n=== RPC get_and_lock_master_commands (limit=1) ===');
  console.log('AVISO: marca pending local → sent');

  const rpc = await supabase.rpc('get_and_lock_master_commands', {
    p_device_id: DEVICE_ID,
    p_limit: 1,
    p_timeout_seconds: 30,
  });

  if (rpc.error) {
    console.error('FAIL RPC master:', rpc.error.message);
    ok = false;
  } else {
    const rows = rpc.data || [];
    console.log(`RPC master OK — ${rows.length} linha(s)`);
    for (const row of rows) {
      const relay = row.relay_number ?? row.relay_numbers?.[0];
      console.log(`  id=${row.id} relay=${relay} status=${row.status} action=${row.action}`);
    }
  }

  const pendingSlave = (pending.data || []).filter(
    (r) => r.status === 'pending' && r.target_device_id
  );
  console.log('\n=== RPC get_and_lock_slave_commands (limit=1) ===');
  console.log(`Pending slave (target MAC): ${pendingSlave.length}`);

  const rpcSlave = await supabase.rpc('get_and_lock_slave_commands', {
    p_master_device_id: DEVICE_ID,
    p_limit: 1,
    p_timeout_seconds: 30,
  });

  if (rpcSlave.error) {
    console.error('FAIL RPC slave:', rpcSlave.error.message);
    ok = false;
  } else {
    const slaveRows = rpcSlave.data || [];
    console.log(`RPC slave OK — ${slaveRows.length} linha(s)`);
    for (const row of slaveRows) {
      const mac = row.slave_mac_address ?? row.target_device_id;
      console.log(
        `  id=${row.id} relay=${row.relay_number} mac=${mac} status=${row.status} action=${row.action}`
      );
    }
  }

  const after = await supabase
    .from('relay_commands')
    .select('id, status')
    .eq('device_id', DEVICE_ID)
    .in('id', (pending.data || []).map((r) => r.id));

  if (!after.error && after.data?.length) {
    console.log('\n=== Status após RPC ===');
    for (const row of after.data) {
      console.log(`  id=${row.id} status=${row.status}`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

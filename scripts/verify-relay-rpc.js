#!/usr/bin/env node
/**
 * Verifica RPC get_and_lock_master_commands + pending relay_commands.
 * Uso: node scripts/verify-relay-rpc.js
 *      node scripts/verify-relay-rpc.js --dry-run   (só preview, não chama RPC)
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
const DEVICE_ID = process.env.VERIFY_DEVICE_ID || 'ESP32_HIDRO_269844';
const dryRun = process.argv.includes('--dry-run');

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
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

  console.log(`\n=== Pending/sent (${pending.data?.length ?? 0}) ===`);
  for (const row of pending.data || []) {
    console.log(
      `  id=${row.id} relay=${row.relay_number} status=${row.status} action=${row.action} dur=${row.duration_seconds}`
    );
  }

  if (dryRun) {
    console.log('\n(dry-run: RPC não chamada — comandos não serão locked)');
    return;
  }

  console.log('\n=== RPC get_and_lock_master_commands (limit=5) ===');
  console.log('AVISO: isto marca pending → sent (como o ESP faria no poll)');

  const rpc = await supabase.rpc('get_and_lock_master_commands', {
    p_device_id: DEVICE_ID,
    p_limit: 5,
    p_timeout_seconds: 30,
  });

  if (rpc.error) {
    console.error('FAIL RPC:', rpc.error.message, rpc.error.code, rpc.error.hint || '');
    console.error('\n→ Execute scripts/PRODUCTION_RPC_GET_AND_LOCK_MASTER.sql no Supabase SQL Editor');
    process.exit(1);
  }

  const rows = rpc.data || [];
  if (rows.length === 0) {
    const pendingOnly = (pending.data || []).filter((r) => r.status === 'pending');
    if (pendingOnly.length === 0) {
      console.log('RPC OK — 0 linhas (sem pending local; normal se tudo sent/completed/failed)');
    } else {
      console.log('RPC retornou 0 linhas mas há pending — verifique PRODUCTION_RPC_GET_AND_LOCK_MASTER.sql');
      ok = false;
    }
  } else {
    for (const row of rows) {
      const relay = row.relay_number ?? row.relay_numbers?.[0];
      console.log(
        `  OK id=${row.id} relay=${relay} status=${row.status} action=${row.action}`
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

  const sentStuck = (pending.data || []).filter((r) => r.status === 'sent');
  if (sentStuck.length > 0) {
    console.log('\n⚠ Sent sem completed — limpar antes de novo teste manual:');
    console.log('   SQL: LIMPAR_RELAY_COMMANDS_STUCK.sql opção A (IDs 97,98,99)');
    console.log('   ou: node scripts/cleanup-relay-stuck.js --ids=97,98,99');
    console.log('\nTeste manual (após limpar):');
    console.log('   1. Dosificar em /automacao');
    console.log('   2. Serial ESP: [CMD https] id=… master R… + Processando comando local');
    console.log('   3. Mapa: Manual pendente desaparece em ~5s');
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Marca relay_commands stuck como failed (IDs ou pending/sent antigos).
 * Uso: node scripts/cleanup-relay-stuck.js
 *      node scripts/cleanup-relay-stuck.js --ids=97,98,99
 *      node scripts/cleanup-relay-stuck.js --all
 *      node scripts/cleanup-relay-stuck.js --dry-run
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
const cleanAll = process.argv.includes('--all');
const markCompleted = process.argv.includes('--completed');

const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const DEFAULT_IDS = [131, 132, 133, 134, 135];
const ids = idsArg
  ? idsArg
      .slice(6)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  : DEFAULT_IDS;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  let previewQuery = supabase
    .from('relay_commands')
    .select('id, relay_number, status, created_at, sent_at')
    .eq('device_id', DEVICE_ID);

  if (cleanAll) {
    previewQuery = previewQuery.in('status', ['pending', 'sent']);
  } else {
    previewQuery = previewQuery.in('id', ids);
  }

  const preview = await previewQuery;

  if (preview.error) {
    console.error('FAIL preview:', preview.error.message);
    process.exit(1);
  }

  console.log(`\n=== Preview cleanup (${preview.data?.length ?? 0} rows) ===`);
  for (const row of preview.data || []) {
    console.log(`  id=${row.id} relay=${row.relay_number} status=${row.status}`);
  }

  if (!preview.data?.length) {
    console.log('Nada a limpar — cola pending/sent já vazia.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n(dry-run: sem UPDATE)');
    process.exit(0);
  }

  const updatePayload = markCompleted
    ? {
        status: 'completed',
        error_message: null,
        completed_at: new Date().toISOString(),
      }
    : {
        status: 'failed',
        error_message: 'stuck pending/sent — limpeza manual Jun/2026',
        completed_at: new Date().toISOString(),
      };

  let updateQuery = supabase
    .from('relay_commands')
    .update(updatePayload)
    .eq('device_id', DEVICE_ID)
    .in('status', ['pending', 'sent']);

  if (!cleanAll) {
    updateQuery = updateQuery.in('id', ids);
  }

  const { data, error } = await updateQuery.select('id, status, relay_number');

  if (error) {
    console.error('FAIL update:', error.message, error.code);
    process.exit(1);
  }

  console.log(`\n=== Limpos ${data?.length ?? 0} comandos ===`);
  for (const row of data || []) {
    console.log(`  id=${row.id} relay=${row.relay_number} → ${row.status}`);
  }

  const remaining = await supabase
    .from('relay_commands')
    .select('id, status')
    .eq('device_id', DEVICE_ID)
    .in('status', ['pending', 'sent']);

  console.log(`\nPending/sent restantes: ${remaining.data?.length ?? 0}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

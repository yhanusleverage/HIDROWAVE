#!/usr/bin/env node
/**
 * Verifica schema E2E Última dosagem en Supabase (anon key).
 * Uso: node scripts/verify-e2e-schema.js
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const results = { ok: true, checks: [] };

  function record(name, pass, detail) {
    results.checks.push({ name, pass, detail });
    if (!pass) results.ok = false;
    console.log(`${pass ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  }

  const dosages = await supabase.from('nutrient_dosages').select('id').limit(1);
  record(
    'nutrient_dosages table',
    !dosages.error,
    dosages.error ? dosages.error.message : `accessible (${dosages.data?.length ?? 0} sample rows)`
  );

  const relay = await supabase
    .from('relay_master')
    .select('device_id,ec_operation_state,ec_operation_remaining_sec,ec_next_check_in_sec')
    .eq('device_id', DEVICE_ID)
    .maybeSingle();

  const hasEcCols =
    !relay.error &&
    relay.data &&
    'ec_operation_state' in relay.data &&
    'ec_operation_remaining_sec' in relay.data &&
    'ec_next_check_in_sec' in relay.data;

  record(
    'relay_master ec_operation_* columns',
    hasEcCols,
    relay.error
      ? relay.error.message
      : relay.data
        ? `state=${relay.data.ec_operation_state} remaining=${relay.data.ec_operation_remaining_sec}s`
        : 'no row for device'
  );

  const count = await supabase
    .from('nutrient_dosages')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', DEVICE_ID);

  record(
    'nutrient_dosages rows for device',
    !count.error,
    count.error ? count.error.message : `${count.count ?? 0} rows`
  );

  const cropTables = ['crop_tasks', 'crop_day_notes', 'crop_alarms', 'crop_events'];
  for (const table of cropTables) {
    const res = await supabase.from(table).select('id').limit(1);
    record(
      `${table} table`,
      !res.error,
      res.error ? res.error.message : `accessible (${res.data?.length ?? 0} sample rows)`
    );
  }

  const phConfig = await supabase.from('ph_config_view').select('device_id').limit(1);
  record(
    'ph_config_view table',
    !phConfig.error,
    phConfig.error ? phConfig.error.message : 'accessible'
  );

  const phRelay = await supabase
    .from('relay_master')
    .select('device_id,ph_operation_state,ph_operation_remaining_sec,ph_next_check_in_sec')
    .eq('device_id', DEVICE_ID)
    .maybeSingle();

  const hasPhCols =
    !phRelay.error &&
    phRelay.data &&
    'ph_operation_state' in phRelay.data;

  record(
    'relay_master ph_operation_* columns',
    hasPhCols,
    phRelay.error
      ? phRelay.error.message
      : phRelay.data
        ? `state=${phRelay.data.ph_operation_state}`
        : 'no row for device'
  );

  console.log('\n' + (results.ok ? 'SCHEMA OK' : 'SCHEMA INCOMPLETE — ejecutar scripts SQL en Supabase'));
  process.exit(results.ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

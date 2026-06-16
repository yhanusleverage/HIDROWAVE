#!/usr/bin/env node
/**
 * Verificación E2E ec_controller_metrics + ph_controller_metrics
 * Uso: node scripts/verify-controller-metrics-e2e.js
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

function isMissingTable(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('does not exist') || err?.code === '42P01' || err?.code === 'PGRST205';
}

async function main() {
  let ok = true;

  function record(name, pass, detail) {
    if (!pass) ok = false;
    console.log(`${pass ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  }

  const ecProbe = await supabase.from('ec_controller_metrics').select('id').limit(1);
  record(
    'ec_controller_metrics table',
    !ecProbe.error || !isMissingTable(ecProbe.error),
    ecProbe.error
      ? isMissingTable(ecProbe.error)
        ? 'FALTA — ejecutar CRIAR_TABELA_EC_CONTROLLER_METRICS.sql'
        : ecProbe.error.message
      : 'accessible'
  );

  const phProbe = await supabase.from('ph_controller_metrics').select('id').limit(1);
  record(
    'ph_controller_metrics table',
    !phProbe.error || !isMissingTable(phProbe.error),
    phProbe.error
      ? isMissingTable(phProbe.error)
        ? 'FALTA — ejecutar CRIAR_TABELA_PH_CONTROLLER_METRICS.sql'
        : phProbe.error.message
      : 'accessible'
  );

  if (!ecProbe.error) {
    const { data, error } = await supabase
      .from('ec_controller_metrics')
      .select('ec_error, dosage_ml, created_at')
      .eq('device_id', DEVICE_ID)
      .order('created_at', { ascending: false })
      .limit(5);
    record(
      'recent EC metrics',
      !error,
      error ? error.message : `${data?.length ?? 0} rows (last 5)`
    );
    if (data?.length) {
      for (const row of data) {
        console.log(`  ${row.created_at} | err=${row.ec_error} | u(t)=${row.dosage_ml} ml`);
      }
    }
  }

  if (!phProbe.error) {
    const { data, error } = await supabase
      .from('ph_controller_metrics')
      .select('error_h, dose_real_ml, created_at')
      .eq('device_id', DEVICE_ID)
      .order('created_at', { ascending: false })
      .limit(5);
    record(
      'recent pH metrics',
      !error,
      error ? error.message : `${data?.length ?? 0} rows (last 5)`
    );
    if (data?.length) {
      for (const row of data) {
        console.log(`  ${row.created_at} | errH=${row.error_h} | u(t)=${row.dose_real_ml} ml`);
      }
    }
  }

  console.log('\nSQL: VERIFICAR_CONTROLLER_METRICS_E2E.sql');
  console.log('\n' + (ok ? 'E2E controller metrics OK' : 'E2E INCOMPLETE — ejecutar SQL scripts'));
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

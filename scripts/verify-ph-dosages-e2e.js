#!/usr/bin/env node
/**
 * Verificación E2E ph_dosages — misma lógica que PhDosageDetail / PhAutoStatusCard
 * Uso: node scripts/verify-ph-dosages-e2e.js
 * Opcional: VERIFY_DEVICE_ID=ESP32_HIDRO_269844 node scripts/verify-ph-dosages-e2e.js
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

async function fetchLastPhDosage(deviceId) {
  const { data: rows, error } = await supabase
    .from('ph_dosages')
    .select(
      'sequence_id, direction, dosage_ml, relay_number, ph_before, ph_setpoint, created_at'
    )
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!rows?.length) {
    return { row: null };
  }
  return { row: rows[0] };
}

async function main() {
  let ok = true;

  function record(name, pass, detail) {
    if (!pass) ok = false;
    console.log(`${pass ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  }

  const probe = await supabase.from('ph_dosages').select('id').limit(1);
  record(
    'ph_dosages accessible',
    !probe.error,
    probe.error ? probe.error.message : 'table readable'
  );

  const { data: recent, error: recentErr } = await supabase
    .from('ph_dosages')
    .select(
      'device_id, sequence_id, direction, dosage_ml, relay_number, ph_before, ph_setpoint, created_at'
    )
    .eq('device_id', DEVICE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  record(
    'recent rows for device',
    !recentErr,
    recentErr ? recentErr.message : `${recent?.length ?? 0} rows (last 10)`
  );

  if (recent?.length) {
    console.log('\nÚltimas filas:');
    for (const row of recent) {
      console.log(
        `  ${row.created_at} | seq=${row.sequence_id} | ${row.direction} | ${row.dosage_ml} ml | relé ${row.relay_number} | pH ${row.ph_before} → SP ${row.ph_setpoint}`
      );
    }
  }

  try {
    const last = await fetchLastPhDosage(DEVICE_ID);
    record(
      'última dosagem pH (PhDosageDetail)',
      last.row != null && Number(last.row.dosage_ml) >= 0,
      last.row
        ? `seq=${last.row.sequence_id} ${last.row.direction} ${last.row.dosage_ml} ml`
        : 'sin dosagens para device'
    );
  } catch (err) {
    record('última dosagem pH', false, err.message);
  }

  const relay = await supabase
    .from('relay_master')
    .select('ph_operation_state, ph_operation_remaining_sec, ph_next_check_in_sec')
    .eq('device_id', DEVICE_ID)
    .maybeSingle();

  record(
    'relay_master ph_operation',
    !relay.error && relay.data,
    relay.error
      ? relay.error.message
      : `state=${relay.data?.ph_operation_state} rem=${relay.data?.ph_operation_remaining_sec}s next=${relay.data?.ph_next_check_in_sec}s`
  );

  console.log(
    '\nDedup: verificar idx_ph_dosages_dedup en SQL Editor (NUTRIENT_DOSAGES_DEDUP_INDEX.sql §2)'
  );

  const realtimeOk = await new Promise((resolve) => {
    const channel = supabase
      .channel(`verify-ph-dosages-${DEVICE_ID}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ph_dosages',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        () => {}
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          supabase.removeChannel(channel);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(channel);
          resolve(false);
        }
      });
    setTimeout(() => {
      supabase.removeChannel(channel);
      resolve(false);
    }, 8000);
  });

  record(
    'supabase_realtime ph_dosages',
    realtimeOk,
    realtimeOk
      ? 'channel SUBSCRIBED'
      : 'CHANNEL_ERROR — ejecutar ENABLE_REALTIME_REPLICATION.sql'
  );

  console.log('\n' + (ok ? 'E2E ph_dosages OK' : 'E2E INCOMPLETE — revisar SQL scripts'));
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Verificación E2E nutrient_dosages — misma lógica que useLastDosage.ts
 * Uso: node scripts/verify-nutrient-dosages-e2e.js
 * Opcional: VERIFY_DEVICE_ID=ESP32_HIDRO_269844 node scripts/verify-nutrient-dosages-e2e.js
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

async function fetchLastDosageSum(deviceId) {
  const { data: latestRows, error: latestError } = await supabase
    .from('nutrient_dosages')
    .select('sequence_id, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (latestError) throw latestError;
  if (!latestRows?.length) {
    return { totalMl: null, sequenceId: null, nutrientes: 0, rows: [] };
  }

  const sequenceId = latestRows[0].sequence_id;
  const { data: seqRows, error: seqError } = await supabase
    .from('nutrient_dosages')
    .select('nutrient_name, dosage_ml, relay_number, created_at')
    .eq('device_id', deviceId)
    .eq('sequence_id', sequenceId);

  if (seqError) throw seqError;

  const totalMl = (seqRows ?? []).reduce(
    (sum, row) => sum + (Number(row.dosage_ml) || 0),
    0
  );

  return {
    totalMl: totalMl > 0 ? Math.round(totalMl * 1000) / 1000 : null,
    sequenceId,
    nutrientes: seqRows?.length ?? 0,
    rows: seqRows ?? [],
  };
}

async function main() {
  let ok = true;

  function record(name, pass, detail) {
    if (!pass) ok = false;
    console.log(`${pass ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  }

  const probe = await supabase.from('nutrient_dosages').select('id').limit(1);
  record(
    'nutrient_dosages accessible',
    !probe.error,
    probe.error ? probe.error.message : 'table readable'
  );

  const { data: recent, error: recentErr } = await supabase
    .from('nutrient_dosages')
    .select('device_id, sequence_id, nutrient_name, dosage_ml, relay_number, created_at')
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
        `  ${row.created_at} | seq=${row.sequence_id} | ${row.nutrient_name} | ${row.dosage_ml} ml | relé ${row.relay_number}`
      );
    }
  }

  try {
    const sum = await fetchLastDosageSum(DEVICE_ID);
    record(
      'useLastDosage SUM (último sequence_id)',
      sum.totalMl != null && sum.nutrientes >= 1,
      sum.sequenceId
        ? `seq=${sum.sequenceId} total=${sum.totalMl} ml (${sum.nutrientes} nutrientes)`
        : 'sin dosagens para device'
    );

    if (sum.rows.length) {
      console.log('\nDetalle último ciclo:');
      for (const row of sum.rows) {
        console.log(`  ${row.nutrient_name}: ${row.dosage_ml} ml`);
      }
    }
  } catch (err) {
    record('useLastDosage SUM', false, err.message);
  }

  const relay = await supabase
    .from('relay_master')
    .select('ec_operation_state, ec_operation_remaining_sec')
    .eq('device_id', DEVICE_ID)
    .maybeSingle();

  record(
    'relay_master ec_operation',
    !relay.error && relay.data,
    relay.error
      ? relay.error.message
      : `state=${relay.data?.ec_operation_state} rem=${relay.data?.ec_operation_remaining_sec}s`
  );

  console.log(
    '\nDedup: HTTP 409 en ESP serial confirma idx_nutrient_dosages_dedup activo'
  );

  // Realtime: probar suscripción breve (requiere publication en Supabase)
  const realtimeOk = await new Promise((resolve) => {
    const channel = supabase
      .channel(`verify-dosages-${DEVICE_ID}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nutrient_dosages',
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
    'supabase_realtime nutrient_dosages',
    realtimeOk,
    realtimeOk
      ? 'channel SUBSCRIBED'
      : 'CHANNEL_ERROR — ejecutar ENABLE_REALTIME_REPLICATION.sql'
  );

  console.log('\n' + (ok ? 'E2E nutrient_dosages OK' : 'E2E INCOMPLETE — revisar SQL scripts'));
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Verificación E2E hydro_measurements — EC único (solo columna ec en inserts nuevos)
 * Uso: node scripts/verify-hydro-raw-e2e.js
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
const MAX_AGE_MIN = Number(process.env.VERIFY_HYDRO_MAX_AGE_MIN || 10);

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function record(name, pass, detail) {
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  return pass;
}

function isNullOrZero(v) {
  return v == null || v === 0;
}

async function main() {
  let ok = true;

  const { data, error } = await supabase
    .from('hydro_measurements')
    .select(
      'device_id, created_at, ph_raw, ph_display_clamped, ph, ec, ec_raw, tds, temperature, temperature_raw, water_level_ok, level_1'
    )
    .eq('device_id', DEVICE_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('FAIL hydro query:', error.message);
    if (error.message.includes('column') && error.message.includes('ec')) {
      console.error('  → Ejecute ADD_HYDRO_EC_COLUMN.sql en Supabase SQL Editor');
    }
    process.exit(1);
  }

  ok = record('recent hydro rows', (data?.length ?? 0) > 0, `${data?.length ?? 0} rows`) && ok;

  const newest = data?.[0];
  if (newest) {
    const ageMin = (Date.now() - new Date(newest.created_at).getTime()) / 60000;
    ok =
      record(
        'fresh insert',
        ageMin <= MAX_AGE_MIN,
        `last row ${ageMin.toFixed(1)} min ago (max ${MAX_AGE_MIN})`
      ) && ok;

    for (const row of data) {
      console.log(
        `  ${row.created_at} | ph_raw=${row.ph_raw ?? '-'} ph_disp=${row.ph_display_clamped ?? '-'} ph=${row.ph ?? '-'} temp=${row.temperature ?? '-'} ec=${row.ec ?? '-'} ec_raw=${row.ec_raw ?? '-'} tds=${row.tds ?? '-'}`
      );
    }

    const hasPhRaw = data.some((r) => r.ph_raw != null);
    const hasEc = newest.ec != null && newest.ec !== 0;
    const hasSensorRow = data.some(
      (r) =>
        r.ph_raw != null ||
        r.temperature_raw != null ||
        (r.ph !== 0 && r.ph != null) ||
        (r.ec != null && r.ec !== 0) ||
        (r.ec_raw != null && r.ec_raw !== 0) ||
        (r.tds != null && r.tds !== 0)
    );

    ok = record('ph_raw populated', hasPhRaw, hasPhRaw ? 'at least one row' : 'all NULL — bridge levels-only or ESP sin ph') && ok;
    ok =
      record(
        'ec populated (newest)',
        hasEc || !hasSensorRow,
        hasEc
          ? `ec=${newest.ec} µS/cm`
          : hasSensorRow
            ? 'sensor row without ec — deploy bridge + ADD_HYDRO_EC_COLUMN.sql'
            : 'no sensor rows (levels-only OK)'
      ) && ok;

    const ecSingleWrite =
      !hasSensorRow ||
      (hasEc && isNullOrZero(newest.tds) && isNullOrZero(newest.ec_raw));
    ok =
      record(
        'ec single-write (tds/ec_raw null on newest)',
        ecSingleWrite,
        ecSingleWrite
          ? 'only ec column active'
          : `newest still has tds=${newest.tds ?? '-'} ec_raw=${newest.ec_raw ?? '-'} — deploy bridge + HYDRO_EC_SINGLE_WRITE.sql`
      ) && ok;

    if (!hasPhRaw && hasSensorRow) {
      console.log('  (tip: filas recientes pueden ser levels-only; buscar fila con ph_raw en SQL)');
    }
  }

  console.log('\nSQL: scripts/HYDRO_EC_SINGLE_WRITE.sql + VERIFICAR_HYDRO_RAW_COLUMNS.sql');
  console.log(
    '\n' +
      (ok
        ? 'E2E hydro EC único OK'
        : 'E2E hydro INCOMPLETE — deploy bridge, HYDRO_EC_SINGLE_WRITE.sql, journalctl')
  );
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 VERIFICANDO ESQUEMA DE BASE DE DATOS');
  console.log('=====================================\n');

  try {
    // Obtener información de las tablas
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info');

    if (tablesError) {
      console.log('No se puede obtener info de tablas con RPC, probando método alternativo...\n');
    }

    // Probar diferentes nombres de tablas posibles
    const possibleTables = [
      'hydro_measurements',
      'environment_measurements',
      'environment_data',
      'sensor_data',
      'measurements',
      'hydro_data',
      'relay_states'
    ];

    console.log('Probando tablas existentes:');
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Existe (${data.length} registros de muestra)`);
          if (data.length > 0) {
            console.log(`   Columnas: ${Object.keys(data[0]).join(', ')}`);
            console.log(`   Ejemplo: ${JSON.stringify(data[0], null, 2)}`);
          }
        }
      } catch (err) {
        console.log(`❌ ${tableName}: Error - ${err.message}`);
      }
    }

    // Verificar específicamente hydro_measurements
    console.log('\n🔍 Analizando tabla hydro_measurements en detalle:');
    const { data: hydroSample, error: hydroError } = await supabase
      .from('hydro_measurements')
      .select('*')
      .limit(3);

    if (!hydroError && hydroSample.length > 0) {
      console.log('Estructura actual de hydro_measurements:');
      const columns = Object.keys(hydroSample[0]);
      columns.forEach(col => {
        const value = hydroSample[0][col];
        const type = typeof value;
        console.log(`  - ${col}: ${type} (ejemplo: ${value})`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkDatabaseSchema(); 
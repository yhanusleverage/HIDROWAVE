#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icndkcHFuZGFzYm9yaG9zZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNDI3MzEsImV4cCI6MjA2MzcxODczMX0.ouRWHqrXv0Umk8SfbyGJoc-TA2vPaGDoC_OS-auj1-A';

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
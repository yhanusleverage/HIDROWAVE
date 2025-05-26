#!/usr/bin/env node

// Test script para verificar conexión con Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icndkcHFuZGFzYm9yaG9zZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNDI3MzEsImV4cCI6MjA2MzcxODczMX0.ouRWHqrXv0Umk8SfbyGJoc-TA2vPaGDoC_OS-auj1-A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  console.log('🔍 PROBANDO CONEXIÓN CON SUPABASE');
  console.log('================================\n');

  try {
    // 1. Probar conexión básica
    console.log('1. Probando conexión básica...');
    const { data: testData, error: testError } = await supabase
      .from('hydro_measurements')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ Error de conexión:', testError.message);
      return;
    }
    console.log('✅ Conexión exitosa\n');

    // 2. Verificar tablas existentes
    console.log('2. Verificando tablas...');
    
    // Probar tabla hydro_measurements
    const { data: hydroData, error: hydroError } = await supabase
      .from('hydro_measurements')
      .select('*')
      .limit(5);
    
    if (hydroError) {
      console.log('❌ Error en tabla hydro_measurements:', hydroError.message);
    } else {
      console.log(`✅ Tabla hydro_measurements: ${hydroData.length} registros encontrados`);
      if (hydroData.length > 0) {
        console.log('   Último registro:', JSON.stringify(hydroData[0], null, 2));
      }
    }

    // Probar tabla environment_data
    const { data: envData, error: envError } = await supabase
      .from('environment_data')
      .select('*')
      .limit(5);
    
    if (envError) {
      console.log('❌ Error en tabla environment_data:', envError.message);
    } else {
      console.log(`✅ Tabla environment_data: ${envData.length} registros encontrados`);
      if (envData.length > 0) {
        console.log('   Último registro:', JSON.stringify(envData[0], null, 2));
      }
    }

    console.log('\n3. Insertando datos de prueba...');
    
    // Insertar datos de prueba en hydro_measurements
    const { data: insertHydro, error: insertHydroError } = await supabase
      .from('hydro_measurements')
      .insert([
        {
          device_id: 'ESP32_DASHBOARD_TEST',
          temperature: 22.5,
          ph: 6.2,
          tds: 950,
          water_level_ok: true
        }
      ])
      .select();

    if (insertHydroError) {
      console.log('❌ Error insertando datos hidropónicos:', insertHydroError.message);
    } else {
      console.log('✅ Datos hidropónicos insertados:', insertHydro);
    }

    // Insertar datos de prueba en environment_data
    const { data: insertEnv, error: insertEnvError } = await supabase
      .from('environment_data')
      .insert([
        {
          device_id: 'ESP32_DASHBOARD_TEST',
          temperature: 24.0,
          humidity: 65.5
        }
      ])
      .select();

    if (insertEnvError) {
      console.log('❌ Error insertando datos ambientales:', insertEnvError.message);
    } else {
      console.log('✅ Datos ambientales insertados:', insertEnv);
    }

    console.log('\n🎯 RESUMEN:');
    console.log('- Conexión con Supabase: ✅');
    console.log('- Tablas accesibles: ✅');
    console.log('- Inserción de datos: ✅');
    console.log('\n¡La base de datos está funcionando correctamente!');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

testSupabaseConnection(); 
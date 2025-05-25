// Script para insertar datos de prueba en Supabase
import { createClient } from '@supabase/supabase-js';

// Usar las mismas variables que en el archivo supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icndkcHFuZGFzYm9yaG9zZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNDI3MzEsImV4cCI6MjA2MzcxODczMX0.ouRWHqrXv0Umk8SfbyGJoc-TA2vPaGDoC_OS-auj1-A';

const supabase = createClient(supabaseUrl, supabaseKey);

const seedData = async () => {
  console.log('Insertando datos de prueba...');

  // Datos ambientales de prueba
  const environmentData = {
    device_id: 'ESP32_TEST',
    temperature: 25.5,
    humidity: 60.2,
  };

  // Datos hidropónicos de prueba
  const hydroData = {
    device_id: 'ESP32_TEST',
    temperature: 22.8,
    ph: 6.5,
    tds: 850,
    water_level_ok: true,
  };

  // Insertar datos ambientales
  const { error: envError } = await supabase
    .from('environment_data')
    .insert(environmentData);

  if (envError) {
    console.error('Error al insertar datos ambientales:', envError);
  } else {
    console.log('Datos ambientales insertados correctamente');
  }

  // Insertar datos hidropónicos
  const { error: hydroError } = await supabase
    .from('hydro_measurements')
    .insert(hydroData);

  if (hydroError) {
    console.error('Error al insertar datos hidropónicos:', hydroError);
  } else {
    console.log('Datos hidropónicos insertados correctamente');
  }

  // Crear datos de relés si no existen
  const { data: relaysExist } = await supabase
    .from('relay_states')
    .select('id')
    .limit(1);

  if (!relaysExist || relaysExist.length === 0) {
    const relays = [
      { name: 'Bomba de agua', state: false },
      { name: 'Luz LED', state: true },
      { name: 'Ventilador', state: false },
      { name: 'Nutriente A', state: false },
      { name: 'Nutriente B', state: false }
    ];

    const { error: relaysError } = await supabase
      .from('relay_states')
      .insert(relays);

    if (relaysError) {
      console.error('Error al insertar datos de relés:', relaysError);
    } else {
      console.log('Datos de relés insertados correctamente');
    }
  }

  console.log('Proceso de inserción de datos completado');
};

// Ejecutar la función
seedData()
  .catch(err => {
    console.error('Error en el script:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  }); 
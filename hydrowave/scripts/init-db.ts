/**
 * Script para inicializar las tablas en Supabase
 * 
 * Para ejecutar este script:
 * 1. Configura las variables de entorno SUPABASE_URL y SUPABASE_KEY
 * 2. Ejecuta: npx ts-node scripts/init-db.ts
 */

import { createClient } from '@supabase/supabase-js';

// Obtener las credenciales de Supabase de las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL || 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseKey) {
  console.error('Error: Se requiere la clave de Supabase. Configura la variable de entorno SUPABASE_KEY.');
  process.exit(1);
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function initDatabase() {
  console.log('Inicializando la base de datos en Supabase...');

  try {
    // Crear tabla para datos ambientales
    console.log('Creando tabla environment_measurements...');
    const { error: envError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'environment_measurements',
      definition: `
        id uuid default uuid_generate_v4() primary key,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null,
        temperature numeric not null,
        humidity numeric not null
      `
    });

    if (envError) {
      throw new Error(`Error al crear tabla environment_measurements: ${envError.message}`);
    }

    // Crear tabla para datos hidropónicos
    console.log('Creando tabla hydro_measurements...');
    const { error: hydroError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'hydro_measurements',
      definition: `
        id uuid default uuid_generate_v4() primary key,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null,
        water_temperature numeric not null,
        ph numeric not null,
        tds numeric not null,
        ec numeric,
        water_level_ok boolean not null
      `
    });

    if (hydroError) {
      throw new Error(`Error al crear tabla hydro_measurements: ${hydroError.message}`);
    }

    // Crear tabla para estados de relés
    console.log('Creando tabla relay_states...');
    const { error: relayError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'relay_states',
      definition: `
        id integer primary key,
        name text not null,
        state boolean not null default false,
        timer integer
      `
    });

    if (relayError) {
      throw new Error(`Error al crear tabla relay_states: ${relayError.message}`);
    }

    // Insertar datos iniciales para los relés
    console.log('Insertando datos iniciales para los relés...');
    const relayNames = [
      'Bomba pH-',
      'Bomba pH+',
      'Bomba A',
      'Bomba B',
      'Bomba C',
      'Bomba Principal',
      'Luz UV',
      'Aerador'
    ];

    for (let i = 0; i < relayNames.length; i++) {
      const { error: insertError } = await supabase
        .from('relay_states')
        .upsert(
          { id: i + 1, name: relayNames[i], state: false },
          { onConflict: 'id' }
        );

      if (insertError) {
        throw new Error(`Error al insertar datos para el relé ${i + 1}: ${insertError.message}`);
      }
    }

    console.log('¡Inicialización de la base de datos completada con éxito!');
  } catch (err) {
    console.error('Error durante la inicialización de la base de datos:', err);
    process.exit(1);
  }
}

// Ejecutar la inicialización
initDatabase(); 
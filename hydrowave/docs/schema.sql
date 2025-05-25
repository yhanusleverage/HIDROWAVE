-- Esquema de base de datos para el sistema HydroWave
-- Este archivo contiene las definiciones de tablas para Supabase

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla para almacenar datos ambientales (temperatura y humedad)
CREATE TABLE IF NOT EXISTS environment_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  temperature NUMERIC NOT NULL,
  humidity NUMERIC NOT NULL
);

-- Tabla para almacenar datos hidropónicos
CREATE TABLE IF NOT EXISTS hydro_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  water_temperature NUMERIC NOT NULL,
  ph NUMERIC NOT NULL,
  tds NUMERIC NOT NULL,
  ec NUMERIC,
  water_level_ok BOOLEAN NOT NULL
);

-- Tabla para almacenar estados de relés
CREATE TABLE IF NOT EXISTS relay_states (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  state BOOLEAN NOT NULL DEFAULT FALSE,
  timer INTEGER
);

-- Insertar datos iniciales para los relés
INSERT INTO relay_states (id, name, state) VALUES 
  (1, 'Bomba pH-', FALSE),
  (2, 'Bomba pH+', FALSE),
  (3, 'Bomba A', FALSE),
  (4, 'Bomba B', FALSE),
  (5, 'Bomba C', FALSE),
  (6, 'Bomba Principal', FALSE),
  (7, 'Luz UV', FALSE),
  (8, 'Aerador', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_environment_measurements_created_at ON environment_measurements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hydro_measurements_created_at ON hydro_measurements (created_at DESC);

-- Función para crear una política de RLS (Row Level Security)
CREATE OR REPLACE FUNCTION create_rls_policy(
  table_name text,
  policy_name text,
  policy_definition text
) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Eliminar la política si ya existe
  BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar errores si la política no existe
  END;
  
  -- Crear la nueva política
  EXECUTE format('CREATE POLICY %I ON %I %s', policy_name, table_name, policy_definition);
END;
$$ LANGUAGE plpgsql;

-- Aplicar políticas de seguridad para los datos
SELECT create_rls_policy(
  'environment_measurements',
  'environment_measurements_select_policy',
  'FOR SELECT USING (true)'
);

SELECT create_rls_policy(
  'environment_measurements',
  'environment_measurements_insert_policy',
  'FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)'
);

SELECT create_rls_policy(
  'hydro_measurements',
  'hydro_measurements_select_policy',
  'FOR SELECT USING (true)'
);

SELECT create_rls_policy(
  'hydro_measurements',
  'hydro_measurements_insert_policy',
  'FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)'
);

SELECT create_rls_policy(
  'relay_states',
  'relay_states_select_policy',
  'FOR SELECT USING (true)'
);

SELECT create_rls_policy(
  'relay_states',
  'relay_states_update_policy',
  'FOR UPDATE USING (auth.uid() IS NOT NULL)'
);

-- Crear función almacenada para crear tablas si no existen (utilizada en init-db.ts)
CREATE OR REPLACE FUNCTION create_table_if_not_exists(
  table_name text,
  definition text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  ) THEN
    EXECUTE format('CREATE TABLE %I (%s)', table_name, definition);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
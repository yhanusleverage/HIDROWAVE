-- Verificar si activate_auto_ec es solo lectura o escribe auto_enabled=true
-- Ejecutar en Supabase SQL Editor (prod) antes del Sprint A

SELECT
  proname AS function_name,
  CASE
    WHEN prosrc ILIKE '%UPDATE%auto_enabled%true%'
      OR prosrc ILIKE '%SET auto_enabled = true%'
    THEN 'ESCRITOR — aplicar FIX_ACTIVATE_AUTO_EC_SOLO_LECTURA.sql'
    ELSE 'SOLO_LECTURA — OK para Sprint A'
  END AS rpc_mode,
  length(prosrc) AS body_length
FROM pg_proc
WHERE proname = 'activate_auto_ec';

-- Vista del cuerpo (revisión manual)
SELECT prosrc FROM pg_proc WHERE proname = 'activate_auto_ec';

-- =====================================================
-- 🔄 RPC: toggle_auto_ec - Alterna auto_enabled (TRUE ↔ FALSE)
-- =====================================================
-- 
-- USO:
--   SELECT * FROM toggle_auto_ec('ESP32_HIDRO_XXXXXX');
-- 
-- RETORNA:
--   - new_value: El nuevo valor de auto_enabled (TRUE o FALSE)
--   - device_id: El device_id actualizado
--   - updated_at: Timestamp de la actualización
--
-- SEGURIDAD:
--   - Usa SECURITY DEFINER para permisos consistentes
--   - Valida que el device_id exista
--   - Operación atómica (UPDATE + RETURNING)
--
-- =====================================================

-- =====================================================
-- PASO 1: Eliminar función anterior si existe
-- =====================================================
DROP FUNCTION IF EXISTS toggle_auto_ec(TEXT);

-- =====================================================
-- PASO 2: Crear función toggle_auto_ec
-- =====================================================
CREATE OR REPLACE FUNCTION toggle_auto_ec(p_device_id TEXT)
RETURNS TABLE (
  new_value BOOLEAN,
  device_id TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_value BOOLEAN;
  v_updated_at TIMESTAMPTZ;
BEGIN
  -- Verificar que el device_id existe
  IF NOT EXISTS (SELECT 1 FROM ec_config_view ecv WHERE ecv.device_id = p_device_id) THEN
    RAISE EXCEPTION 'Device % no encontrado en ec_config_view', p_device_id;
  END IF;

  -- Toggle atómico: NOT auto_enabled
  UPDATE ec_config_view ecv
  SET 
    auto_enabled = NOT ecv.auto_enabled,
    updated_at = now()
  WHERE ecv.device_id = p_device_id
  RETURNING ecv.auto_enabled, ecv.updated_at 
  INTO v_new_value, v_updated_at;

  -- Retornar resultado
  RETURN QUERY SELECT v_new_value, p_device_id, v_updated_at;
END;
$$;

-- =====================================================
-- PASO 3: Comentario descriptivo
-- =====================================================
COMMENT ON FUNCTION toggle_auto_ec(TEXT) IS 
  'Alterna el valor de auto_enabled en ec_config_view. '
  'Si es TRUE → FALSE, si es FALSE → TRUE. '
  'Retorna el nuevo valor para sincronizar el frontend.';

-- =====================================================
-- PASO 4: Verificación
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'toggle_auto_ec') THEN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ RPC toggle_auto_ec CREADO CON ÉXITO                    ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  USO EN FRONTEND:                                          ║';
    RAISE NOTICE '║  const { data } = await supabase                           ║';
    RAISE NOTICE '║    .rpc(''toggle_auto_ec'', { p_device_id: deviceId });      ║';
    RAISE NOTICE '║  setAutoEnabled(data[0].new_value);                        ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
  ELSE
    RAISE WARNING '❌ ERROR: Función toggle_auto_ec no fue creada';
  END IF;
END $$;

-- =====================================================
-- EJEMPLO DE USO EN FRONTEND (TypeScript):
-- =====================================================
--
-- const handleToggleAutoEC = async () => {
--   const { data, error } = await supabase.rpc('toggle_auto_ec', {
--     p_device_id: deviceId
--   });
--   
--   if (error) {
--     console.error('Error:', error);
--     return;
--   }
--   
--   // data[0].new_value = true o false (nuevo valor)
--   setAutoEnabled(data[0].new_value);
--   console.log('Auto EC ahora:', data[0].new_value ? 'ACTIVADO' : 'DESACTIVADO');
-- };
--
-- =====================================================

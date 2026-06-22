-- =====================================================
-- 🔧 CORREÇÃO CRÍTICA: activate_auto_ec - SOLO LECTURA
-- =====================================================
-- 
-- PROBLEMA IDENTIFICADO:
-- El RPC anterior SIEMPRE hacía: UPDATE SET auto_enabled = TRUE
-- Esto causaba que cuando el usuario desactivaba Auto EC en el frontend,
-- el ESP32 al hacer polling (cada 5 segundos) llamaba este RPC y
-- sobrescribía auto_enabled = TRUE, anulando la acción del usuario.
--
-- SOLUCIÓN:
-- El RPC ahora SOLO LEE el valor de auto_enabled, NO lo modifica.
-- El frontend controla auto_enabled via UPDATE directo a ec_config_view.
--
-- FLUJO CORREGIDO:
-- 1. Usuario desactiva Auto EC → UPDATE ec_config_view SET auto_enabled = FALSE
-- 2. ESP32 hace polling → llama rpc/activate_auto_ec
-- 3. RPC solo hace SELECT → retorna auto_enabled = FALSE (valor real)
-- 4. ESP32 ve FALSE → desactiva control automático
-- 5. ✅ Todo sincronizado correctamente
--
-- Fecha: 2025-01-XX
-- Autor: HydroWave Team
-- =====================================================

-- =====================================================
-- PASO 1: Eliminar función anterior (con bug)
-- =====================================================
DROP FUNCTION IF EXISTS activate_auto_ec(TEXT);

-- =====================================================
-- PASO 2: Crear función corregida (SOLO LECTURA)
-- =====================================================
CREATE OR REPLACE FUNCTION activate_auto_ec(p_device_id TEXT)
RETURNS TABLE (
  id BIGINT,
  device_id TEXT,
  base_dose DOUBLE PRECISION,
  flow_rate DOUBLE PRECISION,
  volume DOUBLE PRECISION,
  total_ml DOUBLE PRECISION,
  kp DOUBLE PRECISION,
  ec_setpoint DOUBLE PRECISION,
  auto_enabled BOOLEAN,
  intervalo_auto_ec INTEGER,
  tempo_recirculacao INTEGER,
  nutrients JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- =====================================================
  -- ✅ CORRIGIDO: Solo SELECT, NO hace UPDATE
  -- =====================================================
  -- ANTES (bug): 
  --   UPDATE ec_config_view SET auto_enabled = TRUE WHERE device_id = p_device_id;
  --   RETURN ... true ... (hardcoded)
  --
  -- DESPUÉS (corregido):
  --   Solo SELECT, retorna el valor REAL de la base de datos
  -- =====================================================
  
  RETURN QUERY
  SELECT 
    ecv.id,
    ecv.device_id,
    ecv.base_dose,
    ecv.flow_rate,
    ecv.volume,
    ecv.total_ml,
    ecv.kp,
    ecv.ec_setpoint,
    ecv.auto_enabled,           -- ✅ Retorna valor REAL de la BD (no hardcoded TRUE)
    ecv.intervalo_auto_ec,
    ecv.tempo_recirculacao,
    ecv.nutrients,
    ecv.created_at,
    ecv.updated_at
  FROM public.ec_config_view ecv
  WHERE ecv.device_id = p_device_id;
  
  -- Si no encuentra configuración, retorna vacío (el ESP32 maneja esto)
END;
$$;

-- =====================================================
-- PASO 3: Actualizar comentario de la función
-- =====================================================
COMMENT ON FUNCTION activate_auto_ec(TEXT) IS 
  '✅ CORRIGIDO (2025): Lee configuración EC sin modificar auto_enabled. '
  'El frontend controla auto_enabled via UPDATE directo a ec_config_view. '
  'ESP32 usa este RPC para polling cada 5 segundos. '
  'IMPORTANTE: Este RPC NO activa Auto EC, solo lee la configuración actual.';

-- =====================================================
-- PASO 4: Verificar que se creó correctamente
-- =====================================================
DO $$
DECLARE
  func_exists BOOLEAN;
  func_source TEXT;
BEGIN
  -- Verificar existencia
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'activate_auto_ec'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ CORREÇÃO APLICADA COM SUCESSO                          ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Função activate_auto_ec atualizada                        ║';
    RAISE NOTICE '║  → Agora SOLO LEE auto_enabled (não modifica)              ║';
    RAISE NOTICE '║  → O problema do botão que voltava a TRUE está resolvido   ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '╔════════════════════════════════════════════════════════════╗';
    RAISE WARNING '║  ❌ ERRO: Função activate_auto_ec não foi criada           ║';
    RAISE WARNING '╚════════════════════════════════════════════════════════════╝';
    RAISE WARNING '';
  END IF;
END $$;

-- =====================================================
-- RESUMO DE MUDANÇAS:
-- =====================================================
--
-- ANTES (com bug):
-- ┌─────────────────────────────────────────────────────┐
-- │ UPDATE ec_config_view                              │
-- │ SET auto_enabled = TRUE  ← SEMPRE sobrescrevia     │
-- │ WHERE device_id = p_device_id;                     │
-- │                                                     │
-- │ RETURN ... true ...      ← Valor hardcoded         │
-- └─────────────────────────────────────────────────────┘
--
-- DEPOIS (corrigido):
-- ┌─────────────────────────────────────────────────────┐
-- │ SELECT ... ecv.auto_enabled ...                    │
-- │                  ↑                                  │
-- │         Valor REAL da BD (pode ser TRUE ou FALSE)  │
-- │                                                     │
-- │ SEM UPDATE - Não modifica nada                     │
-- └─────────────────────────────────────────────────────┘
--
-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

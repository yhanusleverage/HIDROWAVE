-- ============================================
-- RPC UNIFICADO PARA MVP
-- ============================================
-- Objetivo: Unificar todas as funcionalidades em 1 RPC
-- - Comandos manuais (masters + slaves)
-- - EC Config
-- - Rules (automação)
-- - Estados de relays slaves
--
-- Ganho esperado: -57% tempo, -55% heap
-- ============================================

-- ETAPA 1: CRIAR FUNÇÃO RPC UNIFICADA
DROP FUNCTION IF EXISTS get_unified_device_data(text, integer, integer, boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION get_unified_device_data(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 10,
  p_timeout_seconds INTEGER DEFAULT 30,
  p_include_manual_commands BOOLEAN DEFAULT true,
  p_include_ec_config BOOLEAN DEFAULT true,
  p_include_rules BOOLEAN DEFAULT true,
  p_include_slave_states BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_master_commands JSONB;
  v_slave_commands JSONB;
  v_ec_config JSONB;
  v_rules JSONB;
  v_slave_states JSONB;
BEGIN
  -- 1. ✅ COMANDOS MANUAIS MASTERS
  IF p_include_manual_commands THEN
    SELECT jsonb_agg(row_to_json(cmd))
    INTO v_master_commands
    FROM (
      SELECT 
        id,
        device_id,
        user_email,
        master_mac_address,
        relay_numbers,
        actions,
        duration_seconds,
        command_type,
        priority,
        triggered_by,
        rule_id,
        rule_name,
        status,
        created_at
      FROM get_and_lock_master_commands(p_device_id, p_limit, p_timeout_seconds)
      WHERE command_type = 'manual'
      LIMIT p_limit
    ) cmd;
    
    v_result := v_result || jsonb_build_object(
      'master_commands', 
      COALESCE(v_master_commands, '[]'::JSONB)
    );
  END IF;
  
  -- 2. ✅ COMANDOS MANUAIS SLAVES
  IF p_include_manual_commands THEN
    SELECT jsonb_agg(row_to_json(cmd))
    INTO v_slave_commands
    FROM (
      SELECT 
        id,
        master_device_id,
        user_email,
        master_mac_address,
        slave_device_id,
        slave_mac_address,
        relay_numbers,
        actions,
        duration_seconds,
        command_type,
        priority,
        triggered_by,
        rule_id,
        rule_name,
        status,
        created_at
      FROM get_and_lock_slave_commands(p_device_id, p_limit, p_timeout_seconds)
      WHERE command_type = 'manual'
      LIMIT p_limit
    ) cmd;
    
    v_result := v_result || jsonb_build_object(
      'slave_commands', 
      COALESCE(v_slave_commands, '[]'::JSONB)
    );
  END IF;
  
  -- 3. ✅ EC CONFIG
  IF p_include_ec_config THEN
    SELECT row_to_json(ec)::JSONB
    INTO v_ec_config
    FROM (
      SELECT 
        id,
        device_id,
        base_dose,
        flow_rate,
        volume,
        total_ml,
        kp,
        ec_setpoint,
        auto_enabled,
        intervalo_seconds,
        tempo_recirculacao_ms,
        nutrients,
        distribution,
        created_at,
        updated_at
      FROM ec_controller_config
      WHERE device_id = p_device_id
      ORDER BY updated_at DESC
      LIMIT 1
    ) ec;
    
    v_result := v_result || jsonb_build_object(
      'ec_config', 
      COALESCE(v_ec_config, '{}'::JSONB)
    );
  END IF;
  
  -- 4. ✅ RULES (DECISION RULES)
  IF p_include_rules THEN
    SELECT jsonb_agg(row_to_json(rule))
    INTO v_rules
    FROM (
      SELECT 
        id,
        device_id,
        rule_id,
        rule_name,
        rule_description,
        rule_json,
        enabled,
        priority,
        created_at,
        updated_at
      FROM decision_rules
      WHERE device_id = p_device_id
        AND enabled = true
      ORDER BY priority DESC, created_at ASC
    ) rule;
    
    v_result := v_result || jsonb_build_object(
      'rules', 
      COALESCE(v_rules, '[]'::JSONB)
    );
  END IF;
  
  -- 5. ✅ ESTADOS DE RELAYS SLAVES
  IF p_include_slave_states THEN
    SELECT jsonb_agg(row_to_json(rs))
    INTO v_slave_states
    FROM (
      SELECT 
        id,
        device_id,
        user_email,
        master_device_id,
        master_mac_address,
        slave_mac_address,
        relay_states,
        relay_has_timers,
        relay_remaining_times,
        relay_names,
        last_update,
        updated_at
      FROM relay_slaves
      WHERE master_device_id = p_device_id
    ) rs;
    
    v_result := v_result || jsonb_build_object(
      'slave_relay_states', 
      COALESCE(v_slave_states, '[]'::JSONB)
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- ETAPA 2: COMENTÁRIOS E DOCUMENTAÇÃO
COMMENT ON FUNCTION get_unified_device_data IS 
'RPC unificado para buscar todos os dados do dispositivo em uma única chamada.
Retorna: comandos manuais (masters + slaves), EC config, rules e estados de relays slaves.
Ganho esperado: -57% tempo, -55% heap vs. múltiplas chamadas separadas.';

-- ETAPA 3: PERMISSÕES
GRANT EXECUTE ON FUNCTION get_unified_device_data TO anon;
GRANT EXECUTE ON FUNCTION get_unified_device_data TO authenticated;

-- ETAPA 4: VALIDAÇÃO
DO $$
BEGIN
  RAISE NOTICE '✅ Função get_unified_device_data() criada com SECURITY DEFINER';
  RAISE NOTICE '✅ Permissões concedidas para anon e authenticated';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TESTE:';
  RAISE NOTICE 'SELECT * FROM get_unified_device_data(''ESP32_HIDRO_F44738'', 10, 30, true, true, true, true);';
END $$;

-- ============================================
-- RPC PARA REINICIAR DISPOSITIVO (REBOOT)
-- ============================================
-- Objetivo: Função RPC segura para incrementar reboot_count
-- - Valida usuário e dispositivo
-- - Incrementa reboot_count atomicamente
-- - Retorna novo valor
-- ============================================

-- ETAPA 1: CRIAR FUNÇÃO RPC
DROP FUNCTION IF EXISTS increment_reboot_count(text, text);

CREATE OR REPLACE FUNCTION increment_reboot_count(
  p_device_id TEXT,
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_new_count INTEGER;
  v_device_exists BOOLEAN;
BEGIN
  -- 1. ✅ Validar parâmetros
  IF p_device_id IS NULL OR p_device_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'device_id é obrigatório'
    );
  END IF;

  IF p_user_email IS NULL OR p_user_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_email é obrigatório'
    );
  END IF;

  -- 2. ✅ Verificar se dispositivo existe e pertence ao usuário
  SELECT 
    EXISTS(
      SELECT 1 
      FROM device_status 
      WHERE device_id = p_device_id 
        AND user_email = p_user_email
    ),
    COALESCE(reboot_count, 0)
  INTO v_device_exists, v_current_count
  FROM device_status
  WHERE device_id = p_device_id
    AND user_email = p_user_email;

  -- 3. ✅ Se dispositivo não encontrado
  IF NOT v_device_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Dispositivo não encontrado ou não pertence ao usuário'
    );
  END IF;

  -- 4. ✅ Incrementar reboot_count atomicamente
  v_new_count := v_current_count + 1;

  UPDATE device_status
  SET 
    reboot_count = v_new_count,
    updated_at = NOW()
  WHERE device_id = p_device_id
    AND user_email = p_user_email;

  -- 5. ✅ Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contador de reinícios atualizado. O dispositivo será reiniciado na próxima verificação.',
    'reboot_count', v_new_count,
    'previous_count', v_current_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro ao atualizar contador de reinícios: ' || SQLERRM
    );
END;
$$;

-- ETAPA 2: COMENTÁRIO DA FUNÇÃO
COMMENT ON FUNCTION increment_reboot_count IS 
'Incrementa o reboot_count de um dispositivo. Valida que o dispositivo pertence ao usuário antes de atualizar.';

-- ETAPA 3: PERMISSÕES
GRANT EXECUTE ON FUNCTION increment_reboot_count TO anon;
GRANT EXECUTE ON FUNCTION increment_reboot_count TO authenticated;

-- ETAPA 4: TESTE (OPCIONAL - Descomente para testar)
-- SELECT increment_reboot_count('ESP32_HIDRO_F44738', 'usuario@example.com');


-- =====================================================
-- RPC prod: get_and_lock_master_commands → relay_commands
-- Corrige poll HTTPS do ESP quando MQTT push falha.
-- Schema prod: pending | sent | completed | failed
-- Sem relay_commands_master nem status processing.
-- =====================================================

DROP FUNCTION IF EXISTS public.get_and_lock_master_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 5,
  p_timeout_seconds integer DEFAULT 30
)
RETURNS TABLE (
  id bigint,
  device_id text,
  relay_number integer,
  action text,
  duration_seconds integer,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  -- Recuperar sent travados (ESP crashou antes do completed)
  UPDATE relay_commands rc
  SET status = 'pending',
      sent_at = NULL,
      error_message = COALESCE(rc.error_message, '') || ' [auto-reset sent timeout]'
  WHERE rc.device_id = p_device_id
    AND rc.status = 'sent'
    AND rc.sent_at IS NOT NULL
    AND rc.sent_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL
    AND (rc.target_device_id IS NULL OR rc.target_device_id = '');

  SELECT COALESCE(array_agg(sub.id ORDER BY sub.created_at ASC), ARRAY[]::bigint[])
  INTO v_ids
  FROM (
    SELECT rc.id, rc.created_at
    FROM relay_commands rc
    WHERE rc.device_id = p_device_id
      AND rc.status = 'pending'
      AND (rc.target_device_id IS NULL OR rc.target_device_id = '')
    ORDER BY rc.created_at ASC
    LIMIT p_limit
  ) sub;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN;
  END IF;

  UPDATE relay_commands rc
  SET status = 'sent',
      sent_at = NOW()
  WHERE rc.id = ANY(v_ids)
    AND rc.status = 'pending';

  RETURN QUERY
  SELECT
    rc.id,
    rc.device_id,
    rc.relay_number,
    rc.action,
    rc.duration_seconds,
    rc.status,
    rc.created_at
  FROM relay_commands rc
  WHERE rc.id = ANY(v_ids)
    AND rc.status = 'sent'
  ORDER BY rc.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_and_lock_master_commands(text, integer, integer)
  TO anon, authenticated, service_role;

-- Teste (deve retornar linhas se houver pending local):
-- SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_269844', 5, 30);

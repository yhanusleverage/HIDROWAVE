-- =====================================================
-- RPC prod: get_and_lock_slave_commands → relay_commands
-- FOR UPDATE SKIP LOCKED + prioridad + timeout 90s + lock_attempts
-- =====================================================

DROP FUNCTION IF EXISTS public.get_and_lock_slave_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_and_lock_slave_commands(
  p_master_device_id text,
  p_limit integer DEFAULT 1,
  p_timeout_seconds integer DEFAULT 90
)
RETURNS TABLE (
  id bigint,
  relay_number integer,
  action text,
  duration_seconds integer,
  status text,
  created_at timestamptz,
  slave_mac_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) sent atascado: 1 reintento → pending; 2º timeout → failed
  UPDATE relay_commands rc
  SET
    status = 'pending',
    sent_at = NULL,
    lock_attempts = rc.lock_attempts + 1,
    error_message = COALESCE(rc.error_message, '') || ' [auto-reset sent timeout slave]'
  WHERE rc.device_id = p_master_device_id
    AND rc.status = 'sent'
    AND rc.sent_at IS NOT NULL
    AND rc.sent_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL
    AND rc.target_device_id IS NOT NULL
    AND rc.target_device_id <> ''
    AND rc.lock_attempts < 1;

  UPDATE relay_commands rc
  SET
    status = 'failed',
    completed_at = NOW(),
    error_message = COALESCE(rc.error_message, '') || ' stale sent — no ACK'
  WHERE rc.device_id = p_master_device_id
    AND rc.status = 'sent'
    AND rc.sent_at IS NOT NULL
    AND rc.sent_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL
    AND rc.target_device_id IS NOT NULL
    AND rc.target_device_id <> ''
    AND rc.lock_attempts >= 1;

  -- 2) Lock atómico pending → sent
  RETURN QUERY
  WITH picked AS (
    SELECT rc.id
    FROM relay_commands rc
    WHERE rc.device_id = p_master_device_id
      AND rc.status = 'pending'
      AND rc.target_device_id IS NOT NULL
      AND rc.target_device_id <> ''
    ORDER BY COALESCE(rc.priority, 50) DESC, rc.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE relay_commands rc
  SET status = 'sent',
      sent_at = NOW()
  FROM picked
  WHERE rc.id = picked.id
    AND rc.status = 'pending'
  RETURNING
    rc.id,
    rc.relay_number,
    rc.action,
    rc.duration_seconds,
    rc.status,
    rc.created_at,
    rc.target_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_and_lock_slave_commands(text, integer, integer)
  TO anon, authenticated, service_role;

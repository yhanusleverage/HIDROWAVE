-- =====================================================
-- RPC prod: complete_relay_command
-- Cierra relay_commands (pending/sent→completed) + relay_slaves en 1 transacción
--
-- PREREQUISITO: migrations/20250623_relay_commands_prod_columns.sql
-- =====================================================

DROP FUNCTION IF EXISTS public.complete_relay_command(bigint, text, boolean, text, boolean[]);

CREATE OR REPLACE FUNCTION public.complete_relay_command(
  p_command_id bigint,
  p_device_id text,
  p_current_state boolean,
  p_slave_mac text DEFAULT NULL,
  p_relay_states boolean[] DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  status text,
  relay_number integer,
  current_state boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_status text;
  v_relay_number integer;
  v_slave_device_id text;
  v_user_email text;
  v_master_mac text;
  v_has_current_state boolean;
  v_has_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'relay_commands'
      AND column_name = 'current_state'
  ) INTO v_has_current_state;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'relay_commands'
      AND column_name = 'updated_at'
  ) INTO v_has_updated_at;

  IF v_has_current_state AND v_has_updated_at THEN
    UPDATE relay_commands rc
    SET
      status = 'completed',
      completed_at = NOW(),
      current_state = p_current_state,
      updated_at = NOW()
    WHERE rc.id = p_command_id
      AND rc.device_id = p_device_id
      AND rc.status IN ('sent', 'pending')
    RETURNING rc.id, rc.status, rc.relay_number
    INTO v_id, v_status, v_relay_number;
  ELSIF v_has_current_state THEN
    UPDATE relay_commands rc
    SET
      status = 'completed',
      completed_at = NOW(),
      current_state = p_current_state
    WHERE rc.id = p_command_id
      AND rc.device_id = p_device_id
      AND rc.status IN ('sent', 'pending')
    RETURNING rc.id, rc.status, rc.relay_number
    INTO v_id, v_status, v_relay_number;
  ELSIF v_has_updated_at THEN
    UPDATE relay_commands rc
    SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE rc.id = p_command_id
      AND rc.device_id = p_device_id
      AND rc.status IN ('sent', 'pending')
    RETURNING rc.id, rc.status, rc.relay_number
    INTO v_id, v_status, v_relay_number;
  ELSE
    UPDATE relay_commands rc
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE rc.id = p_command_id
      AND rc.device_id = p_device_id
      AND rc.status IN ('sent', 'pending')
    RETURNING rc.id, rc.status, rc.relay_number
    INTO v_id, v_status, v_relay_number;
  END IF;

  IF NOT FOUND THEN
    SELECT rc.id, rc.status, rc.relay_number
    INTO v_id, v_status, v_relay_number
    FROM relay_commands rc
    WHERE rc.id = p_command_id
      AND rc.device_id = p_device_id
      AND rc.status = 'completed';

    IF FOUND THEN
      RETURN QUERY
      SELECT v_id, v_status, v_relay_number, p_current_state;
      RETURN;
    END IF;

    RETURN;
  END IF;

  IF p_slave_mac IS NOT NULL
     AND length(trim(p_slave_mac)) > 0
     AND p_relay_states IS NOT NULL
     AND cardinality(p_relay_states) > 0 THEN

    v_slave_device_id := 'ESP32_SLAVE_' || replace(p_slave_mac, ':', '_');

    SELECT ds.user_email, ds.mac_address
    INTO v_user_email, v_master_mac
    FROM device_status ds
    WHERE ds.device_id = p_device_id
    LIMIT 1;

    IF v_user_email IS NOT NULL THEN
      INSERT INTO relay_slaves (
        device_id,
        user_email,
        master_device_id,
        master_mac_address,
        slave_mac_address,
        relay_states,
        last_update,
        updated_at
      )
      VALUES (
        v_slave_device_id,
        v_user_email,
        p_device_id,
        COALESCE(v_master_mac, ''),
        p_slave_mac,
        p_relay_states,
        NOW(),
        NOW()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        relay_states = EXCLUDED.relay_states,
        last_update = NOW(),
        updated_at = NOW();
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_id, v_status, v_relay_number, p_current_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_relay_command(bigint, text, boolean, text, boolean[])
  TO anon, authenticated, service_role;

-- Teste (comando en pending o sent):
-- SELECT * FROM complete_relay_command(147, 'ESP32_HIDRO_1A575C', true, '14:33:5C:38:BF:60', ARRAY[false,false,false,false,true,false,false,false]);

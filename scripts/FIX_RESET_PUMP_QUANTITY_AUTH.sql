-- Patch reset_pump_quantity: reconocer role en JWT claim (bridge service_role)
-- Executar no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.reset_pump_quantity(
  p_device_id text,
  p_relay_index smallint,
  p_reset_by text DEFAULT 'web'
)
RETURNS public.pump_quantity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.pump_quantity;
  before_ml numeric(12, 3);
  by_norm text;
  jwt_email text;
  owner_email text;
  jwt_role text;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'p_device_id required';
  END IF;
  IF p_relay_index IS NULL OR p_relay_index < 0 OR p_relay_index > 7 THEN
    RAISE EXCEPTION 'p_relay_index out of range 0-7';
  END IF;

  jwt_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  jwt_role := COALESCE(auth.jwt() ->> 'role', auth.role(), '');
  IF jwt_email = '' AND jwt_role NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF jwt_email <> '' THEN
    SELECT lower(ds.user_email) INTO owner_email
    FROM public.device_status ds
    WHERE ds.device_id = p_device_id;
    IF owner_email IS NULL OR owner_email <> jwt_email THEN
      RAISE EXCEPTION 'device not owned by caller';
    END IF;
  END IF;

  by_norm := COALESCE(NULLIF(trim(p_reset_by), ''), 'web');
  IF by_norm NOT IN ('web', 'hmi', 'master', 'rpc') THEN
    by_norm := 'web';
  END IF;

  SELECT total_ml INTO before_ml
  FROM public.pump_quantity
  WHERE device_id = p_device_id AND relay_index = p_relay_index;

  IF before_ml IS NULL THEN
    before_ml := 0;
    INSERT INTO public.pump_quantity (
      device_id, relay_index, total_ml, last_reset_at, updated_at
    ) VALUES (
      p_device_id, p_relay_index, 0, now(), now()
    )
    RETURNING * INTO row;
  ELSE
    INSERT INTO public.pump_quantity_resets (
      device_id, relay_index, total_ml_before, reset_by
    ) VALUES (
      p_device_id, p_relay_index, before_ml, by_norm
    );

    UPDATE public.pump_quantity
    SET total_ml = 0,
        last_reset_at = now(),
        updated_at = now()
    WHERE device_id = p_device_id AND relay_index = p_relay_index
    RETURNING * INTO row;
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_pump_quantity(text, smallint, text)
  TO authenticated, service_role;

-- ============================================================
-- pump_quantity — odómetro ml por bomba (HMI Quantity / web Calibragem)
-- Incremento: MQTT dose/ph_dose → bridge → RPC (idempotente via ledger)
-- Zerar: web/HMI → reset_pump_quantity
-- Executar no SQL Editor do Supabase
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pump_quantity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL
    REFERENCES public.device_status(device_id) ON DELETE CASCADE,
  relay_index smallint NOT NULL
    CHECK (relay_index >= 0 AND relay_index <= 7),
  role text NOT NULL DEFAULT 'other'
    CHECK (role = ANY (ARRAY['ec', 'ph_up', 'ph_down', 'other'])),
  total_ml numeric(12, 3) NOT NULL DEFAULT 0
    CHECK (total_ml >= 0 AND total_ml <= 10000000),
  last_increment_at timestamptz,
  last_increment_ml numeric(12, 3),
  last_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, relay_index)
);

CREATE INDEX IF NOT EXISTS pump_quantity_device_idx
  ON public.pump_quantity (device_id);

COMMENT ON TABLE public.pump_quantity IS
  'Totalizador ml dispensados por bomba desde último reset (paridad HMI Quantity).';

CREATE TABLE IF NOT EXISTS public.pump_quantity_resets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL
    REFERENCES public.device_status(device_id) ON DELETE CASCADE,
  relay_index smallint NOT NULL
    CHECK (relay_index >= 0 AND relay_index <= 7),
  total_ml_before numeric(12, 3) NOT NULL,
  reset_by text NOT NULL DEFAULT 'web'
    CHECK (reset_by = ANY (ARRAY['web', 'hmi', 'master', 'rpc'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pump_quantity_resets_device_idx
  ON public.pump_quantity_resets (device_id, created_at DESC);

-- Idempotencia: mismo sequence_id + relé no suma dos veces (MQTT retry / upsert)
CREATE TABLE IF NOT EXISTS public.pump_quantity_ledger (
  device_id text NOT NULL,
  sequence_id text NOT NULL,
  relay_index smallint NOT NULL
    CHECK (relay_index >= 0 AND relay_index <= 7),
  dosage_ml numeric(12, 3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, sequence_id, relay_index)
);

CREATE INDEX IF NOT EXISTS pump_quantity_ledger_device_idx
  ON public.pump_quantity_ledger (device_id, created_at DESC);

-- ------------------------------------------------------------
-- RPC increment (bridge tras dose / ph_dose)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_pump_quantity(
  p_device_id text,
  p_relay_index smallint,
  p_ml numeric,
  p_sequence_id text,
  p_role text DEFAULT 'other'
)
RETURNS public.pump_quantity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.pump_quantity;
  role_norm text;
  ledger_inserted int;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'p_device_id required';
  END IF;
  IF p_sequence_id IS NULL OR length(trim(p_sequence_id)) = 0 THEN
    RAISE EXCEPTION 'p_sequence_id required';
  END IF;
  IF p_ml IS NULL OR p_ml <= 0 THEN
    RAISE EXCEPTION 'p_ml must be > 0';
  END IF;
  IF p_relay_index IS NULL OR p_relay_index < 0 OR p_relay_index > 7 THEN
    RAISE EXCEPTION 'p_relay_index out of range 0-7';
  END IF;

  role_norm := COALESCE(NULLIF(trim(p_role), ''), 'other');
  IF role_norm NOT IN ('ec', 'ph_up', 'ph_down', 'other') THEN
    role_norm := 'other';
  END IF;

  INSERT INTO public.pump_quantity_ledger (
    device_id, sequence_id, relay_index, dosage_ml
  ) VALUES (
    p_device_id, trim(p_sequence_id), p_relay_index, p_ml
  )
  ON CONFLICT (device_id, sequence_id, relay_index) DO NOTHING;

  GET DIAGNOSTICS ledger_inserted = ROW_COUNT;

  IF ledger_inserted = 0 THEN
    SELECT * INTO row
    FROM public.pump_quantity
    WHERE device_id = p_device_id AND relay_index = p_relay_index;
    IF row.id IS NULL THEN
      INSERT INTO public.pump_quantity (device_id, relay_index, role, total_ml, updated_at)
      VALUES (p_device_id, p_relay_index, role_norm, 0, now())
      RETURNING * INTO row;
    END IF;
    RETURN row;
  END IF;

  INSERT INTO public.pump_quantity AS q (
    device_id, relay_index, role, total_ml,
    last_increment_at, last_increment_ml, updated_at
  ) VALUES (
    p_device_id, p_relay_index, role_norm, p_ml,
    now(), p_ml, now()
  )
  ON CONFLICT (device_id, relay_index) DO UPDATE
    SET total_ml = q.total_ml + EXCLUDED.total_ml,
        last_increment_at = now(),
        last_increment_ml = EXCLUDED.total_ml,
        role = COALESCE(EXCLUDED.role, q.role),
        updated_at = now()
  RETURNING * INTO row;

  RETURN row;
END;
$$;

-- ------------------------------------------------------------
-- RPC reset (web Zerar)
-- ------------------------------------------------------------

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
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'p_device_id required';
  END IF;
  IF p_relay_index IS NULL OR p_relay_index < 0 OR p_relay_index > 7 THEN
    RAISE EXCEPTION 'p_relay_index out of range 0-7';
  END IF;

  jwt_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  -- PostgREST: role suele venir en claim JWT; auth.role() a veces no es service_role
  IF jwt_email = ''
     AND COALESCE(auth.jwt() ->> 'role', auth.role(), '') NOT IN ('service_role', 'postgres')
  THEN
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

REVOKE ALL ON FUNCTION public.increment_pump_quantity(text, smallint, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_pump_quantity(text, smallint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.increment_pump_quantity(text, smallint, numeric, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_pump_quantity(text, smallint, text)
  TO authenticated, service_role;

GRANT SELECT ON public.pump_quantity TO authenticated, service_role;
GRANT SELECT ON public.pump_quantity_resets TO authenticated, service_role;
GRANT ALL ON public.pump_quantity TO service_role;
GRANT ALL ON public.pump_quantity_resets TO service_role;
GRANT ALL ON public.pump_quantity_ledger TO service_role;

ALTER TABLE public.pump_quantity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_quantity_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_quantity_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pump_quantity_select_own ON public.pump_quantity;
CREATE POLICY pump_quantity_select_own ON public.pump_quantity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.device_status ds
      WHERE ds.device_id = pump_quantity.device_id
        AND lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS pump_quantity_service_all ON public.pump_quantity;
CREATE POLICY pump_quantity_service_all ON public.pump_quantity
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pump_quantity_resets_select_own ON public.pump_quantity_resets;
CREATE POLICY pump_quantity_resets_select_own ON public.pump_quantity_resets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.device_status ds
      WHERE ds.device_id = pump_quantity_resets.device_id
        AND lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS pump_quantity_resets_service_all ON public.pump_quantity_resets;
CREATE POLICY pump_quantity_resets_service_all ON public.pump_quantity_resets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Ledger: sin SELECT público (solo service_role / SECURITY DEFINER)
DROP POLICY IF EXISTS pump_quantity_ledger_deny ON public.pump_quantity_ledger;
CREATE POLICY pump_quantity_ledger_deny ON public.pump_quantity_ledger
  FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS pump_quantity_ledger_service_all ON public.pump_quantity_ledger;
CREATE POLICY pump_quantity_ledger_service_all ON public.pump_quantity_ledger
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Realtime (también: ENABLE_PUMP_QUANTITY_REALTIME.sql / ENABLE_REALTIME_REPLICATION.sql)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pump_quantity;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

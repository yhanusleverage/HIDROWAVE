-- =====================================================
-- HIDROWAVE — Nivel 3 producción (NO ejecutar en MVP sin revisar)
-- Complementa USERS_RLS_POLICIES.sql + CLEANUP_TEST_DEVICES.sql
-- Ejecutar por fases en Supabase SQL Editor
-- =====================================================

-- ─── FASE A: Trigger auth.users → public.users ───
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    email, name, subscription_type, max_devices, total_devices, is_active
  ) VALUES (
    NEW.email,
    split_part(NEW.email, '@', 1),
    'free',
    5,
    0,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    is_active = true,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── FASE B: RPC ensure_public_user (AuthContext ya la llama) ───
CREATE OR REPLACE FUNCTION public.ensure_public_user(
  p_user_email text,
  p_name text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.users;
BEGIN
  IF auth.jwt() IS NULL OR lower(p_user_email) <> lower(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Unauthorized or email mismatch';
  END IF;

  INSERT INTO public.users (email, name, subscription_type, max_devices, total_devices, is_active)
  VALUES (
    lower(p_user_email),
    coalesce(p_name, split_part(p_user_email, '@', 1)),
    'free',
    5,
    0,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    name = coalesce(excluded.name, public.users.name),
    is_active = true,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_public_user(text, text) TO authenticated;

-- ─── FASE C: RLS device_status (usuário só vê os seus) ───
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_status_select_own ON public.device_status;
DROP POLICY IF EXISTS device_status_update_own ON public.device_status;

CREATE POLICY device_status_select_own ON public.device_status
  FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY device_status_update_own ON public.device_status
  FOR UPDATE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- ⚠️ INSERT/PATCH do ESP32: usar service_role no bridge ou RPC register_device (criar separado)

-- ─── FASE D: Índices performance ───
CREATE INDEX IF NOT EXISTS idx_device_status_user_email
  ON public.device_status (lower(user_email));

CREATE INDEX IF NOT EXISTS idx_device_status_last_seen
  ON public.device_status (last_seen DESC);

-- ─── FASE E: user_settings em users (migrar de localStorage) ───
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_settings jsonb DEFAULT '{}'::jsonb;

-- ─── FASE F (opcional): view slaves_discovery ───
CREATE OR REPLACE VIEW public.slaves_discovery AS
SELECT
  rs.device_id AS slave_device_id,
  rs.slave_mac_address,
  coalesce(ds.device_name, rs.device_id) AS slave_name,
  coalesce(ds.device_type, 'ESP32_SLAVE') AS device_type,
  rs.master_device_id,
  rs.master_mac_address,
  rs.user_email,
  coalesce(ds.is_online, false) AS is_online,
  coalesce(ds.last_seen, rs.last_update) AS last_seen,
  rs.slave_mac_address AS slave_device_mac,
  8 AS total_relays,
  0 AS active_relays,
  rs.last_update AS last_relay_update
FROM public.relay_slaves rs
LEFT JOIN public.device_status ds ON rs.device_id = ds.device_id;

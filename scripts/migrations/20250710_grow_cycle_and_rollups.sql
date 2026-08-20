  -- Grow cycle plans, instances, weekly stats, hydro rollups + retention
  -- Executar no SQL Editor Supabase (após backup)

  BEGIN;

  -- =====================================================
  -- F1: grow_cycle_plans
  -- =====================================================
  CREATE TABLE IF NOT EXISTS public.grow_cycle_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id text NOT NULL,
    name text NOT NULL,
    total_weeks int NOT NULL CHECK (total_weeks BETWEEN 1 AND 14),
    plan_json jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'published', 'archived')),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_grow_cycle_plans_device_status
    ON public.grow_cycle_plans (device_id, status, updated_at DESC);

  COMMENT ON TABLE public.grow_cycle_plans IS
    'Recipe ISA-88 — plano de cultivo S0–Sn (weeks, tankEvents, schedules).';

  -- =====================================================
  -- F2: grow_cycle_instances (runtime)
  -- =====================================================
  CREATE TABLE IF NOT EXISTS public.grow_cycle_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid REFERENCES public.grow_cycle_plans(id) ON DELETE SET NULL,
    device_id text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    current_week_index int NOT NULL DEFAULT 0,
    ended_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS idx_grow_cycle_instances_device_active
    ON public.grow_cycle_instances (device_id, ended_at)
    WHERE ended_at IS NULL;

  -- =====================================================
  -- F2: grow_cycle_weekly_stats (cold tier)
  -- =====================================================
  CREATE TABLE IF NOT EXISTS public.grow_cycle_weekly_stats (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id uuid REFERENCES public.grow_cycle_instances(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    week_index int NOT NULL,
    phase text,
    ec_setpoint numeric(12, 2),
    ec_avg numeric(12, 2),
    ec_min numeric(12, 2),
    ec_max numeric(12, 2),
    ph_setpoint numeric(8, 3),
    ph_avg numeric(8, 3),
    tank_events_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
    dosages_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    computed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (instance_id, week_index)
  );

  CREATE INDEX IF NOT EXISTS idx_grow_cycle_weekly_stats_device
    ON public.grow_cycle_weekly_stats (device_id, week_index);

  -- =====================================================
  -- F2: grow_cycle_events (P1/P4 audit)
  -- =====================================================
  CREATE TABLE IF NOT EXISTS public.grow_cycle_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id uuid REFERENCES public.grow_cycle_instances(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    week_index int,
    event_type text NOT NULL,
    rule_id text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_grow_cycle_events_instance
    ON public.grow_cycle_events (instance_id, created_at DESC);

  -- =====================================================
  -- F2: hydro rollups
  -- =====================================================
  CREATE TABLE IF NOT EXISTS public.hydro_measurements_hourly (
    device_id text NOT NULL,
    bucket_start timestamptz NOT NULL,
    ec_avg numeric(12, 2),
    ec_min numeric(12, 2),
    ec_max numeric(12, 2),
    ph_avg numeric(8, 3),
    temp_avg numeric(8, 2),
    sample_count int NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, bucket_start)
  );

  CREATE TABLE IF NOT EXISTS public.hydro_measurements_daily (
    device_id text NOT NULL,
    day date NOT NULL,
    ec_avg numeric(12, 2),
    ph_avg numeric(8, 3),
    temp_avg numeric(8, 2),
    sample_count int NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, day)
  );

  -- =====================================================
  -- Aggregation functions
  -- =====================================================
  CREATE OR REPLACE FUNCTION public.aggregate_hydro_measurements_hourly()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    INSERT INTO public.hydro_measurements_hourly (
      device_id, bucket_start, ec_avg, ec_min, ec_max, ph_avg, temp_avg, sample_count
    )
    SELECT
      device_id,
      date_trunc('hour', created_at) AS bucket_start,
      avg(COALESCE(ec, ec_raw)) FILTER (WHERE COALESCE(ec, ec_raw) IS NOT NULL),
      min(COALESCE(ec, ec_raw)) FILTER (WHERE COALESCE(ec, ec_raw) IS NOT NULL),
      max(COALESCE(ec, ec_raw)) FILTER (WHERE COALESCE(ec, ec_raw) IS NOT NULL),
      avg(ph) FILTER (WHERE ph IS NOT NULL),
      avg(temperature) FILTER (WHERE temperature IS NOT NULL),
      count(*)::int
    FROM public.hydro_measurements
    WHERE created_at >= now() - interval '2 hours'
      AND created_at < date_trunc('hour', now())
    GROUP BY device_id, date_trunc('hour', created_at)
    ON CONFLICT (device_id, bucket_start) DO UPDATE SET
      ec_avg = EXCLUDED.ec_avg,
      ec_min = EXCLUDED.ec_min,
      ec_max = EXCLUDED.ec_max,
      ph_avg = EXCLUDED.ph_avg,
      temp_avg = EXCLUDED.temp_avg,
      sample_count = EXCLUDED.sample_count;
  END;
  $$;

  CREATE OR REPLACE FUNCTION public.aggregate_hydro_measurements_daily()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    INSERT INTO public.hydro_measurements_daily (
      device_id, day, ec_avg, ph_avg, temp_avg, sample_count
    )
    SELECT
      device_id,
      (bucket_start AT TIME ZONE 'UTC')::date AS day,
      avg(ec_avg),
      avg(ph_avg),
      avg(temp_avg),
      sum(sample_count)::int
    FROM public.hydro_measurements_hourly
    WHERE bucket_start >= now() - interval '2 days'
    GROUP BY device_id, (bucket_start AT TIME ZONE 'UTC')::date
    ON CONFLICT (device_id, day) DO UPDATE SET
      ec_avg = EXCLUDED.ec_avg,
      ph_avg = EXCLUDED.ph_avg,
      temp_avg = EXCLUDED.temp_avg,
      sample_count = EXCLUDED.sample_count;
  END;
  $$;

  CREATE OR REPLACE FUNCTION public.purge_hydro_measurements_raw(retention_days int DEFAULT 90)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    deleted bigint;
  BEGIN
    DELETE FROM public.hydro_measurements
    WHERE created_at < now() - make_interval(days => retention_days);
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
  END;
  $$;

  CREATE OR REPLACE FUNCTION public.compute_grow_cycle_weekly_stats(p_instance_id uuid DEFAULT NULL)
  RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    inst record;
    wk record;
    inserted int := 0;
    w_start timestamptz;
    w_end timestamptz;
  BEGIN
    FOR inst IN
      SELECT i.*, p.plan_json
      FROM public.grow_cycle_instances i
      LEFT JOIN public.grow_cycle_plans p ON p.id = i.plan_id
      WHERE i.ended_at IS NULL
        AND (p_instance_id IS NULL OR i.id = p_instance_id)
    LOOP
      FOR wk IN
        SELECT
          (elem->>'weekIndex')::int AS week_index,
          elem->>'phase' AS phase,
          (elem->>'ecSetpointUsCm')::numeric AS ec_setpoint,
          (elem->>'phSetpoint')::numeric AS ph_setpoint
        FROM jsonb_array_elements(inst.plan_json->'weeks') AS elem
        WHERE (elem->>'weekIndex')::int <= inst.current_week_index
      LOOP
        w_start := inst.started_at + (wk.week_index * interval '7 days');
        w_end := w_start + interval '7 days';

        INSERT INTO public.grow_cycle_weekly_stats (
          instance_id, device_id, week_index, phase,
          ec_setpoint, ph_setpoint,
          ec_avg, ec_min, ec_max, ph_avg
        )
        SELECT
          inst.id,
          inst.device_id,
          wk.week_index,
          wk.phase,
          wk.ec_setpoint,
          wk.ph_setpoint,
          avg(COALESCE(h.ec, h.ec_raw)),
          min(COALESCE(h.ec, h.ec_raw)),
          max(COALESCE(h.ec, h.ec_raw)),
          avg(h.ph)
        FROM public.hydro_measurements h
        WHERE h.device_id = inst.device_id
          AND h.created_at >= w_start
          AND h.created_at < w_end
          AND (h.ec IS NOT NULL OR h.ec_raw IS NOT NULL OR h.ph IS NOT NULL)
        GROUP BY inst.id, inst.device_id, wk.week_index, wk.phase, wk.ec_setpoint, wk.ph_setpoint
        HAVING count(*) > 0
        ON CONFLICT (instance_id, week_index) DO UPDATE SET
          ec_avg = EXCLUDED.ec_avg,
          ec_min = EXCLUDED.ec_min,
          ec_max = EXCLUDED.ec_max,
          ph_avg = EXCLUDED.ph_avg,
          computed_at = now();

        IF FOUND THEN
          inserted := inserted + 1;
        END IF;
      END LOOP;
    END LOOP;

    RETURN inserted;
  END;
  $$;

  COMMENT ON FUNCTION public.aggregate_hydro_measurements_hourly IS
    'Job horário — agrega hydro_measurements raw para hourly rollup.';
  COMMENT ON FUNCTION public.aggregate_hydro_measurements_daily IS
    'Job diário — agrega hourly para daily rollup.';
  COMMENT ON FUNCTION public.purge_hydro_measurements_raw IS
    'Retenção hot tier — apaga raw mais antigo que retention_days (default 90).';
  COMMENT ON FUNCTION public.compute_grow_cycle_weekly_stats IS
    'Snapshot semanal — médias EC/pH por semana de ciclo activo.';

  -- RLS desactivado (mesmo padrão ec_controller_metrics em dev)
  ALTER TABLE public.grow_cycle_plans DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.grow_cycle_instances DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.grow_cycle_weekly_stats DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.grow_cycle_events DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.hydro_measurements_hourly DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.hydro_measurements_daily DISABLE ROW LEVEL SECURITY;

  COMMIT;

  -- pg_cron (executar separadamente se extensão disponível no plano Supabase Pro):
  -- SELECT cron.schedule('hydro-hourly-rollup', '5 * * * *', $$SELECT public.aggregate_hydro_measurements_hourly()$$);
  -- SELECT cron.schedule('hydro-daily-rollup', '15 3 * * *', $$SELECT public.aggregate_hydro_measurements_daily()$$);
  -- SELECT cron.schedule('hydro-raw-purge', '30 4 * * *', $$SELECT public.purge_hydro_measurements_raw(90)$$);
  -- SELECT cron.schedule('grow-weekly-stats', '0 6 * * 0', $$SELECT public.compute_grow_cycle_weekly_stats()$$);

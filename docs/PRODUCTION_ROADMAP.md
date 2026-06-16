# HIDROWAVE — Roadmap producción (anotado)

> Estado actual: **Nivel 2 (MVP prod)** — Jun 2026  
> Objetivo futuro: **Nivel 3 (serio)** antes de escalar usuarios/dispositivos.

---

## Nivel actual (implementado / en curso)

### Frontend

| Item | Archivo | Notas |
|------|---------|-------|
| JWT de sesión (no forzar anon) | `src/lib/supabase.ts` | **Crítico.** Nunca `Authorization: Bearer ${anonKey}` global |
| Dispositivos por email | `src/lib/automation.ts` → `getUserDevices` | `.eq('user_email', email)` — no `SELECT *` sin filtro |
| Helpers schema prod | `src/lib/db-schema.ts` | `device_status` sin `master_device_id` / `user_settings` |
| Settings en localStorage | `src/lib/settings.ts` | OK para MVP; migrar a `users` en nivel 3 |
| Perfil auth | `src/contexts/AuthContext.tsx` | `maybeSingle()`, fallback si RLS falla |
| Relay commands | `automation.ts` | Tabla `relay_commands` (no `relay_commands_master/slave`) |

### Supabase — scripts listos

| Script | Cuándo ejecutar |
|--------|-----------------|
| `scripts/USERS_RLS_POLICIES.sql` | **Ya** — RLS en `public.users` |
| `scripts/ENABLE_REALTIME_REPLICATION.sql` | **Ya** — WebSocket postgres_changes |
| `scripts/CLEANUP_TEST_DEVICES.sql` | **Ya** — borrar ~1000 filas `TEST_*` |
| `scripts/CRIAR_TABELA_NUTRIENT_DOSAGES.sql` | **Sendero Última dosagem** — `nutrient_dosages` + `relay_master.ec_operation_*` |
| `scripts/VERIFICAR_NUTRIENT_DOSAGES_E2E.sql` | **Post-migración** — checklist SQL prod |
| `scripts/ADD_PH_CONTROLLER_COLUMNS.sql` | **Auto pH** — `ph_dosages` + `relay_master.ph_operation_*` |
| `scripts/MIGRATE_PH_ADAPTIVE.sql` | **Auto pH adaptativo** — K gains, límites |
| `scripts/MIGRATE_PH_CALIBRATION.sql` | **Calibragem** — ml/unid ácido/base |
| `scripts/CREATE_RPC_ACTIVATE_AUTO_PH.sql` | RPC activación Auto pH |
| `scripts/VERIFICAR_PH_DOSAGES_E2E.sql` | **Post-migración pH** — checklist SQL prod |
| `scripts/verify-ph-dosages-e2e.js` | **npm run verify:ph-dosages** — paridad EC |
| `scripts/CRIAR_TABELA_EC_CONTROLLER_METRICS.sql` | **Métricas ciclo Auto EC** |
| `scripts/CRIAR_TABELA_PH_CONTROLLER_METRICS.sql` | **Métricas ciclo Auto pH** |
| `scripts/VERIFICAR_CONTROLLER_METRICS_E2E.sql` | Post-migración métricas |
| `scripts/BANCADA_EC_REMAINDER_CHECKLIST.md` | Soak 24h + fallback HTTPS EC |
| `scripts/reset-ph-operation.sql` | Reset estados huérfanos tras tests MQTT pH |

### Supabase Realtime (implementado en frontend)

| Módulo | Archivo | Tablas |
|--------|---------|--------|
| Dispositivos online | `src/lib/realtime/device-status.ts` | `device_status` |
| Relés en vivo | `src/lib/realtime/relay-states.ts` | `relay_master`, `relay_slaves` (+ `ec_operation_*`) |
| Última dosagem Auto EC | `src/hooks/useLastDosage.ts` | `nutrient_dosages` (Realtime INSERT + poll 30s fallback) |
| Detalle nutrientes | `src/components/NutrientDosageDetail.tsx` | `nutrient_dosages` (Realtime por sequence_id) |
| Realtime dosagens | `src/lib/realtime/nutrient-dosages.ts` | INSERT → UI |
| Estado operacional EC | `src/hooks/useEcOperationState.ts` | `relay_master.ec_operation_state` |
| Auto pH — estado | `src/hooks/usePhOperationState.ts` | `relay_master.ph_operation_*` |
| Auto pH — dosagens | `src/lib/realtime/ph-dosages.ts` | INSERT → `PhDosageDetail` |
| Métricas ciclo EC/pH | `src/lib/controller-metrics.ts` | `ec_controller_metrics`, `ph_controller_metrics` |
| Gráfico métricas | `src/components/ControllerMetricsChart.tsx` | Dashboard — error + u(t) 24h |
| Sensores dashboard | `src/lib/realtime/sensor-measurements.ts` | `hydro_measurements`, `environment_data` |

WebSocket: browser → Supabase (no Railway). Ver `docs/MQTT_INTEGRACAO_FRONTEND.md`.

### Bridge MQTT — Auto EC UX (implementado)

| Tópico | Bridge action |
|--------|---------------|
| `hidrowave/+/ec_operation` | PATCH `relay_master.ec_operation_*` |
| `hidrowave/+/dose` | INSERT `nutrient_dosages` |

Firmware: MQTT primario + HTTPS fallback (`HydroSystemCore::syncEcOperationStateToSupabase`, `handleNutrientDoseEvent`). Test: `infra/mqtt/bridge` → `npm run test:pub:ec-dose`.

### Handoffs serial Auto pH

| Doc | Uso |
|-----|-----|
| [`docs/handoffs/ph/00_INDICE_SERIAL.md`](handoffs/ph/00_INDICE_SERIAL.md) | **Entrada única** S01→S08 (SQL, NVS, calibragem, bridge, bancada) |
| [`docs/HANDOFF_AUTO_PH_E2E.md`](HANDOFF_AUTO_PH_E2E.md) | Resumen 1 pantalla + links |

### Bridge MQTT — Auto pH UX (implementado)

| Tópico | Bridge action |
|--------|---------------|
| `hidrowave/+/ph_operation` | PATCH `relay_master.ph_operation_*` |
| `hidrowave/+/ph_dose` | INSERT `ph_dosages` |

Firmware: MQTT primario + HTTPS fallback (`syncPhOperationStateToSupabase`, `handlePhDoseEvent`). Test: `npm run test:pub:ph-dose`. Handoff: [`docs/handoffs/ph/S01_PH_DOSAGES_E2E.md`](handoffs/ph/S01_PH_DOSAGES_E2E.md).

### Bridge MQTT — métricas de ciclo (implementado)

| Tópico | Bridge action |
|--------|---------------|
| `hidrowave/+/ec_metric` | INSERT `ec_controller_metrics` |
| `hidrowave/+/ph_metric` | INSERT `ph_controller_metrics` |

Firmware: cada `checkAutoEC` / `checkAutoPH` con PV válido. Verificar: `npm run verify:controller-metrics`.

### Schema prod (contrato fijo)

```
users              → PK email
device_status      → hub (user_email, mac, relay_states[])
relay_commands     → cola 1 fila/relé
relay_master       → estados relés locales (arrays)
relay_slaves       → estados slaves + master_device_id
hydro_measurements / environment_data / ec_config_view
```

**No usar:** `relay_commands_master`, `relay_commands_slave`, tabla `relay_states`, view `slaves_discovery`, `device_status.master_device_id`.

### Railway

- Dominio público: `*.up.railway.app` (no `.railway.internal`)
- `railway.toml`: `buildCommand = "npm run build"` sin `npm ci` duplicado
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Nivel 3 — Implementación futura (producción seria)

### Prioridad 1 — Seguridad datos

#### 1.1 RLS en `device_status`

Hoy cualquier cliente con anon key podría listar todos los devices si conoce la API.

```sql
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_status_select_own ON public.device_status;
DROP POLICY IF EXISTS device_status_update_own ON public.device_status;

CREATE POLICY device_status_select_own ON public.device_status
  FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- UPDATE solo si el device ya pertenece al usuario (reasignación vía API server)
CREATE POLICY device_status_update_own ON public.device_status
  FOR UPDATE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));
```

**Impacto frontend:** ESP32 y bridge usan **service_role** o API route con validación — no anon key directa para PATCH masivo.

**Impacto firmware:** registro inicial puede necesitar RPC `register_device` con `SECURITY DEFINER`.

#### 1.2 RLS en tablas hijas (mismo patrón)

Aplicar filtro por `user_email` o join a `device_status`:

- `relay_master`, `relay_slaves`
- `hydro_measurements`, `environment_data`
- `relay_commands` (SELECT/INSERT web; ESP32 poll con service role o RPC)
- `ec_config_view`

#### 1.3 Política para ESP32 / bridge (service role)

- `SUPABASE_SERVICE_ROLE` **solo** en:
  - Lightsail bridge MQTT (`infra/mqtt/bridge`)
  - API routes Next.js server-side (`route.ts`)
- **Nunca** en `NEXT_PUBLIC_*` ni en el browser

---

### Prioridad 2 — Usuarios sin INSERT desde el browser

#### 2.1 Trigger auth → public.users (recomendado)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (email, name, subscription_type, max_devices, total_devices, is_active)
  VALUES (
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
```

**Frontend después:** `AuthContext` solo `SELECT` — eliminar `createUserProfile` INSERT.

#### 2.2 RPC `ensure_public_user` (alternativa/complemento)

```sql
CREATE OR REPLACE FUNCTION public.ensure_public_user(p_user_email text, p_name text DEFAULT NULL)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.users;
BEGIN
  IF lower(p_user_email) <> lower(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'email mismatch';
  END IF;
  INSERT INTO public.users (email, name, is_active)
  VALUES (lower(p_user_email), coalesce(p_name, split_part(p_user_email, '@', 1)), true)
  ON CONFLICT (email) DO UPDATE SET updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;
```

Ya referenciado en `AuthContext.tsx` → `syncPublicUserProfile`.

---

### Prioridad 3 — Datos y operaciones

| Tarea | Acción |
|-------|--------|
| Limpiar `TEST_*` | `scripts/CLEANUP_TEST_DEVICES.sql` |
| Evitar nuevos TEST | Validar `device_id` en API `device/register` — rechazar `TEST_*` en prod |
| Índices | `CREATE INDEX ON device_status (user_email);` `CREATE INDEX ON device_status (last_seen DESC);` |
| Realtime | Replication activa en `device_status` (dashboard Supabase) |

---

### Prioridad 4 — Settings y preferencias

Migrar de `localStorage` a DB:

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_settings jsonb DEFAULT '{}'::jsonb;
```

Actualizar `src/lib/settings.ts` para leer/escribir en `users.user_settings`.

---

### Prioridad 5 — Features fuera del schema actual

| Feature | Requiere |
|---------|----------|
| Automación / reglas | Tabla `decision_rules` + RLS |
| Analytics relay avanzado | Ya usa `relay_commands` — OK |
| View opcional slaves | `CREATE VIEW slaves_discovery AS SELECT ... FROM relay_slaves JOIN device_status` |

---

## Checklist antes de “producción abierta”

- [ ] `USERS_RLS_POLICIES.sql` ejecutado
- [ ] Fix `supabase.ts` desplegado en Railway
- [ ] `getUserDevices` con filtro email desplegado
- [ ] `CLEANUP_TEST_DEVICES.sql` ejecutado
- [ ] RLS `device_status` (nivel 3)
- [ ] Trigger `auth.users` → `public.users` (nivel 3)
- [ ] Service role solo server/bridge (auditar `.env`)
- [ ] Replication Realtime `device_status`
- [ ] Probar login → `/dispositivos` → 1 device, sin errores 401/42501

---

## Errores conocidos y causas

| Error | Causa | Fix |
|-------|-------|-----|
| `42501` RLS users | JWT anon fijo o sin política INSERT | Quitar Authorization global + `USERS_RLS_POLICIES.sql` |
| `401` POST users | Mismo — sin sesión authenticated | Fix `supabase.ts` |
| `PGRST116` users | 0 filas + `.single()` | `maybeSingle()` + trigger/RPC |
| `42703` master_device_id | Columna no existe en prod | Usar `device_type` / `relay_slaves` |
| 1000 filas device_status | `SELECT *` sin filtro | `.eq('user_email', ...)` |
| Lista vacía dispositivos | Filtro users + sin MAC / TEST | Fix query + cleanup TEST |

---

## Referencias en repo

- MQTT + frontend: `docs/MQTT_INTEGRACAO_FRONTEND.md`
- Schema helpers: `src/lib/db-schema.ts`
- SQL scripts: `scripts/*.sql`

---

*Última actualización: conversación Railway + Supabase RLS — esp32 `ESP32_HIDRO_269844`, user `permitateengresar@gmail.com`.*

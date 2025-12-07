-- =====================================================
-- ✅ TABELA EC CONTROLLER DINÂMICA COM ARRAYS (JSONB)
-- =====================================================
-- 
-- Esta tabela permite passar parâmetros para o controller embarcado,
-- incluindo arrays de nutrientes e distribuições de dosagem.
-- 
-- Estrutura baseada em Hydro-Controller-main
-- Suporta arrays dinâmicos via JSONB (PostgreSQL)
--
-- =====================================================
-- 🚀 COPIAR E COLAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- =====================================================

BEGIN;

-- =====================================================
-- ETAPA 1: CRIAR TABELA ec_controller_config
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ec_controller_config (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  
  -- ✅ Parâmetros Básicos do Controller
  base_dose REAL DEFAULT 0.0,
  flow_rate REAL DEFAULT 0.0,
  volume REAL DEFAULT 0.0,
  total_ml REAL DEFAULT 0.0,
  kp REAL DEFAULT 1.0,
  ec_setpoint REAL DEFAULT 0.0,
  auto_enabled BOOLEAN DEFAULT false,
  intervalo_auto_ec INTEGER DEFAULT 300,  -- segundos entre verificações automáticas
  
  -- ✅ ARRAY DE NUTRIENTES (JSONB - flexível e dinâmico)
  nutrients JSONB DEFAULT '[]'::jsonb,
  -- Estrutura esperada:
  -- [
  --   {
  --     "name": "Grow",
  --     "relay": 0,
  --     "mlPerLiter": 2.5,
  --     "proportion": 0.4,
  --     "active": true
  --   },
  --   ...
  -- ]
  -- ✅ NOTA: Distribution foi removido - ESP32 calcula localmente usando nutrients
  
  -- ✅ Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  
  -- ✅ Constraints
  CONSTRAINT ec_controller_config_device_id_check 
    CHECK (device_id IS NOT NULL AND device_id != ''),
  CONSTRAINT ec_controller_config_kp_check 
    CHECK (kp >= 0 AND kp <= 10),
  CONSTRAINT ec_controller_config_volume_check 
    CHECK (volume >= 0),
  CONSTRAINT ec_controller_config_flow_rate_check 
    CHECK (flow_rate >= 0),
  CONSTRAINT ec_controller_config_base_dose_check 
    CHECK (base_dose >= 0),
  CONSTRAINT ec_controller_config_total_ml_check 
    CHECK (total_ml >= 0),
  CONSTRAINT ec_controller_config_intervalo_check 
    CHECK (intervalo_auto_ec > 0 AND intervalo_auto_ec <= 3600)
);

-- =====================================================
-- ETAPA 2: CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ec_controller_config_device_id 
  ON public.ec_controller_config(device_id);

CREATE INDEX IF NOT EXISTS idx_ec_controller_config_updated_at 
  ON public.ec_controller_config(updated_at DESC);

-- ✅ Índice GIN para busca em arrays JSONB
CREATE INDEX IF NOT EXISTS idx_ec_controller_config_nutrients_gin 
  ON public.ec_controller_config USING GIN (nutrients);

-- ✅ REMOVIDO: Índice de distribution (coluna removida)

-- =====================================================
-- ETAPA 3: CRIAR TRIGGER PARA updated_at AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION update_ec_controller_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ec_controller_config_updated_at 
  ON public.ec_controller_config;

CREATE TRIGGER trigger_update_ec_controller_config_updated_at
  BEFORE UPDATE ON public.ec_controller_config
  FOR EACH ROW
  EXECUTE FUNCTION update_ec_controller_config_updated_at();

-- =====================================================
-- ETAPA 4: COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.ec_controller_config IS 
  'Configuração dinâmica do EC Controller com arrays de nutrientes e distribuições';

COMMENT ON COLUMN public.ec_controller_config.device_id IS 
  'ID único do dispositivo ESP32 (ex: ESP32_HIDRO_F44738)';

COMMENT ON COLUMN public.ec_controller_config.base_dose IS 
  'EC base em µS/cm (condutividade elétrica base)';

COMMENT ON COLUMN public.ec_controller_config.flow_rate IS 
  'Taxa de vazão em ml/s (ou s/ml, dependendo da configuração)';

COMMENT ON COLUMN public.ec_controller_config.volume IS 
  'Volume do reservatório em litros';

COMMENT ON COLUMN public.ec_controller_config.total_ml IS 
  'Total de ml/L (soma de todos os nutrientes)';

COMMENT ON COLUMN public.ec_controller_config.kp IS 
  'Ganho proporcional do controlador PID (0-10)';

COMMENT ON COLUMN public.ec_controller_config.ec_setpoint IS 
  'Setpoint desejado de EC em µS/cm';

COMMENT ON COLUMN public.ec_controller_config.auto_enabled IS 
  'Se o controle automático de EC está ativado';

COMMENT ON COLUMN public.ec_controller_config.intervalo_auto_ec IS 
  'Intervalo em segundos entre verificações automáticas de EC';

COMMENT ON COLUMN public.ec_controller_config.nutrients IS 
  'Array JSON de nutrientes: [{"name": "...", "relay": 0, "mlPerLiter": 2.5, "proportion": 0.4, "active": true}, ...]. ESP32 calcula distribution localmente usando estes dados.';

-- =====================================================
-- ETAPA 5: CONFIGURAR PERMISSÕES (RLS)
-- =====================================================

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.ec_controller_config ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode ler (anon)
CREATE POLICY "ec_controller_config_select_anon" 
  ON public.ec_controller_config
  FOR SELECT
  TO anon
  USING (true);

-- Política: Qualquer um pode inserir/atualizar (anon) - para ESP32
CREATE POLICY "ec_controller_config_insert_anon" 
  ON public.ec_controller_config
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "ec_controller_config_update_anon" 
  ON public.ec_controller_config
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Política: Usuários autenticados têm acesso total
CREATE POLICY "ec_controller_config_all_authenticated" 
  ON public.ec_controller_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ETAPA 6: FUNÇÃO HELPER PARA VALIDAR JSONB
-- =====================================================

CREATE OR REPLACE FUNCTION validate_ec_controller_nutrients(nutrients_json JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validar que é um array
  IF jsonb_typeof(nutrients_json) != 'array' THEN
    RETURN false;
  END IF;
  
  -- Validar estrutura de cada nutriente
  RETURN (
    SELECT bool_and(
      jsonb_typeof(elem) = 'object' AND
      elem ? 'name' AND
      elem ? 'relay' AND
      elem ? 'mlPerLiter' AND
      (elem->>'relay')::integer >= 0 AND
      (elem->>'relay')::integer <= 15 AND
      (elem->>'mlPerLiter')::real >= 0
    )
    FROM jsonb_array_elements(nutrients_json) AS elem
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- ETAPA 7: EXEMPLOS DE USO
-- =====================================================

-- Exemplo 1: Inserir configuração completa com arrays
/*
INSERT INTO public.ec_controller_config (
  device_id,
  base_dose,
  flow_rate,
  volume,
  total_ml,
  kp,
  ec_setpoint,
  auto_enabled,
  intervalo_auto_ec,
  nutrients,
) VALUES (
  'ESP32_HIDRO_F44738',
  1525.0,
  0.974,
  100.0,
  4.1,
  1.0,
  1500.0,
  true,
  300,
  '[
    {
      "name": "Grow",
      "relay": 0,
      "mlPerLiter": 2.5,
      "proportion": 0.4,
      "active": true
    },
    {
      "name": "Micro",
      "relay": 1,
      "mlPerLiter": 1.5,
      "proportion": 0.3,
      "active": true
    }
  ]'::jsonb,
  NULL
);
*/

-- Exemplo 2: Atualizar apenas array de nutrientes
/*
UPDATE public.ec_controller_config
SET 
  nutrients = '[
    {
      "name": "Grow",
      "relay": 0,
      "mlPerLiter": 3.0,
      "proportion": 0.5,
      "active": true
    }
  ]'::jsonb,
  updated_at = NOW()
WHERE device_id = 'ESP32_HIDRO_F44738';
*/

-- Exemplo 3: Buscar configuração com arrays
/*
SELECT 
  device_id,
  base_dose,
  flow_rate,
  nutrients,
FROM public.ec_controller_config
WHERE device_id = 'ESP32_HIDRO_F44738';
*/

COMMIT;

-- =====================================================
-- ✅ TABELA CRIADA COM SUCESSO!
-- =====================================================
-- 
-- A tabela ec_controller_config agora suporta:
-- ✅ Parâmetros básicos do controller
-- ✅ Arrays de nutrientes (JSONB)
-- ✅ Distribuições de dosagem (JSONB)
-- ✅ Validação e constraints
-- ✅ Índices para performance
-- ✅ RLS configurado
--
-- Próximos passos:
-- 1. Atualizar API /api/ec-controller/config para usar esta estrutura
-- 2. Implementar parse de arrays no ESP32
-- 3. Testar fluxo completo
--
-- =====================================================


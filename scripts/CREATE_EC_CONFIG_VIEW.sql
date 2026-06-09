-- =====================================================
-- Script para criar view table para ec_config
-- =====================================================
-- 
-- Similar ao padrão relay_slaves/relay_commands_slave
-- A view army o array dos nutrientesazena a configuração completa do EC Controller
-- O botão "Salvar Parâmetros" salva nesta view
-- O botão "Ativar Auto EC" chama RPC activate_auto_ec que lê desta view
--
-- Data: 2025-01-12
-- =====================================================

-- Criar view table ec_config_view (similar a relay_slaves)
-- Esta view contém a configuração completa pronta para ser enviada ao ESP32 via RPC
CREATE TABLE IF NOT EXISTS public.ec_config_view (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  device_id TEXT NOT NULL UNIQUE,
  
  -- Parâmetros básicos
  base_dose DOUBLE PRECISION DEFAULT 0,
  flow_rate DOUBLE PRECISION DEFAULT 1.0,
  volume DOUBLE PRECISION DEFAULT 10,
  total_ml DOUBLE PRECISION DEFAULT 0,
  kp DOUBLE PRECISION DEFAULT 1.0,
  ec_setpoint DOUBLE PRECISION DEFAULT 0,
  
  -- Controle automático
  auto_enabled BOOLEAN DEFAULT false,
  intervalo_auto_ec INTEGER DEFAULT 300 CHECK (intervalo_auto_ec > 0),
  tempo_recirculacao INTEGER DEFAULT 60 CHECK (tempo_recirculacao > 0),  -- ✅ SEGUNDOS (60s = 1 minuto) - IMPORTANTE: INTEGER, no string
  
  -- Nutrientes (JSONB)
  nutrients JSONB DEFAULT '[]'::jsonb,
  
  -- Distribuição de dosagem (JSONB) - ❌ DEPRECADO: Ya no se usa, se calcula en tiempo real en ESP32
  distribution JSONB DEFAULT NULL,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface',
  
  -- Foreign key
  CONSTRAINT fk_ec_config_view_device FOREIGN KEY (device_id) REFERENCES device_status(device_id) ON DELETE CASCADE
);

-- Índice para busca rápida por device_id
CREATE INDEX IF NOT EXISTS idx_ec_config_view_device_id ON public.ec_config_view(device_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_ec_config_view_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ec_config_view_updated_at ON public.ec_config_view;
CREATE TRIGGER trigger_update_ec_config_view_updated_at
  BEFORE UPDATE ON public.ec_config_view
  FOR EACH ROW
  EXECUTE FUNCTION update_ec_config_view_updated_at();

-- Comentários
COMMENT ON TABLE public.ec_config_view IS 
  'View table para configuração do EC Controller. Similar a relay_slaves, armazena configuração completa pronta para ser enviada ao ESP32 via RPC. O botão "Salvar Parâmetros" salva aqui, e o botão "Ativar Auto EC" chama RPC activate_auto_ec.';

COMMENT ON COLUMN public.ec_config_view.device_id IS 
  'ID do dispositivo master (ESP32)';

COMMENT ON COLUMN public.ec_config_view.nutrients IS 
  'Array JSONB de nutrientes. Cada nutriente contém: name (text), relay (integer), mlPerLiter (double precision), active (boolean). Se envía al ESP32 para que sepa qué relé usar, pero NO se guarda en NVS.';

COMMENT ON COLUMN public.ec_config_view.kp IS 
  'Ganho proporcional do controlador (default: 1.0). Parâmetro crítico para cálculo de dosagem.';

COMMENT ON COLUMN public.ec_config_view.tempo_recirculacao IS 
  'Tempo de recirculação em SEGUNDOS (INTEGER). Exemplo: 60 = 1 minuto, 4500 = 75 minutos. Valor mínimo: 1 segundo. ✅ IMPORTANTE: Enviar como INTEGER, no string ni milisegundos.';

COMMENT ON COLUMN public.ec_config_view.distribution IS 
  '❌ DEPRECADO: Distribution ya no se usa. Se calcula en tiempo real en el ESP32 con valores actuales del sensor. Este campo se mantiene por compatibilidad pero no se retorna en el RPC activate_auto_ec.';

-- Desabilitar RLS (similar a ec_controller_config)
ALTER TABLE public.ec_config_view DISABLE ROW LEVEL SECURITY;

-- Verificar criação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_config_view'
  ) THEN
    RAISE NOTICE '✅ Tabela ec_config_view criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar tabela ec_config_view';
  END IF;
END $$;

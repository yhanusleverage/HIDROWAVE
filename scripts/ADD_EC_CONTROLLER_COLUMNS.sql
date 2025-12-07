-- =====================================================
-- Script para adicionar colunas faltantes à tabela ec_controller_config
-- =====================================================
-- 
-- Este script adiciona as seguintes colunas:
-- 1. nutrients (JSONB) - Array de nutrientes com relés e ml/L
-- 2. intervalo_auto_ec (INTEGER) - Intervalo entre verificações de EC (segundos)
-- 3. tempo_recirculacao (INTEGER) - Tempo de recirculação em milisegundos
--
-- Data: 2025-01-12
-- =====================================================

-- Adicionar coluna nutrients (JSONB) para armazenar array de nutrientes
ALTER TABLE public.ec_controller_config
ADD COLUMN IF NOT EXISTS nutrients JSONB DEFAULT '[]'::jsonb;

-- ❌ REMOVIDO: Coluna distribution não é necessária
-- A distribuição de dosagem é calculada dinamicamente pelo ESP32

-- Adicionar coluna intervalo_auto_ec (INTEGER) para intervalo entre verificações
ALTER TABLE public.ec_controller_config
ADD COLUMN IF NOT EXISTS intervalo_auto_ec INTEGER DEFAULT 300 CHECK (intervalo_auto_ec > 0);

-- Adicionar coluna tempo_recirculacao (TEXT) para tempo de recirculação
-- Formato: HH:MM:SS (ex: 00:01:00 = 1 minuto)
ALTER TABLE public.ec_controller_config
ADD COLUMN IF NOT EXISTS tempo_recirculacao TEXT DEFAULT '00:01:00' CHECK (
  tempo_recirculacao ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
);

-- Adicionar coluna last_processed_at (TIMESTAMPTZ) para controle de lock RPC
-- Usado pela função RPC get_and_lock_ec_config para evitar processamento simultâneo
ALTER TABLE public.ec_controller_config
ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMPTZ;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN public.ec_controller_config.nutrients IS 
  'Array JSONB de nutrientes. Cada nutriente contém: name (text), relay (integer), mlPerLiter (double precision), proportion (double precision), active (boolean)';

-- ❌ REMOVIDO: Comentário da coluna distribution (coluna não é mais usada)

COMMENT ON COLUMN public.ec_controller_config.intervalo_auto_ec IS 
  'Intervalo em segundos entre verificações automáticas de EC. Valor mínimo: 1 segundo';

COMMENT ON COLUMN public.ec_controller_config.tempo_recirculacao IS 
  'Tempo de recirculação em milisegundos. Exemplo: 60000 = 1 minuto (60 segundos * 1000). Valor mínimo: 1 ms';

COMMENT ON COLUMN public.ec_controller_config.last_processed_at IS 
  'Timestamp da última vez que a configuração foi processada pelo ESP32. Usado pela função RPC get_and_lock_ec_config para evitar processamento simultâneo';

-- Verificar se as colunas foram criadas corretamente
DO $$
BEGIN
  -- Verificar nutrients
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'nutrients'
  ) THEN
    RAISE NOTICE '✅ Coluna nutrients criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar coluna nutrients';
  END IF;

  -- ❌ REMOVIDO: Verificação da coluna distribution (não é mais usada)

  -- Verificar intervalo_auto_ec
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'intervalo_auto_ec'
  ) THEN
    RAISE NOTICE '✅ Coluna intervalo_auto_ec criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar coluna intervalo_auto_ec';
  END IF;

  -- Verificar tempo_recirculacao
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'tempo_recirculacao'
  ) THEN
    RAISE NOTICE '✅ Coluna tempo_recirculacao criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar coluna tempo_recirculacao';
  END IF;

  -- Verificar last_processed_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'last_processed_at'
  ) THEN
    RAISE NOTICE '✅ Coluna last_processed_at criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar coluna last_processed_at';
  END IF;
END $$;

-- =====================================================
-- Exemplo de estrutura esperada para nutrients (JSONB):
-- =====================================================
-- [
--   {
--     "name": "pH-",
--     "relay": 0,
--     "mlPerLiter": 0.5,
--     "proportion": 0.1,
--     "active": true
--   },
--   {
--     "name": "Grow",
--     "relay": 2,
--     "mlPerLiter": 2.0,
--     "proportion": 0.4,
--     "active": true
--   }
-- ]
-- =====================================================
-- ❌ REMOVIDO: Exemplo de estrutura para distribution
-- A distribuição é calculada dinamicamente pelo ESP32
-- =====================================================

-- =====================================================
-- Script para ADICIONAR coluna distribution à ec_config_view
-- =====================================================
-- 
-- Este script adiciona a coluna distribution JSONB que foi
-- removida ou não existe na tabela ec_config_view
--
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- ✅ Adicionar coluna distribution se não existir
ALTER TABLE public.ec_config_view
ADD COLUMN IF NOT EXISTS distribution JSONB DEFAULT NULL;

-- ✅ Adicionar comentário na coluna
COMMENT ON COLUMN public.ec_config_view.distribution IS 
  'Distribuição de dosagem proporcional calculada. Estrutura: {"totalUt": 15.50, "intervalo": 5, "distribution": [{"name": "Grow", "relay": 2, "dosage": 6.20, "duration": 6.37}, ...]}. Compatível com Hydro-Controller executeWebDosage(). Calculada automaticamente no frontend ao salvar.';

-- ✅ Verificar se a coluna foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_config_view'
    AND column_name = 'distribution'
  ) THEN
    RAISE NOTICE '✅ Coluna distribution adicionada com sucesso à ec_config_view';
  ELSE
    RAISE WARNING '❌ Falha ao adicionar coluna distribution';
  END IF;
END $$;

-- =====================================================
-- Script para migrar tempo_recirculacao de TEXT (HH:MM:SS) para INTEGER (milisegundos)
-- =====================================================
-- 
-- Este script:
-- 1. Converte valores existentes de HH:MM:SS para milisegundos
-- 2. Altera o tipo da coluna de TEXT para INTEGER
-- 3. Remove o constraint CHECK antigo
-- 4. Adiciona novo constraint CHECK para valores > 0
--
-- Data: 2025-01-12
-- =====================================================

-- Passo 1: Converter valores existentes de HH:MM:SS para milisegundos
-- Se a coluna já existir como TEXT, converter os valores
DO $$
DECLARE
  rec RECORD;
  hours INTEGER;
  minutes INTEGER;
  seconds INTEGER;
  total_ms INTEGER;
BEGIN
  -- Verificar se a coluna existe e é do tipo TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'tempo_recirculacao'
    AND data_type = 'text'
  ) THEN
    -- Converter cada registro de HH:MM:SS para milisegundos
    FOR rec IN 
      SELECT id, tempo_recirculacao 
      FROM public.ec_controller_config 
      WHERE tempo_recirculacao IS NOT NULL 
      AND tempo_recirculacao ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
    LOOP
      -- Parsear HH:MM:SS
      hours := COALESCE((regexp_split_to_array(rec.tempo_recirculacao, ':'))[1]::INTEGER, 0);
      minutes := COALESCE((regexp_split_to_array(rec.tempo_recirculacao, ':'))[2]::INTEGER, 0);
      seconds := COALESCE((regexp_split_to_array(rec.tempo_recirculacao, ':'))[3]::INTEGER, 0);
      
      -- Calcular milisegundos: (horas * 3600 + minutos * 60 + segundos) * 1000
      total_ms := (hours * 3600 + minutes * 60 + seconds) * 1000;
      
      -- Atualizar registro (usar uma coluna temporária primeiro)
      UPDATE public.ec_controller_config
      SET tempo_recirculacao = total_ms::TEXT
      WHERE id = rec.id;
      
      RAISE NOTICE 'Convertido tempo_recirculacao para %: % ms (era: %)', rec.id, total_ms, rec.tempo_recirculacao;
    END LOOP;
    
    -- Se houver valores inválidos, usar default (60000 ms = 1 minuto)
    UPDATE public.ec_controller_config
    SET tempo_recirculacao = '60000'
    WHERE tempo_recirculacao IS NOT NULL 
    AND NOT (tempo_recirculacao ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$')
    AND NOT (tempo_recirculacao ~ '^[0-9]+$');
    
    RAISE NOTICE '✅ Conversão de valores existentes concluída';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna tempo_recirculacao não existe ou não é TEXT, pulando conversão';
  END IF;
END $$;

-- Passo 2: Remover constraint CHECK antigo (se existir)
ALTER TABLE public.ec_controller_config
DROP CONSTRAINT IF EXISTS ec_controller_config_tempo_recirculacao_check;

-- Passo 3: Alterar tipo da coluna de TEXT para INTEGER
-- Se a coluna não existir, criar como INTEGER
-- Se existir como TEXT, alterar para INTEGER
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'tempo_recirculacao'
  ) THEN
    -- Coluna existe, alterar tipo
    ALTER TABLE public.ec_controller_config
    ALTER COLUMN tempo_recirculacao TYPE INTEGER 
    USING CASE 
      WHEN tempo_recirculacao ~ '^[0-9]+$' THEN tempo_recirculacao::INTEGER
      ELSE 60000 -- Default: 1 minuto em milisegundos
    END;
    
    RAISE NOTICE '✅ Tipo da coluna tempo_recirculacao alterado para INTEGER';
  ELSE
    -- Coluna não existe, criar como INTEGER
    ALTER TABLE public.ec_controller_config
    ADD COLUMN tempo_recirculacao INTEGER DEFAULT 60000 CHECK (tempo_recirculacao > 0);
    
    RAISE NOTICE '✅ Coluna tempo_recirculacao criada como INTEGER';
  END IF;
END $$;

-- Passo 4: Adicionar constraint CHECK para valores > 0
ALTER TABLE public.ec_controller_config
ADD CONSTRAINT ec_controller_config_tempo_recirculacao_check 
CHECK (tempo_recirculacao > 0);

-- Passo 5: Definir default se não tiver
ALTER TABLE public.ec_controller_config
ALTER COLUMN tempo_recirculacao SET DEFAULT 60000; -- 1 minuto em milisegundos

-- Passo 6: Atualizar comentário da coluna
COMMENT ON COLUMN public.ec_controller_config.tempo_recirculacao IS 
  'Tempo de recirculação em milisegundos. Exemplo: 60000 = 1 minuto (60 segundos * 1000). Valor mínimo: 1 ms';

-- Verificar resultado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config' 
    AND column_name = 'tempo_recirculacao'
    AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '✅ Migração concluída: tempo_recirculacao é agora INTEGER (milisegundos)';
  ELSE
    RAISE WARNING '❌ Falha na migração: tempo_recirculacao não é INTEGER';
  END IF;
END $$;

-- =====================================================
-- Exemplos de valores:
-- =====================================================
-- 60000   = 1 minuto (00:01:00)
-- 300000  = 5 minutos (00:05:00)
-- 3600000 = 1 hora (01:00:00)
-- =====================================================

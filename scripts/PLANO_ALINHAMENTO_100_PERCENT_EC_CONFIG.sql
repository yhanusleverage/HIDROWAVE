-- =====================================================
-- 🎯 PLANO DE ALINHAMENTO 100% - EC CONFIG
-- =====================================================
-- 
-- Este script verifica e elimina a tabela ec_controller_config
-- que não está sendo usada, garantindo que tudo use apenas ec_config_view
--
-- ⚠️ EXECUTAR COM CUIDADO - FAZER BACKUP ANTES
-- =====================================================

BEGIN;

-- =====================================================
-- ETAPA 1: VERIFICAÇÕES DE SEGURANÇA
-- =====================================================

-- 1.1 Verificar se há dados em ec_controller_config
DO $$
DECLARE
  row_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE '✅ ec_controller_config não existe - já foi eliminada ou nunca existiu';
  ELSE
    SELECT COUNT(*) INTO row_count FROM public.ec_controller_config;
    
    IF row_count > 0 THEN
      RAISE NOTICE '⚠️ ATENÇÃO: ec_controller_config tem % registros. Verifique se precisa migrar dados.', row_count;
      RAISE NOTICE '📋 Execute: SELECT * FROM ec_controller_config ORDER BY updated_at DESC LIMIT 10;';
    ELSE
      RAISE NOTICE '✅ ec_controller_config está vazia - seguro para eliminar';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '✅ ec_controller_config não existe - já foi eliminada';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao verificar ec_controller_config: %', SQLERRM;
END $$;

-- 1.2 Verificar se há RPCs que usam ec_controller_config
DO $$
DECLARE
  func_count INTEGER;
  func_def TEXT;
BEGIN
  -- Verificar funções que referenciam ec_controller_config
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
    AND EXISTS (
      SELECT 1 
      FROM pg_proc p2
      WHERE p2.oid = p.oid
        AND pg_get_functiondef(p2.oid) LIKE '%ec_controller_config%'
    );
  
  IF func_count > 0 THEN
    RAISE WARNING '⚠️ ATENÇÃO: Encontradas % funções que referenciam ec_controller_config', func_count;
    RAISE NOTICE '📋 Execute: SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = ''public'' AND pg_get_functiondef(p.oid) LIKE ''%%ec_controller_config%%'';';
  ELSE
    RAISE NOTICE '✅ Nenhuma função RPC usa ec_controller_config';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao verificar funções RPC: %', SQLERRM;
    RAISE NOTICE '📋 Execute manualmente: SELECT proname FROM pg_proc WHERE pg_get_functiondef(oid) LIKE ''%%ec_controller_config%%'';';
END $$;

-- 1.3 Verificar se há triggers que referenciam ec_controller_config
DO $$
DECLARE
  trigger_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_controller_config'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE '✅ ec_controller_config não existe - não há triggers para verificar';
  ELSE
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'public.ec_controller_config'::regclass;
    
    IF trigger_count > 0 THEN
      RAISE WARNING '⚠️ ATENÇÃO: Encontrados % triggers em ec_controller_config', trigger_count;
    ELSE
      RAISE NOTICE '✅ Nenhum trigger em ec_controller_config';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '✅ ec_controller_config não existe - não há triggers';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao verificar triggers: %', SQLERRM;
END $$;

-- 1.4 Verificar se há views que referenciam ec_controller_config
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
    AND definition LIKE '%ec_controller_config%';
  
  IF view_count > 0 THEN
    RAISE WARNING '⚠️ ATENÇÃO: Encontradas % views que referenciam ec_controller_config', view_count;
    RAISE NOTICE '📋 Execute: SELECT viewname FROM pg_views WHERE schemaname = ''public'' AND definition LIKE ''%%ec_controller_config%%'';';
  ELSE
    RAISE NOTICE '✅ Nenhuma view usa ec_controller_config';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao verificar views: %', SQLERRM;
END $$;

-- 1.5 Verificar se há foreign keys que referenciam ec_controller_config
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'ec_controller_config';
  
  IF fk_count > 0 THEN
    RAISE WARNING '⚠️ ATENÇÃO: Encontradas % foreign keys que referenciam ec_controller_config', fk_count;
  ELSE
    RAISE NOTICE '✅ Nenhuma foreign key referencia ec_controller_config';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao verificar foreign keys: %', SQLERRM;
END $$;

-- =====================================================
-- ETAPA 2: BACKUP (OPCIONAL - DESCOMENTAR SE NECESSÁRIO)
-- =====================================================

-- Descomentar para fazer backup antes de eliminar
/*
CREATE TABLE IF NOT EXISTS ec_controller_config_backup AS 
SELECT * FROM public.ec_controller_config;

COMMENT ON TABLE ec_controller_config_backup IS 
  'Backup de ec_controller_config antes da eliminação. Criado em ' || now()::text;
*/

-- =====================================================
-- ETAPA 3: MIGRAÇÃO DE DADOS (SE NECESSÁRIO)
-- =====================================================

-- Migrar dados de ec_controller_config para ec_config_view
-- Apenas para device_ids que não existem em ec_config_view
INSERT INTO public.ec_config_view (
  device_id,
  base_dose,
  flow_rate,
  volume,
  total_ml,
  kp,
  ec_setpoint,
  auto_enabled,
  intervalo_auto_ec,
  tempo_recirculacao,
  nutrients,
  created_at,
  updated_at,
  created_by
)
SELECT 
  ecc.device_id,
  ecc.base_dose,
  ecc.flow_rate,
  ecc.volume,
  ecc.total_ml,
  ecc.kp,
  ecc.ec_setpoint,
  ecc.auto_enabled,
  ecc.intervalo_auto_ec,
  -- Converter tempo_recirculacao de TEXT ('HH:MM:SS') para INTEGER (milissegundos)
  CASE 
    WHEN ecc.tempo_recirculacao ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' THEN
      -- Extrair horas, minutos e segundos
      (
        EXTRACT(HOUR FROM ecc.tempo_recirculacao::TIME) * 3600 +
        EXTRACT(MINUTE FROM ecc.tempo_recirculacao::TIME) * 60 +
        EXTRACT(SECOND FROM ecc.tempo_recirculacao::TIME)
      ) * 1000
    ELSE
      60000 -- Default: 1 minuto em milissegundos
  END AS tempo_recirculacao,
  COALESCE(ecc.nutrients, '[]'::jsonb) AS nutrients,
  ecc.created_at,
  ecc.updated_at,
  'migrated_from_ec_controller_config' AS created_by
FROM public.ec_controller_config ecc
WHERE NOT EXISTS (
  SELECT 1 FROM public.ec_config_view ecv 
  WHERE ecv.device_id = ecc.device_id
)
ON CONFLICT (device_id) DO NOTHING;

-- =====================================================
-- ETAPA 4: ELIMINAR TABELA ec_controller_config
-- =====================================================

-- ⚠️ DESCOMENTAR APENAS APÓS VERIFICAR TODAS AS ETAPAS ANTERIORES
-- DROP TABLE IF EXISTS public.ec_controller_config CASCADE;

-- =====================================================
-- ETAPA 5: VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar que ec_config_view está funcionando
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_config_view'
  ) THEN
    RAISE NOTICE '✅ ec_config_view existe e está pronta para uso';
  ELSE
    RAISE EXCEPTION '❌ ERRO: ec_config_view não existe! Execute CREATE_EC_CONFIG_VIEW.sql primeiro.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'activate_auto_ec'
  ) THEN
    RAISE NOTICE '✅ RPC activate_auto_ec existe e está configurado';
  ELSE
    RAISE WARNING '⚠️ RPC activate_auto_ec não existe! Execute CREATE_RPC_ACTIVATE_AUTO_EC.sql';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- RESUMO FINAL
-- =====================================================
-- 
-- Após executar este script:
-- 1. ✅ Verifique os NOTICES e WARNINGS acima
-- 2. ✅ Se houver dados migrados, verifique em ec_config_view
-- 3. ✅ Descomente DROP TABLE apenas se todas as verificações passaram
-- 4. ✅ Execute novamente para confirmar que tudo está OK
-- 
-- =====================================================

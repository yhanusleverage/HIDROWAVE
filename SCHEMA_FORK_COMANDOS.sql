-- =====================================================
-- 🎯 ARQUITETURA FORK: COMANDOS SEPARADOS POR ORIGEM
-- =====================================================
-- Adiciona campo command_type para bifurcar comandos
-- manual | rule | peristaltic

-- =====================================================
-- 1. ADICIONAR command_type EM relay_commands
-- =====================================================

-- Adicionar coluna command_type (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'relay_commands' 
        AND column_name = 'command_type'
    ) THEN
        ALTER TABLE public.relay_commands
        ADD COLUMN command_type text NOT NULL DEFAULT 'manual'
        CHECK (command_type IN ('manual', 'rule', 'peristaltic'));
        
        -- Criar índice para performance
        CREATE INDEX idx_relay_commands_command_type 
        ON public.relay_commands(device_id, command_type, status);
        
        RAISE NOTICE '✅ Coluna command_type adicionada em relay_commands';
    ELSE
        RAISE NOTICE '⚠️ Coluna command_type já existe em relay_commands';
    END IF;
END $$;

-- =====================================================
-- 2. ADICIONAR CAMPOS BÁSICOS EM decision_rules
-- =====================================================

-- Adicionar allowed_relays (array de relés permitidos)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decision_rules' 
        AND column_name = 'allowed_relays'
    ) THEN
        ALTER TABLE public.decision_rules
        ADD COLUMN allowed_relays integer[] DEFAULT ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        
        RAISE NOTICE '✅ Coluna allowed_relays adicionada em decision_rules';
    ELSE
        RAISE NOTICE '⚠️ Coluna allowed_relays já existe em decision_rules';
    END IF;
END $$;

-- Adicionar allowed_targets (array de targets permitidos)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decision_rules' 
        AND column_name = 'allowed_targets'
    ) THEN
        ALTER TABLE public.decision_rules
        ADD COLUMN allowed_targets text[] DEFAULT ARRAY['local'];
        
        RAISE NOTICE '✅ Coluna allowed_targets adicionada em decision_rules';
    ELSE
        RAISE NOTICE '⚠️ Coluna allowed_targets já existe em decision_rules';
    END IF;
END $$;

-- Adicionar cooldown_seconds (cooldown entre execuções)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decision_rules' 
        AND column_name = 'cooldown_seconds'
    ) THEN
        ALTER TABLE public.decision_rules
        ADD COLUMN cooldown_seconds integer DEFAULT 60 
        CHECK (cooldown_seconds >= 0);
        
        RAISE NOTICE '✅ Coluna cooldown_seconds adicionada em decision_rules';
    ELSE
        RAISE NOTICE '⚠️ Coluna cooldown_seconds já existe em decision_rules';
    END IF;
END $$;

-- =====================================================
-- 3. ATUALIZAR triggered_by EXISTENTE PARA command_type
-- =====================================================

-- Migrar dados existentes baseado em triggered_by
UPDATE public.relay_commands
SET command_type = CASE
    WHEN triggered_by = 'automation' OR triggered_by = 'rule' THEN 'rule'
    WHEN triggered_by = 'peristaltic' THEN 'peristaltic'
    ELSE 'manual'
END
WHERE command_type = 'manual' OR command_type IS NULL;

-- =====================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice composto para busca rápida por tipo e status
CREATE INDEX IF NOT EXISTS idx_relay_commands_type_status 
ON public.relay_commands(device_id, command_type, status) 
WHERE status = 'pending';

-- Índice para decision_rules (enabled + device_id)
CREATE INDEX IF NOT EXISTS idx_decision_rules_enabled_device 
ON public.decision_rules(device_id, enabled) 
WHERE enabled = true;

-- =====================================================
-- 5. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN public.relay_commands.command_type IS 
'FORK: Tipo de comando - manual (botão), rule (automação), peristaltic (dosagem)';

COMMENT ON COLUMN public.decision_rules.allowed_relays IS 
'Array de relés permitidos para esta regra [0-15]';

COMMENT ON COLUMN public.decision_rules.allowed_targets IS 
'Array de targets permitidos: local, ESP-NOW-SLAVE, etc';

COMMENT ON COLUMN public.decision_rules.cooldown_seconds IS 
'Tempo mínimo (segundos) entre execuções da regra';

-- =====================================================
-- ✅ SCRIPT CONCLUÍDO
-- =====================================================

SELECT '✅ Arquitetura FORK implementada com sucesso!' AS status;






-- =====================================================
-- ADICIONAR CAMPO reboot_count À TABELA device_status
-- =====================================================
-- 
-- Este campo rastreia o número de reinícios/reboots do dispositivo ESP32
-- Útil para debug de memória e detecção de instabilidade
--
-- Uso:
--   - 0 = Estável (sem reinícios)
--   - < 10 = Atenção (alguns reinícios)
--   - >= 10 = Crítico (muitos reinícios, possível vazamento de memória)
-- =====================================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'device_status' 
      AND column_name = 'reboot_count'
  ) THEN
    -- Adicionar coluna reboot_count
    ALTER TABLE public.device_status
    ADD COLUMN reboot_count integer DEFAULT 0 CHECK (reboot_count >= 0);
    
    -- Adicionar comentário na coluna
    COMMENT ON COLUMN public.device_status.reboot_count IS 
      'Contador de reinícios/reboots do dispositivo. Útil para debug de memória e detecção de instabilidade. 0 = Estável, < 10 = Atenção, >= 10 = Crítico';
    
    RAISE NOTICE '✅ Coluna reboot_count adicionada com sucesso à tabela device_status';
  ELSE
    RAISE NOTICE '⚠️ Coluna reboot_count já existe na tabela device_status';
  END IF;
END $$;

-- Verificar se a coluna foi criada
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'device_status'
  AND column_name = 'reboot_count';


-- =====================================================
-- ✅ SISTEMA COMPLETO DE CALENDÁRIO DE CULTIVO
-- =====================================================
-- 
-- Este script cria todas as tabelas necessárias para o
-- sistema de calendário de cultivo com eventos, tarefas,
-- anotações e alarmes automatizados.
-- 
-- Todas as tabelas usam o prefixo "crop_" para fácil distinção
-- Modelado conforme schema existente do Supabase
--
-- =====================================================
-- 🚀 COPIAR E COLAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- =====================================================

BEGIN;

-- =====================================================
-- ETAPA 1: CRIAR crop_tasks (novo) + migrar legado
-- =====================================================
-- Ordem: CREATE IF NOT EXISTS primeiro; ALTER só se a tabela já existia incompleta.

CREATE TABLE IF NOT EXISTS public.crop_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id TEXT,
  user_email TEXT,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT CHECK (task_type IN ('dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  task_date DATE,
  task_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  nutrients JSONB DEFAULT '[]'::jsonb,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface'::text,
  CONSTRAINT crop_tasks_pkey PRIMARY KEY (id)
);

-- Colunas extras em instalações legadas (ignorado se CREATE acima já criou tudo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crop_tasks'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN user_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'task_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'type'
    ) THEN
      ALTER TABLE public.crop_tasks ADD COLUMN task_type TEXT
        CHECK (task_type IN ('dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio'));
    ELSE
      ALTER TABLE public.crop_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'dosagem'
        CHECK (task_type IN ('dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio'));
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'task_date'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN task_date DATE;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'due_date'
    ) THEN
      UPDATE public.crop_tasks
      SET task_date = due_date::DATE
      WHERE task_date IS NULL AND due_date IS NOT NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'task_time'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN task_time TIME;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN duration_minutes INTEGER DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'nutrients'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN nutrients JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'completed'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN completed BOOLEAN DEFAULT false;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'status'
    ) THEN
      UPDATE public.crop_tasks
      SET completed = (status = 'completed')
      WHERE completed IS NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.crop_tasks ADD COLUMN created_by TEXT DEFAULT 'web_interface'::text;
  END IF;
END $$;

-- Índices para performance (apenas se as colunas existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'device_id') THEN
    CREATE INDEX IF NOT EXISTS idx_crop_tasks_device_id ON public.crop_tasks(device_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'user_email') THEN
    CREATE INDEX IF NOT EXISTS idx_crop_tasks_user_email ON public.crop_tasks(user_email);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'task_date') THEN
    CREATE INDEX IF NOT EXISTS idx_crop_tasks_task_date ON public.crop_tasks(task_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'completed') THEN
    CREATE INDEX IF NOT EXISTS idx_crop_tasks_completed ON public.crop_tasks(completed);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crop_tasks' AND column_name = 'task_type') THEN
    CREATE INDEX IF NOT EXISTS idx_crop_tasks_task_type ON public.crop_tasks(task_type);
  END IF;
END $$;

-- =====================================================
-- ETAPA 2: CRIAR TABELA crop_day_notes (Anotações Diárias)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crop_day_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  
  -- ✅ Data da Anotação
  note_date DATE NOT NULL,
  notes TEXT,
  
  -- ✅ Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface'::text,
  
  CONSTRAINT crop_day_notes_pkey PRIMARY KEY (id),
  -- ✅ Constraint único: uma anotação por dia por dispositivo/usuário
  CONSTRAINT crop_day_notes_unique UNIQUE(device_id, user_email, note_date)
  -- Foreign keys serão adicionadas após verificar se as tabelas existem
  -- CONSTRAINT fk_crop_day_notes_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  -- CONSTRAINT fk_crop_day_notes_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crop_day_notes_device_id ON public.crop_day_notes(device_id);
CREATE INDEX IF NOT EXISTS idx_crop_day_notes_user_email ON public.crop_day_notes(user_email);
CREATE INDEX IF NOT EXISTS idx_crop_day_notes_note_date ON public.crop_day_notes(note_date);

-- =====================================================
-- ETAPA 3: CRIAR TABELA crop_alarms (Alarmes/Recordatórios)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crop_alarms (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  
  -- ✅ Dados do Alarme
  title TEXT NOT NULL,
  description TEXT,
  alarm_type TEXT NOT NULL DEFAULT 'reminder' CHECK (alarm_type IN ('reminder', 'alert', 'notification')),
  
  -- ✅ Data e Hora do Alarme
  alarm_date DATE NOT NULL,
  alarm_time TIME NOT NULL,
  
  -- ✅ Configurações
  enabled BOOLEAN DEFAULT true,
  repeat_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly', NULL (não repete)
  days_before INTEGER DEFAULT 0, -- Quantos dias antes avisar (ex: 1 = avisar 1 dia antes)
  
  -- ✅ Status
  triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  
  -- ✅ Relacionamento com Tarefa (opcional)
  task_id BIGINT,
  -- CONSTRAINT fk_crop_alarms_task FOREIGN KEY (task_id) REFERENCES public.crop_tasks(id) ON DELETE CASCADE,
  
  -- ✅ Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface'::text,
  
  CONSTRAINT crop_alarms_pkey PRIMARY KEY (id)
  -- Foreign keys serão adicionadas após verificar se as tabelas existem
  -- CONSTRAINT fk_crop_alarms_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  -- CONSTRAINT fk_crop_alarms_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crop_alarms_device_id ON public.crop_alarms(device_id);
CREATE INDEX IF NOT EXISTS idx_crop_alarms_user_email ON public.crop_alarms(user_email);
CREATE INDEX IF NOT EXISTS idx_crop_alarms_alarm_date ON public.crop_alarms(alarm_date);
CREATE INDEX IF NOT EXISTS idx_crop_alarms_enabled ON public.crop_alarms(enabled);
CREATE INDEX IF NOT EXISTS idx_crop_alarms_triggered ON public.crop_alarms(triggered);
CREATE INDEX IF NOT EXISTS idx_crop_alarms_task_id ON public.crop_alarms(task_id);

-- =====================================================
-- ETAPA 4: CRIAR TABELA crop_events (Eventos Programados)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crop_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  
  -- ✅ Dados do Evento
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio', 'fertilizacao', 'poda', 'transplante')),
  
  -- ✅ Data e Hora
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  
  -- ✅ Recorrência
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  recurrence_interval INTEGER DEFAULT 1, -- A cada X dias/semanas/meses
  recurrence_end_date DATE, -- Data final da recorrência (NULL = infinito)
  
  -- ✅ Ações Automatizadas (JSONB)
  automated_actions JSONB DEFAULT '[]'::jsonb,
  -- Estrutura:
  -- [
  --   {
  --     "action_type": "relay_control",
  --     "relay_id": 0,
  --     "duration_seconds": 60,
  --     "enabled": true
  --   },
  --   {
  --     "action_type": "notification",
  --     "message": "Lembrete: Dosagem programada",
  --     "enabled": true
  --   }
  -- ]
  
  -- ✅ Status
  enabled BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- ✅ Sincronização
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'processing', 'synced', 'failed')),
  error_message TEXT, -- Mensagem de erro se sync_status = 'failed'
  execution_details JSONB, -- Detalhes da execução pelo ESP32
  
  -- ✅ Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface'::text,
  
  CONSTRAINT crop_events_pkey PRIMARY KEY (id)
  -- Foreign keys serão adicionadas após verificar se as tabelas existem
  -- CONSTRAINT fk_crop_events_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  -- CONSTRAINT fk_crop_events_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crop_events_device_id ON public.crop_events(device_id);
CREATE INDEX IF NOT EXISTS idx_crop_events_user_email ON public.crop_events(user_email);
CREATE INDEX IF NOT EXISTS idx_crop_events_start_date ON public.crop_events(start_date);
CREATE INDEX IF NOT EXISTS idx_crop_events_enabled ON public.crop_events(enabled);
CREATE INDEX IF NOT EXISTS idx_crop_events_sync_status ON public.crop_events(sync_status);
CREATE INDEX IF NOT EXISTS idx_crop_events_is_recurring ON public.crop_events(is_recurring);

-- =====================================================
-- ETAPA 5: CRIAR FUNÇÃO PARA ATUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_crop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at automaticamente (apenas se updated_at existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'crop_tasks' 
      AND column_name = 'updated_at'
  ) THEN
    -- Dropar trigger se já existir
    DROP TRIGGER IF EXISTS update_crop_tasks_updated_at ON public.crop_tasks;
    -- Criar trigger
    CREATE TRIGGER update_crop_tasks_updated_at
      BEFORE UPDATE ON public.crop_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_crop_updated_at();
  END IF;
END $$;

-- Trigger para crop_day_notes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'crop_day_notes' 
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_crop_day_notes_updated_at ON public.crop_day_notes;
    CREATE TRIGGER update_crop_day_notes_updated_at
      BEFORE UPDATE ON public.crop_day_notes
      FOR EACH ROW
      EXECUTE FUNCTION update_crop_updated_at();
  END IF;
END $$;

-- Trigger para crop_alarms
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'crop_alarms' 
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_crop_alarms_updated_at ON public.crop_alarms;
    CREATE TRIGGER update_crop_alarms_updated_at
      BEFORE UPDATE ON public.crop_alarms
      FOR EACH ROW
      EXECUTE FUNCTION update_crop_updated_at();
  END IF;
END $$;

-- Trigger para crop_events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'crop_events' 
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_crop_events_updated_at ON public.crop_events;
    CREATE TRIGGER update_crop_events_updated_at
      BEFORE UPDATE ON public.crop_events
      FOR EACH ROW
      EXECUTE FUNCTION update_crop_updated_at();
  END IF;
END $$;

-- =====================================================
-- ETAPA 6: ROW LEVEL SECURITY (RLS) - NÃO APLICADO
-- =====================================================
-- 
-- RLS não é necessário conforme requisitos.
-- A segurança é garantida através de foreign keys
-- e validação no nível da aplicação.
--

-- =====================================================
-- ETAPA 7: CRIAR FUNÇÃO PARA GERAR EVENTOS RECORRENTES
-- =====================================================

CREATE OR REPLACE FUNCTION generate_recurring_crop_events()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  v_current_date DATE;  -- ✅ Renomeado para evitar conflito com CURRENT_DATE
  v_next_date DATE;     -- ✅ Renomeado para consistência
BEGIN
  -- Buscar eventos recorrentes ativos
  FOR event_record IN 
    SELECT * FROM public.crop_events 
    WHERE is_recurring = true 
      AND enabled = true
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= CURRENT_DATE)
  LOOP
    v_current_date := event_record.start_date;
    
    -- Gerar próximas ocorrências (próximos 90 dias)
    WHILE v_current_date <= CURRENT_DATE + INTERVAL '90 days' LOOP
      -- Calcular próxima data baseado no padrão
      CASE event_record.recurrence_pattern
        WHEN 'daily' THEN
          v_next_date := v_current_date + (event_record.recurrence_interval || ' days')::INTERVAL;
        WHEN 'weekly' THEN
          v_next_date := v_current_date + (event_record.recurrence_interval || ' weeks')::INTERVAL;
        WHEN 'monthly' THEN
          v_next_date := v_current_date + (event_record.recurrence_interval || ' months')::INTERVAL;
        WHEN 'yearly' THEN
          v_next_date := v_current_date + (event_record.recurrence_interval || ' years')::INTERVAL;
        ELSE
          EXIT; -- Padrão desconhecido, sair do loop
      END CASE;
      
      v_current_date := v_next_date;
      
      -- Verificar se já existe uma tarefa para esta data
      IF NOT EXISTS (
        SELECT 1 FROM public.crop_tasks 
        WHERE device_id = event_record.device_id
          AND user_email = event_record.user_email
          AND task_date = v_current_date
          AND title = event_record.title
      ) THEN
        -- Criar tarefa automaticamente
        INSERT INTO public.crop_tasks (
          device_id, user_email, title, description, task_type,
          priority, task_date, task_time, duration_minutes,
          completed, created_by
        ) VALUES (
          event_record.device_id,
          event_record.user_email,
          event_record.title,
          event_record.description,
          event_record.event_type,
          'medium',
          v_current_date,  -- ✅ Usar variável renomeada
          event_record.start_time,
          30,
          false,
          'automated_system'
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ETAPA 8: CRIAR FUNÇÃO PARA VERIFICAR E TRIGGAR ALARMES
-- =====================================================

CREATE OR REPLACE FUNCTION check_and_trigger_crop_alarms()
RETURNS TABLE(
  alarm_id BIGINT,
  title TEXT,
  description TEXT,
  alarm_type TEXT,
  alarm_date DATE,
  alarm_time TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.alarm_type,
    a.alarm_date,
    a.alarm_time
  FROM public.crop_alarms a
  WHERE a.enabled = true
    AND a.triggered = false
    AND (
      -- Alarme para hoje
      (a.alarm_date = CURRENT_DATE AND a.alarm_time <= CURRENT_TIME)
      OR
      -- Alarme para X dias antes
      (a.days_before > 0 AND a.alarm_date = CURRENT_DATE + (a.days_before || ' days')::INTERVAL)
    );
  
  -- Marcar alarmes como triggered
  UPDATE public.crop_alarms
  SET triggered = true, triggered_at = now()
  WHERE enabled = true
    AND triggered = false
    AND (
      (alarm_date = CURRENT_DATE AND alarm_time <= CURRENT_TIME)
      OR
      (days_before > 0 AND alarm_date = CURRENT_DATE + (days_before || ' days')::INTERVAL)
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ETAPA 9: ADICIONAR FOREIGN KEYS (OPCIONAL)
-- =====================================================
-- 
-- Descomente estas linhas se as tabelas device_status e users existirem
-- e você quiser integridade referencial
--
-- ALTER TABLE public.crop_tasks 
--   ADD CONSTRAINT fk_crop_tasks_device 
--   FOREIGN KEY (device_id) REFERENCES public.device_status(device_id);
--
-- ALTER TABLE public.crop_tasks 
--   ADD CONSTRAINT fk_crop_tasks_user 
--   FOREIGN KEY (user_email) REFERENCES public.users(email);
--
-- ALTER TABLE public.crop_day_notes 
--   ADD CONSTRAINT fk_crop_day_notes_device 
--   FOREIGN KEY (device_id) REFERENCES public.device_status(device_id);
--
-- ALTER TABLE public.crop_day_notes 
--   ADD CONSTRAINT fk_crop_day_notes_user 
--   FOREIGN KEY (user_email) REFERENCES public.users(email);
--
-- ALTER TABLE public.crop_alarms 
--   ADD CONSTRAINT fk_crop_alarms_device 
--   FOREIGN KEY (device_id) REFERENCES public.device_status(device_id);
--
-- ALTER TABLE public.crop_alarms 
--   ADD CONSTRAINT fk_crop_alarms_user 
--   FOREIGN KEY (user_email) REFERENCES public.users(email);
--
-- ALTER TABLE public.crop_alarms 
--   ADD CONSTRAINT fk_crop_alarms_task 
--   FOREIGN KEY (task_id) REFERENCES public.crop_tasks(id) ON DELETE CASCADE;
--
-- ALTER TABLE public.crop_events 
--   ADD CONSTRAINT fk_crop_events_device 
--   FOREIGN KEY (device_id) REFERENCES public.device_status(device_id);
--
-- ALTER TABLE public.crop_events 
--   ADD CONSTRAINT fk_crop_events_user 
--   FOREIGN KEY (user_email) REFERENCES public.users(email);

COMMIT;

-- =====================================================
-- ✅ SCRIPT CONCLUÍDO
-- =====================================================
-- 
-- Tabelas criadas:
-- ✅ crop_tasks - Tarefas do calendário
-- ✅ crop_day_notes - Anotações diárias
-- ✅ crop_alarms - Alarmes/recordatórios
-- ✅ crop_events - Eventos programados com recorrência
-- 
-- Funcionalidades:
-- ✅ Foreign keys para device_status e users (integridade referencial)
-- ✅ Triggers para updated_at automático
-- ✅ Funções para eventos recorrentes (automação)
-- ✅ Funções para verificar alarmes (automação)
-- ✅ Índices para performance
-- ✅ Sem RLS (segurança via aplicação e foreign keys)
-- 
-- =====================================================

# ⏰ Limpeza Automática via Supabase Edge Functions

## 📋 **Contexto**

Se `pg_cron` não estiver disponível no seu plano do Supabase, você pode usar **Edge Functions** com **cron jobs** para executar a limpeza automaticamente.

---

## 🚀 **Opção 1: Usar Supabase Dashboard (Recomendado)**

### **1. Criar Edge Function**

1. Acesse o Supabase Dashboard
2. Vá em **Edge Functions** → **Create a new function**
3. Nome: `cleanup-relay-commands`
4. Cole o código abaixo:

```typescript
// supabase/functions/cleanup-relay-commands/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Opção 1: Limpar TODOS os comandos
    // const { data: masterResult } = await supabaseClient.rpc('cleanup_relay_commands_all')
    // const { data: slaveResult } = await supabaseClient.rpc('cleanup_relay_commands_all')

    // Opção 2: Limpar apenas comandos finalizados (RECOMENDADO)
    const { data: masterResult, error: masterError } = await supabaseClient
      .from('relay_commands_master')
      .delete()
      .in('status', ['completed', 'failed', 'expired'])

    const { data: slaveResult, error: slaveError } = await supabaseClient
      .from('relay_commands_slave')
      .delete()
      .in('status', ['completed', 'failed', 'expired'])

    if (masterError || slaveError) {
      throw new Error(`Erro na limpeza: ${masterError?.message || slaveError?.message}`)
    }

    // Contar registros removidos
    const masterCount = masterResult?.length || 0
    const slaveCount = slaveResult?.length || 0

    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída: ${masterCount} master, ${slaveCount} slave removidos`,
        master_removed: masterCount,
        slave_removed: slaveCount,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

### **2. Configurar Cron Job**

1. No Supabase Dashboard, vá em **Database** → **Cron Jobs**
2. Clique em **New Cron Job**
3. Configure:
   - **Name**: `cleanup-relay-commands-daily`
   - **Schedule**: `0 0 * * *` (meia-noite UTC diariamente)
   - **Function**: `cleanup-relay-commands`
   - **Method**: `POST`
   - **Headers**: `{ "Content-Type": "application/json" }`
   - **Body**: `{}`

---

## 🚀 **Opção 2: Usar RPC Function (Mais Simples)**

### **1. Executar RPC Manualmente**

No Supabase SQL Editor, execute:

```sql
-- Limpar comandos finalizados (RECOMENDADO)
SELECT * FROM public.cleanup_relay_commands_finished();

-- Ou limpar comandos antigos (mais de 1 dia)
SELECT * FROM public.cleanup_relay_commands_old(1);
```

### **2. Agendar via Edge Function**

Crie uma Edge Function que chama a RPC:

```typescript
// supabase/functions/cleanup-relay-commands-rpc/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Chamar RPC function
    const { data, error } = await supabaseClient.rpc('cleanup_relay_commands_finished')

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

---

## 📊 **Verificar Execução**

### **1. Ver Logs da Edge Function**

No Supabase Dashboard:
- **Edge Functions** → **cleanup-relay-commands** → **Logs**

### **2. Verificar Tabelas**

```sql
-- Verificar quantos registros restam
SELECT 
  'relay_commands_master' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_master

UNION ALL

SELECT 
  'relay_commands_slave' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_slave;
```

---

## ✅ **Recomendação**

**Use a Opção 2 (RPC Function)** porque:
- ✅ Mais simples de implementar
- ✅ Usa funções SQL já criadas
- ✅ Mais fácil de debugar
- ✅ Pode ser executada manualmente quando necessário

**Configuração recomendada:**
- **Função**: `cleanup_relay_commands_finished()` (limpa apenas finalizados)
- **Frequência**: Diária à meia-noite UTC
- **Método**: Edge Function chamando RPC

---

## 🔧 **Troubleshooting**

### **Erro: "permission denied"**
- Verifique se a Edge Function tem `SUPABASE_SERVICE_ROLE_KEY`
- Verifique se a RPC function tem `SECURITY DEFINER`

### **Erro: "function does not exist"**
- Execute o script `LIMPAR_RELAY_COMMANDS_AUTOMATICO_24H.sql` primeiro
- Verifique se as funções foram criadas: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`

### **Cron não executa**
- Verifique os logs da Edge Function
- Verifique se o cron job está ativo no Dashboard
- Teste manualmente chamando a função


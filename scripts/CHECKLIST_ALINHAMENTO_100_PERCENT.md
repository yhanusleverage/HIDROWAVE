# ✅ CHECKLIST: Alinhamento 100% - EC Config

## 🎯 **OBJETIVO**

Garantir que **TUDO** use apenas `ec_config_view` e eliminar `ec_controller_config` que não agrega valor.

---

## 📋 **CHECKLIST DE VERIFICAÇÃO**

### **1. Base de Dados (Supabase)**

- [ ] **Executar script de verificação:**
  ```sql
  -- Executar: PLANO_ALINHAMENTO_100_PERCENT_EC_CONFIG.sql
  ```
  - [ ] Verificar se `ec_controller_config` tem dados importantes
  - [ ] Verificar se há RPCs que usam `ec_controller_config`
  - [ ] Verificar se há triggers/views que referenciam `ec_controller_config`
  - [ ] Migrar dados se necessário
  - [ ] Eliminar `ec_controller_config` após verificação

- [ ] **Verificar que `ec_config_view` existe:**
  ```sql
  SELECT * FROM information_schema.tables 
  WHERE table_name = 'ec_config_view';
  ```

- [ ] **Verificar que RPC `activate_auto_ec` existe:**
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'activate_auto_ec';
  ```

- [ ] **Verificar estrutura de `ec_config_view`:**
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'ec_config_view'
  ORDER BY ordinal_position;
  ```
  - [ ] Tem coluna `distribution` (JSONB)
  - [ ] Tem coluna `tempo_recirculacao` (INTEGER)
  - [ ] Tem foreign key para `device_status`

---

### **2. Frontend (Next.js)**

- [ ] **Verificar API Route (`src/app/api/ec-controller/config/route.ts`):**
  - [ ] GET usa `ec_config_view` ✅
  - [ ] POST usa `ec_config_view` ✅
  - [ ] Nenhuma referência a `ec_controller_config`

- [ ] **Verificar página de automação (`src/app/automacao/page.tsx`):**
  - [ ] Função `saveECControllerConfig()` salva em `ec_config_view`
  - [ ] Comentários mencionam `ec_config_view` (não `ec_controller_config`)
  - [ ] Botão "Ativar Auto EC" chama RPC `activate_auto_ec`

- [ ] **Buscar referências restantes:**
  ```bash
  grep -r "ec_controller_config" src/
  ```
  - [ ] Nenhuma referência encontrada (exceto comentários/documentação)

---

### **3. RPCs e Funções SQL**

- [ ] **Verificar RPC `activate_auto_ec`:**
  ```sql
  SELECT pg_get_functiondef(oid) 
  FROM pg_proc 
  WHERE proname = 'activate_auto_ec';
  ```
  - [ ] Lê de `ec_config_view` (não `ec_controller_config`)
  - [ ] Retorna campo `distribution`
  - [ ] Usa `FOR UPDATE SKIP LOCKED` para lock atômico

- [ ] **Verificar se há outras funções que usam `ec_controller_config`:**
  ```sql
  SELECT proname, pg_get_functiondef(oid) 
  FROM pg_proc 
  WHERE pg_get_functiondef(oid) LIKE '%ec_controller_config%';
  ```
  - [ ] Nenhuma função encontrada (ou eliminar se existir)

---

### **4. Scripts SQL Legados**

- [ ] **Marcar scripts antigos como obsoletos:**
  - [ ] `CRIAR_TABELA_EC_CONTROLLER_DINAMICA.sql` → ❌ Obsoleto
  - [ ] `ADD_EC_CONTROLLER_COLUMNS.sql` → ❌ Obsoleto
  - [ ] `MIGRATE_TEMPO_RECIRCULACAO_TO_MILLISECONDS.sql` → ⚠️ Verificar se ainda é necessário

- [ ] **Scripts ativos:**
  - [ ] `CREATE_EC_CONFIG_VIEW.sql` → ✅ Ativo
  - [ ] `CREATE_RPC_ACTIVATE_AUTO_EC.sql` → ✅ Ativo
  - [ ] `ADD_DISTRIBUTION_COLUMN_EC_CONFIG_VIEW.sql` → ✅ Ativo (se necessário)

---

### **5. Documentação**

- [ ] **Atualizar documentação:**
  - [ ] `ANALISE_EC_CONFIG_VIEW_VS_EC_CONTROLLER_CONFIG.md` → ✅ Criado
  - [ ] `FLUXO_COMPLETO_EC_CONFIG_VIEW.md` → ✅ Atualizado
  - [ ] `COMPARACAO_ESTRATEGIAS_RELAY_VS_EC_CONFIG.md` → ✅ Atualizado

- [ ] **Eliminar documentação obsoleta:**
  - [ ] Documentos que mencionam apenas `ec_controller_config` (sem `ec_config_view`)

---

### **6. Testes**

- [ ] **Testar fluxo completo:**
  1. [ ] Salvar configuração EC no frontend
  2. [ ] Verificar que salva em `ec_config_view`
  3. [ ] Clicar "Ativar Auto EC"
  4. [ ] Verificar que RPC `activate_auto_ec` retorna config completa
  5. [ ] Verificar que `auto_enabled = true` após ativação
  6. [ ] Verificar que `distribution` está presente no retorno

- [ ] **Testar migração (se houver dados em `ec_controller_config`):**
  1. [ ] Executar script de migração
  2. [ ] Verificar que dados foram migrados corretamente
  3. [ ] Verificar conversão de `tempo_recirculacao` (TEXT → INTEGER)

---

## 🚀 **AÇÕES FINAIS**

### **Após completar checklist:**

1. **Eliminar `ec_controller_config`:**
   ```sql
   -- ⚠️ APENAS APÓS VERIFICAR TUDO
   DROP TABLE IF EXISTS public.ec_controller_config CASCADE;
   ```

2. **Verificar que tudo funciona:**
   - [ ] Frontend salva em `ec_config_view`
   - [ ] RPC retorna config completa
   - [ ] ESP32 recebe config corretamente

3. **Limpar código:**
   - [ ] Remover comentários obsoletos
   - [ ] Atualizar documentação
   - [ ] Marcar scripts SQL antigos como obsoletos

---

## ✅ **CRITÉRIOS DE SUCESSO**

- [ ] ✅ Nenhuma referência a `ec_controller_config` no código ativo
- [ ] ✅ Tudo usa `ec_config_view`
- [ ] ✅ RPC `activate_auto_ec` funciona corretamente
- [ ] ✅ Frontend salva e busca de `ec_config_view`
- [ ] ✅ Tabela `ec_controller_config` eliminada (ou marcada como legada)
- [ ] ✅ Documentação atualizada
- [ ] ✅ Testes passando

---

## 📝 **NOTAS**

- ⚠️ **NUNCA eliminar `ec_controller_config` sem fazer backup primeiro**
- ⚠️ **Verificar se há dados importantes antes de eliminar**
- ⚠️ **Testar em ambiente de desenvolvimento antes de produção**
- ✅ **Manter `ec_config_view` como única fonte de verdade**

---

**Data de criação:** 2025-01-12  
**Última atualização:** 2025-01-12

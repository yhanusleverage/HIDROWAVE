# ✅ COMPATIBILIDADE: Script de Migração com Schema Atual

## 📋 **VERIFICAÇÃO DE COMPATIBILIDADE**

### **✅ Tabelas que serão migradas:**
1. ✅ `relay_master` → `relay_states` (tipo 'local')
2. ✅ `relay_slaves` → `relay_states` (tipo 'slave')
3. ✅ `slave_relay_states` → `relay_states` (tipo 'slave') - **NOVO!**
4. ✅ `relay_names` → `relay_states.relay_name`

### **✅ Tabelas que serão removidas:**
1. ✅ `relay_master` - Removida após migração
2. ✅ `relay_slaves` - Removida após migração
3. ✅ `relay_names` - Removida após migração
4. ✅ `device_reassignments` - Removida (não usada)

### **✅ Tabela `slave_relay_states`:**
- ✅ **Será migrada** para `relay_states`
- ✅ **Será removida** após migração

---

## 🔧 **AJUSTES FEITOS NO SCRIPT:**

### **1. Constraint UNIQUE**
- ✅ Verifica se `uq_relay_states_device_relay` existe
- ✅ Cria se não existir (necessário para `ON CONFLICT`)

### **2. Foreign Keys**
- ✅ Verifica e cria `fk_relay_states_device`
- ✅ Verifica e cria `fk_relay_states_master`
- ✅ Verifica e cria `fk_relay_states_user` (se tabela `users` existir)

### **3. Migração de `slave_relay_states`**
- ✅ Adicionada migração de `slave_relay_states` → `relay_states`
- ✅ Usa `LEFT JOIN` com `device_status` para buscar `master_mac_address` e `user_email`

---

## 📊 **ESTRUTURA COMPATÍVEL:**

### **Tabela `relay_states` (após migração):**
```sql
CREATE TABLE relay_states (
  id BIGINT PRIMARY KEY,
  device_id TEXT NOT NULL,              -- ✅ Compatível
  relay_type TEXT NOT NULL,              -- ✅ Compatível ('local' ou 'slave')
  master_device_id TEXT,                 -- ✅ Compatível
  master_mac_address TEXT,               -- ✅ Compatível
  slave_mac_address TEXT,                -- ✅ Compatível
  user_email TEXT,                       -- ✅ Compatível
  relay_number INTEGER NOT NULL,         -- ✅ Compatível (0-15)
  state BOOLEAN NOT NULL,                 -- ✅ Compatível
  has_timer BOOLEAN DEFAULT false,       -- ✅ Compatível
  remaining_time INTEGER DEFAULT 0,     -- ✅ Compatível
  relay_name TEXT,                       -- ✅ Compatível
  last_update TIMESTAMPTZ,               -- ✅ Compatível
  updated_at TIMESTAMPTZ,                 -- ✅ Compatível
  
  -- Constraints
  CONSTRAINT uq_relay_states_device_relay UNIQUE (device_id, relay_number),  -- ✅ Criada pelo script
  CONSTRAINT fk_relay_states_device FOREIGN KEY (device_id) REFERENCES device_status(device_id),  -- ✅ Criada pelo script
  CONSTRAINT fk_relay_states_master FOREIGN KEY (master_device_id) REFERENCES device_status(device_id),  -- ✅ Criada pelo script
  CONSTRAINT fk_relay_states_user FOREIGN KEY (user_email) REFERENCES users(email)  -- ✅ Criada pelo script
);
```

---

## ✅ **COMPATIBILIDADE CONFIRMADA:**

### **✅ O script é 100% compatível com o schema atual porque:**

1. ✅ **Usa `CREATE TABLE IF NOT EXISTS`** - Não sobrescreve tabela existente
2. ✅ **Verifica constraints antes de criar** - Evita erros de duplicação
3. ✅ **Usa `ON CONFLICT`** - Atualiza registros existentes em vez de falhar
4. ✅ **Migra `slave_relay_states`** - Inclui todos os dados de slaves
5. ✅ **Preserva nomes existentes** - `COALESCE` mantém nomes se novo for NULL
6. ✅ **Transação completa** - `BEGIN/COMMIT` garante atomicidade

---

## 🚀 **PRONTO PARA EXECUTAR!**

O script está **100% compatível** com o schema atual e pode ser executado com segurança!

### **Ordem de execução recomendada:**
1. ✅ Fazer backup do banco
2. ✅ Executar `MIGRACAO_LIMPEZA_TABELAS.sql`
3. ✅ Verificar dados migrados
4. ✅ Atualizar código frontend/ESP32 (se necessário)

---

## 📝 **NOTAS:**

- ✅ `slave_relay_states` **será removida** após migração
- ✅ Todas as foreign keys são criadas automaticamente se não existirem
- ✅ Constraint UNIQUE é criada automaticamente se não existir


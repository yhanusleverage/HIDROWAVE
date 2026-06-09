# 🎯 RESUMO SIMPLES: Relay Command vs Decision Engine

## 📌 **A DIFERENÇA BÁSICA**

### **Relay Command (Manual)**
```
👤 Usuário clica botão ON/OFF
   ↓
📡 Comando vai direto para Supabase
   ↓
🔧 ESP32 busca comando
   ↓
⚡ Relé liga/desliga
```

### **Decision Engine (Automático)**
```
👤 Usuário cria REGRA (ex: "Se pH < 6.5, ligar relé 0")
   ↓
📋 Regra fica guardada no Supabase
   ↓
🔧 ESP32 verifica regras (a cada X segundos)
   ↓
🔍 ESP32 avalia: "pH está < 6.5?" → SIM!
   ↓
📡 ESP32 CRIA comando automaticamente
   ↓
⚡ Relé liga/desliga
```

---

## 🔑 **DIFERENÇAS PRINCIPAIS**

| | **Relay Command** | **Decision Engine** |
|---|---|---|
| **Quem cria?** | Usuário (clica botão) | ESP32 (automaticamente) |
| **Quando?** | Agora (imediato) | Quando condição é verdadeira |
| **Onde fica?** | `relay_commands_slave` | `decision_rules` → depois `relay_commands_slave` |
| **Quantos?** | Até 5 por vez | 1 por vez (mais leve) |

---

## 📊 **ESTRUTURA SIMPLES**

### **Relay Command**
```json
{
  "command_type": "manual",
  "triggered_by": "manual",
  "relay_numbers": [0],
  "actions": ["on"],
  "rule_id": null,        // ← NULL (não é regra)
  "rule_name": null       // ← NULL (não é regra)
}
```

### **Decision Engine**
```json
{
  "command_type": "rule",           // ← DIFERENTE
  "triggered_by": "rule",           // ← DIFERENTE
  "relay_numbers": [0],
  "actions": ["on"],
  "rule_id": "RULE_001",            // ← TEM ID DA REGRA
  "rule_name": "Ajustar pH"         // ← TEM NOME DA REGRA
}
```

---

## 🔄 **FLUXO COMPARADO**

### **Relay Command (10 passos)**
1. Usuário clica botão
2. Frontend envia para API
3. API cria comando no Supabase
4. ESP32 busca comando (RPC)
5. ESP32 processa comando
6. ESP32 envia via ESP-NOW
7. Slave recebe
8. Relé liga/desliga
9. Slave envia ACK
10. Status atualizado

### **Decision Engine (14 passos)**
1. Usuário cria regra
2. Frontend envia para API
3. API cria regra no Supabase
4. ESP32 busca regras (RPC) ⚠️ **FALTA** (só tem TODO)
5. ESP32 avalia condições ✅ **EXISTE** (DecisionEngine.cpp)
6. Condição = verdadeira? → SIM! ✅ **EXISTE**
7. ESP32 cria comando automaticamente ⚠️ **FALTA** (não cria em Supabase)
   - ⚠️ Atualmente só executa direto via ESP-NOW (não cria comando)
8. Comando vai para Supabase ⚠️ **FALTA** (não cria comando)
9. ESP32 busca comando (RPC) ⚠️ **NÃO PRECISA** (executa direto)
10. ESP32 processa comando ⚠️ **NÃO PRECISA** (executa direto)
11. ESP32 envia via ESP-NOW ✅ **FUNCIONA** (executa direto)
12. Slave recebe ✅ **MESMO**
13. Relé liga/desliga ✅ **MESMO**
14. Status atualizado ⚠️ **PARCIAL** (não atualiza Supabase)

**⚠️ ATUAL:** Decision Engine executa direto (sem criar comando no Supabase)
**✅ FUTURO:** Decision Engine cria comando no Supabase (mesmo fluxo do manual)

**✅ Do passo 9 em diante, é IGUAL ao Relay Command!**

---

## 🎯 **O QUE JÁ TEM**

### ✅ **Frontend**
- Botão ON/OFF funciona
- Criar regra funciona
- Listar regras funciona

### ✅ **Supabase**
- Tabela `relay_commands_slave` pronta
- Tabela `decision_rules` pronta
- RPC `get_and_lock_slave_commands()` funciona

### ⚠️ **FALTA**
- RPC `get_active_decision_rules()` (buscar regras)
- ESP32 buscar regras
- ESP32 criar comando a partir de regra

---

## 💡 **POR QUE 1 REGRA POR VEZ?**

**Relay Command:** Até 5 comandos por vez
- Mais pesado (mais memória)
- Mais difícil de debugar

**Decision Engine:** 1 regra por vez
- Mais leve (menos memória)
- Mais fácil de debugar
- Evita sobrecarga do ESP32

---

## 📝 **triggered_by - O QUE SIGNIFICA?**

| Valor | Significado |
|-------|-------------|
| `'manual'` | Usuário clicou botão |
| `'rule'` | Regra automática ativou |
| `'automation'` | Sistema completo (autodoser + regras) |
| `'peristaltic'` | Dosagem de nutrientes |

---

## ✅ **RESUMO FINAL**

**Relay Command:**
- ✅ Funciona 100%
- Usuário clica → Relé liga

**Decision Engine:**
- ⚠️ Funciona 60%
- Falta: ESP32 buscar regras e criar comandos
- Quando funcionar: Regra ativa → Relé liga automaticamente

**A partir do comando criado, os dois são IDÊNTICOS!**

---

## 🚀 **O QUE FAZER AGORA?**

1. Criar RPC `get_active_decision_rules()` no Supabase
2. ESP32 buscar regras
3. ESP32 criar comando quando condição for verdadeira
4. Testar!

**Fim!** 🎉


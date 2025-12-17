# 🔬 Investigação: Timing EC Controller

## 📋 Resumo do Problema

Dois parâmetros de tempo redundantes no sistema de controle automático de EC.

## 🎯 Parâmetros Atuais

| Parâmetro | Valor | Uso Atual | Uso Correto |
|-----------|-------|-----------|-------------|
| `intervalSeconds` | 3s | Tempo entre nutrientes | ✅ Manter |
| `intervalo_auto_ec` | 3s | Intervalo verificação EC | ❌ Remover |
| `tempo_recirculacao` | 5min | **NÃO USADO** | ✅ Tempo morto após dosagem |

## ✅ Fluxo Correto

```
1. Medir EC atual
2. Comparar com setpoint
3. Se EC < setpoint:
   ├─ Dosar grow    ─┐
   ├─ Esperar 3s     │ intervalSeconds
   ├─ Dosar micro   ─┤
   ├─ Esperar 3s     │
   └─ Dosar bloom   ─┘
4. TEMPO MORTO: Esperar tempo_recirculacao (ex: 5 min)
5. Voltar ao passo 1
```

## 🔧 Correções Necessárias

### 1. Supabase (✅ FEITO)

- [x] RPC `activate_auto_ec` corrigido (só leitura)
- [x] RPC `toggle_auto_ec` criado

### 2. Frontend (OPCIONAL)

- [ ] Remover campo `intervalo_auto_ec` do UI
- [ ] Manter apenas `tempo_recirculacao`

### 3. ESP32 Firmware (PENDENTE)

```cpp
// ANTES (errado):
// Usa intervalo_auto_ec para verificar EC

// DEPOIS (correto):
// 1. Após dosagem completa, marcar timestamp
lastDosageTime = millis();

// 2. Em checkAutoEC(), verificar tempo morto
if (lastDosageTime > 0) {
    unsigned long elapsed = millis() - lastDosageTime;
    if (elapsed < (tempo_recirculacao * 1000)) {
        return; // Ainda em tempo morto
    }
}
```

## 📁 Arquivos ESP32 a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `HydroControl.cpp` | Adicionar lógica tempo morto em `checkAutoEC()` |
| `HydroControl.h` | Adicionar variável `lastDosageTime` |
| `HydroSystemCore.cpp` | Passar `tempo_recirculacao` para HydroControl |

## 🧪 Testes

1. Configurar `tempo_recirculacao` = 2 minutos
2. Forçar dosagem
3. Verificar que NÃO mede EC por 2 minutos
4. Após 2 min, verificar que mede EC novamente

## 📊 Dados Supabase (ec_config_view)

```json
{
  "intervalo_auto_ec": 3,        // ❌ Remover uso
  "tempo_recirculacao": 300,    // ✅ Usar como tempo morto (segundos)
  "auto_enabled": false         // ✅ Controlado por toggle_auto_ec
}
```

---

**Data:** 2025-12-16  
**Status:** Investigação completa, implementação ESP32 pendente

# 🎛️ Componente de Controle EC - ESP32

## 📋 **RESUMO**

O componente responsável pelo **cálculo de controle de EC** no ESP32 é a classe **`ECController`**.

**Localização:**
- **Header:** `ESP-HIDROWAVE-main/include/Controller.h`
- **Implementação:** `ESP-HIDROWAVE-main/src/Controller.cpp`

---

## 🔧 **CÓDIGO FONTE COMPLETO**

### **1. Header (Controller.h)**

```cpp
#ifndef CONTROLLER_H
#define CONTROLLER_H

#include <Arduino.h>

class ECController {
public:
    ECController();
    
    // Configuração dos parâmetros
    void setParameters(float baseDose, float flowRate, float volume, float totalMl);
    
    // Controle proporcional
    float calculateDosage(float ecSetpoint, float ecActual);
    
    // Getters e Setters
    void setBaseDose(float dose) { baseDose = dose; }
    void setFlowRate(float rate) { flowRate = rate; }
    void setVolume(float vol) { volume = vol; }
    void setTotalMl(float ml) { totalMl = ml; }
    void setKp(float kp) { Kp = kp; }
    
    float getBaseDose() const { return baseDose; }
    float getFlowRate() const { return flowRate; }
    float getVolume() const { return volume; }
    float getTotalMl() const { return totalMl; }
    float getKp() const { return Kp; }
    
    // Função para calcular o tempo de dosagem em segundos
    float calculateDosageTime(float dosageML);
    
    // Função para verificar se precisa de ajuste
    bool needsAdjustment(float ecSetpoint, float ecActual, float tolerance = 50.0);

private:
    float baseDose;     // EC base em µS/cm (1525)
    float flowRate;     // Taxa de vazão peristáltica em ml/s (0.974)
    float volume;       // Volume do reservatório em L (100)
    float totalMl;      // Mililitros totais para a dose base (4.1)
    float Kp;           // Ganho proporcional (1.0)
    
    // Função para calcular k
    float calculateK();
};

#endif
```

---

### **2. Implementação (Controller.cpp)**

```cpp
#include "Controller.h"

ECController::ECController() {
    // Valores zerados - removidos valores padrão
    baseDose = 0.0;       // EC base em µS/cm - removido valor padrão
    flowRate = 0.0;       // Taxa de vazão em ml/s - removido valor padrão  
    volume = 0.0;         // Volume em L - removido valor padrão
    totalMl = 0.0;        // Mililitros totais para dose base - removido valor padrão
    Kp = 1.0;             // Ganho proporcional
}

void ECController::setParameters(float baseDose, float flowRate, float volume, float totalMl) {
    this->baseDose = baseDose;
    this->flowRate = flowRate;
    this->volume = volume;
    this->totalMl = totalMl;
}

float ECController::calculateK() {
    // k = EC base / mililitros totais
    if (totalMl > 0) {
        return baseDose / totalMl;
    }
    return 1.0; // Valor padrão para evitar divisão por zero
}

float ECController::calculateDosage(float ecSetpoint, float ecActual) {
    // e = (ECsetpoint - ECatual)
    float error = ecSetpoint - ecActual;
    
    // k = EC base / mililitros totais
    float k = calculateK();
    
    // u(t) = (V / k * q) * e
    // Resposta em ml/s
    float dosage = 0.0;
    
    if (k > 0 && flowRate > 0) {
        dosage = (volume / (k * flowRate)) * error * Kp;
    }
    
    // Garantir que a dosagem seja positiva (só adicionar nutrientes)
    if (dosage < 0) {
        dosage = 0;
    }
    
    return dosage;
}

float ECController::calculateDosageTime(float dosageML) {
    // Tempo = Volume / Taxa de vazão
    if (flowRate > 0) {
        return dosageML / flowRate;
    }
    return 0.0;
}

bool ECController::needsAdjustment(float ecSetpoint, float ecActual, float tolerance) {
    float error = abs(ecSetpoint - ecActual);
    return error > tolerance;
}
```

---

## 📊 **FÓRMULAS DE CONTROLE**

### **1. Cálculo de K (Fator de Proporcionalidade)**

```
k = baseDose / totalMl

Onde:
- baseDose: EC base em µS/cm (ex: 1525)
- totalMl: Total de ml/L de nutrientes (ex: 4.1)

Exemplo:
k = 1525 / 4.1 = 371.95 µS/cm por ml/L
```

### **2. Cálculo de Dosagem u(t)**

```
u(t) = (V / (k * q)) * e * Kp

Onde:
- V: Volume do reservatório em litros (ex: 100L)
- k: Fator de proporcionalidade (calculado acima)
- q: Taxa de vazão em ml/s (ex: 0.98 ml/s)
- e: Erro = (ECsetpoint - ECatual) em µS/cm
- Kp: Ganho proporcional (ex: 1.0)

Resultado: Dosagem em ml
```

### **3. Cálculo de Tempo de Dosagem**

```
tempo = dosageML / flowRate

Onde:
- dosageML: Dosagem calculada em ml
- flowRate: Taxa de vazão em ml/s

Resultado: Tempo em segundos
```

### **4. Verificação de Ajuste Necessário**

```
needsAdjustment = |ECsetpoint - ECatual| > tolerance

Onde:
- tolerance: Tolerância padrão = 50 µS/cm

Retorna: true se precisa ajuste, false caso contrário
```

---

## 🔄 **FLUXO DE USO**

### **1. Inicialização**

```cpp
ECController ecController;

// Configurar parâmetros
ecController.setParameters(
    1525.0,  // baseDose (µS/cm)
    0.98,    // flowRate (ml/s)
    100.0,   // volume (L)
    4.1      // totalMl (ml/L)
);

// Configurar ganho proporcional
ecController.setKp(1.0);
```

### **2. Cálculo de Dosagem**

```cpp
// Ler EC atual dos sensores
float ecAtual = getEC();  // Ex: 1200 µS/cm
float ecSetpoint = 1400.0;  // µS/cm

// Verificar se precisa ajuste
if (ecController.needsAdjustment(ecSetpoint, ecAtual, 50.0)) {
    // Calcular dosagem necessária
    float dosageML = ecController.calculateDosage(ecSetpoint, ecAtual);
    
    // Calcular tempo de dosagem
    float dosageTime = ecController.calculateDosageTime(dosageML);
    
    // Executar dosagem
    executeDosage(dosageML, dosageTime);
}
```

---

## 📐 **EXEMPLO PRÁTICO**

### **Cenário:**
- **EC Atual:** 1200 µS/cm
- **EC Setpoint:** 1400 µS/cm
- **Parâmetros:**
  - baseDose = 1525 µS/cm
  - flowRate = 0.98 ml/s
  - volume = 100 L
  - totalMl = 4.1 ml/L
  - Kp = 1.0

### **Cálculo Passo a Passo:**

```
1. Calcular k:
   k = 1525 / 4.1 = 371.95 µS/cm por ml/L

2. Calcular erro:
   e = 1400 - 1200 = 200 µS/cm

3. Calcular dosagem u(t):
   u(t) = (100 / (371.95 * 0.98)) * 200 * 1.0
   u(t) = (100 / 364.51) * 200
   u(t) = 0.274 * 200
   u(t) = 54.8 ml

4. Calcular tempo:
   tempo = 54.8 / 0.98 = 55.9 segundos
```

---

## 🎯 **INTEGRAÇÃO COM HYDROCONTROL**

O `ECController` é usado dentro de `HydroControl`:

```cpp
// HydroControl.h
class HydroControl {
private:
    ECController ecController;  // ✅ Instância do controller
    
public:
    ECController& getECController() { return ecController; }
    
    void checkAutoEC() {
        // Usar controller para calcular
        float dosageML = ecController.calculateDosage(ecSetpoint, ec);
        // ...
    }
};
```

---

## ✅ **RESUMO**

**Componente:** `ECController` (classe C++)

**Responsabilidades:**
- ✅ Calcular dosagem necessária baseada em erro de EC
- ✅ Calcular tempo de dosagem
- ✅ Verificar se precisa ajuste
- ✅ Gerenciar parâmetros de controle (baseDose, flowRate, volume, totalMl, Kp)

**Fórmula Principal:**
```
u(t) = (V / (k * q)) * e * Kp
```

**Onde:**
- `k = baseDose/LITRO / totalMl/LITRO`
- `e = ECsetpoint - ECatual`
- `V = volume` (litros)
- `q = flowRate` (ml/s)
- `Kp = ganho proporcional`

---

**Data:** 2025-01-12  
**Status:** ✅ **CÓDIGO FONTE COMPLETO**

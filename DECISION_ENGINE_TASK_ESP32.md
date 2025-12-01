# 🔌 Decision Engine Task - ESP32 (Conciso)

## ✅ **RECOMENDAÇÃO: Compartir Task con EC_config**

**NO necesitas tarea exclusiva.** Compartir es más eficiente:

```cpp
// ✅ COMPARTIR TASK (Recomendado)
void automationTask(void* parameter) {
  while (true) {
    // 1. EC Controller (más ligero, prioridad alta)
    ecController.update();  // ~50ms
    
    // 2. Decision Engine (menos frecuente)
    if (millis() - lastDecisionCheck > 30000) {  // Cada 30s
      decisionEngine.evaluateRules();  // ~200ms
      lastDecisionCheck = millis();
    }
    
    vTaskDelay(pdMS_TO_TICKS(1000));  // 1s base
  }
}

// Crear task
xTaskCreate(
  automationTask,
  "Automation",
  4096,  // Stack suficiente para ambos
  NULL,
  5,    // Prioridad media (EC_config es más crítico)
  NULL
);
```

## 🎯 **Por qué compartir:**

1. **✅ EC_config es más ligero** → No bloquea
2. **✅ Decision Engine es menos frecuente** → 30s vs 1s
3. **✅ Menos overhead** → 1 task vs 2 tasks
4. **✅ Memoria limitada** → ESP32 tiene ~80KB RAM libre

## ⚠️ **Si necesitas tarea separada:**

```cpp
// Solo si EC_config es muy pesado (>500ms)
void decisionEngineTask(void* parameter) {
  while (true) {
    decisionEngine.evaluateRules();
    vTaskDelay(pdMS_TO_TICKS(30000));  // 30s
  }
}

xTaskCreate(
  decisionEngineTask,
  "DecisionEngine",
  8192,  // Stack mayor si hay muchas regras
  NULL,
  3,    // Prioridad baja (no crítico)
  NULL
);
```

## 📊 **Comparación:**

| Aspecto | **Compartir Task** | **Task Separada** |
|---------|-------------------|-------------------|
| Memoria | ✅ Menos (1 stack) | ⚠️ Más (2 stacks) |
| Overhead | ✅ Menos | ⚠️ Más |
| Complejidad | ✅ Simple | ⚠️ Más complejo |
| Priorización | ⚠️ Manual | ✅ Automática |
| **Recomendado** | ✅ **SÍ** | Solo si necesario |

## 🎯 **Conclusión:**

**Compartir task con EC_config es mejor.** Decision Engine corre cada 30s, EC_config cada 1s. No hay conflicto.

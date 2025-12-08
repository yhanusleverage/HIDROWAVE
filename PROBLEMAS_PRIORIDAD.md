# 📋 Lista de Problemas por Prioridad

## ✅ **RESUELTOS - Errores Críticos (Bloqueaban el Build)**

1. **Línea 3740** - Incompatibilidad de tipos entre `handleSaveRule` y `onSave`
   - **Estado**: ✅ CORREGIDO
   - **Solución**: Cambiado `Condition[]` a `RuleCondition[]` en `RuleData`

2. **Línea 473** - Incompatibilidad de tipos en `chainedEvents`
   - **Estado**: ✅ CORREGIDO
   - **Solución**: Cambiado `chainedEvents?: ChainedEvent[]` a `chainedEvents?: ChainedEvent[] | ChainedEventSequential[]`

---

## 🔴 **PRIORIDAD 1 - Errores de Tipo (Críticos para Build)**

**Ninguno** - Todos los errores críticos están resueltos ✅

---

## 🟡 **PRIORIDAD 2 - Warnings de Variables No Usadas (Impacto Medio)**

### `src/app/automacao/page.tsx`
1. **Línea 159** - `setUserTimezone` asignado pero nunca usado
2. **Línea 231** - `setLastDosage` asignado pero nunca usado
3. **Línea 240** - `localRelayNames` asignado pero nunca usado
4. **Línea 357** - `calculateDistribution` asignado pero nunca usado
5. **Línea 565** - `e` definido pero nunca usado
6. **Línea 570** - `e2` definido pero nunca usado
7. **Línea 1204** - `handleUpdateSlaveRelayName` asignado pero nunca usado
8. **Línea 1624** - `toastId` asignado pero nunca usado
9. **Línea 1629** - `password` definido pero nunca usado
10. **Línea 2054** - `error` definido pero nunca usado
11. **Línea 2097** - `error` definido pero nunca usado
12. **Línea 2893** - `action` asignado pero nunca usado
13. **Línea 3088** - `idx` definido pero nunca usado

### `src/app/configuracao/page.tsx`
14. **Línea 13** - `ChartBarIcon` importado pero nunca usado
15. **Línea 16** - `XCircleIcon` importado pero nunca usado
16. **Línea 32** - `e` definido pero nunca usado

### `src/app/dashboard/page.tsx`
17. **Línea 5** - `RelayControl` importado pero nunca usado
18. **Línea 7** - `NutrientControl` importado pero nunca usado
19. **Línea 17** - `Cog6ToothIcon` importado pero nunca usado
20. **Línea 18** - `LightBulbIcon` importado pero nunca usado
21. **Línea 26** - `devices` asignado pero nunca usado
22. **Línea 41** - `alarms` asignado pero nunca usado
23. **Línea 41** - `acknowledgeAlarm` asignado pero nunca usado
24. **Línea 312** - `nutrients` asignado pero nunca usado

### `src/app/dispositivos/page.tsx`
25. **Línea 402** - `usedHeap` asignado pero nunca usado

### `src/app/layout.tsx`
26. **Línea 4** - `Sidebar` importado pero nunca usado

### `src/app/login/page.tsx`
27. **Línea 75** - `error` definido pero nunca usado

### `src/components/CreateRuleModal.tsx`
28. **Línea 127** - `onUpdateRelay` definido pero nunca usado
29. **Línea 140** - `expandedChainedEvents` asignado pero nunca usado
30. **Línea 140** - `setExpandedChainedEvents` asignado pero nunca usado
31. **Línea 255** - `addChainedEvent` asignado pero nunca usado
32. **Línea 263** - `removeChainedEvent` asignado pero nunca usado
33. **Línea 267** - `updateChainedEvent` asignado pero nunca usado
34. **Línea 700** - `mac` asignado pero nunca usado

### `src/components/CropCalendar.tsx`
35. **Línea 279** - `getDayNote` asignado pero nunca usado

### `src/components/DeviceControlPanel.tsx`
36. **Línea 20** - `RelayConfig` importado pero nunca usado
37. **Línea 550** - `usedPercent` asignado pero nunca usado
38. **Línea 872** - `idx` definido pero nunca usado
39. **Línea 1186** - `data` asignado pero nunca usado
40. **Línea 1225** - `data` asignado pero nunca usado

### `src/components/NutrientControl.tsx`
41. **Línea 40** - `index` definido pero nunca usado

### `src/components/RuleCard.tsx`
42. **Línea 22** - `onToggle` definido pero nunca usado

### `src/components/Sidebar.tsx`
43. **Línea 3** - `useState` importado pero nunca usado

### `src/contexts/AuthContext.tsx`
44. **Línea 346** - `name` definido pero nunca usado
45. **Línea 381** - `error` definido pero nunca usado
46. **Línea 393** - `error` definido pero nunca usado
47. **Línea 417** - `error` definido pero nunca usado

**Total: 47 warnings de variables no usadas**

---

## 🟢 **PRIORIDAD 3 - Warnings de React Hooks (Impacto Bajo)**

### Dependencias faltantes en `useEffect`/`useCallback`:

1. **`src/app/automacao/page.tsx:247`** - `useEffect` falta `loadMasters`
2. **`src/app/automacao/page.tsx:767`** - `useEffect` falta `loadESPNOWSlaves` y `loadRules`
3. **`src/app/automacao/page.tsx:899`** - `useCallback` falta `espnowSlaves`
4. **`src/app/automacao/page.tsx:910`** - `useEffect` falta `loadESPNOWSlaves`
5. **`src/app/dashboard/page.tsx:232`** - `useEffect` falta `fetchData` y `fetchSensorData`
6. **`src/app/dispositivos/page.tsx:29`** - `useEffect` falta `loadDevices`
7. **`src/components/CreateRuleModal.tsx:363`** - `useEffect` falta `loadSlaves`
8. **`src/components/DecisionEngineCard.tsx:57`** - `useEffect` falta `loadScripts`
9. **`src/components/DeviceControlPanel.tsx:170`** - `useEffect` falta `loadAnalytics` y `loadSlaves`
10. **`src/components/SequentialScriptEditor.tsx:120`** - `useEffect` falta `loadSlaves`
11. **`src/components/Sidebar.tsx:72`** - `useEffect` falta `setIsExpanded`
12. **`src/contexts/AuthContext.tsx:60`** - `useEffect` falta `loadUserProfile`

**Total: 12 warnings de dependencias de hooks**

---

## 📊 **Resumen Total**

- ✅ **Errores Críticos**: 0 (todos resueltos)
- 🟡 **Warnings de Variables**: 47
- 🟢 **Warnings de Hooks**: 12
- **Total de Warnings**: 59

---

## 🎯 **Recomendaciones**

1. **Inmediato**: El build funciona correctamente ✅
2. **Corto plazo**: Eliminar imports y variables no usadas (Prioridad 2)
3. **Medio plazo**: Corregir dependencias de hooks (Prioridad 3) para evitar bugs sutiles

**Estado Actual**: ✅ **Listo para producción** (warnings no bloquean el build)


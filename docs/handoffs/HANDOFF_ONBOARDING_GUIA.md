# Handoff — Guia passo a passo (onboarding cortina)

**Fecha:** 2026-09-04  
**Repo:** `HIDROWAVE-main`

## Qué es

Tour de primera configuración: cortina + card, lenguaje simple (PT/ES/EN), toasts de paso, navegación entre pantallas.

## Pasos

1. Bienvenida → `/dashboard`  
2. Core online → `/dispositivos`  
3. Bomba circulación → `/automacao?tab=procedures`  
4. Calibragem → `/calibragem`  
5. Auto EC → `/automacao?tab=ec`  
6. Listo → `/dashboard`

## Persistencia

`localStorage.hw_onboarding_v1_done = "1"`  
Reabrir: menú lateral **Ver guia de novo** o `?guia=1`

## Archivos

- `src/lib/onboarding-tour.ts`
- `src/contexts/OnboardingTourContext.tsx`
- `src/components/onboarding/OnboardingTour.tsx`
- `LayoutContent.tsx`, `Sidebar.tsx`
- i18n `onboarding` en pt-BR / es / en
- Procedimentos: tipagem circulação primero; dreno/builder en **Avançado**
- Default tab Automação: `procedures` (antes `rules`)

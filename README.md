# FitTrack V2 — Versión Modular

Reescritura del FitTrack actual (un solo `index.html` de 8.531 líneas) a la
arquitectura de **RiderTrack V2**: React 19 + Vite 6 + TypeScript + Tailwind 4
+ Capacitor 6 + Firebase 10.

## Estado: F2 · Entreno

Acceso y entreno en línea: login Google real, onboarding, perfil, dashboard y
la sesión de entreno completa — split del día, series peso×reps con progresión
inteligente, PRs en vivo, descansos con cronómetro y guardado en el historial
del app viejo (misma estructura, cero migración).

| Fase | Alcance | Verificación |
|------|---------|--------------|
| F0 Esqueleto | Vite + TS + Tailwind, rutas, tema, Capacitor | ✓ Compila, login vacío, APK debug |
| F1 Acceso | Login Google, onboarding, perfil, dashboard | ✓ El mismo usuario entra y ve su racha |
| F2 Entreno | Hoy, rutinas, series/reps, descanso | ✓ Sesión real completa y guardada |
| F3 Progreso | Historial, medidas, gráficas | Historial viejo completo, sin huecos |
| F4 Extras | FitBot, GymChat, Spotify, Radio | GymChat en vivo, Spotify reproduce |
| F5 Empaquetado | Iconos, splash, notificaciones, APK firmado | APK actualiza sobre el instalado |

## Reglas de oro

1. **Mismo appId** (`com.fittrack.app`) y mismo origen `https://localhost` →
   el localStorage del FitTrack actual sobrevive sin migración.
2. **Claves viejas**: `FITTRACK_*`, `SPOTIFY_*`, `GYMCHAT_*` nunca se
   renombran. F2 ESCRIBE el state completo (`FITTRACK_ALPHA_V2_STATE`)
   con merge quirúrgico vía `aplicarEstado` — solo toca los campos de
   entreno, preservando el resto. Claves nuevas usan prefijo `FT2_`.
3. **La app vieja queda congelada** como referencia visual (lado a lado
   antes de cerrar cada fase).
4. Protocolo de entregas: clon fresco · parches quirúrgicos · changelog doble.

## Desarrollo

```bash
npm install --legacy-peer-deps
npm run dev       # http://localhost:3100 (RiderTrack usa 3000)
npm run lint      # tsc --noEmit
npm run build     # vite build → dist/
```

## Estructura

```
src/
├── main.tsx              # Punto de entrada
├── App.tsx               # Cerca de auth + shell + subtabs F2
├── index.css             # Tailwind 4 + tema claro/oscuro
├── types.ts              # Vistas, usuario, entreno, claves de storage
├── services/
│   ├── firebase.ts       # fittrack-e06be (mismo proyecto del app viejo)
│   ├── platform.ts       # Web vs APK
│   ├── storageFit.ts     # Puente claves viejas + aplicarEstado (merge)
│   ├── entreno.ts        # Split, modos, biblioteca, progresión, PRs
│   └── feedback.ts       # Beeps (WebAudio) + vibración
└── components/
    ├── LoginScreen.tsx   # Login Google (F1)
    ├── OnboardingView.tsx # Onboarding 2 etapas (F1)
    ├── DashboardView.tsx # KPIs, racha, heatmap (F1)
    ├── PerfilView.tsx    # Mi Perfil (F1)
    ├── EntrenoView.tsx   # Sesión de hoy: series, PRs, descanso (F2)
    ├── RutinaView.tsx    # Mi Semana: split + modo activo (F2)
    ├── EjerciciosView.tsx # Biblioteca + customs (F2)
    └── ui/Button.tsx     # Botón reutilizable base
```

## APK (GitHub Actions)

Push a `main` → build automático. Requiere los secrets (los mismos del repo
`fittrack.github.io`): `KEYSTORE_BASE64`, `STORE_PASSWORD`, `KEY_PASSWORD`.
El artifact queda en la pestaña Actions → **FitTrack-V2-APK**.

> `firestore.rules` es solo documentación de referencia: NO publicar en F0
> (las reglas activas viven en Firebase Console y las comparte el app vieja).

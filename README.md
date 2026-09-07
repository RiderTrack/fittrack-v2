# FitTrack V2 — Versión Modular

Reescritura del FitTrack actual (un solo `index.html` de 8.531 líneas) a la
arquitectura de **RiderTrack V2**: React 19 + Vite 6 + TypeScript + Tailwind 4
+ Capacitor 6 + Firebase 10.

## Estado: F0 · Fundación

Esqueleto compilando, login visual (maqueta), shell con el roadmap de fases,
tema claro/oscuro y APK debug desde GitHub Actions. Sin lógica de negocio
todavía — cada fase aterriza una vista del app viejo.

| Fase | Alcance | Verificación |
|------|---------|--------------|
| F0 Esqueleto | Vite + TS + Tailwind, rutas, tema, Capacitor | Compila, login vacío, APK debug |
| F1 Acceso | Login Google, onboarding, perfil, dashboard | El mismo usuario entra y ve su racha |
| F2 Entreno | Hoy, rutinas, series/reps, descanso | Sesión real completa y guardada |
| F3 Progreso | Historial, medidas, gráficas | Historial viejo completo, sin huecos |
| F4 Extras | FitBot, GymChat, Spotify, Radio | GymChat en vivo, Spotify reproduce |
| F5 Empaquetado | Iconos, splash, notificaciones, APK firmado | APK actualiza sobre el instalado |

## Reglas de oro

1. **Mismo appId** (`com.fittrack.app`) y mismo origen `https://localhost` →
   el localStorage del FitTrack actual sobrevive sin migración.
2. **Claves viejas solo lectura**: `FITTRACK_*`, `SPOTIFY_*`, `GYMCHAT_*`
   nunca se renombran. Claves nuevas usan prefijo `FT2_`.
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
├── App.tsx               # Cerca de auth + shell + roadmap F0
├── index.css             # Tailwind 4 + tema claro/oscuro
├── types.ts              # Vistas, usuario, claves de storage
├── services/
│   ├── firebase.ts       # fittrack-e06be (mismo proyecto del app viejo)
│   └── platform.ts       # Web vs APK
└── components/
    ├── LoginScreen.tsx   # Maqueta del login (F1 lo cablea)
    └── ui/Button.tsx     # Botón reutilizable base
```

## APK (GitHub Actions)

Push a `main` → build automático. Requiere los secrets (los mismos del repo
`fittrack.github.io`): `KEYSTORE_BASE64`, `STORE_PASSWORD`, `KEY_PASSWORD`.
El artifact queda en la pestaña Actions → **FitTrack-V2-APK**.

> `firestore.rules` es solo documentación de referencia: NO publicar en F0
> (las reglas activas viven en Firebase Console y las comparte el app vieja).

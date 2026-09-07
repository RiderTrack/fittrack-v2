# FitTrack V2 — Versión Modular

Reescritura del FitTrack actual (un solo `index.html` de 8.531 líneas) a la
arquitectura de **RiderTrack V2**: React 19 + Vite 6 + TypeScript + Tailwind 4
+ Capacitor 6 + Firebase 10.

## Estado: F5 · Extras

Acceso, entreno, los dos robots, el progreso y ahora los TRES extras
(login Google real, onboarding, perfil, dashboard, sesión de entreno
completa, FitBot con 225 ejercicios, FitBot IA con Claude, historial,
medidas, y):

- **GymChat**: chat 1-a-1 con tus amigos del gym por código
  `FIT-XXXXXX` (Firestore en tiempo real — las mismas colecciones
  `gymchats` y `fittrack_usuarios` del app vieja, tus chats
  sobreviven). Inbox con no leídos, burbujas, y rutinas por chat:
  envía TU rutina de hoy o una generada con FitBot IA; la rutina
  recibida se carga directo en Entreno de Hoy con un toque.
- **Spotify**: login PKCE con tu cuenta (mismo client y claves
  `SPOTIFY_*` del viejo — la sesión se recupera sola vía refresh),
  player completo (portada, progreso con seek, me gusta REAL,
  volumen), playlists y "Tus me gusta" para arrancar la música
  desde la app, y el motor anti-cuelgue por llamadas de RiderTrack
  (watchdog 20s + revive + reanudar solo + 🧪 simulacro).
- **Radio Peruana**: las 14 emisoras del viejo por categoría
  (noticias / pop / romántica / variada) con HLS para los .m3u8,
  favoritos ⭐ y volumen (nuevos vs viejo).
- **La música sigue sonando al cambiar de vista**: el audio vive en
  `MediosFitProvider` (global) con FABs flotantes (GymChat con badge,
  Spotify, Radio) y el mini-pill de "suena ahora", igual que el viejo.
  Solo una fuente suena a la vez (Spotify pausa radio y viceversa).
- **Deep link `fittrack://callback`**: Android re-abre la app al
  aceptar en Spotify, incluso en arranque en frío (capturado por
  `getLaunchUrl` + `appUrlOpen` con dedupe).

La rutina que cualquiera de los dos robots genere aterriza directo en
**Entreno de Hoy** con sus series y reps (mismo flujo de PRs, descansos y
racha de F2). Las medidas nuevas se escriben en `state.measurements` con el
mismo shape del viejo (imc/height/bodyfat/visceral/muscle incluidos).

| Fase | Alcance | Verificación |
|------|---------|--------------|
| F0 Esqueleto | Vite + TS + Tailwind, rutas, tema, Capacitor | ✓ Compila, login vacío, APK debug |
| F1 Acceso | Login Google, onboarding, perfil, dashboard | ✓ El mismo usuario entra y ve su racha |
| F2 Entreno | Hoy, rutinas, series/reps, descanso | ✓ Sesión real completa y guardada |
| F3 Robots | FitBot (225 ejercicios) + FitBot IA (Claude) | ✓ Wizard genera rutina y carga en Hoy; IA conversa con contexto real |
| F4 Progreso | Historial, medidas, gráficas, clave IA en Perfil | ✓ Historial viejo completo, sin huecos; peso rápido actualiza hoy |
| F5 Extras | GymChat, Spotify, Radio | ✓ GymChat en vivo, Spotify reproduce |
| F6 Empaquetado | Iconos, splash, notificaciones, APK firmado | APK actualiza sobre el instalado |

## Reglas de oro

1. **Mismo appId** (`com.fittrack.app`) y mismo origen `https://localhost` →
   el localStorage del FitTrack actual sobrevive sin migración.
2. **Claves viejas**: `FITTRACK_*`, `SPOTIFY_*`, `GYMCHAT_*` nunca se
   renombran. F2 ESCRIBE el state completo (`FITTRACK_ALPHA_V2_STATE`)
   con merge quirúrgico vía `aplicarEstado` — solo toca los campos de
   entreno, preservando el resto. F3 escribe `state.fitbot` (check-in,
   perfil, rutina) + `FITTRACK_RUTINA_HOY` / `FITTRACK_RUTINA_FECHA` y
   lee `FITTRACK_ANTHROPIC_KEY` — todo con el MISMO shape del viejo.
   F4 escribe `state.measurements` (peso rápido + registros completos con
   imc/height/bodyfat/visceral/muscle, shape del saveMeasurements del viejo).
   F5 escribe `GYMCHAT_CODIGO` (código propio, mismo formato) y lee/escribe
   `SPOTIFY_TOKEN` / `SPOTIFY_TOKEN_TIME` / `SPOTIFY_REFRESH` /
   `SPOTIFY_VERIFIER` (mismas claves del viejo — sesión compatible);
   radio usa claves nuevas `FT2_RADIO_*`.
   Claves nuevas usan prefijo `FT2_`.
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
├── App.tsx               # Cerca de auth + shell + subtabs F2 + robots F3
├── index.css             # Tailwind 4 + tema claro/oscuro
├── types.ts              # Vistas, usuario, entreno, robots, claves de storage
├── services/
│   ├── firebase.ts       # fittrack-e06be (mismo proyecto del app viejo)
│   ├── platform.ts       # Web vs APK
│   ├── storageFit.ts     # Puente claves viejas + aplicarEstado (merge)
│   ├── entreno.ts        # Split, modos, biblioteca, progresión, PRs
│   ├── fitbot.ts         # F3: motor del robot propio (perfiles, memoria, rutinas)
│   ├── claude.ts         # F3: robot IA (key, contexto real, conversión JSON) + F4: probar key
│   ├── progreso.ts       # F4: medidas (IMC, gráficas), historial, volumen semanal, CSV
│   └── feedback.ts       # Beeps (WebAudio) + vibración
├── data/
│   ├── fitbotDb.ts       # F3: los 225 ejercicios + reglas (generada)
│   └── demoData.ts       # Modo demo
└── components/
    ├── LoginScreen.tsx   # Login Google (F1)
    ├── OnboardingView.tsx # Onboarding 2 etapas (F1)
    ├── DashboardView.tsx # KPIs, racha, heatmap (F1)
    ├── EntrenoView.tsx   # Sesión de hoy: series, PRs, descanso (F2+F3)
    ├── RutinaView.tsx    # Mi Semana: split + modo activo (F2)
    ├── EjerciciosView.tsx # Biblioteca + customs (F2)
    ├── FitBotView.tsx    # F3: wizard del robot + chat IA Claude
    ├── HistorialView.tsx # F4: sesiones con detalle + gráfica volumen + CSV
    ├── MedidasView.tsx   # F4: peso rápido, gráfica peso, formulario IMC
    ├── GraficaLinea.tsx  # F4: line chart SVG puro (puerto del viejo)
    ├── PerfilView.tsx    # F1: Mi Perfil + F4: gestión clave Claude
    └── ui/Button.tsx     # Botón reutilizable base
```

## APK (GitHub Actions)

Push a `main` → build automático. Requiere los secrets (los mismos del repo
`fittrack.github.io`): `KEYSTORE_BASE64`, `STORE_PASSWORD`, `KEY_PASSWORD`.
El artifact queda en la pestaña Actions → **FitTrack-V2-APK**.

> `firestore.rules` es solo documentación de referencia: NO publicar en F0
> (las reglas activas viven en Firebase Console y las comparte el app vieja).

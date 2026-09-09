# FitTrack V2 — Versión Modular

Reescritura del FitTrack actual (un solo `index.html` de 8.531 líneas) a la
arquitectura de **RiderTrack V2**: React 19 + Vite 6 + TypeScript + Tailwind 4
+ Capacitor 6 + Firebase 10.

## Estado: F10.3 · Pro

**F10.3 · Fotos IA de recetas + detalle de revista.**

- **Foto IA del plato (✨)**: botón "Generar foto IA del plato" que CREA la
  foto profesional del plato con IA (prompt de fotografía de comida armado
  con el nombre + ingredientes + categoría de la receta). **Sin API key** —
  la clave Anthropic del usuario solo genera texto, así que la imagen sale
  de un generador público gratuito (Pollinations) y pasa por el MISMO
  compresor del F6 (JPEG 900px), respetando máx. 4 fotos por receta y el
  límite de 3 MB del recetario. Disponible en 3 lugares: el formulario
  (crear/editar), el preview de la IA (antes de guardar) y el detalle de
  una receta guardada (se guarda directo, sin abrir el formulario).
- **Detalle estilo revista**: con foto, el título va SOBRE la imagen con
  degradado (look de revista de cocina); chips de categoría/dificultad y
  panel de macros debajo. Sin foto: CTA ✨ para generarla en un toque.

**F10.2 · Recetas editables + galería.** Botón ✏️ para reabrir cualquier
receta guardada en el formulario (guarda SIN duplicar, misma fecha y
posición), galería de hasta 4 fotos por receta (al crear, al editar y antes
de guardar el resultado de la IA) y migración automática del campo imagen
viejo.

**F10.1 · Medicamentos profesionales + Recetas pro + SaludBot con los robots.**

- **Medicamentos (pestaña nueva, F10.1)**: lo que pidió el usuario — no un
  listado simple sino UN TRATAMIENTO COMO UN PROFESIONAL: **qué** pastilla
  (nombre + cantidad: mg/g/mL/gotas/cápsulas/IU), **a qué horas** (horarios
  múltiples: 08:00, 14:00, 20:00…), **cada cuántos días** (diario, cada 2,
  cada 3, semanal) y **por cuántos días** (fecha de inicio + duración, o uso
  continuo para suplementos). Incluye **plan de hoy** (timeline de tomas con
  Tomar/Saltar/deshacer, marca ATRASADA), **próxima dosis con cuenta
  atrás**, **adherencia de 7 días** (tomadas/saltadas/omitidas), tarjetas por
  tratamiento (día 3 de 7, termina dd/mm), pausa/reanudar, editar y aviso
  fijo: la app registra lo que tu médico indicó, **no receta ni sustituye
  consulta médica**. El health score y el tip del día usan las dosis reales
  de hoy. Los meds del modelo F10 se migran solos al abrir.
- **Recetas pro**: macros por porción (🔥 kcal · 🥩 proteína · 🍞 carbs ·
  🥑 grasa) y dificultad (Fácil/Media/Avanzada) en el alta, en las tarjetas,
  en el detalle y en el PDF; la IA también devuelve macros (con backfill
  para recetas guardadas antes de F10.1).
- **SaludBot → 🤖 ROBOTS · IA**: se mudó de pestaña del módulo Salud a su
  propia vista junto al FitBot (como pidió: "donde está los robots"). Su
  contexto ahora incluye los tratamientos con horarios reales y sigue
  guardando medicamentos detectados en el chat (completas horarios después).


**F10 · HealthTrack fusionado + menú hamburguesa.** El app HealthTrack
(un solo `index.html` de 2.788 líneas) vive ahora DENTRO del FitTrack como
módulo **Salud**, modularizado en React y con menú hamburguesa:

- **Menú hamburguesa (☰ del header)**: `NavDrawer` con TODO agrupado en 8
  secciones — Inicio · Entreno (Hoy/Mi Semana/Biblioteca) · Progreso
  (Historial/Medidas/Estadísticas) · **Salud** · **🤖 Robots · IA
  (FitBot + SaludBot)** · Medios · Chat · Cuenta
  (Perfil/Ajustes). La barra inferior se reduce a 5 destinos diarios
  (Inicio · Entreno · **Salud** · Medios · Chat) porque 13 pantallas ya no
  cabían. ESC/backdrop/ítem cierran el cajón; el badge de GymChat vive
  también acá.
- **Módulo Salud (5 pestañas, patrón MediosView)**:
  - **Resumen**: health score en anillo (fórmula exacta del viejo:
    40 base + agua ≤25 + sueño ≤25 + meds ≤10), métricas del día, tip
    contextual, 3 logros (el de "Control Total" usa tus Medidas de F4) y
    gráficas de 7 días de agua y sueño (misma GraficaLinea de F4).
  - **Hábitos**: agua con meta editable + vasos rápidos y sueño
    (hora de dormir/despertar con vuelta de medianoche + calidad).
  - **Registros**: signos vitales (PA/FC/O2), síntomas con chips y
    severidad, y perfil de salud (sangre, alergias, contacto de emergencia —
    tarjeta 🚨). Los medicamentos ahora tienen SU pestaña (arriba).
  - **Medicamentos (F10.1)**: tratamientos profesionales — ver arriba.
  - **Recetas**: recetario profesional — buscador, categorías, CRUD con
    macros (kcal/prot/carbs/grasa), dificultad, ingredientes/pasos dinámicos
    y foto (compresión 900px de F6), detalle con panel de macros, exportar
    PDF (vista de impresión), IA para crear recetas y para importar texto
    pegado (parser local "Sin IA" incluido).
  - (El SaludBot era la 5ª pestaña — ahora vive en 🤖 Robots · IA.)
- **Peso SIN duplicar**: el Resumen toma el peso/IMC de tus Medidas (F4) —
  una sola fuente de verdad.
- **Datos**: `FT2_SALUD` + `FT2_RECETAS` (prefijo FT2_) → entran SOLOS al
  respaldo JSON y al reset de F6, sin tocar respaldo.ts.
- **🔐 Regla de oro (por esto te bloquearon GitHub)**: el index.html del
  HealthTrack traía una **API key de Anthropic hardcodeada** — el escáner
  de secretos de GitHub la detecta y suspende la cuenta. En F10 la clave
  NUNCA está en el código: se ingresa en Mi Perfil → Robot IA y vive solo
  en el teléfono (`FITTRACK_ANTHROPIC_KEY`, la misma del FitBot IA).
  La clave vieja debe REVOCARSE en console.anthropic.com.

Acceso, entreno, los dos robots, el progreso, los extras, los Ajustes
reales, el editor de rutinas, la sincronización en la nube y ahora las
**analíticas profesionales + pulido de publicación**: login Google real,
onboarding, perfil, dashboard, sesión de entreno completa, FitBot con 225
ejercicios, FitBot IA con Claude, historial, medidas, y:

- **Apartado Medios** (pestañas, como el MediosView de RiderTrack):
  - **Spotify**: login PKCE con tu cuenta (mismo client y claves
    `SPOTIFY_*` del viejo — la sesión se recupera sola vía refresh),
    player completo (portada, progreso con seek, me gusta REAL,
    volumen), playlists y "Tus me gusta" para arrancar la música
    desde la app, y el motor anti-cuelgue por llamadas de RiderTrack
    (watchdog 20s + revive + reanudar solo + 🧪 simulacro).
  - **Radio Peruana**: las 14 emisoras del viejo por categoría
    (noticias / pop / romántica / variada) con HLS para los .m3u8,
    favoritos ⭐ y volumen.
  - **YouTube** (nuevo en F5.1, puerto del rider): pega un link y suena
    — video flotante (PiP) que sigue sonando mientras usas la app,
    favoritos con título, sin API key.
  - **Podcasts** (nuevo en F5.1, puerto del rider F3.43): novelas y
    audiolibros por RSS — buscador de iTunes, 34 feeds curados en 7
    categorías, memoria de posición por episodio (sigues donde lo
    dejaste), velocidad 1×–3×, descargas offline (Cache API).
- **Apartado Chat** (nuevo en F5.1): **GymChat** — chat 1-a-1 con tus
  amigos del gym por código `FIT-XXXXXX` (Firestore en tiempo real —
  las mismas colecciones `gymchats` y `fittrack_usuarios` del app
  vieja, tus chats sobreviven). Inbox con no leídos (badge en la nav),
  y rutinas por chat: envía TU rutina de hoy o una generada con
  FitBot IA; la rutina recibida se carga directo en Entreno de Hoy.
- **La música sigue sonando al cambiar de vista**: el audio vive en
  `MediosFitProvider` (global) con el mini-reproductor sobre la barra
  de nav (play/pausa + cortar + PiP de YouTube). Solo UNA fuente suena
  a la vez: al arrancar una, pausa las otras tres.
- **Deep link `fittrack://callback`**: Android re-abre la app al
  aceptar en Spotify (incluso en arranque en frío) y cae directo en
  el apartado Medios → pestaña Spotify.
- **Ajustes** (nuevo en F6, el ⚙ del header): **recordatorio de entreno**
  con notificación diaria nativa (mismo canal e id del viejo — si lo tenías
  activo, se reprograma solo), **respaldo export/import** en un JSON
  (entrenamientos, medidas, PRs, fotos, clave IA, Spotify, GymChat —
  todo en un archivo para cambiar de celular), **fotos de progreso**
  (galería + comparador antes/ahora, misma compresión 900px JPEG 0.8,
  guardadas en el teléfono — sin reglas remotas), y **borrar todo**
  (el reset del viejo, ahora por prefijo FITTRACK_/SPOTIFY_/GYMCHAT_/FT2_).
- **Editor de rutina personal** (nuevo en F7, en Mi Semana): tocá
  "Personalizar mi semana" y clona el split clásico con tu biblioteca;
  de ahí editás cada día — nombre, entrena/descansa, qué ejercicios
  (base + customs, con buscador), series 1-10, reps (`8-12`) y ORDEN
  (subir/bajar). Con la rutina activa, **Entreno de Hoy usa TUS series y
  reps** por ejercicio; pausarla devuelve el split clásico sin borrar nada.
  Vive en `state.rutinaPersonal` → entra solo al respaldo JSON.
- **Detalle por ejercicio** (nuevo en F7): desde la tarjeta de Entreno
  ("Ver historial y progreso") o la Biblioteca (ícono de historial) se
  abre el detalle con marcas (peso máx, 1RM estimado, volumen total),
  **gráfica de evolución del peso** y la lista de TODAS las sesiones de
  ese ejercicio — soporta el historial clásico y el de FitBot.
- **Sincronización en la nube** (nuevo en F8, en Ajustes): TODO tu
  progreso (sesiones, medidas, PRs, rutina, customs, fotos, perfil)
  respaldado en Firestore en tu cuenta Google — un doc por usuario
  (`fittrack_sync/{uid}`). Sincroniza al iniciar sesión, cada 5 min,
  al volver al frente y 8 s tras cada cambio (debounce). El merge
  **combina sin borrar** (sesiones ∪ por fecha+hora, medidas ∪ por
  fecha, PRs el mayor 1RM, customs ∪ por id); "Restaurar desde la
  nube" y "Subir todo" para controlar a mano. Por seguridad NO sube
  la clave IA ni los tokens de Spotify. Requiere UNA regla Firestore
  nueva (paso 1 del changelog F8) — si falta, la app sigue 100 %
  local y la tarjeta de Ajustes te avisa.
- **Estadísticas profesionales** (nuevo en F9, tercera pestaña del módulo
  Progreso): el dashboard de las apps pro — resumen de vida (sesiones
  totales, kg históricos, tiempo entrenado, mejor racha calculada),
  **semana vs semana** con delta de volumen/sesiones (también compacto
  en el Dashboard), volumen de las últimas **12 semanas** con semanas
  vacías incluidas, **distribución por grupo muscular** de 90 días
  (mapea cada ejercicio contra la biblioteca propia + la DB de 225 del
  FitBot), evolución del **peso corporal** con deltas (grasa, cintura,
  brazo, músculo), **récords con progreso real** (1RM Epley + % desde
  la primera vez que registraste el ejercicio), **consistencia** vs tu
  objetivo de días/semana del perfil y **días favoritos**. Todo lectura
  pura (`services/analiticas.ts`), cero escrituras.
- **Pulido Play Store** (nuevo en F9): versionCode 9 · versionName 2.0.0
  en la CI, **splash de arranque real** (logo sobre el fondo del tema en
  5 densidades — adiós logo genérico de Capacitor), **icono de
  notificación propio** (mancuerna blanca `ic_stat_fittrack` — adiós
  sample genérico), `webContentsDebuggingEnabled` off (seguridad) y la
  guía `docs/PLAY_STORE.md` + plantilla de política de privacidad
  `docs/PRIVACIDAD.md` listas para hostear en GitHub Pages.

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
| F5.1 Medios | Apartados Medios (Spotify/Radio/YouTube/Podcasts) y Chat en la nav; sin burbujas | ✓ Barra: Dashboard · Entreno · Medios · Chat · FitBot · Historial; pestañas cambian; YouTube suena con link; podcast retoma posición |
| F6 Ajustes | Recordatorio diario, respaldo JSON export/import, fotos de progreso, reset, tema en ajustes | ✓ Notificación suena a la hora; respaldo exporta/importa; foto aparece en galería y comparador; borrar todo reinicia |
| F7 Rutinas | Editor de rutina personal (día por día: ejercicios, series×reps, orden) + detalle por ejercicio (historial + gráfica) | ✓ Personalizar clona el split; editar cambia Entreno de Hoy; pausar vuelve al split; detalle muestra historial y gráfica |
| F8 Sync | Nube: Firestore fittrack_sync/{uid} — baja+combina+sube al entrar, cada 5 min, al despertar y 8 s tras cada cambio; Restaurar/Subir todo en Ajustes | ✓ Entrena en un teléfono y el otro recibe las sesiones; "Sincronizado (hace X)" en Ajustes; la clave IA nunca sube |
| F9 Pro | Estadísticas: resumen, semana vs semana, 12 semanas de volumen, grupos musculares, peso, PRs con progreso, consistencia, días favoritos · Play Store: versionCode 9/2.0.0, splash real, icono notificación propio, debugging off, docs de publicación | ✓ Historial → Estadísticas pinta todo con datos reales; Dashboard muestra delta semanal; splash/logo de notificación propios en el APK |
| F10 Salud | HealthTrack fusionado: módulo Salud (score, hábitos, vitales, síntomas, meds, recetario IA, SaludBot) · menú hamburguesa NavDrawer con 7 secciones · barra inferior de 5 · cero secretos hardcodeados (clave IA del teléfono) · versionCode 10/2.1.0 | ✓ Salud en barra y ☰ abre las 5 pestañas; score 68/68 en smoke; tsc 0 err; build OK |
| F10.1 Pro | Medicamentos como tratamiento (mg + horarios múltiples + cadencia + duración, plan de hoy, adherencia 7d, migración auto) · recetas con macros + dificultad · SaludBot junto al FitBot en ROBOTS · IA | ✓ Pestaña Medicamentos con timeline de tomas; smoke 119/119; tsc 0 err; build OK |
| F10.2 Pro | Recetas EDITABLES (✏️ reabre precargada, guarda sin duplicar) · galería de 4 fotos + miniaturas + PDF con galería · migración imagen→imagenes | ✓ Editar y agregar fotos sin duplicar; smoke 67/67; tsc 0 err; build OK |
| F10.3 Pro | Foto IA del plato ✨ (generador sin API key, compresor 900px, guardas 4/3MB) en form + preview IA + detalle · detalle estilo revista (título sobre la foto) | ✓ Botón ✨ en 3 vistas; smoke F10.3; tsc 0 err; build OK · versionCode 13/2.1.3 |

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
   F5.1 usa claves nuevas `ft_yt_favoritos` (YouTube) y `ft_pod_*`
   (podcasts, por uid — sin Firestore: todo local en el teléfono).
   Claves nuevas usan prefijo `FT2_` (o `ft_` para medios). F8 añade
   `FT2_SYNC_META` (reloj del sync: modificado/última subida/última
   bajada — clave nueva v2, entra al respaldo JSON sin chocar).
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
│   ├── progreso.ts       # F4: medidas (IMC, gráficas), historial, volumen semanal, CSV + F7: detalle por ejercicio
│   ├── gymchat.ts        # F5: GymChat (gymchats + fittrack_usuarios, inbox refcount)
│   ├── spotify.ts        # F5: login PKCE + player + playlists + anti-cuelgue
│   ├── radioFit.ts       # F5: 14 emisoras + RadioEngine (hls.js lazy)
│   ├── mediosYouTube.ts  # F5.1: IFrame API de YouTube (puerto del rider)
│   ├── podcastRSS.ts     # F5.1: motor de podcasts RSS (puerto F3.43, sin Firestore)
│   ├── recordatorio.ts   # F6: notificación diaria (canal e id 777001 del viejo)
│   ├── respaldo.ts       # F6: export/import JSON de TODAS las claves + reset
│   ├── fotosProgreso.ts  # F6: fotos comprimidas 900px JPEG 0.8 (dataURL local)
│   ├── rutinaPersonal.ts # F7: motor del editor de Mi Semana (crear/editar/activar)
│   ├── sync.ts           # F8: sincronización en la nube (fittrack_sync/{uid}, merge sin borrar)
│   ├── analiticas.ts     # F9: motor de estadísticas (resumen, comparativa, grupos, PRs, consistencia)
│   ├── salud.ts          # F10: datos del módulo Salud (agua, sueño, vitales, meds, síntomas, score, logros)
│   ├── recetas.ts        # F10: recetario (CRUD, filtros, parser local, exportar PDF)
│   ├── saludIa.ts        # F10: SaludBot + recetas IA (reusa la clave IA del perfil, NUNCA hardcodeada)
│   └── feedback.ts       # Beeps (WebAudio) + vibración
├── utils/
│   ├── podcastRssCore.ts # F5.1: parseo RSS puro (regex, sin DOM)
│   └── podcastCatalogo.ts # F5.1: 34 feeds curados en 7 categorías
├── data/
│   ├── fitbotDb.ts       # F3: los 225 ejercicios + reglas (generada)
│   └── demoData.ts       # Modo demo
└── components/
    ├── LoginScreen.tsx   # Login Google (F1)
    ├── OnboardingView.tsx # Onboarding 2 etapas (F1)
    ├── DashboardView.tsx # KPIs, racha, heatmap (F1)
    ├── EntrenoView.tsx   # Sesión de hoy: series, PRs, descanso (F2+F3+F7)
    ├── RutinaView.tsx    # Mi Semana: split + modo activo + editor F7
    ├── RutinaEditorDia.tsx # F7: modal editor de un día (ejercicios, series, orden)
    ├── DetalleEjercicio.tsx # F7: modal historial por ejercicio + gráfica
    ├── EjerciciosView.tsx # Biblioteca + customs + historial F7 (F2)
    ├── FitBotView.tsx    # F3: wizard del robot + chat IA Claude
    ├── HistorialView.tsx # F4: sesiones con detalle + gráfica volumen + CSV
    ├── MedidasView.tsx   # F4: peso rápido, gráfica peso, formulario IMC
    ├── EstadisticasView.tsx # F9: analíticas (módulo Progreso, 3ª pestaña)
    ├── NavDrawer.tsx        # F10: menú hamburguesa (7 secciones, TODO el app)
    ├── salud/               # F10: módulo Salud del HealthTrack
    │   ├── SaludView.tsx    # contenedor con 5 pestañas
    │   ├── TabResumen.tsx   # score anillo, métricas, tips, logros, gráficas 7d
    │   ├── TabHabitos.tsx   # agua (meta, vasos) + sueño
    │   ├── TabRegistros.tsx # vitales, síntomas, medicamentos, perfil salud
    │   ├── TabRecetas.tsx   # recetario completo + IA + importar + PDF
    │   └── TabSaludBot.tsx  # chat de salud con IA y guardar meds
    ├── GraficaLinea.tsx  # F4: line chart SVG puro (puerto del viejo)
    ├── PerfilView.tsx    # F1: Mi Perfil + F4: gestión clave Claude
    ├── AjustesView.tsx   # F6: recordatorio, perfil, tema, fotos, respaldo, reset + F8: sincronización
    ├── GymChatView.tsx   # F5: GymChat (apartado Chat en F5.1)
    ├── SpotifyView.tsx   # F5: Spotify (pestaña de Medios en F5.1)
    ├── RadioView.tsx     # F5: Radio (pestaña de Medios en F5.1)
    ├── medios/
    │   ├── MediosView.tsx     # F5.1: apartado Medios (4 pestañas)
    │   ├── MediosFitProvider.tsx # Global: radio+spotify+YT+podcasts, exclusión mutua
    │   ├── MiniPlayerFit.tsx  # F5.1: barra sobre la nav + PiP de YouTube
    │   └── TabPodcasts.tsx   # F5.1: pestaña Podcasts (puerto del rider)
    └── ui/Button.tsx     # Botón reutilizable base
```

## APK (GitHub Actions)

Push a `main` → build automático. Requiere los secrets (los mismos del repo
`fittrack.github.io`): `KEYSTORE_BASE64`, `STORE_PASSWORD`, `KEY_PASSWORD`.
El artifact queda en la pestaña Actions → **FitTrack-V2-APK** (APK
`FitTrack-V2-F10.apk`, versionCode 10 · versionName 2.1.0).

> `firestore.rules` es solo documentación de referencia: NO publicar en F0
> (las reglas activas viven en Firebase Console y las comparte el app vieja).

> Publicación en Google Play: checklist completo en `docs/PLAY_STORE.md`
> y plantilla de política de privacidad en `docs/PRIVACIDAD.md`.

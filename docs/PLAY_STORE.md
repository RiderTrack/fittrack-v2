# 📱 FitTrack V2 — Checklist de publicación en Google Play

Guía práctica para llevar el APK de Actions a la Play Store real.
Estado actual (F9): la app ya está "pulida para publicación"
(versión, icono de notificación propio, splash real, debugging
off). Lo que queda es trámite de consola, no de código.

---

## 1 · Lo que la F9 ya dejó listo (sin que muevas nada)

| Requisito de Play | Estado |
|---|---|
| `versionCode` / `versionName` | CI los fija en **9 / 2.0.0** (paso "F9 · Versionar APK"). Cada nueva subida a Play necesita un versionCode MAYOR: edítalo en `.github/workflows/build.yml` |
| Icono de launcher + adaptive | Ya se generaba en HD (Lanczos + unsharp) |
| Splash de arranque | NUEVO: logo centrado sobre el fondo del tema (#020617) en las 5 densidades — antes salía el logo genérico de Capacitor |
| Icono de notificación | NUEVO: mancuerna blanca propia (`ic_stat_fittrack`) — antes el sample genérico de Capacitor |
| Debugging web off | NUEVO: `webContentsDebuggingEnabled: false` (requisito de seguridad de Play) |
| Firma del APK | Keystore persistente en GitHub Secrets (mismo del app vieja) |
| Política de privacidad | Plantilla lista en `docs/PRIVACIDAD.md` — solo falta hostearla (ver paso 4) |

---

## 2 · APK de prueba vs bundle de Play

La CI entrega un **APK firmado** (instalación directa). Play Store
para publicar pide un **AAB** (Android App Bundle). Dos opciones:

- **Opción A (recomendada al inicio):** seguir con el APK para tu
  círculo (drive/WhatsApp) — no requiere nada de la consola.
- **Opción B (publicar de verdad):** cambiar en la CI
  `./gradlew assembleDebug` por `./gradlew bundleRelease` y firmar
  el `.aab` con el mismo keystore. Play firma el APK final por ti
  (Play App Signing) usando ese keystore como identidad.

---

## 3 · Trámites de consola (una sola vez)

1. **Cuenta de Google Play Console** — US$ 25 únicos (play.google.com/console).
   Cuenta personal → Play exige **14 días de testing cerrado con 12
   testers** antes de poder publicar a producción. Úsalo a favor:
   12 compañeros del gym con el APK = testing cerrado cumplido.
2. **Crear la app** en la consola: nombre "FitTrack", idioma es-419,
   categoría *Salud y bienestar* (sub: *Ejercicio y entrenamiento*).
3. **Ficha de la tienda**:
   - Título (30 chars) y descripción corta (80) y larga (4000).
   - Mínimo 2 capturas de teléfono (ideal 4-8): Dashboard,
     Entreno de hoy, Estadísticas, Medios con Spotify suenando.
   - Icono 512×512 (usa el mismo `icon.png` recortado) y
     **feature graphic** 1024×500 (portada con logo + eslogan).
   - Fotos de teléfono: screenshots reales del APK (sin barras
     de notificación de otras apps, sin datos de terceros).

---

## 4 · Política de privacidad (OBLIGATORIA)

Play la exige para cualquier app con cuenta de usuario.

1. Copia `docs/PRIVACIDAD.md`, rellena los `[corchetes]`
   (fecha, email de contacto).
2. Hosteala gratis: GitHub Pages del propio repo
   (Settings → Pages → rama `main` / carpeta `docs`) → URL tipo
   `https://ridertrack.github.io/fittrack-v2/PRIVACIDAD.md`
   (o renderizada en HTML).
3. Pega esa URL en Consola → Política de privacidad.

---

## 5 · Declaraciones de la consola que importan

- **Data safety (formulario "Seguridad de los datos"):**
  - Recopila: *Ubicación aproximada* NO (mientras no uses GPS),
    *Nombre* (cuenta Google), *Correo*, *IDs de usuario* (uid),
    *Fotos* (las de progreso), *Otros datos* (medidas/entrenos).
  - Todo se **cifra en tránsito** (HTTPS a Firestore) y **se puede
    borrar** (Ajustes → Reset; y borrar cuenta Google).
  - NO compartes datos con terceros, NO publicidades, NO analytics.
- **Content rating:** cuestionario → probable "Para todos" o 3+.
- **Audiencia objetivo:** 18+ (evita las reglas extra de menores).
- **Anuncios:** declarar "No contiene anuncios".

---

## 6 · Publicación gradual (recomendado)

1. Subir AAB al track **Interno** → probar instalación real.
2. Track **Cerrado** (12+ testers, 14 días si cuenta nueva).
3. Track **Producción** con **release gradual**: 10% → 50% → 100%
   (si algo explota, frenas sin que llegue a todos).

---

## 7 · Mantenimiento post-publicación

- Cada versión nueva: subir versionCode en la CI (10, 11…), subir
  AAB, Play review automático (horas, no días para updates pequeños).
- Quebrar el keystore = pierdes la identidad de la app → respalda
  el secret `KEYSTORE_BASE64` en 2 lugares distintos.
- Revisa la pestaña *Vital statistics* (crashes Android Vitals).

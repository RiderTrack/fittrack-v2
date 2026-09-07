// ═══════════════════════════════════════════════════════════
// ☁️ SYNC — FitTrack V2 (F8 · Sincronización en la nube)
// El seguro que F6 prometía: TODO tu progreso (sesiones, medidas,
// PRs, logros, rutina personal, ejercicios custom, fotos, perfil
// y ajustes) respaldado en Firestore, en TU cuenta Google — un
// solo documento por usuario: fittrack_sync/{uid}.
//   • CUÁNDO sincroniza: al iniciar sesión (baja+combina+sube),
//     al volver al frente la app, cada 5 min, y 8 s después de
//     cada cambio local (debounce — storageFit avisa por el hook
//     alEscribirEstado).
//   • CÓMO combina (merge sin borrar): sesiones ∪ por fecha+hora,
//     medidas ∪ por fecha, PRs se queda el MAYOR 1RM, logros la
//     fecha más nueva, customs ∪ por id, fotos ∪ exactas; el resto
//     de campos gana el estado más reciente. Borrar en un teléfono
//     NO se replica (no hay borrado suave) — "Subir todo" manda.
//   • NO sube (por seguridad): la clave IA (FITTRACK_ANTHROPIC_KEY)
//     ni los tokens de Spotify (son de ESTE teléfono).
//   • Si la nube rechaza (reglas Firestore) o no hay internet, la
//     app sigue 100 % local: la tarjeta de Ajustes muestra el error
//     y nada del flujo gym se rompe.
// ═══════════════════════════════════════════════════════════

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { versionApp } from './platform';
import { CLAVES, alEscribirEstado, leerEstado, leerPerfil } from './storageFit';
import type {
  EstadoFitTrack, Ejercicio, FotoProgreso, MedidaCorporal, PRLevantamiento,
  PerfilEntreno, SesionEntreno,
} from '../types';

/** Firestore: un doc por usuario con TODO su progreso */
const RUTA_SYNC = 'fittrack_sync';
/** Clave nueva v2 (entra al respaldo JSON sin chocar con nada) */
const CLAVE_META = 'FT2_SYNC_META';
/** 8 s de debounce tras un cambio (ni cada serie, ni nunca) */
const RETARDO_SUBIDA_MS = 8_000;
/** Cada 5 min con la app abierta y sesión iniciada */
const INTERVALO_MS = 5 * 60_000;
/** Firestore rechaza docs > 1 MiB — margen de aviso (fotos dataURL) */
const PESO_MAX = 900_000;

// ═══════════════════════════════════════════════════════════
// 📦 PAYLOAD — lo que viaja a la nube (y lo que NO)
// ═══════════════════════════════════════════════════════════

export interface SyncPayload {
  modificado: number;              // epoch ms del último cambio local
  subidoEn: number;                // epoch ms de la última subida
  versionApp: string;              // fase que escribió la nube
  estado: EstadoFitTrack;          // FITTRACK_ALPHA_V2_STATE
  perfilCompleto: PerfilEntreno | null; // FITTRACK_PERFIL_COMPLETO
  nombrePreferido: string;         // FITTRACK_NOMBRE
  codigoGym: string;               // GYMCHAT_CODIGO
}

export interface ResultadoSync {
  ok: boolean;
  error?: string;
}

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Arma el payload con lo que hay AHORA en el teléfono */
function armarPayload(modificado: number): SyncPayload {
  const s = ls();
  return {
    modificado,
    subidoEn: Date.now(),
    versionApp: versionApp(),
    estado: leerEstado(),
    perfilCompleto: leerPerfil(),
    nombrePreferido: (s?.getItem(CLAVES.NOMBRE) ?? '').trim(),
    codigoGym: s?.getItem('GYMCHAT_CODIGO') ?? '',
  };
}

/** Firestore no acepta undefined en los docs — se limpia con JSON */
function limpiar(payload: SyncPayload): SyncPayload {
  return JSON.parse(JSON.stringify(payload)) as SyncPayload;
}

// ═══════════════════════════════════════════════════════════
// 🧲 MERGE — combinar local + nube SIN borrar nada
// (funciones puras y exportadas: las prueba el smoke F8)
// ═══════════════════════════════════════════════════════════

/** Momento de una sesión: timestamp ISO (FitBot) o fecha+hora */
export function tiempoSesion(s: SesionEntreno): number {
  if (s.timestamp) {
    const t = Date.parse(s.timestamp);
    if (!Number.isNaN(t)) return t;
  }
  const base = s.date ? Date.parse(`${s.date}T00:00:00`) : NaN;
  if (Number.isNaN(base)) return 0;
  const [h, m] = (s.time ?? '').split(':').map(Number);
  return base + ((h || 0) * 60 + (m || 0)) * 60_000;
}

/** Identidad de una sesión para el merge (misma clave = misma sesión) */
export function claveSesion(s: SesionEntreno): string {
  return s.timestamp ? `ts:${s.timestamp}` : `${s.date}|${s.time ?? ''}`;
}

/** Une dos listas por clave: nada se pisa salvo la misma clave */
function unirPorClave<T>(
  local: T[] | undefined,
  remoto: T[] | undefined,
  clave: (item: T) => string,
  remotoGana: boolean,
  orden?: (a: T, b: T) => number,
): T[] {
  const mapa = new Map<string, T>();
  for (const item of local ?? []) mapa.set(clave(item), item);
  for (const item of remoto ?? []) {
    const k = clave(item);
    if (!mapa.has(k) || remotoGana) mapa.set(k, item);
  }
  const lista = Array.from(mapa.values());
  if (orden) lista.sort(orden);
  return lista;
}

/** PRs: se queda el MAYOR 1RM por ejercicio (gana el mejor día) */
function combinarPRs(
  local: Record<string, PRLevantamiento> | undefined,
  remoto: Record<string, PRLevantamiento> | undefined,
): Record<string, PRLevantamiento> {
  const out: Record<string, PRLevantamiento> = { ...(local ?? {}) };
  for (const [id, pr] of Object.entries(remoto ?? {})) {
    const prev = out[id];
    if (!prev || Number(pr?.value ?? 0) > Number(prev?.value ?? 0)) out[id] = pr;
  }
  return out;
}

/** Logros (id → fecha 'YYYY-MM-DD'): la fecha más nueva */
function combinarLogros(
  local: Record<string, string> | undefined,
  remoto: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...(local ?? {}) };
  for (const [id, fecha] of Object.entries(remoto ?? {})) {
    if (!out[id] || String(fecha) > String(out[id])) out[id] = fecha;
  }
  return out;
}

/**
 * Combina dos estados completos: colecciones por unión/clave y el
 * resto de campos del más reciente. `remotoMasNuevo` decide quién
 * gana los empates (mismo reloj: gana el local, que ya está en uso).
 */
export function combinarEstados(
  local: EstadoFitTrack,
  remoto: EstadoFitTrack,
  remotoMasNuevo: boolean,
): EstadoFitTrack {
  const base: EstadoFitTrack = remotoMasNuevo ? { ...remoto } : { ...local };

  base.workoutHistory = unirPorClave<SesionEntreno>(
    local.workoutHistory, remoto.workoutHistory, claveSesion, remotoMasNuevo,
    (a, b) => tiempoSesion(b) - tiempoSesion(a), // más reciente primero
  );
  base.measurements = unirPorClave<MedidaCorporal>(
    local.measurements, remoto.measurements, (m) => m.date, remotoMasNuevo,
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
  );
  base.fotosProgreso = unirPorClave<FotoProgreso>(
    local.fotosProgreso, remoto.fotosProgreso,
    (f) => `${f.date}::${f.url}`, false, // solo dedupe exacto (no se pisan)
  );
  base.prs = combinarPRs(local.prs, remoto.prs);
  base.logros = combinarLogros(local.logros, remoto.logros);

  // Ejercicios custom (state.customExercises): unión por id
  const customsLocal = Array.isArray(local.customExercises) ? local.customExercises as Ejercicio[] : [];
  const customsRemoto = Array.isArray(remoto.customExercises) ? remoto.customExercises as Ejercicio[] : [];
  base.customExercises = unirPorClave<Ejercicio>(
    customsLocal, customsRemoto, (e) => e.id, remotoMasNuevo,
  );

  // El resto de campos (perfil, fitbot, recordatorio, rutinaPersonal,
  // streak…): manda el lado MÁS NUEVO — pero si SOLO un lado lo tiene,
  // sobrevive (ausencia = nunca se configuró, no un borrado).
  const clavesMerged = new Set([
    'workoutHistory', 'measurements', 'fotosProgreso', 'prs', 'logros', 'customExercises',
  ]);
  for (const k of new Set([...Object.keys(local), ...Object.keys(remoto)])) {
    if (clavesMerged.has(k)) continue;
    const vLocal = local[k];
    const vRemoto = remoto[k];
    if (vLocal === undefined) {
      if (vRemoto !== undefined) base[k] = vRemoto;
    } else if (vRemoto === undefined) {
      base[k] = vLocal;
    } else {
      base[k] = remotoMasNuevo ? vRemoto : vLocal;
    }
  }

  return base;
}

// ═══════════════════════════════════════════════════════════
// 🕐 META — reloj local (FT2_SYNC_META, aparte del state:
// no dispara renders ni bucles con el hook de escritura)
// ═══════════════════════════════════════════════════════════

interface MetaSync {
  modificado: number;    // último cambio local
  ultimaSubida: number;  // última subida exitosa
  ultimaBajada: number;  // última bajada exitosa
}

function leerMeta(): MetaSync {
  try {
    const crudo = ls()?.getItem(CLAVE_META);
    if (crudo) {
      const m = JSON.parse(crudo);
      return {
        modificado: Number(m?.modificado ?? 0),
        ultimaSubida: Number(m?.ultimaSubida ?? 0),
        ultimaBajada: Number(m?.ultimaBajada ?? 0),
      };
    }
  } catch { /* meta corrupta → reloj nuevo */ }
  return { modificado: 0, ultimaSubida: 0, ultimaBajada: 0 };
}

function guardarMeta(m: MetaSync) {
  try { ls()?.setItem(CLAVE_META, JSON.stringify(m)); } catch { /* sin espacio */ }
}

// ═══════════════════════════════════════════════════════════
// 📡 ESTADO PARA LA UI (AjustesView se suscribe aquí)
// ═══════════════════════════════════════════════════════════

export interface EstadoSyncUI {
  activo: boolean;             // sesión iniciada (hay uid)
  sincronizando: boolean;      // hay una sync en vuelo
  pendiente: boolean;          // cambios locales sin subir
  ultimaSubida: number | null;
  ultimaBajada: number | null;
  error: string | null;
}

let _uid: string | null = null;
let _enVuelo = false;
let _reintentar = false;
let _error: string | null = null;
let _alCambiarRemoto: (() => void) | null = null;
let _timerSubida: ReturnType<typeof setTimeout> | null = null;
let _timerPeriodico: ReturnType<typeof setInterval> | null = null;

const _oyentes = new Set<(e: EstadoSyncUI) => void>();

export function snapshotSync(): EstadoSyncUI {
  const m = leerMeta();
  return {
    activo: _uid != null,
    sincronizando: _enVuelo,
    pendiente: !!_uid && m.modificado > m.ultimaSubida,
    ultimaSubida: m.ultimaSubida > 0 ? m.ultimaSubida : null,
    ultimaBajada: m.ultimaBajada > 0 ? m.ultimaBajada : null,
    error: _error,
  };
}

/** La tarjeta de Sincronización de Ajustes se entera de todo */
export function suscribirSync(cb: (e: EstadoSyncUI) => void): () => void {
  _oyentes.add(cb);
  cb(snapshotSync()); // estado inmediato
  return () => { _oyentes.delete(cb); };
}

function emitir() {
  const snap = snapshotSync();
  _oyentes.forEach((cb) => { try { cb(snap); } catch { /* oyente desmontado */ } });
}

// ═══════════════════════════════════════════════════════════
// ⚠️ ERRORES — nunca rompen la app, se explican solos
// ═══════════════════════════════════════════════════════════

function mensajeError(e: unknown): string {
  const code = String((e as { code?: unknown })?.code ?? '');
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (code.includes('permission-denied')) {
    return 'La nube rechazó la conexión — falta la regla fittrack_sync en Firestore (paso 1 del changelog)';
  }
  if (code.includes('unavailable') || code.includes('failed-precondition') || /network|offline/i.test(msg)) {
    return 'Sin conexión con la nube — reintenta cuando haya internet';
  }
  if (e instanceof Error && e.message === 'peso') {
    return 'Tus datos pesan más de 1 MB (normal: muchas fotos) — el respaldo JSON local los cubre';
  }
  return 'No se pudo conectar con la nube — reintenta más tarde';
}

// ═══════════════════════════════════════════════════════════
// ✍️ ESCRITURA SILENCIOSA — aplicar la nube SIN re-disparar el
// debounce (escribir crudo, sin pasar por aplicarEstado)
// ═══════════════════════════════════════════════════════════

function escribirEstadoSilencioso(estado: EstadoFitTrack) {
  try { ls()?.setItem(CLAVES.STATE, JSON.stringify(estado)); } catch { /* sin espacio */ }
}

/** Aplica las piezas del payload en las claves EXACTAS del viejo */
function aplicarPiezas(payload: SyncPayload, reemplazoTotal: boolean) {
  const s = ls();
  if (!s) return;
  escribirEstadoSilencioso(payload.estado ?? {});
  if (payload.perfilCompleto) {
    try { s.setItem(CLAVES.PERFIL, JSON.stringify(payload.perfilCompleto)); } catch { /* sin espacio */ }
  } else if (reemplazoTotal) {
    try { s.removeItem(CLAVES.PERFIL); } catch { /* sin storage */ }
  }
  if (payload.nombrePreferido) {
    try { s.setItem(CLAVES.NOMBRE, payload.nombrePreferido); } catch { /* sin espacio */ }
  } else if (reemplazoTotal) {
    try { s.removeItem(CLAVES.NOMBRE); } catch { /* sin storage */ }
  }
  // Código GymChat: solo rellena si falta (el local manda en este teléfono)
  if (payload.codigoGym && !s.getItem('GYMCHAT_CODIGO')) {
    try { s.setItem('GYMCHAT_CODIGO', payload.codigoGym); } catch { /* sin espacio */ }
  }
}

// ═══════════════════════════════════════════════════════════
// 🔄 MOTOR — bajar · combinar · subir (una sola vez en vuelo)
// ═══════════════════════════════════════════════════════════

/** Baja + combina + aplica local + sube el resultado (convergente) */
export async function sincronizarAhora(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  if (_enVuelo) { _reintentar = true; return { ok: true }; }
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const refDoc = doc(db, RUTA_SYNC, uid);
    const snap = await getDoc(refDoc);
    const remoto = snap.exists() ? (snap.data() as Partial<SyncPayload>) : null;

    let meta = leerMeta();
    const localP = armarPayload(meta.modificado);
    let payloadFinal: SyncPayload;
    let huboBajada = false;

    if (remoto?.estado) {
      // Combinar: la nube trae cosas → merge sin borrar + aplicar
      const remotoMasNuevo = Number(remoto.modificado ?? 0) > meta.modificado;
      const combinado = combinarEstados(localP.estado, remoto.estado as EstadoFitTrack, remotoMasNuevo);
      payloadFinal = {
        modificado: Math.max(meta.modificado, Number(remoto.modificado ?? 0)),
        subidoEn: Date.now(),
        versionApp: versionApp(),
        estado: combinado,
        perfilCompleto: remotoMasNuevo && remoto.perfilCompleto
          ? remoto.perfilCompleto
          : (localP.perfilCompleto ?? remoto.perfilCompleto ?? null),
        nombrePreferido: remotoMasNuevo && remoto.nombrePreferido
          ? remoto.nombrePreferido
          : (localP.nombrePreferido || remoto.nombrePreferido || ''),
        codigoGym: localP.codigoGym || remoto.codigoGym || '',
      };
      aplicarPiezas(payloadFinal, false); // silencioso: sin debounce
      meta = { ...meta, ultimaBajada: Date.now() };
      huboBajada = true;
      _alCambiarRemoto?.(); // App relee el state (setVersion)
    } else {
      // Nada en la nube: sube lo local tal cual
      payloadFinal = localP;
    }

    const limpio = limpiar(payloadFinal);
    if (JSON.stringify(limpio).length > PESO_MAX) throw new Error('peso');
    await setDoc(refDoc, limpio);
    guardarMeta({
      modificado: payloadFinal.modificado,
      ultimaSubida: Date.now(),
      ultimaBajada: huboBajada ? meta.ultimaBajada : meta.ultimaBajada,
    });
    if (_timerSubida) { clearTimeout(_timerSubida); _timerSubida = null; }
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
    if (_reintentar) { _reintentar = false; void sincronizarAhora(); }
  }
}

/** Cambio local (avisa storageFit): marcar el reloj y programar subida */
export function notificarCambioLocal() {
  const m = leerMeta();
  guardarMeta({ ...m, modificado: Date.now() });
  if (!_uid) { emitir(); return; } // sin sesión: solo el reloj
  if (_timerSubida) clearTimeout(_timerSubida);
  _timerSubida = setTimeout(() => {
    _timerSubida = null;
    void sincronizarAhora();
  }, RETARDO_SUBIDA_MS);
  emitir();
}

/** Baja la nube y REEMPLAZA este teléfono (recuperar / nuevo celu) */
export async function restaurarDesdeNube(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const snap = await getDoc(doc(db, RUTA_SYNC, uid));
    if (!snap.exists()) return { ok: false, error: 'Todavía no hay nada en tu nube' };
    const remoto = snap.data() as Partial<SyncPayload>;
    if (!remoto?.estado) return { ok: false, error: 'La nube no tiene datos legibles' };
    aplicarPiezas({
      modificado: Number(remoto.modificado ?? 0),
      subidoEn: 0,
      versionApp: String(remoto.versionApp ?? ''),
      estado: remoto.estado as EstadoFitTrack,
      perfilCompleto: remoto.perfilCompleto ?? null,
      nombrePreferido: String(remoto.nombrePreferido ?? ''),
      codigoGym: String(remoto.codigoGym ?? ''),
    }, true);
    const m = leerMeta();
    guardarMeta({ ...m, ultimaBajada: Date.now() });
    _alCambiarRemoto?.();
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
  }
}

/** Sube TODO lo de este teléfono y REEMPLAZA la nube (tras un reset) */
export async function subirTodoALaNube(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const payload = limpiar(armarPayload(Date.now()));
    if (JSON.stringify(payload).length > PESO_MAX) throw new Error('peso');
    await setDoc(doc(db, RUTA_SYNC, uid), payload);
    const m = leerMeta();
    guardarMeta({ modificado: payload.modificado, ultimaSubida: Date.now(), ultimaBajada: m.ultimaBajada });
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
  }
}

// ═══════════════════════════════════════════════════════════
// 🚀 ARRANQUE — App lo cablea: uid cambia → sync nueva
// ═══════════════════════════════════════════════════════════

export interface OpcionesInitSync {
  uid: string | null;
  alCambiarEstadoRemoto: () => void;
}

function alVolverAlFrente() {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void sincronizarAhora();
    }
  } catch { /* sin DOM */ }
}

function programar(uid: string | null) {
  if (_uid === uid) return;
  _uid = uid;
  if (_timerSubida) { clearTimeout(_timerSubida); _timerSubida = null; }
  if (_timerPeriodico) { clearInterval(_timerPeriodico); _timerPeriodico = null; }
  if (typeof document !== 'undefined') {
    try { document.removeEventListener('visibilitychange', alVolverAlFrente); } catch { /* sin DOM */ }
  }
  if (uid) {
    void sincronizarAhora();                       // al entrar (login o arranque)
    _timerPeriodico = setInterval(() => void sincronizarAhora(), INTERVALO_MS);
    if (typeof document !== 'undefined') {
      try { document.addEventListener('visibilitychange', alVolverAlFrente); } catch { /* sin DOM */ }
    }
  }
  emitir();
}

/**
 * Inicializa el motor. App pasa el uid (null en demo/sin sesión) y
 * un callback para re-leer el state tras aplicar datos de la nube.
 * Devuelve la función de limpieza (logout / desmontar).
 */
export function initSync(opts: OpcionesInitSync): () => void {
  _alCambiarRemoto = opts.alCambiarEstadoRemoto;
  // storageFit avisa de CADA escritura (state, perfil, onboarding)
  alEscribirEstado(() => notificarCambioLocal());
  programar(opts.uid);
  return () => {
    alEscribirEstado(null);
    programar(null);
    _alCambiarRemoto = null;
  };
}

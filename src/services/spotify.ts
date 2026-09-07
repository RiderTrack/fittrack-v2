// ═══════════════════════════════════════════════════════════
// 🎵 SPOTIFY — FitTrack V2 (F5 · Extras)
// Puerto del app viejo (index.html L7591-7900) con el motor
// anti-cuelgue de RiderTrack V2 (probado en producción):
//   • OAuth Authorization Code + PKCE (mismo client_id del viejo)
//   • Mismas claves del viejo: SPOTIFY_VERIFIER / SPOTIFY_TOKEN /
//     SPOTIFY_TOKEN_TIME (+ SPOTIFY_REFRESH que el viejo guardaba
//     pero NUNCA leía — aquí sí se usa: refresh automático)
//   • Redirect fittrack://callback — el MISMO del viejo, ya
//     registrado en el dashboard de Spotify, y la CI del repo ya
//     agrega el intent-filter (scheme fittrack · host callback)
//   • Web Playback SDK: la app es un dispositivo Spotify Connect
//     ("FitTrack 🏋️") y reproduce DIRECTO (requiere Premium)
//   • 📞 ANTI-CUELGUE POR LLAMADAS (del RiderTrack F3.29-F3.32):
//     conTimeout en TODAS las promesas del SDK + watchdog de 20s +
//     revivir el MISMO player antes de crear uno nuevo + reanudar
//     la música sola si sonaba hace <15 min (una llamada entre
//     series no mata la playlist)
//   • Login abre Spotify en el navegador del sistema; al aceptar,
//     Android re-abre la app y el código llega por appUrlOpen
//     (App.tsx lo captura SIEMPRE, arranque en frío incluido)
//   • NUEVO vs viejo: playlists + "Tus me gusta" para arrancar la
//     música desde la propia app (el viejo solo tenía controles)
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export const SPOTIFY_CLIENT_ID = '9542b79ff46f44aa9ce31a7450497af6';

// El MISMO redirect del app viejo (ya registrado en Spotify y ya
// parcheado en la CI con el intent-filter del manifest).
export const SPOTIFY_REDIRECT = 'fittrack://callback';
export const SPOTIFY_SCOPES =
  'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state user-library-read user-library-modify';

const KEY_TOKEN = 'SPOTIFY_TOKEN';
const KEY_TOKEN_TIME = 'SPOTIFY_TOKEN_TIME';
const KEY_REFRESH = 'SPOTIFY_REFRESH';
const KEY_VERIFIER = 'SPOTIFY_VERIFIER';

// ── Estado interno ──
let _accessToken: string | null = null;
let _deviceId: string | null = null;
let _sdkCargado = false;
let _cargandoSdk = false;

export interface SpotifyTrackInfo {
  id: string | null;
  nombre: string;
  artista: string;
  album: string;
  imagen: string | null;
  duracionMs: number;
  posicionMs: number;
  reproduciendo: boolean;
}

export interface SpotifyEstado {
  conectado: boolean;         // hay token
  listo: boolean;             // el dispositivo SDK está ready
  estado: 'desconectado' | 'conectando' | 'listo' | 'error' | 'requiere-premium' | 'reconectando';
  mensaje: string;
  track: SpotifyTrackInfo | null;
  shuffle: boolean;
  repeat: 0 | 1 | 2;          // off / context / track
  liked: boolean;
}

type Listener = (e: SpotifyEstado) => void;
const _listeners = new Set<Listener>();

function _estadoBase(): SpotifyEstado {
  return {
    conectado: false, listo: false, estado: 'desconectado',
    mensaje: '', track: null, shuffle: false, repeat: 0, liked: false,
  };
}
let _estado: SpotifyEstado = _estadoBase();

export function subscribeSpotify(cb: Listener): () => void {
  _listeners.add(cb);
  cb(_estado); // emite el estado actual al suscribirse
  return () => { _listeners.delete(cb); };
}
function emitir(patch: Partial<SpotifyEstado> = {}) {
  _estado = { ..._estado, ...patch };
  _listeners.forEach((l) => l(_estado));
}

export function getAccessToken(): string | null { return _accessToken; }
export function getDeviceId(): string | null { return _deviceId; }

// ── PKCE (idéntico al viejo) ──
function generateCodeVerifier(): string {
  const array = new Uint8Array(56);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function generateCodeChallenge(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Login: abre Spotify en el navegador del sistema ──
export async function spotifyLogin(): Promise<void> {
  const verifier = generateCodeVerifier();
  localStorage.setItem(KEY_VERIFIER, verifier);
  const challenge = await generateCodeChallenge(verifier);
  const url =
    'https://accounts.spotify.com/authorize' +
    '?client_id=' + SPOTIFY_CLIENT_ID +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(SPOTIFY_REDIRECT) +
    '&scope=' + encodeURIComponent(SPOTIFY_SCOPES) +
    '&code_challenge_method=S256' +
    '&code_challenge=' + challenge;
  // El WebView de Capacitor abre las URLs externas en el navegador
  // del sistema → la app sigue viva y recibe el código por
  // appUrlOpen (fittrack://callback) al volver.
  window.location.href = url;
}

// ── Intercambio code → token ──
async function tokenRequest(body: Record<string, string>): Promise<any> {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = await r.json();
  if (!data || !data.access_token) throw new Error(data?.error_description || 'respuesta sin token');
  return data;
}

/** Resultado del intercambio con MOTIVO (para avisar al usuario
 *  qué pasó exactamente y no un genérico "no se pudo") */
export interface ResultadoExchangeSpotify {
  ok: boolean;
  /** 'sin-verifier' = código repetido/viejo (se ignora en silencio) ·
   *  'redirect-uri' = el redirect no coincide con el dashboard ·
   *  'red' = sin internet/otro error */
  motivo: 'ok' | 'sin-verifier' | 'redirect-uri' | 'red';
  detalle?: string;
}

export async function spotifyExchangeCode(code: string): Promise<ResultadoExchangeSpotify> {
  const verifier = localStorage.getItem(KEY_VERIFIER);
  if (!verifier) {
    // Sin verifier: login viejo ya usado o duplicado (Android a veces
    // entrega el mismo deep link 2 veces) → NO es error del usuario.
    return { ok: false, motivo: 'sin-verifier' };
  }
  try {
    const data = await tokenRequest({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT,
      code_verifier: verifier,
    });
    _guardarToken(data);
    localStorage.removeItem(KEY_VERIFIER);
    // El token YA quedó guardado → la conexión es un hecho. Si el SDK
    // tarda o falla al arrancar (p.ej. mala conexión momentánea), NO
    // es un fallo del login: la restauración al re-montar reintenta.
    try {
      await iniciarSpotify(data.access_token);
    } catch (e: any) {
      console.warn('Spotify: token OK pero el SDK tardó en arrancar:', e?.message || e);
    }
    return { ok: true, motivo: 'ok' };
  } catch (e: any) {
    const detalle = e?.message || String(e || '');
    const esRedirect = /redirect/i.test(detalle);
    console.warn('Spotify exchange error:', detalle);
    return { ok: false, motivo: esRedirect ? 'redirect-uri' : 'red', detalle };
  }
}

// ── Deep link: parseo puro (testable sin React) ──
/** Reconoce la URL de callback de Spotify: fittrack://callback?code=XXX
 *  o con ?error=… si el usuario no aceptó. Cualquier OTRA URL devuelve
 *  null → el handler la ignora. */
export function parsearCallbackSpotify(url: string): { code: string; error?: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const esquemaNuestro = u.protocol === 'fittrack:';
    const esCallback = u.host === 'callback' || u.pathname === '/callback';
    if (!esquemaNuestro || !esCallback) return null;
    const code = u.searchParams.get('code');
    const error = u.searchParams.get('error');
    if (code) return { code };
    if (error) return { code: '', error };
    return null;
  } catch {
    return null; // URL malformada — ignorar
  }
}

export async function spotifyRefreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem(KEY_REFRESH);
  if (!refresh) return false;
  try {
    const data = await tokenRequest({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    });
    _guardarToken(data);
    return true;
  } catch (e) {
    console.warn('Spotify refresh falló — se requiere login de nuevo');
    return false;
  }
}

function _guardarToken(data: any): void {
  _accessToken = data.access_token;
  localStorage.setItem(KEY_TOKEN, data.access_token);
  localStorage.setItem(KEY_TOKEN_TIME, Date.now().toString());
  if (data.refresh_token) localStorage.setItem(KEY_REFRESH, data.refresh_token);
}

/** ¿El token guardado sigue fresco? (dura ~1h, margen de 2 min) */
export function tokenGuardadoFresco(): string | null {
  const t = localStorage.getItem(KEY_TOKEN);
  const ts = parseInt(localStorage.getItem(KEY_TOKEN_TIME) || '0', 10);
  if (t && Date.now() - ts < 58 * 60 * 1000) return t;
  return null;
}
export function hayRefreshToken(): boolean {
  return !!localStorage.getItem(KEY_REFRESH);
}

// ═══════════════════════════════════════════════════════════
// 📞 ANTI-CUELGUE POR LLAMADAS (puerto RiderTrack F3.29-F3.32)
// ═══════════════════════════════════════════════════════════

export interface AjustesReconexion {
  /** pausas entre reintentos al fallar la reconexión */
  reintentosMs: number[];
  /** período del latido de salud */
  heartbeatMs: number;
  /** re-chequeo rápido tras la 1ª ausencia del dispositivo */
  recheckMs: number;
  /** cuánto esperar el ready del player nuevo antes de darlo por fallido */
  readyTimeoutMs: number;
}
/** Puntos de sintonía (tests y smoke los acortan para ir rápido) */
export const AJUSTES_RECONEXION: AjustesReconexion = {
  reintentosMs: [10_000, 30_000, 60_000],
  heartbeatMs: 20_000,
  recheckMs: 5_000,
  readyTimeoutMs: 15_000,
};

/** Promesa con límite de tiempo: un player muerto a veces NUNCA
 *  resuelve (WebSocket caído) → sin esto la UI queda esperando
 *  para siempre. */
export function conTimeout<T>(p: Promise<T>, ms: number, etiqueta = 'sdk'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout-' + etiqueta)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Lo último que sonaba — para reanudar tras la reconexión */
interface ContextoReproduccion {
  uri: string | null;      // playlist que sonaba (context_uri)
  esMegusta: boolean;      // "me gusta" no tiene context_uri
  trackUri: string | null; // tema concreto (fallback de reanudación)
  posicionMs: number;      // por dónde iba
  reproduciendo: boolean;  // ¿sonaba al morir el player?
  momento: number;         // cuándo fue el último estado conocido
}
let _contexto: ContextoReproduccion | null = null;

let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _recheckTimer: ReturnType<typeof setTimeout> | null = null;
let _reintentoTimer: ReturnType<typeof setTimeout> | null = null;
let _timerNotReady: ReturnType<typeof setTimeout> | null = null;
let _appListenerListo = false;
let _docListenerListo = false;
let _fallosDevices = 0;
let _reconectando = false;
let _reintentos = 0;
// 🩹 anti-atasco — cuándo EMPEZÓ la reconexión en curso
let _reconnectStart = 0;

/** Reanudar solo si sonaba hace menos de 15 min: una llamada no mata
 *  la playlist, pero tampoco queremos que la música explote sola
 *  horas después de reabrir la app. */
const REANUDAR_MAX_MS = 15 * 60 * 1000;

/** Diagnóstico visible (tests, smoke y depuración) */
export interface SpotifyDiagnostico {
  conectado: boolean;
  estado: SpotifyEstado['estado'];
  deviceId: string | null;
  reconectando: boolean;
  reintentos: number;
  fallosDevices: number;
  contexto: { reproduciendo: boolean; uri: string | null; trackUri: string | null; posicionMs: number } | null;
}
export function spotifyDiagnostico(): SpotifyDiagnostico {
  return {
    conectado: !!_accessToken,
    estado: _estado.estado,
    deviceId: _deviceId,
    reconectando: _reconectando,
    reintentos: _reintentos,
    fallosDevices: _fallosDevices,
    contexto: _contexto
      ? { reproduciendo: _contexto.reproduciendo, uri: _contexto.uri, trackUri: _contexto.trackUri, posicionMs: _contexto.posicionMs }
      : null,
  };
}

function _arrancarWatchdog(): void {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(() => { void _chequearSalud(); }, AJUSTES_RECONEXION.heartbeatMs);
  // Al volver a la app (fin de la llamada) → chequeo inmediato
  if (!_appListenerListo) {
    _appListenerListo = true;
    try {
      const sub = CapApp.addListener('appStateChange', (s: any) => {
        if (s?.isActive) void _chequearSalud();
      });
      if (sub && typeof sub.catch === 'function') sub.catch(() => {});
    } catch { /* web sin plugin: el latido alcanza */ }
  }
  // Navegador (dev): al volver a la pestaña también se chequea
  if (!_docListenerListo && typeof document !== 'undefined') {
    _docListenerListo = true;
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void _chequearSalud();
      });
    } catch {}
  }
}
function _pararWatchdog(): void {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_recheckTimer) { clearTimeout(_recheckTimer); _recheckTimer = null; }
  if (_timerNotReady) { clearTimeout(_timerNotReady); _timerNotReady = null; }
  _fallosDevices = 0;
}

/** Latido: ¿nuestro dispositivo sigue registrado en Spotify?
 *  Exportado porque también sirve de chequeo manual. */
export async function spotifyChequearSalud(): Promise<boolean> {
  return _chequearSalud();
}
async function _chequearSalud(): Promise<boolean> {
  // 🩹 ANTI-ATASCO: si una reconexión lleva >75s sin resolver,
  // se libera el candado y se avisa — el botón ▶ vuelve a responder.
  if (_reconectando && _reconnectStart && Date.now() - _reconnectStart > 75_000) {
    _reconectando = false;
    _reintentos = 0;
    if (_reintentoTimer) { clearTimeout(_reintentoTimer); _reintentoTimer = null; }
    emitir({ estado: 'error', listo: false, mensaje: '⚠️ Spotify no quiso volver — toca ▶ para reintentar' });
    return false;
  }
  if (!_player || _reconectando || !_deviceId) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true; // sin red: no es culpa del player
  try {
    const d = await _api('/me/player/devices', { cache: 'no-store' });
    const vivos: string[] = (d?.devices || []).map((x: any) => x?.id).filter(Boolean);
    if (vivos.includes(_deviceId)) {
      _fallosDevices = 0;
      return true;
    }
  } catch { return true; } // red intermitente: no culpar al player
  _fallosDevices++;
  if (_fallosDevices === 1) {
    // 1ª ausencia: Spotify a veces tarda en registrar → re-chequeo rápido
    if (_recheckTimer) clearTimeout(_recheckTimer);
    _recheckTimer = setTimeout(() => { void _chequearSalud(); }, AJUSTES_RECONEXION.recheckMs);
    return false;
  }
  void _reconectarPlayer('dispositivo-perdido');
  return false;
}

/** Reconstruye el player muerto (misma sesión) y reanuda la música
 *  si sonaba. Exportado para poder dispararlo a mano. */
export async function spotifyReconectarPlayer(motivo = 'manual'): Promise<boolean> {
  return _reconectarPlayer(motivo);
}

// ─────────────────────────────────────────────────────────────
// 🧪 SIMULAR LLAMADA (botón de prueba del anti-cuelgue)
// ─────────────────────────────────────────────────────────────
/** Resultado del botón 🧪 de la vista Spotify */
export interface ResultadoSimulacion {
  ok: boolean;
  msg: string;
}

/**
 * 🧪 Simula lo que hace una llamada REAL sin llamarse por teléfono:
 * Android le quita el audio al WebView y el WebSocket del SDK se
 * cae EN SILENCIO. Aquí reproducimos ese guion:
 *   1) Se suelta la conexión del player por debajo (como el OS).
 *   2) El síntoma llega solo (not_ready reprograma este timer).
 *   3) A los 3s el motor anti-cuelgue hace su trabajo: player nuevo
 *      + la música vuelve donde estaba.
 */
export function spotifySimularLlamada(): ResultadoSimulacion {
  if (!_accessToken) return { ok: false, msg: 'Conecta Spotify primero' };
  if (!_deviceId || !_player) return { ok: false, msg: 'Espera al 🟢 Listo antes de simular' };
  if (_reconectando) {
    if (_reconnectStart && Date.now() - _reconnectStart > 25_000) {
      _reconectando = false;
      _reintentos = 0;
      if (_reintentoTimer) { clearTimeout(_reintentoTimer); _reintentoTimer = null; }
    } else {
      return { ok: false, msg: '📞 Ya se está reconectando — deja que termine' };
    }
  }

  const sonaba =
    !!_contexto?.reproduciendo && Date.now() - (_contexto?.momento || 0) < REANUDAR_MAX_MS;

  // 1) 📞 la llamada "se lleva" la conexión — la app no se entera
  try { _player.disconnect(); } catch { /* ya estaba muerto */ }

  // 2) síntoma: el dispositivo dejó de estar listo
  if (_timerNotReady) clearTimeout(_timerNotReady);
  emitir({ listo: false, mensaje: '🧪 Llamada simulada — probando el anti-cuelgue…' });
  _timerNotReady = setTimeout(() => {
    if (!_estado.listo) void _reconectarPlayer('simulacion-llamada');
  }, 3_000);

  return {
    ok: true,
    msg: sonaba
      ? '📞 Llamada simulada — la música vuelve sola en unos segundos'
      : '📞 Llamada simulada — el reproductor revive solo (no sonaba nada)',
  };
}

// ══ FIN PARTE 1 ══

async function _reconectarPlayer(motivo: string): Promise<boolean> {
  if (_reconectando) return false;
  if (!getAccessToken() && !hayRefreshToken()) return false;
  _reconectando = true;
  _reconnectStart = Date.now();
  _fallosDevices = 0;
  if (_reintentoTimer) { clearTimeout(_reintentoTimer); _reintentoTimer = null; }
  const contexto = _contexto;
  emitir({ estado: 'reconectando', listo: false, mensaje: '📞 La llamada cortó el reproductor — reconectando…' });
  try {
    // el token vivo: localStorage, o el de memoria (Android a veces
    // limpia el storage con la app abierta y el player seguía sonando)
    let token = tokenGuardadoFresco() || _accessToken;
    if (!token) {
      if (!hayRefreshToken()) throw new Error('sin-token');
      if (!(await spotifyRefreshToken())) throw new Error('sin-token');
      token = _accessToken;
    }
    if (!token) throw new Error('sin-token');

    // ═══ PASO 1: REVIVIR EL MISMO PLAYER ═══
    // Se le pide al SDK que reconecte su WebSocket (player.connect())
    // y se conserva el device_id → sin carreras entre players. Era la
    // pieza que faltaba en RiderTrack F3.32: crear un player NUEVO al
    // toque enredaba el WebSocket del viejo → nunca quedaba "listo".
    if (_player) {
      try {
        const revivió = await conTimeout(_player.connect(), 8_000, 'revive');
        if (revivió && _deviceId) {
          if (contexto?.reproduciendo && Date.now() - contexto.momento < REANUDAR_MAX_MS) {
            await _reanudar(contexto);
            emitir({ estado: 'listo', listo: true, mensaje: '🎶 Recuperado tras la llamada' });
          } else {
            emitir({ estado: 'listo', listo: true, mensaje: '🟢 Listo · FitTrack 🏋️' });
          }
          _reintentos = 0;
          _reconectando = false;
          return true;
        }
      } catch { /* no revivió → paso 2: player nuevo */ }
    }

    // ═══ PASO 2: PLAYER NUEVO — se le QUITAN los listeners al viejo
    // (que sus not_ready fantasma no reprogramen nada) y se espera
    // 1.2s a que su WebSocket cierre DE VERDAD antes de crear el nuevo.
    if (_player) {
      try { _player.removeAllListeners?.(); } catch {}
      try { _player.disconnect(); } catch {}
      _player = null;
      _deviceId = null;
      await new Promise<void>((r) => setTimeout(r, 1_200));
    }
    await conTimeout(
      new Promise<void>((res) => { crearPlayer(token!, res); }),
      AJUSTES_RECONEXION.readyTimeoutMs, 'ready',
    );
    // ¿sonaba? → que vuelva a sonar donde estaba
    if (contexto?.reproduciendo && Date.now() - contexto.momento < REANUDAR_MAX_MS) {
      await _reanudar(contexto);
      emitir({ estado: 'listo', listo: true, mensaje: '🎶 Recuperado tras la llamada' });
    } else {
      emitir({ estado: 'listo', listo: true, mensaje: '🟢 Listo · FitTrack 🏋️' });
    }
    _reintentos = 0;
    _reconectando = false;
    return true;
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('sin-token')) {
      emitir({ estado: 'error', mensaje: 'Sesión vencida — vuelve a conectar Spotify' });
      _reconectando = false;
    } else if (_reintentos < AJUSTES_RECONEXION.reintentosMs.length) {
      const espera = AJUSTES_RECONEXION.reintentosMs[_reintentos] || 60_000;
      _reintentos++;
      emitir({ mensaje: `⚠️ Spotify no responde — reintento en ${Math.round(espera / 1000)}s…` });
      _reintentoTimer = setTimeout(() => {
        _reconectando = false;
        void _reconectarPlayer('reintento');
      }, espera);
      return false; // _reconectando queda TRUE para dedupe hasta que dispare
    } else {
      emitir({ estado: 'error', mensaje: 'No se pudo reconectar — toca ▶ para reintentar' });
      _reconectando = false;
    }
  }
  return false;
}

/** Reanuda lo que sonaba: primero lo que Spotify recuerda (sigue
 *  el tema donde iba), y si ya no hay nada activo, el último
 *  contexto conocido (playlist o tema + posición). */
async function _reanudar(c: ContextoReproduccion): Promise<void> {
  if (!_accessToken || !_deviceId) return;
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`;
  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + _accessToken },
    });
    if (r.ok || r.status === 204) return;
  } catch { /* sin red: el usuario tocará play */ }
  try {
    const body: Record<string, any> = {};
    if (c.uri && !c.esMegusta) body.context_uri = c.uri;
    else if (c.trackUri) {
      body.uris = [c.trackUri];
      if (c.posicionMs > 5000) body.position_ms = c.posicionMs;
    } else return;
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + _accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { /* idem */ }
}

// ── Web Playback SDK ──
declare global {
  interface Window { Spotify?: any; onSpotifyWebPlaybackSDKReady?: () => void; }
}

function cargarSdk(): Promise<void> {
  if (_sdkCargado || _cargandoSdk) return Promise.resolve();
  _cargandoSdk = true;
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => { _sdkCargado = true; resolve(); };
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => { _cargandoSdk = false; resolve(); };
    document.head.appendChild(s);
  });
}

let _player: any = null;
export function getPlayer(): any { return _player; }

/** Arranca el SDK + player con el token dado (idéntico al viejo) */
export async function iniciarSpotify(token: string): Promise<void> {
  _accessToken = token;
  emitir({ conectado: true, estado: 'conectando', mensaje: '🟡 Conectando...' });

  await cargarSdk();
  if (!window.Spotify) {
    emitir({ estado: 'error', mensaje: '⚠️ No se pudo cargar el SDK de Spotify (revisa tu conexión)' });
    return;
  }
  crearPlayer(token);
}

function crearPlayer(token: string, alListo?: () => void): void {
  if (_player) { try { _player.disconnect(); } catch {} _player = null; }
  _player = new window.Spotify.Player({
    name: 'FitTrack 🏋️',
    getOAuthToken: (cb: (t: string) => void) => { cb(_accessToken || token); },
    volume: 0.8,
  });

  _player.addListener('ready', (e: any) => {
    _deviceId = e.device_id;
    emitir({ estado: 'listo', listo: true, mensaje: '🟢 Listo · FitTrack 🏋️' });
    transferirPlayback(e.device_id);
    _arrancarWatchdog(); // 📞 vigilar que la llamada no lo mate
    alListo?.();
  });
  _player.addListener('not_ready', () => {
    emitir({ listo: false, mensaje: '🔴 Desconectado' });
    // 📞 el not_ready es el síntoma clásico de la llamada —
    // si no revive solo en 3s → reconectar (player nuevo)
    if (_timerNotReady) clearTimeout(_timerNotReady);
    _timerNotReady = setTimeout(() => {
      if (!_estado.listo) void _reconectarPlayer('not-ready');
    }, 3_000);
  });
  _player.addListener('player_state_changed', (state: any) => {
    if (!state) return;
    const t = state.track_window?.current_track;
    if (t) {
      // 📞 recordar lo que suena → para reanudar tras la llamada
      _contexto = {
        uri: _contexto?.uri || null,
        esMegusta: _contexto?.esMegusta || false,
        trackUri: t.uri || null,
        posicionMs: state.position || 0,
        reproduciendo: !state.paused,
        momento: Date.now(),
      };
      emitir({
        track: {
          id: t.id || null,
          nombre: t.name || '',
          artista: (t.artists || []).map((a: any) => a.name).join(', '),
          album: t.album?.name || '',
          imagen: t.album?.images?.[0]?.url || null,
          duracionMs: state.duration || 0,
          posicionMs: state.position || 0,
          reproduciendo: !state.paused,
        },
        liked: false,
      });
      if (t.id) chequearLike(t.id);
    }
  });
  _player.addListener('initialization_error', (e: any) => console.warn('SP init error:', e));
  _player.addListener('authentication_error', async (e: any) => {
    console.warn('SP auth error:', e);
    const ok = await spotifyRefreshToken();
    if (!ok) emitir({ estado: 'error', mensaje: 'Sesión vencida — vuelve a conectar Spotify' });
  });
  _player.addListener('account_error', () => {
    emitir({ estado: 'requiere-premium', mensaje: '⚠️ Spotify Premium requerido para reproducir en la app' });
  });
  _player.connect();
}

/** Mueve la reproducción de Spotify a este dispositivo (sin arrancarla) */
export async function transferirPlayback(deviceId: string): Promise<void> {
  if (!_accessToken || !deviceId) return;
  try {
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + _accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
  } catch {}
}

/** Asegura token vivo antes de llamar a la API */
async function _token(): Promise<string | null> {
  if (_accessToken) return _accessToken;
  const fresco = tokenGuardadoFresco();
  if (fresco) { _accessToken = fresco; return fresco; }
  if (await spotifyRefreshToken()) return _accessToken;
  return null;
}

async function _api(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await _token();
  if (!token) throw new Error('sin token');
  const r = await fetch('https://api.spotify.com/v1' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 204) return null;
  return r.json();
}

// ── Controles (misma lógica robusta · con timeout anti-cuelgue) ──
export async function spotifyTogglePlay(): Promise<void> {
  // 🩹 si hay una reconexión en curso NO se apila más trabajo; pero
  // si lleva >25s atascada, el propio ▶ la libera — siempre hay salida.
  if (_reconectando) {
    if (_reconnectStart && Date.now() - _reconnectStart > 25_000) {
      _reconectando = false;
      _reintentos = 0;
      if (_reintentoTimer) { clearTimeout(_reintentoTimer); _reintentoTimer = null; }
    } else {
      emitir({ mensaje: '⏳ Reconectando — dame unos segundos y vuelve a tocar ▶' });
      return;
    }
  }
  const p = _player;
  if (p) {
    try {
      const state = await conTimeout(p.getCurrentState(), 2_500, 'estado');
      if (!state && _accessToken && _deviceId) {
        // el player se desconectó (llamada lo pausó) → forzar por API
        try {
          const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + _accessToken },
          });
          if (r.ok || r.status === 204) return;
          if (r.status === 404 || r.status === 500) {
            void _reconectarPlayer('toggle-404');
            return;
          }
        } catch { /* sin red */ }
        try { await conTimeout(p.togglePlay(), 3_000, 'toggle'); }
        catch { void _reconectarPlayer('toggle-muerto'); }
        return;
      }
      await conTimeout(p.togglePlay(), 3_000, 'toggle');
    } catch {
      // ni el estado responde: el WebSocket murió con la llamada
      void _reconectarPlayer('toggle-timeout');
    }
    return;
  }
  try {
    const d = await _api('/me/player');
    if (!d || !d.is_playing) await _api('/me/player/play', { method: 'PUT' });
    else await _api('/me/player/pause', { method: 'PUT' });
  } catch {}
}

export async function spotifyNext(): Promise<void> {
  if (_player) {
    try { await conTimeout(_player.nextTrack(), 3_000, 'next'); return; }
    catch { void _reconectarPlayer('next'); return; }
  }
  try { await _api('/me/player/next', { method: 'POST' }); } catch {}
}
export async function spotifyPrev(): Promise<void> {
  if (_player) {
    try { await conTimeout(_player.previousTrack(), 3_000, 'prev'); return; }
    catch { void _reconectarPlayer('prev'); return; }
  }
  try { await _api('/me/player/previous', { method: 'POST' }); } catch {}
}
export async function spotifyVolume(pct: number): Promise<void> {
  if (_player) {
    try { await conTimeout(_player.setVolume(Math.max(0, Math.min(1, pct / 100))), 2_000, 'volume'); return; }
    catch { return; } // volumen no dispara reconexión (se arrastra mucho)
  }
  try { await _api(`/me/player/volume?volume_percent=${Math.round(pct)}`, { method: 'PUT' }); } catch {}
}
export async function spotifySeek(ms: number): Promise<void> {
  if (_player) {
    try { await conTimeout(_player.seek(Math.round(ms)), 3_000, 'seek'); return; }
    catch { void _reconectarPlayer('seek'); return; }
  }
  try { await _api(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: 'PUT' }); } catch {}
}
export async function spotifyShuffle(on: boolean): Promise<boolean> {
  try { await _api(`/me/player/shuffle?state=${on}`, { method: 'PUT' }); return on; } catch { return !on; }
}
export async function spotifyRepeat(mode: 0 | 1 | 2): Promise<0 | 1 | 2> {
  const estados = ['off', 'context', 'track'];
  try { await _api(`/me/player/repeat?state=${estados[mode]}`, { method: 'PUT' }); return mode; } catch { return 0; }
}

async function chequearLike(trackId: string): Promise<void> {
  try {
    const d = await _api(`/me/tracks/contains?ids=${trackId}`);
    emitir({ liked: Array.isArray(d) ? !!d[0] : false });
  } catch {}
}
export async function spotifyToggleLike(): Promise<boolean> {
  const trackId = _estado.track?.id;
  if (!trackId) return false;
  try {
    if (_estado.liked) {
      await _api(`/me/tracks?ids=${trackId}`, { method: 'DELETE' });
      emitir({ liked: false });
      return false;
    }
    await _api(`/me/tracks?ids=${trackId}`, { method: 'PUT' });
    emitir({ liked: true });
    return true;
  } catch { return _estado.liked; }
}

// ── Playlists (NUEVO vs viejo — para arrancar la música desde la app) ──
export interface SpotifyPlaylist {
  id: string;
  nombre: string;
  imagen: string | null;
  total: number;
  uri: string;
}

export async function spotifyMisPlaylists(): Promise<SpotifyPlaylist[]> {
  const d = await _api('/me/playlists?limit=30');
  return (d?.items || [])
    .filter((p: any) => p && p.uri)
    .map((p: any) => ({
      id: p.id,
      nombre: p.name || 'Sin nombre',
      imagen: p.images?.[0]?.url || null,
      total: p.tracks?.total || 0,
      uri: p.uri,
    }));
}

/** Suena una playlist en ESTE dispositivo (FitTrack 🏋️) */
export async function spotifyTocarPlaylist(uri: string): Promise<boolean> {
  const token = await _token();
  if (!token || !_deviceId) return false;
  try {
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: uri }),
    });
    _contexto = { uri, esMegusta: false, trackUri: _contexto?.trackUri || null, posicionMs: 0, reproduciendo: true, momento: Date.now() };
    return true;
  } catch { return false; }
}

/** "Tus me gusta" no tiene context_uri → se toca por uris de temas */
export async function spotifyTocarMeGusta(): Promise<boolean> {
  const token = await _token();
  if (!token || !_deviceId) return false;
  try {
    const d = await _api('/me/tracks?limit=50');
    const uris = (d?.items || []).map((i: any) => i?.track?.uri).filter(Boolean);
    if (!uris.length) return false;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });
    _contexto = { uri: null, esMegusta: true, trackUri: _contexto?.trackUri || null, posicionMs: 0, reproduciendo: true, momento: Date.now() };
    return true;
  } catch { return false; }
}

// ── Logout ──
export function spotifyLogout(): void {
  if (_player) { try { _player.disconnect(); } catch {} _player = null; }
  _accessToken = null;
  _deviceId = null;
  [KEY_TOKEN, KEY_TOKEN_TIME, KEY_REFRESH, KEY_VERIFIER].forEach((k) => localStorage.removeItem(k));
  // 📞 apagar el watchdog y olvidar el contexto
  _pararWatchdog();
  if (_reintentoTimer) { clearTimeout(_reintentoTimer); _reintentoTimer = null; }
  _contexto = null;
  _reconectando = false;
  _reintentos = 0;
  _estado = _estadoBase();
  _listeners.forEach((l) => l(_estado));
}


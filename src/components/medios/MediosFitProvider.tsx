// ═══════════════════════════════════════════════════════════
// 🎛️ MEDIOS FIT PROVIDER — FitTrack V2 (F5 · Extras)
// Estado GLOBAL de radio + Spotify, montado en App:
//   • El <audio> de radio y el player de Spotify viven AQUÍ (no
//     en la vista) → la música sigue sonando al cambiar de vista
//     (Dashboard, Entreno, Historial…), como los FABs del viejo
//   • Solo una fuente suena a la vez: al arrancar una, pausa la
//     otra (el viejo sonaba lo que agarraras primero)
//   • FABs flotantes apilados a la derecha (GymChat con badge de
//     no leídos, Spotify, Radio) + mini-pill de "suena ahora",
//     igual que el app viejo
//   • Restauración de sesión Spotify al montar (token fresco o
//     refresh — el viejo pedía reconectar cada ~1h)
//   • Publica el perfil de GymChat (fittrack_usuarios) para que
//     te encuentren por código apenas entras, y mantiene el
//     badge de no leídos con la MISMA suscripción del inbox
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, Music, Radio as RadioIcon, Play, Pause, Loader2 } from 'lucide-react';
import { RadioEngine, RadioEstado, RADIOS, type RadioEstacion } from '../../services/radioFit';
import {
  SpotifyEstado, subscribeSpotify, spotifyLogin, spotifyTogglePlay, spotifyNext, spotifyPrev,
  spotifyVolume, spotifySeek, spotifyToggleLike, spotifyLogout, spotifyMisPlaylists,
  SpotifyPlaylist, spotifyTocarPlaylist, spotifyTocarMeGusta,
  tokenGuardadoFresco, hayRefreshToken, spotifyRefreshToken, iniciarSpotify, getAccessToken,
} from '../../services/spotify';
import { suscribirInbox, totalNoLeidos, publicarPerfilGym, type ChatResumen } from '../../services/gymchat';
import type { VistaApp } from '../../types';

interface MediosFitContexto {
  radio: RadioEstado;
  radioVolumen: number;
  radioPlay: (idEstacion: string) => void;
  radioToggle: () => void;
  radioDetener: () => void;
  radioSetVolumen: (v: number) => void;

  spotify: SpotifyEstado;
  playlists: SpotifyPlaylist[];
  playlistsCargando: boolean;
  recargarPlaylists: () => void;
  spotifyConectar: () => void;
  spotifyToggle: () => void;
  spotifySiguiente: () => void;
  spotifyAnterior: () => void;
  spotifySetVolumen: (pct: number) => void;
  spotifyBuscar: (ms: number) => void;
  spotifyLike: () => void;
  spotifyDesconectar: () => void;
  spotifyTocar: (uri: string) => void;
  spotifyTocarMegusta: () => void;
}

const Ctx = createContext<MediosFitContexto | null>(null);

export function useMediosFit(): MediosFitContexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMediosFit fuera de MediosFitProvider');
  return c;
}

interface Props {
  children: React.ReactNode;
  /** para navegar desde los FABs y el mini-pill */
  onAbrirVista: (v: VistaApp) => void;
  /** vista ACTIVA (oculta los FABs/mini-pill cuando ya estás ahí) */
  vista: VistaApp;
  /** uid real (null en demo) — para GymChat: perfil + badge */
  uid: string | null;
  /** nombre preferido (FITTRACK_USER_NAME / onboarding) */
  nombre: string;
}

export function MediosFitProvider({ children, onAbrirVista, vista, uid, nombre }: Props) {
  // ── Radio: UN motor global ──
  const engineRef = useRef<RadioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new RadioEngine();
  const engine = engineRef.current;

  const [radio, setRadio] = useState<RadioEstado>(engine.estado);
  const [radioVolumen, setRadioVolumen] = useState<number>(engine.volumen);
  useEffect(() => {
    engine.onCambio = (e) => setRadio({ ...e });
    return () => { engine.onCambio = null; };
  }, [engine]);

  // ── Spotify: estado del servicio ──
  const [spotify, setSpotify] = useState<SpotifyEstado>({
    conectado: false, listo: false, estado: 'desconectado', mensaje: '',
    track: null, shuffle: false, repeat: 0, liked: false,
  });
  useEffect(() => subscribeSpotify(setSpotify), []);

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsCargando, setPlaylistsCargando] = useState(false);

  const recargarPlaylists = useCallback(() => {
    if (!getAccessToken() && !tokenGuardadoFresco() && !hayRefreshToken()) return;
    setPlaylistsCargando(true);
    spotifyMisPlaylists()
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setPlaylistsCargando(false));
  }, []);

  // Restaurar sesión al montar (el viejo pedía reconectar cada ~1h)
  useEffect(() => {
    const fresco = tokenGuardadoFresco();
    if (fresco) { iniciarSpotify(fresco); return; }
    if (hayRefreshToken()) {
      spotifyRefreshToken().then((ok) => {
        if (ok && getAccessToken()) iniciarSpotify(getAccessToken()!);
      }).catch(() => {});
    }
  }, []);

  // Playlists cuando el dispositivo queda listo
  const listoAntes = useRef(false);
  useEffect(() => {
    if (spotify.listo && !listoAntes.current) recargarPlaylists();
    listoAntes.current = spotify.listo;
  }, [spotify.listo, recargarPlaylists]);

  // ── GymChat: perfil público + badge de no leídos ──
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const noLeidos = totalNoLeidos(chats);
  useEffect(() => {
    if (!uid) return;
    publicarPerfilGym(uid, nombre);
    return suscribirInbox(uid, setChats);
  }, [uid, nombre]);

  // ── Solo una fuente a la vez ──
  const radioPlay = useCallback((idEstacion: string) => {
    const est = RADIOS.find((r) => r.id === idEstacion);
    if (!est) return;
    // si Spotify estaba sonando en ESTE dispositivo → pausa cortés
    if (spotify.track?.reproduciendo && spotify.listo) void spotifyTogglePlay();
    void engine.play(est);
  }, [engine, spotify.track?.reproduciendo, spotify.listo]);

  const radioToggle = useCallback(() => engine.toggle(), [engine]);
  const radioDetener = useCallback(() => engine.detener(), [engine]);
  const radioSetVolumen = useCallback((v: number) => {
    engine.setVolumen(v);
    setRadioVolumen(v);
  }, [engine]);

  const spotifyConectar = useCallback(() => { void spotifyLogin(); }, []);

  const spotifyTocar = useCallback((uri: string) => {
    if (radio.reproduciendo) engine.pausar(); // pausa cortés
    void spotifyTocarPlaylist(uri);
  }, [radio.reproduciendo, engine]);

  const spotifyTocarMegusta = useCallback(() => {
    if (radio.reproduciendo) engine.pausar();
    void spotifyTocarMeGusta();
  }, [radio.reproduciendo, engine]);

  const spotifyDesconectar = useCallback(() => {
    spotifyLogout();
    setPlaylists([]);
  }, []);

  const valor: MediosFitContexto = {
    radio, radioVolumen, radioPlay, radioToggle, radioDetener, radioSetVolumen,
    spotify, playlists, playlistsCargando, recargarPlaylists,
    spotifyConectar,
    spotifyToggle: () => { void spotifyTogglePlay(); },
    spotifySiguiente: () => { void spotifyNext(); },
    spotifyAnterior: () => { void spotifyPrev(); },
    spotifySetVolumen: (pct: number) => { void spotifyVolume(pct); },
    spotifyBuscar: (ms: number) => { void spotifySeek(ms); },
    spotifyLike: () => { void spotifyToggleLike(); },
    spotifyDesconectar, spotifyTocar, spotifyTocarMegusta,
  };

  // ── FABs y mini-pill ocultos cuando YA estás en esa vista ──
  const enExtras = vista === 'gymchat' || vista === 'spotify' || vista === 'radio';
  const mostrarPillSpotify = !enExtras && spotify.conectado && !!spotify.track;
  const mostrarPillRadio = !enExtras && radio.estacion !== null;

  return (
    <Ctx.Provider value={valor}>
      {children}

      {/* Mini-pill: "suena ahora" (arriba de los FABs, como el viejo) */}
      {(mostrarPillSpotify || mostrarPillRadio) && (
        <button
          data-testid="pill-ahora-suena"
          onClick={() => onAbrirVista(mostrarPillSpotify ? 'spotify' : 'radio')}
          className="fixed right-4 bottom-[252px] z-30 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl bg-slate-800/95 backdrop-blur-xl border border-slate-600 shadow-2xl max-w-[230px] hover:border-emerald-500/60 transition-colors"
        >
          {mostrarPillSpotify && spotify.track ? (
            <>
              {spotify.track.imagen ? (
                <img src={spotify.track.imagen} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <Music className="w-5 h-5 text-[#1DB954] shrink-0" />
              )}
              <span className="min-w-0 text-left flex-1">
                <span className="block text-[11px] font-bold text-white truncate">{spotify.track.nombre}</span>
                <span className="block text-[10px] text-slate-400 truncate">{spotify.track.artista}</span>
              </span>
              <span
                role="button"
                aria-label="Pausar o reanudar"
                onClick={(e) => { e.stopPropagation(); valor.spotifyToggle(); }}
                className="w-8 h-8 rounded-full bg-[#1DB954] text-black flex items-center justify-center shrink-0"
              >
                {spotify.track.reproduciendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </span>
            </>
          ) : radio.estacion ? (
            <>
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ background: (radio.estacion as RadioEstacion).color + '33' }}
              >
                {(radio.estacion as RadioEstacion).emoji}
              </span>
              <span className="min-w-0 text-left flex-1">
                <span className="block text-[11px] font-bold text-white truncate">{radio.estacion.nombre}</span>
                <span className="block text-[10px] text-emerald-400">
                  {radio.cargando ? 'cargando…' : radio.reproduciendo ? 'EN VIVO' : 'en pausa'}
                </span>
              </span>
              <span
                role="button"
                aria-label="Pausar o reanudar radio"
                onClick={(e) => { e.stopPropagation(); radioToggle(); }}
                className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"
              >
                {radio.cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : radio.reproduciendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </span>
            </>
          ) : null}
        </button>
      )}

      {/* FABs apilados a la derecha (mismo layout del viejo) */}
      {!enExtras && (
        <>
          <button
            onClick={() => onAbrirVista('gymchat')}
            data-testid="fab-gymchat"
            title="GymChat"
            className="fixed right-4 bottom-[196px] z-30 w-[52px] h-[52px] rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 flex items-center justify-center active:scale-95 transition-transform hover:bg-emerald-500"
          >
            <MessageCircle className="w-6 h-6" />
            {noLeidos > 0 && (
              <span
                data-testid="badge-gymchat"
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-900"
              >
                {noLeidos}
              </span>
            )}
          </button>

          <button
            onClick={() => onAbrirVista('spotify')}
            data-testid="fab-spotify"
            title="Spotify"
            className="fixed right-4 bottom-[140px] z-30 w-[52px] h-[52px] rounded-2xl bg-[#1DB954] text-black shadow-xl shadow-emerald-900/40 flex items-center justify-center active:scale-95 transition-transform hover:brightness-110"
          >
            <Music className="w-6 h-6" />
          </button>

          <button
            onClick={() => onAbrirVista('radio')}
            data-testid="fab-radio"
            title="Radio Peruana"
            className="fixed right-4 bottom-[84px] z-30 w-[52px] h-[52px] rounded-2xl bg-orange-600 text-white shadow-xl shadow-orange-900/40 flex items-center justify-center active:scale-95 transition-transform hover:bg-orange-500"
          >
            <RadioIcon className="w-6 h-6" />
          </button>
        </>
      )}
    </Ctx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════
// 🎛️ MEDIOS FIT PROVIDER — FitTrack V2 (F5.1 · Medios)
// Estado GLOBAL de radio + Spotify + YouTube + podcasts, montado
// en App:
//   • El <audio> de radio, el player de Spotify, el iframe de
//     YouTube y el <audio> de podcasts viven AQUÍ (no en la
//     vista) → el audio sigue sonando al cambiar de vista
//   • Solo UNA fuente suena a la vez: al arrancar una, pausa
//     las otras tres (cortesía cruzada)
//   • F5.1: FUERA los FABs/burbujas — el apartado Medios de la
//     barra inferior abre todo; queda el MiniPlayerFit (barra
//     sobre la nav + video PiP de YouTube, como RiderTrack)
//   • Restauración de sesión Spotify al montar (token fresco o
//     refresh — el viejo pedía reconectar cada ~1h)
//   • Publica el perfil de GymChat (fittrack_usuarios) para que
//     te encuentren por código apenas entras, y deja el badge
//     de no leídos (chatNoLeidos) para el ítem Chat de la nav
//   • Podcasts: estado por usuario en localStorage (ft_pod_*)
//     — puerto del RiderTrack F3.43 SIN Firestore (cero reglas)
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RadioEngine, RadioEstado, RADIOS } from '../../services/radioFit';
import {
  SpotifyEstado, subscribeSpotify, spotifyLogin, spotifyTogglePlay, spotifyNext, spotifyPrev,
  spotifyVolume, spotifySeek, spotifyToggleLike, spotifyLogout, spotifyMisPlaylists,
  SpotifyPlaylist, spotifyTocarPlaylist, spotifyTocarMeGusta,
  tokenGuardadoFresco, hayRefreshToken, spotifyRefreshToken, iniciarSpotify, getAccessToken,
} from '../../services/spotify';
import {
  YouTubeEstado, YT_CONTAINER_ID, subscribeYouTube, getEstadoYouTube, tocarYouTube,
  ytTogglePlay, ytDetener, extraerVideoId,
} from '../../services/mediosYouTube';
import {
  EstadoPodcastsRSS, EpisodioRSS, snapshotPodcastsRSS, suscribirPodcastsRSS, arrancarPodcastsRSS,
  tocarEpisodioRSS, pausarEpisodioRSS, toggleEpisodioRSS, detenerEpisodioRSS,
  saltarEpisodioRSS, fijarVelocidadRSS,
} from '../../services/podcastRSS';
import { suscribirInbox, totalNoLeidos, publicarPerfilGym, type ChatResumen } from '../../services/gymchat';
import type { VistaApp } from '../../types';
import { MiniPlayerFit } from './MiniPlayerFit';

/** re-export para el mini-player (contenedor persistente del iframe) */
export { YT_CONTAINER_ID };

export type FuenteMedia = 'radio' | 'spotify' | 'youtube' | 'podcast';

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

  youtube: YouTubeEstado;
  youtubeTocar: (urlOId: string) => boolean;
  youtubeToggle: () => void;
  youtubeDetener: () => void;

  podcast: EstadoPodcastsRSS;
  podcastTocar: (ep: EpisodioRSS) => void;
  podcastToggle: () => void;
  podcastDetener: () => void;
  podcastSaltar: (seg: number) => void;
  podcastVelocidad: (v: number) => void;

  /** qué fuente manda ahora (para el mini-reproductor) */
  fuenteActiva: FuenteMedia | null;
  algoCargado: boolean;
  /** badge de no leídos de GymChat (ítem Chat de la nav) */
  chatNoLeidos: number;
}

const Ctx = createContext<MediosFitContexto | null>(null);

export function useMediosFit(): MediosFitContexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMediosFit fuera de MediosFitProvider');
  return c;
}

interface Props {
  children: React.ReactNode;
  /** para abrir el apartado Medios desde el mini-reproductor */
  onAbrirVista: (v: VistaApp) => void;
  /** vista ACTIVA (agrandar el PiP de YouTube dentro de Medios) */
  vista: VistaApp;
  /** uid real (null en demo) — GymChat + claves por usuario de podcasts */
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

  // ── YouTube: estado del motor (F5.1) ──
  const [youtube, setYoutube] = useState<YouTubeEstado>(getEstadoYouTube());
  useEffect(() => subscribeYouTube(setYoutube), []);

  // ── Podcasts: estado del servicio (F5.1, local por uid) ──
  const [podcast, setPodcast] = useState<EstadoPodcastsRSS>(snapshotPodcastsRSS());
  useEffect(() => {
    const cb = () => setPodcast(snapshotPodcastsRSS());
    const off = suscribirPodcastsRSS(cb);
    cb();
    return off;
  }, []);
  useEffect(() => {
    if (!uid) return; // demo: suena, pero no persiste entre sesiones
    return arrancarPodcastsRSS(uid);
  }, [uid]);

  // ── GymChat: perfil público + badge de no leídos ──
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const chatNoLeidos = totalNoLeidos(chats);
  useEffect(() => {
    if (!uid) return;
    publicarPerfilGym(uid, nombre);
    return suscribirInbox(uid, setChats);
  }, [uid, nombre]);

  // ── La última fuente que arrancó manda (mini-reproductor) ──
  const [ultimaFuente, setUltimaFuente] = useState<FuenteMedia | null>(null);

  // ── Solo UNA fuente a la vez (cortesía cruzada de las 4) ──
  const radioPlay = useCallback((idEstacion: string) => {
    const est = RADIOS.find((r) => r.id === idEstacion);
    if (!est) return;
    if (spotify.track?.reproduciendo && spotify.listo) void spotifyTogglePlay();
    if (youtube.reproduciendo) ytTogglePlay();
    pausarEpisodioRSS();
    setUltimaFuente('radio');
    void engine.play(est);
  }, [engine, spotify.track?.reproduciendo, spotify.listo, youtube.reproduciendo]);

  const radioToggle = useCallback(() => engine.toggle(), [engine]);
  const radioDetener = useCallback(() => engine.detener(), [engine]);
  const radioSetVolumen = useCallback((v: number) => {
    engine.setVolumen(v);
    setRadioVolumen(v);
  }, [engine]);

  const spotifyConectar = useCallback(() => { void spotifyLogin(); }, []);

  const spotifyTocar = useCallback((uri: string) => {
    if (radio.reproduciendo) engine.pausar();
    if (youtube.reproduciendo) ytTogglePlay();
    pausarEpisodioRSS();
    setUltimaFuente('spotify');
    void spotifyTocarPlaylist(uri);
  }, [radio.reproduciendo, engine, youtube.reproduciendo]);

  const spotifyTocarMegusta = useCallback(() => {
    if (radio.reproduciendo) engine.pausar();
    if (youtube.reproduciendo) ytTogglePlay();
    pausarEpisodioRSS();
    setUltimaFuente('spotify');
    void spotifyTocarMeGusta();
  }, [radio.reproduciendo, engine, youtube.reproduciendo]);

  const spotifyDesconectar = useCallback(() => {
    spotifyLogout();
    setPlaylists([]);
  }, []);

  const youtubeTocar = useCallback((urlOId: string): boolean => {
    const id = extraerVideoId(urlOId);
    if (!id) return false;
    if (spotify.track?.reproduciendo && spotify.listo) void spotifyTogglePlay();
    if (radio.reproduciendo) engine.pausar();
    pausarEpisodioRSS();
    setUltimaFuente('youtube');
    void tocarYouTube(id, YT_CONTAINER_ID);
    return true;
  }, [engine, spotify.track?.reproduciendo, spotify.listo, radio.reproduciendo]);

  const youtubeToggle = useCallback(() => { ytTogglePlay(); }, []);
  const youtubeDetener = useCallback(() => { ytDetener(); }, []);

  const podcastTocar = useCallback((ep: EpisodioRSS) => {
    if (spotify.track?.reproduciendo && spotify.listo) void spotifyTogglePlay();
    if (radio.reproduciendo) engine.pausar();
    if (youtube.reproduciendo) ytTogglePlay();
    setUltimaFuente('podcast');
    void tocarEpisodioRSS(ep);
  }, [engine, spotify.track?.reproduciendo, spotify.listo, radio.reproduciendo, youtube.reproduciendo]);

  const podcastToggle = useCallback(() => { toggleEpisodioRSS(); }, []);
  const podcastDetener = useCallback(() => { detenerEpisodioRSS(); }, []);
  const podcastSaltar = useCallback((seg: number) => { saltarEpisodioRSS(seg); }, []);
  const podcastVelocidad = useCallback((v: number) => { fijarVelocidadRSS(v); }, []);

  // ── Qué fuente está "al mando" ──
  const fuenteActiva = useMemo<FuenteMedia | null>(() => {
    if (ultimaFuente === 'radio' && radio.estacion) return 'radio';
    if (ultimaFuente === 'spotify' && spotify.track) return 'spotify';
    if (ultimaFuente === 'youtube' && youtube.videoId) return 'youtube';
    if (ultimaFuente === 'podcast' && podcast.episodio) return 'podcast';
    if (radio.estacion) return 'radio';
    if (spotify.track) return 'spotify';
    if (youtube.videoId) return 'youtube';
    if (podcast.episodio) return 'podcast';
    return null;
  }, [ultimaFuente, radio.estacion, spotify.track, youtube.videoId, podcast.episodio]);
  const algoCargado = fuenteActiva !== null;

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
    youtube, youtubeTocar, youtubeToggle, youtubeDetener,
    podcast, podcastTocar, podcastToggle, podcastDetener, podcastSaltar, podcastVelocidad,
    fuenteActiva, algoCargado, chatNoLeidos,
  };

  return (
    <Ctx.Provider value={valor}>
      {children}
      {/* Mini-reproductor global (reemplaza a los FABs de la F5) */}
      <MiniPlayerFit mediosVisible={vista === 'medios'} onAbrirMedios={() => onAbrirVista('medios')} />
    </Ctx.Provider>
  );
}

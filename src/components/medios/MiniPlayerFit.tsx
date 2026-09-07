// ═══════════════════════════════════════════════════════════
// 🔊 MINI-PLAYER FIT — FitTrack V2 (F5.1 · Medios)
// Barra flotante abajo (SOBRE la nav inferior) con lo que está
// sonando (radio / Spotify / YouTube / podcast): pausar o cortar
// sin volver a Medios. Puerto del MiniPlayerReproductor de
// RiderTrack V2, adaptado:
//   • Incluye el contenedor PERSISTENTE del iframe de YouTube
//     (mini video PiP sobre la barra). ⚠️ Ese div vive SIEMPRE
//     en el DOM (aunque oculto) — si se desmontara, el video
//     se cortaría. El div interno no cambia props para no
//     pelearse con el iframe que crea la API de YouTube.
//   • Reemplaza a los FABs/burbujas de la F5 (adiós burbujas:
//     ahora todo se abre desde los apartados Medios y Chat).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Pause, Play, X, Music2, Youtube, Podcast as PodcastIcon } from 'lucide-react';
import { useMediosFit, YT_CONTAINER_ID } from './MediosFitProvider';
import { formatearTiempoPlayer } from '../../utils/podcastRssCore';
import { posicionVivaRSS } from '../../services/podcastRSS';

export const MiniPlayerFit: React.FC<{ mediosVisible?: boolean; onAbrirMedios?: () => void }> = ({
  mediosVisible = false,
  onAbrirMedios,
}) => {
  const m = useMediosFit();
  const { radio, spotify, youtube, podcast, fuenteActiva, algoCargado } = m;

  // posición viva del episodio (1 s, SOLO este componente — el
  // timeupdate del audio no re-renderiza toda la app)
  const [segMini, setSegMini] = useState(podcast.seg);
  useEffect(() => {
    setSegMini(podcast.seg);
    if (fuenteActiva !== 'podcast' || podcast.fase !== 'reproduciendo') return;
    const t = setInterval(() => setSegMini(posicionVivaRSS()), 1000);
    return () => clearInterval(t);
  }, [fuenteActiva, podcast.fase, podcast.seg, podcast.episodio?.url]);

  // Reserva un poco de espacio extra cuando la barra está visible
  useEffect(() => {
    document.body.style.paddingBottom = algoCargado ? '1rem' : '';
    return () => { document.body.style.paddingBottom = ''; };
  }, [algoCargado]);

  // ── Clases del contenedor de YouTube (siempre montado) ──
  const pipActivo = fuenteActiva === 'youtube' && !!youtube.videoId && !youtube.error;
  const clasesContenedor = !youtube.videoId
    // sin video: invisible pero en el DOM
    ? 'fixed bottom-0 right-0 w-px h-px overflow-hidden opacity-0 pointer-events-none'
    : pipActivo
      ? `fixed z-30 overflow-hidden rounded-xl border border-slate-700 bg-black shadow-2xl transition-all bottom-[124px] right-3 ${
          mediosVisible ? 'w-[calc(100%-1.5rem)] max-w-[340px] aspect-video' : 'w-40 aspect-video'
        }`
      // video cargado pero otra fuente activa o con error: escondido, sin destruirlo
      : 'fixed bottom-0 right-0 w-px h-px overflow-hidden opacity-0 pointer-events-none';

  // ── Qué mostrar en la barra según la fuente activa ──
  let icono: React.ReactNode = <Music2 className="w-4 h-4" />;
  let titulo = '';
  let subtitulo = '';
  let sonando = false;

  if (fuenteActiva === 'radio' && radio.estacion) {
    icono = <span className="text-base leading-none">{radio.estacion.emoji}</span>;
    titulo = radio.estacion.nombre;
    subtitulo = radio.cargando ? 'Conectando…' : radio.reproduciendo ? 'EN VIVO' : 'En pausa';
    sonando = radio.reproduciendo;
  } else if (fuenteActiva === 'spotify' && spotify.track) {
    icono = <Music2 className="w-4 h-4 text-[#1DB954]" />;
    titulo = spotify.track.nombre || 'Spotify';
    subtitulo = spotify.estado === 'reconectando'
      ? '📞 Reconectando…'
      : spotify.track.artista || '';
    sonando = spotify.estado === 'reconectando' ? false : spotify.track.reproduciendo;
  } else if (fuenteActiva === 'youtube' && youtube.videoId) {
    icono = <Youtube className="w-4 h-4 text-red-500" />;
    titulo = youtube.titulo || 'YouTube';
    subtitulo = youtube.cargando ? 'Cargando…' : youtube.reproduciendo ? 'Reproduciendo' : 'Pausado';
    sonando = youtube.reproduciendo;
  } else if (fuenteActiva === 'podcast' && podcast.episodio) {
    icono = <PodcastIcon className="w-4 h-4 text-violet-400" />;
    titulo = podcast.episodio.titulo;
    subtitulo = podcast.fase === 'cargando'
      ? 'Cargando…'
      : `${podcast.episodio.podcastTitulo} · ${formatearTiempoPlayer(segMini)}${podcast.velocidad !== 1 ? ` · ${podcast.velocidad}×` : ''}`;
    sonando = podcast.fase === 'reproduciendo';
  }

  const toggle = () => {
    if (fuenteActiva === 'radio') m.radioToggle();
    else if (fuenteActiva === 'spotify') m.spotifyToggle();
    else if (fuenteActiva === 'youtube') m.youtubeToggle();
    else if (fuenteActiva === 'podcast') m.podcastToggle();
  };
  const detener = () => {
    if (fuenteActiva === 'radio') m.radioDetener();
    else if (fuenteActiva === 'spotify') m.spotifyToggle(); // pausa cortés (no desconecta la sesión)
    else if (fuenteActiva === 'youtube') m.youtubeDetener();
    else if (fuenteActiva === 'podcast') m.podcastDetener();
  };

  return (
    <>
      {/* Contenedor PERSISTENTE del iframe de YouTube */}
      <div data-testid="yt-pip-container" className={clasesContenedor}>
        {/* div interno estable: la API de YouTube lo reemplaza por el iframe */}
        <div id={YT_CONTAINER_ID} className="w-full h-full" />
      </div>

      {/* Barra del mini-reproductor (sobre la nav inferior) */}
      {algoCargado && (
        <div
          data-testid="mini-player-bar"
          className="fixed bottom-[64px] left-3 right-3 z-30 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Icono + info (tocar → abre el apartado Medios) */}
            <div
              role="button"
              aria-label="Abrir Medios"
              onClick={() => onAbrirMedios?.()}
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sonando ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                {icono}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate leading-tight">{titulo}</div>
                <div className="text-[10px] text-slate-400 truncate leading-tight">{subtitulo}</div>
              </div>
              {sonando && (
                <div className="flex items-end gap-0.5 h-4 shrink-0">
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '60%', animation: 'ftEq 0.9s ease-in-out infinite' }} />
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '100%', animation: 'ftEq 0.7s ease-in-out infinite 0.1s' }} />
                  <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: '40%', animation: 'ftEq 1.1s ease-in-out infinite 0.2s' }} />
                </div>
              )}
            </div>

            {/* Play / Pausa */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
              aria-label={sonando ? 'Pausar' : 'Reproducir'}
            >
              {sonando ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Detener / cerrar */}
            <button
              onClick={detener}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
              aria-label="Detener"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

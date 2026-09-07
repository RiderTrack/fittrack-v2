// ═══════════════════════════════════════════════════════════
// 🎛️ MEDIOS VIEW — FitTrack V2 (F5.1 · Medios)
// El apartado "Medios" de la barra inferior: Spotify, Radio,
// YouTube y Podcasts en pestañas (estructura del MediosView
// de RiderTrack V2, adaptada al contexto FitTrack):
//   • Spotify / Radio: las vistas F5 tal cual, ahora como
//     pestañas (el audio vive en MediosFitProvider → sigue
//     sonando en toda la app)
//   • YouTube: puerto del TabYouTube de RiderTrack (pegás un
//     link y suena; el video flota como PiP mientras usás la
//     app) — motor en services/mediosYouTube.ts
//   • Podcasts: puerto del TabPodcasts de RiderTrack (novelas
//     y audiolibros por RSS, con memoria de posición) — motor
//     en services/podcastRSS.ts
//   • El mini-reproductor (abajo, sobre la barra de nav) sigue
//     visible en TODAS las vistas — ya no hay burbujas FAB.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  Music, Radio as RadioIcon, Youtube, Podcast as Podcasts,
  Play, Pause, Square, Star, Trash2, Link2, Check,
} from 'lucide-react';
import { useMediosFit } from './MediosFitProvider';
import { TabPodcasts } from './TabPodcasts';
import { SpotifyView } from '../SpotifyView';
import { RadioView } from '../RadioView';
import { leerFavoritosYT, guardarFavoritosYT, type VideoFavorito } from '../../services/mediosYouTube';

export type TabMedios = 'spotify' | 'radio' | 'youtube' | 'podcasts';

/** pedido externo de pestaña (deep link de Spotify → pestaña spotify) */
export interface PedidoTab {
  tab: TabMedios;
  nonce: number;
}

const TABS: { id: TabMedios; nombre: string; icono: React.ReactNode; activo: string }[] = [
  { id: 'spotify', nombre: 'Spotify', icono: <Music className="w-4 h-4" />, activo: 'bg-emerald-600 border-emerald-500 text-white' },
  { id: 'radio', nombre: 'Radio', icono: <RadioIcon className="w-4 h-4" />, activo: 'bg-blue-600 border-blue-500 text-white' },
  { id: 'youtube', nombre: 'YouTube', icono: <Youtube className="w-4 h-4" />, activo: 'bg-red-600 border-red-500 text-white' },
  { id: 'podcasts', nombre: 'Podcasts', icono: <Podcasts className="w-4 h-4" />, activo: 'bg-violet-600 border-violet-500 text-white' },
];

export const MediosView: React.FC<{ pedidoTab?: PedidoTab | null }> = ({ pedidoTab }) => {
  const [tab, setTab] = useState<TabMedios>('spotify');

  // deep link: "Conectar Spotify" → abrir el apartado en su pestaña
  useEffect(() => {
    if (pedidoTab) setTab(pedidoTab.tab);
  }, [pedidoTab?.nonce]);

  return (
    <div className="space-y-4 pb-4" data-testid="medios-view">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Music className="w-6 h-6 text-emerald-500" />
          Medios
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Tu música y audio mientras entrenas — sigue sonando en toda la app 🎧
        </p>
      </div>

      {/* Barra de pestañas (patrón RiderTrack) */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Medios">
        {TABS.map(({ id, nombre, icono, activo }) => {
          const activa = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              data-testid={`subtab-medios-${id}`}
              role="tab"
              aria-selected={activa}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 ${
                activa ? activo : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {icono}
              {nombre}
            </button>
          );
        })}
      </div>

      {/* Contenido por pestaña (sin lazy: los 4 motores son módulos ya cargados por el provider) */}
      {tab === 'spotify' && <SpotifyView />}
      {tab === 'radio' && <RadioView />}
      {tab === 'youtube' && <TabYouTube />}
      {tab === 'podcasts' && <TabPodcasts />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ▶️ YOUTUBE — puerto del TabYouTube de RiderTrack V2
// ═══════════════════════════════════════════════════════════
const TabYouTube: React.FC = () => {
  const m = useMediosFit();
  const { youtube } = m;
  const [url, setUrl] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [favoritos, setFavoritos] = useState<VideoFavorito[]>([]);
  const [yaGuardado, setYaGuardado] = useState(false);

  useEffect(() => {
    setFavoritos(leerFavoritosYT());
  }, []);

  useEffect(() => {
    setYaGuardado(!!youtube.videoId && favoritos.some((f) => f.id === youtube.videoId));
  }, [youtube.videoId, favoritos]);

  const tocar = () => {
    setErrorLocal(null);
    if (!url.trim()) { setErrorLocal('Pega un link de YouTube primero'); return; }
    const ok = m.youtubeTocar(url.trim());
    if (!ok) setErrorLocal('No reconocí ese link — copia el enlace con el botón "Compartir" de YouTube');
  };

  const guardarActual = () => {
    if (!youtube.videoId) return;
    const nuevos = [
      { id: youtube.videoId, titulo: youtube.titulo || 'Video de YouTube', agregadoEn: Date.now() },
      ...favoritos.filter((f) => f.id !== youtube.videoId),
    ];
    setFavoritos(nuevos);
    guardarFavoritosYT(nuevos);
  };

  const borrarFav = (id: string) => {
    const nuevos = favoritos.filter((f) => f.id !== id);
    setFavoritos(nuevos);
    guardarFavoritosYT(nuevos);
  };

  return (
    <div className="space-y-3">
      {/* Pegar link */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
        <div className="text-xs font-black text-white flex items-center gap-1.5">
          <Youtube className="w-4 h-4 text-red-500" /> Toca un video o música
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErrorLocal(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') tocar(); }}
              placeholder="https://youtu.be/… o youtube.com/watch?v=…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
            />
          </div>
          <button
            onClick={tocar}
            data-testid="youtube-tocar"
            className="px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
          >
            <Play className="w-3.5 h-3.5" /> Tocar
          </button>
        </div>
        {errorLocal && <div className="text-[11px] text-amber-400">{errorLocal}</div>}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Pega el enlace que te da el botón “Compartir” de YouTube. El video sale en una
          ventana flotante (abajo a la derecha) y sigue sonando mientras usas la app.
        </p>
      </div>

      {/* Video activo */}
      {youtube.videoId && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2" data-testid="youtube-activo">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 ${youtube.reproduciendo ? 'animate-pulse' : ''}`}>
              <Youtube className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{youtube.titulo || 'Cargando…'}</div>
              <div className="text-[10px] text-slate-400">{youtube.reproduciendo ? 'Sonando en la ventana flotante' : 'Pausado'}</div>
            </div>
            <button
              onClick={m.youtubeToggle}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
            >
              {youtube.reproduciendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              onClick={guardarActual}
              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${
                yaGuardado ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={yaGuardado ? 'Guardado en favoritos' : 'Guardar en favoritos'}
            >
              {yaGuardado ? <Check className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            </button>
            <button
              onClick={m.youtubeDetener}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
              title="Cerrar video"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
          {youtube.error && <div className="text-[11px] text-amber-400">{youtube.error}</div>}
        </div>
      )}

      {/* Favoritos */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-700/50 text-xs font-black text-white flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400" /> Tus favoritos
        </div>
        {favoritos.length === 0 && (
          <div className="p-4 text-center text-[11px] text-slate-500">
            Aún no guardas videos — toca uno y pícale ⭐ para tenerlo siempre a mano
          </div>
        )}
        {favoritos.map((f) => {
          const esActual = youtube.videoId === f.id;
          return (
            <div key={f.id} className={`flex items-center gap-3 px-3 py-3 border-b border-slate-700/50 last:border-0 ${esActual ? 'bg-red-500/10' : 'hover:bg-slate-700/30'}`}>
              <button onClick={() => m.youtubeTocar(f.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Youtube className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{f.titulo}</div>
                  {esActual && youtube.reproduciendo && <div className="text-[9px] text-red-300 font-black">SONANDO</div>}
                </div>
                <Play className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
              <button
                onClick={() => borrarFav(f.id)}
                className="w-8 h-8 rounded-lg bg-slate-900/50 hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center shrink-0"
                title="Quitar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

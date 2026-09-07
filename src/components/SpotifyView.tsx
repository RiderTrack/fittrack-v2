// ═══════════════════════════════════════════════════════════
// 🎵 SPOTIFY VIEW — FitTrack V2 (F5 · Extras)
// Puerto del modal del app viejo (L7591-7900) + playlists de
// RiderTrack V2:
//   • Login PKCE (el botón verde del viejo) — abre Spotify en el
//     navegador del sistema y vuelve solo por deep link
//   • Player: portada, título/artista, barra de progreso clicable
//     (seek), prev/▶/next, corazón (aquí SÍ funciona — el del
//     viejo era "próximamente"), volumen
//   • Playlists + "Tus me gusta" para ARRANCAR la música desde
//     la app (el viejo solo controlaba lo que ya sonaba)
//   • 🧪 Simular llamada: prueba el anti-cuelgue sin llamarte
//   • La música sigue sonando al cambiar de vista (el player vive
//     en MediosFitProvider) — el mini-pill arriba de los FABs
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  Music, Play, Pause, SkipBack, SkipForward, Heart, Volume2, LogOut,
  Loader2, FlaskConical, RefreshCw, Info, ListMusic, ThumbsUp,
} from 'lucide-react';
import { useMediosFit } from './medios/MediosFitProvider';
import { spotifyReconectarPlayer, spotifySimularLlamada, spotifyChequearSalud } from '../services/spotify';

const fmtTiempo = (ms: number): string => {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export const SpotifyView: React.FC = () => {
  const m = useMediosFit();
  const { spotify } = m;
  const [volumen, setVolumen] = useState(80);
  const [msgSimul, setMsgSimul] = useState('');
  const [aviso, setAviso] = useState('');
  const barraRef = useRef<HTMLDivElement | null>(null);

  // Ticker local: el SDK solo avisa cuando cambia el estado —
  // el progreso avanza acá para que la barra camine
  const [posLocal, setPosLocal] = useState(0);
  useEffect(() => {
    setPosLocal(spotify.track?.posicionMs ?? 0);
  }, [spotify.track?.posicionMs, spotify.track?.id]);
  useEffect(() => {
    if (!spotify.track?.reproduciendo) return;
    const t = setInterval(() => setPosLocal((p) => p + 1000), 1000);
    return () => clearInterval(t);
  }, [spotify.track?.reproduciendo]);

  const duracion = spotify.track?.duracionMs ?? 0;
  const pct = duracion > 0 ? Math.min(100, (posLocal / duracion) * 100) : 0;

  // Click en la barra → seek (como el viejo)
  const buscar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barraRef.current || !duracion) return;
    const rect = barraRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    m.spotifyBuscar(Math.round(ratio * duracion));
    setPosLocal(Math.round(ratio * duracion));
  };

  const avisoConTiempo = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(''), 3000);
  };

  // ═══ LOGIN (como el viejo) ═══
  if (!spotify.conectado) {
    return (
      <div className="space-y-4" data-testid="spotify-login">
        <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Music className="w-6 h-6 text-[#1DB954]" />
            Spotify
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tu música para entrenar, integrada con tu cuenta
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1DB954] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/50">
            <Music className="w-8 h-8 text-black" />
          </div>
          <p className="text-sm text-slate-300 font-bold mb-1">Conecta tu Spotify</p>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            La app se vuelve un dispositivo Spotify Connect
            (<span className="font-mono text-slate-400">FitTrack 🏋️</span>) y reproduce directo.
          </p>
          <button
            onClick={m.spotifyConectar}
            data-testid="boton-conectar-spotify"
            className="w-full py-3 rounded-xl bg-[#1DB954] text-black font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Conectar con Spotify
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex gap-2.5">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Requiere Spotify <b className="text-slate-300">Premium</b>. El login abre
            Spotify en el navegador del sistema; al aceptar, la app vuelve sola
            (deep link <span className="font-mono">fittrack://callback</span>).
            Si ya te conectaste en el app viejo, tu sesión se recupera automáticamente.
          </p>
        </div>
      </div>
    );
  }

  // ═══ PLAYER (como el viejo, con playlists nuevas) ═══
  return (
    <div className="space-y-4 pb-4" data-testid="spotify-player">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Music className="w-6 h-6 text-[#1DB954]" />
          Spotify
        </h1>
        <p
          className="text-xs mt-1 font-bold"
          data-testid="spotify-estado"
        >
          {spotify.estado === 'listo' && <span className="text-emerald-400">Conectado ✓</span>}
          {spotify.estado === 'conectando' && <span className="text-amber-400">🟡 Conectando…</span>}
          {spotify.estado === 'reconectando' && <span className="text-amber-400">📞 Reconectando…</span>}
          {spotify.estado === 'error' && <span className="text-red-400">{spotify.mensaje || 'Error'}</span>}
          {spotify.estado === 'requiere-premium' && <span className="text-amber-400">{spotify.mensaje}</span>}
          {spotify.estado === 'desconectado' && <span className="text-slate-400">Desconectado</span>}
        </p>
        {spotify.mensaje && spotify.estado !== 'error' && spotify.estado !== 'requiere-premium' && (
          <p className="text-[10px] text-slate-500 mt-0.5">{spotify.mensaje}</p>
        )}
      </div>

      {/* Player */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
        {spotify.track ? (
          <>
            <div className="flex items-center gap-4">
              {spotify.track.imagen ? (
                <img
                  src={spotify.track.imagen}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover shadow-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                  <Music className="w-7 h-7 text-[#1DB954]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-white truncate">{spotify.track.nombre}</p>
                <p className="text-xs text-slate-400 truncate">{spotify.track.artista}</p>
                <p className="text-[10px] text-slate-600 truncate">{spotify.track.album}</p>
              </div>
              <button
                onClick={m.spotifyLike}
                title={spotify.liked ? 'Quitar de me gusta' : 'Me gusta'}
                data-testid="spotify-like"
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                  spotify.liked
                    ? 'bg-[#1DB954]/15 border-[#1DB954]/60 text-[#1DB954]'
                    : 'border-slate-600 text-slate-400 hover:text-white hover:border-[#1DB954]/60'
                }`}
              >
                <Heart className={`w-5 h-5 ${spotify.liked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Barra de progreso clicable (seek) */}
            <div className="mt-4">
              <div
                ref={barraRef}
                onClick={buscar}
                data-testid="spotify-progreso"
                className="h-1.5 rounded-full bg-slate-700 cursor-pointer relative group"
              >
                <div className="h-full rounded-full bg-[#1DB954] relative" style={{ width: pct + '%' }}>
                  <span className="absolute -right-1.5 -top-[3px] w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-mono text-slate-500">{fmtTiempo(posLocal)}</span>
                <span className="text-[10px] font-mono text-slate-500">{fmtTiempo(duracion)}</span>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-4 mt-3">
              <button
                onClick={m.spotifyAnterior}
                title="Anterior"
                className="w-11 h-11 rounded-full text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={m.spotifyToggle}
                data-testid="spotify-toggle"
                className="w-14 h-14 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-lg shadow-emerald-900/50 active:scale-95 transition-transform"
              >
                {spotify.track.reproduciendo ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
              </button>
              <button
                onClick={m.spotifySiguiente}
                title="Siguiente"
                className="w-11 h-11 rounded-full text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Volumen (el viejo: slider 0-100 default 70-80) */}
            <div className="flex items-center gap-3 mt-4">
              <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={volumen}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolumen(v);
                  m.spotifySetVolumen(v);
                }}
                className="flex-1 accent-[#1DB954]"
                aria-label="Volumen Spotify"
              />
              <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{volumen}%</span>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <Music className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-bold">
              {spotify.listo ? 'Toca una playlist o Tus me gusta 👇' : 'Espera al 🟢 Listo…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {spotify.listo
                ? 'También puedes controlar lo que suena en tu Spotify desde aquí'
                : 'Conectando el reproductor…'}
            </p>
          </div>
        )}
      </div>

      {/* Tus me gusta + playlists */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <ListMusic className="w-3.5 h-3.5 text-[#1DB954]" /> Arranca la música
          </p>
          <button
            onClick={() => {
              m.recargarPlaylists();
              avisoConTiempo('Playlists actualizadas');
            }}
            title="Recargar playlists"
            className="w-7 h-7 rounded-lg border border-slate-600 text-slate-400 flex items-center justify-center hover:text-white hover:border-[#1DB954]/60 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${m.playlistsCargando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={() => {
            if (!spotify.listo) { avisoConTiempo('Espera al 🟢 Listo para reproducir'); return; }
            m.spotifyTocarMegusta();
          }}
          disabled={!spotify.listo}
          data-testid="spotify-megusta"
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors text-left disabled:opacity-40"
        >
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#1DB954] to-emerald-700 flex items-center justify-center shrink-0">
            <ThumbsUp className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Tus me gusta</p>
            <p className="text-[11px] text-slate-500">50 temas que amas, al azar de Spotify</p>
          </div>
          <Play className="w-4 h-4 text-[#1DB954] shrink-0" />
        </button>

        {m.playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => m.spotifyTocar(p.uri)}
            disabled={!spotify.listo}
            data-testid={`spotify-playlist-${p.id}`}
            className="w-full flex items-center gap-3 px-4 py-3 border-t border-slate-700/60 hover:bg-slate-700/40 transition-colors text-left disabled:opacity-40"
          >
            {p.imagen ? (
              <img src={p.imagen} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <ListMusic className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{p.nombre}</p>
              <p className="text-[11px] text-slate-500">{p.total} temas</p>
            </div>
            <Play className="w-4 h-4 text-[#1DB954] shrink-0" />
          </button>
        ))}

        {m.playlists.length === 0 && !m.playlistsCargando && (
          <p className="px-4 py-4 text-xs text-slate-500 text-center border-t border-slate-700/60">
            Sin playlists — créalas en Spotify y refresca acá
          </p>
        )}
      </div>

      {/* 🧪 Simular llamada + re-sincronizar (anti-cuelgue) */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const r = spotifySimularLlamada();
            setMsgSimul(r.msg);
            setTimeout(() => setMsgSimul(''), 9000);
          }}
          disabled={!spotify.listo}
          data-testid="boton-simular-llamada"
          className="flex-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-400 text-xs font-bold hover:bg-amber-500/25 disabled:opacity-40 transition-all inline-flex items-center justify-center gap-1.5"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          🧪 Simular llamada
        </button>
        <button
          onClick={() => { void spotifyReconectarPlayer('manual'); void spotifyChequearSalud(); }}
          title="Re-sincronizar el reproductor"
          className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-xs font-bold hover:text-white hover:border-[#1DB954]/60 transition-all inline-flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          🔄
        </button>
      </div>
      {msgSimul && (
        <p className="text-[11px] text-amber-400 text-center px-2 leading-relaxed" data-testid="msg-simulacion">
          {msgSimul}
        </p>
      )}
      {aviso && (
        <p className="text-[11px] text-emerald-400 text-center px-2">{aviso}</p>
      )}

      {/* Salir (como el viejo) */}
      <button
        onClick={m.spotifyDesconectar}
        data-testid="spotify-logout"
        className="w-full py-2.5 rounded-xl border border-slate-600 text-slate-400 text-xs font-bold hover:text-red-400 hover:border-red-500/60 transition-all inline-flex items-center justify-center gap-1.5"
      >
        <LogOut className="w-3.5 h-3.5" />
        Desconectar Spotify
      </button>
    </div>
  );
};

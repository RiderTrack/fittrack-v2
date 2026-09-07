// ═══════════════════════════════════════════════════════════
// 📻 RADIO VIEW — FitTrack V2 (F5 · Extras)
// Puerto del modal del app viejo (L7421-7571):
//   • Las 14 emisoras peruanas agrupadas por categoría
//     (NOTICIAS / POP / ROMÁNTICA / VARIADA) con su punto de
//     color que late cuando suena (como el viejo)
//   • Click en la que suena = pausa (toggle del viejo)
//   • Estado EN VIVO · {nombre} + botón Detener
//   • NUEVO vs viejo: favoritos ⭐ y volumen (el viejo era fijo)
//   • El audio vive en MediosFitProvider → sigue sonando en
//     todas las vistas con el mini-pill arriba de los FABs
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { Radio as RadioIcon, Volume2, Square, Star, Loader2 } from 'lucide-react';
import { useMediosFit } from './medios/MediosFitProvider';
import {
  RADIOS, ETIQUETAS_CATEGORIA, leerFavoritos, guardarFavoritos,
  type CategoriaRadio,
} from '../services/radioFit';

const ORDEN_CATEGORIAS: CategoriaRadio[] = ['noticias', 'pop', 'romantica', 'variada'];

export const RadioView: React.FC = () => {
  const m = useMediosFit();
  const [favoritos, setFavoritos] = useState<string[]>(() => leerFavoritos());
  const [volumen, setVolumen] = useState(() => Math.round(m.radioVolumen * 100));

  const porCategoria = useMemo(() => {
    const mapa = new Map<CategoriaRadio, typeof RADIOS>();
    ORDEN_CATEGORIAS.forEach((cat) => mapa.set(cat, []));
    RADIOS.forEach((r) => mapa.get(r.categoria)?.push(r));
    return mapa;
  }, []);

  const alternarFavorito = (id: string) => {
    const nuevos = favoritos.includes(id)
      ? favoritos.filter((x) => x !== id)
      : [...favoritos, id];
    setFavoritos(nuevos);
    guardarFavoritos(nuevos);
  };

  const sonando = m.radio.estacion;

  return (
    <div className="space-y-4 pb-4" data-testid="radio-view">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <RadioIcon className="w-6 h-6 text-orange-500" />
          Radio Peruana
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Radio en vivo mientras levantas hierro 📻
        </p>
        <div className="flex items-center gap-3 mt-3">
          <p className="text-xs font-bold flex-1" data-testid="radio-status">
            {sonando ? (
              <>
                {m.radio.cargando ? (
                  <span className="text-amber-400 inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Conectando con {sonando.nombre}…
                  </span>
                ) : (
                  <span className="text-emerald-400">EN VIVO · {sonando.nombre}</span>
                )}
                {m.radio.error && <span className="text-red-400 block mt-0.5">{m.radio.error}</span>}
              </>
            ) : (
              <span className="text-slate-400">Selecciona una emisora</span>
            )}
          </p>
          {sonando && (
            <button
              onClick={m.radioDetener}
              data-testid="radio-detener"
              className="px-3 py-1.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-red-400 hover:border-red-500/60 transition-all inline-flex items-center gap-1.5"
            >
              <Square className="w-3 h-3" />
              Detener
            </button>
          )}
        </div>

        {/* Volumen (nuevo — el viejo era fijo 0.8) */}
        <div className="flex items-center gap-3 mt-3">
          <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={volumen}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolumen(v);
              m.radioSetVolumen(v / 100);
            }}
            className="flex-1 accent-orange-500"
            aria-label="Volumen radio"
          />
          <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{volumen}%</span>
        </div>
      </div>

      {/* Emisoras por categoría (como el viejo) */}
      {ORDEN_CATEGORIAS.map((cat) => (
        <div key={cat} className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
          <p className="px-4 pt-3.5 pb-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">
            {ETIQUETAS_CATEGORIA[cat]}
          </p>
          {(porCategoria.get(cat) ?? []).map((r) => {
            const activa = sonando?.id === r.id;
            const reproduciendo = activa && m.radio.reproduciendo;
            return (
              <button
                key={r.id}
                onClick={() => (activa ? m.radioToggle() : m.radioPlay(r.id))}
                data-testid={`radio-item-${r.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 border-t border-slate-700/60 text-left transition-colors ${
                  activa ? 'bg-emerald-500/10' : 'hover:bg-slate-700/40'
                }`}
              >
                {/* Punto de color que late cuando suena (como el viejo) */}
                <span className="relative flex items-center justify-center shrink-0" style={{ color: r.color }}>
                  {reproduciendo ? (
                    <>
                      <span
                        className="absolute w-4 h-4 rounded-full animate-ping"
                        style={{ background: r.color, opacity: 0.6 }}
                      />
                      <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                    </>
                  ) : (
                    <span className="w-3 h-3 rounded-full" style={{ background: r.color, opacity: activa ? 1 : 0.65 }} />
                  )}
                </span>
                <span className="text-lg shrink-0">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-bold truncate ${activa ? 'text-white' : 'text-slate-200'}`}>
                    {r.nombre}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {r.freq}{activa && !m.radio.reproduciendo && !m.radio.cargando ? ' · en pausa' : ''}
                  </span>
                </span>
                <span
                  role="button"
                  aria-label={favoritos.includes(r.id) ? 'Quitar de favoritos' : 'Marcar favorito'}
                  onClick={(e) => { e.stopPropagation(); alternarFavorito(r.id); }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    favoritos.includes(r.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${favoritos.includes(r.id) ? 'fill-current' : ''}`} />
                </span>
              </button>
            );
          })}
        </div>
      ))}

      <p className="text-[11px] text-slate-500 text-center px-2 leading-relaxed">
        La radio sigue sonando mientras entrenas — contrólala desde el mini-reproductor 📻
        {m.radio.error ? '' : ''}
      </p>
    </div>
  );
};

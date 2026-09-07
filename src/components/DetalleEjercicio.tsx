// ═══════════════════════════════════════════════════════════
// 🔎 DETALLE DE EJERCICIO — FitTrack V2 (F7 · Progreso)
// El historial completo de UN ejercicio: toda su historia en la
// gráfica de peso (GraficaLinea de F4), sus mejores marcas y la
// lista de sesiones (más reciente primero). Se abre desde la
// tarjeta del ejercicio en Entreno de Hoy ("Ver historial") y
// desde la Biblioteca. Solo LEE (workoutHistory + prs) — cero
// escrituras, cero riesgo para el state.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { X, Trophy, TrendingUp, History, Dumbbell } from 'lucide-react';
import type { Ejercicio, EstadoFitTrack, PRLevantamiento } from '../types';
import { GraficaLinea } from './GraficaLinea';
import { datosGraficoEjercicio, historialDeEjercicio } from '../services/progreso';
import { etiquetaPR, ultimaVez } from '../services/entreno';
import { formatearVolumen } from '../services/storageFit';

interface DetalleEjercicioProps {
  ejercicio: Ejercicio;
  estado: EstadoFitTrack;
  pr?: PRLevantamiento;
  onCerrar: () => void;
}

export const DetalleEjercicio: React.FC<DetalleEjercicioProps> = ({ ejercicio, estado, pr, onCerrar }) => {
  // Cronológico (más viejo primero) para la gráfica; la lista se pinta al revés
  const historial = useMemo(() => historialDeEjercicio(ejercicio.name, estado), [ejercicio.name, estado]);
  const grafico = useMemo(() => datosGraficoEjercicio(historial), [historial]);
  const [verSerie, setVerSerie] = useState(true); // gráfica de peso activa por defecto

  const sesiones = historial.length;
  const mejorPeso = historial.reduce((m, h) => Math.max(m, h.pesoMax), 0);
  const volumenTotal = historial.reduce((v, h) => v + h.volumen, 0);
  const mejorRM = historial.reduce<number | null>((m, h) => (h.rm1 != null && h.rm1 > (m ?? 0) ? h.rm1 : m), null);
  const ultima = useMemo(() => ultimaVez(ejercicio.name, estado), [ejercicio.name, estado]);

  return (
    <div
      data-testid="detalle-ejercicio"
      className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl border border-slate-700/60 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="p-4 border-b border-slate-700/60 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white truncate">{ejercicio.name}</h3>
            <p className="text-[11px] text-slate-400">
              {ejercicio.category} ·{' '}
              {sesiones > 0 ? `${sesiones} sesión(es) registrada(s)` : 'sin historial todavía'}
            </p>
          </div>
          {pr && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 shrink-0">
              <Trophy className="w-3 h-3" /> {etiquetaPR(pr)}
            </span>
          )}
          <button
            onClick={onCerrar}
            data-testid="detalle-cerrar"
            title="Cerrar"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Marcas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5 text-center">
              <p className="text-lg font-black text-emerald-400 tabular-nums">{mejorPeso > 0 ? `${mejorPeso}` : '—'}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Peso máx (kg)</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5 text-center">
              <p className="text-lg font-black text-emerald-400 tabular-nums">
                {mejorRM != null ? mejorRM.toFixed(1) : '—'}
              </p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">1RM est.</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5 text-center">
              <p className="text-lg font-black text-emerald-400 tabular-nums">
                {volumenTotal > 0 ? formatearVolumen(volumenTotal) : '—'}
              </p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Vol. total (kg)</p>
            </div>
          </div>

          {/* Gráfica de peso */}
          {grafico.valores.length >= 2 ? (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
              <p className="text-[11px] font-bold text-slate-300 flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Peso máximo por sesión
              </p>
              <div data-testid="detalle-grafica">
                <GraficaLinea etiquetas={grafico.etiquetas} valores={grafico.valores} unidad="kg" color="emerald" />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 text-center rounded-2xl border border-slate-700/60 bg-slate-900/60 px-3 py-4">
              Con 2+ sesiones de este ejercicio aparece la gráfica de evolución del peso.
            </p>
          )}

          {/* Lista de sesiones (más reciente primero) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-emerald-400" /> Historial
              </p>
              {verSerie && (
                <button
                  onClick={() => setVerSerie(false)}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
                >
                  Ocultar
                </button>
              )}
              {!verSerie && (
                <button
                  onClick={() => setVerSerie(true)}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Mostrar ({sesiones})
                </button>
              )}
            </div>
            {verSerie && (
              sesiones > 0 ? (
                <ul className="space-y-1.5">
                  {historial
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <li
                        key={`${h.fecha}-${i}`}
                        data-testid={`detalle-sesion-${i}`}
                        className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 flex items-center gap-3"
                      >
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">{h.fecha.slice(5)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white">
                            {h.resumen}
                            {h.repsTop != null && <span className="text-slate-400 font-normal"> × mejor de {h.repsTop}</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Volumen {formatearVolumen(h.volumen)} kg
                            {h.rm1 != null && ` · 1RM est. ${h.rm1.toFixed(1)} kg`}
                          </p>
                        </div>
                        {i === 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0">
                            ÚLTIMA
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-3 text-center">
                  {ultima
                    ? `Última vez ${ultima.fecha}: ${ultima.resumen} — sin más detalle guardado.`
                    : 'Todavía no registraste este ejercicio en una sesión.'}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

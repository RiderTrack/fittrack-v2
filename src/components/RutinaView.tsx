// ═══════════════════════════════════════════════════════════
// 📅 RUTINA · MI SEMANA — FitTrack V2 (F2 · Entreno)
// Vista del split semanal del app viejo (WEEKLY_SPLIT): qué
// toca cada día, con selector del modo activo (el mismo
// state.activeMode que la vista Entreno usa) y conteo de
// ejercicios por día desde la biblioteca (base + custom).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { CalendarDays, Dumbbell, Info } from 'lucide-react';
import type { EstadoFitTrack, ModoEntreno } from '../types';
import { aplicarEstado } from '../services/storageFit';
import {
  EJERCICIOS_BASE, PARAMETROS_MODO, SPLIT_SEMANAL, bibliotecaCompleta,
  ejerciciosDelDia, leerModoActivo, splitDeHoy,
} from '../services/entreno';

interface RutinaViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
  onModoCambiado: () => void; // App relee el state
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // Lunes → Domingo

const ETIQUETAS_MODO: Record<ModoEntreno, string> = {
  fuerza: 'Fuerza (5×3-5, 87% 1RM)',
  hipertrofia: 'Hipertrofia (4×8-12, 70% 1RM)',
  potencia: 'Potencia (3×1-3, 90-95% 1RM)',
  descarga: 'Descarga (3×12-15, 50% 1RM)',
  descanso: 'Descanso',
};

export const RutinaView: React.FC<RutinaViewProps> = ({ estado, esDemo, onModoCambiado }) => {
  const hoy = useMemo(() => new Date().getDay(), []);
  const splitHoy = useMemo(() => splitDeHoy(), []);
  const [modo, setModo] = useState<ModoEntreno>(() => leerModoActivo(estado));

  const biblioteca = useMemo(() => bibliotecaCompleta(estado), [estado]);
  const params = modo !== 'descanso' ? PARAMETROS_MODO[modo] : null;

  const cambiarModo = (nuevo: ModoEntreno) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    if (!esDemo) {
      aplicarEstado((est) => { est.activeMode = nuevo; }); // changeWorkoutMode del viejo
      onModoCambiado();
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-400" /> Mi Semana
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Split semanal del FitTrack original. Hoy te toca{' '}
          <strong className="text-slate-200">{splitHoy.name}</strong>
          {splitHoy.target.length > 0 && ` (${splitHoy.target.join(' + ')})`}.
        </p>

        {/* Modo activo */}
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <p className="text-[11px] text-slate-400 mb-2">
            Modo activo: <strong className="text-emerald-400">{ETIQUETAS_MODO[modo]}</strong>
            {params && <span className="text-slate-500"> · {params.sets} series × {params.reps} reps</span>}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de entreno">
            {(Object.keys(ETIQUETAS_MODO) as ModoEntreno[]).map((m) => {
              const activo = modo === m;
              return (
                <button
                  key={m}
                  onClick={() => cambiarModo(m)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    activo
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {ETIQUETAS_MODO[m]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="space-y-2.5">
        {ORDEN_SEMANA.map((diaNum) => {
          const split = SPLIT_SEMANAL[diaNum];
          const esHoy = diaNum === hoy;
          const ejerciciosDia = ejerciciosDelDia(estado, split);
          return (
            <div
              key={diaNum}
              className={`rounded-2xl border p-4 flex items-center gap-3 ${
                esHoy
                  ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
                  : 'border-slate-700/60 bg-slate-900/60'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  esHoy ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800 border border-slate-700'
                }`}
              >
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                <span className="text-[9px] font-mono font-bold text-slate-400 mt-0.5">
                  {DIAS[diaNum].slice(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white truncate">
                  {split.name}
                  {esHoy && (
                    <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 align-middle">
                      HOY
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {split.target.length > 0
                    ? `${split.target.join(' + ')} · ${ejerciciosDia.length} ejercicio(s) en biblioteca`
                    : 'Recuperación total — sin entreno'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 flex gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Los ejercicios de cada día salen de la Biblioteca ({EJERCICIOS_BASE.length} base + los
          custom que agregues): aparecen en el día de su grupo muscular. El editor día por día
          llega en una fase posterior — por ahora el split es el clásico del FitTrack original.
        </p>
      </div>
    </div>
  );
};

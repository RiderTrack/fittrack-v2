// ═══════════════════════════════════════════════════════════
// 📜 HISTORIAL — FitTrack V2 (F4 · Progreso)
// Puerto React del "Historial de Sesiones" del viejo: tarjetas
// expandibles con detalle por ejercicio (peso × series + barra
// de volumen), feedback de la sesión y botón de exportación
// (el "Excel" del viejo, ahora CSV nativo). Arriba, la gráfica
// de volumen semanal que el viejo pintaba en el dashboard.
// Fuente: renderHistory L5908-L6006 + renderGraficoVolumen L4510.
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
import {
  TrendingUp, Download, BarChart3, Dumbbell, Zap, Bandage,
  Moon, Smile, Frown, Meh, Thermometer, Flame,
} from 'lucide-react';
import type { EstadoFitTrack, SesionEntreno } from '../types';
import { ETIQUETAS_DIFICULTAD, ETIQUETAS_ENERGIA, ETIQUETAS_DOLOR, volumenSemanal, exportarHistorialCSV } from '../services/progreso';
import { formatearVolumen } from '../services/storageFit';
import { GraficaLinea } from './GraficaLinea';

// Iconos de feedback (mismas listas del viejo, L5928-5929)
const ICONO_DIFICULTAD = [Moon, Smile, Dumbbell, Frown, Thermometer]; // dificultad 1-5
const ICONO_ENERGIA = [Frown, Meh, Smile, Flame]; // energía 1-4

interface HistorialViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
}

export const HistorialView: React.FC<HistorialViewProps> = ({ estado, esDemo }) => {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [toastLocal, setToastLocal] = useState('');
  const timerToast = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const avisar = (mensaje: string) => {
    setToastLocal(mensaje);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToastLocal(''), 2500);
  };

  const sesiones = estado.workoutHistory ?? [];
  const { etiquetas, valores } = volumenSemanal(estado);

  const exportar = () => {
    const ok = exportarHistorialCSV(estado);
    avisar(ok ? 'Historial exportado (CSV para Excel)' : 'Aún no hay datos para exportar');
  };

  /** Fila de una sesión (tarjeta colapsable del renderHistory del viejo) */
  const tarjetaSesion = (s: SesionEntreno, idx: number) => {
    const fb = s.feedback;
    const IconoDif = fb?.dificultad ? ICONO_DIFICULTAD[fb.dificultad - 1] : null;
    const IconoEng = fb?.energia ? ICONO_ENERGIA[fb.energia - 1] : null;

    const nombres = (s.exercises ?? []).slice(0, 3).map((e) => e.name).join(' · ');
    const extra = (s.exercises ?? []).length > 3 ? ` +${(s.exercises ?? []).length - 3} más` : '';
    const expandida = abierta === idx;

    return (
      <div
        key={idx}
        data-testid={`tarjeta-historial-${idx}`}
        className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden"
      >
        {/* Cabecera colapsable */}
        <button
          onClick={() => setAbierta((a) => (a === idx ? null : idx))}
          data-testid={`cabecera-historial-${idx}`}
          className="w-full text-left px-4 py-3.5 cursor-pointer"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-xs font-bold text-emerald-400">{s.date}</span>
                {s.time && <span className="text-[11px] text-slate-500">{s.time}</span>}
                {s.mode && (
                  <span className="text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded-lg font-semibold text-slate-300 uppercase">
                    {s.mode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-white mb-1">
                <span className="truncate">{s.routineName ?? 'Sesión'}</span>
                {IconoDif && <IconoDif className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                {IconoEng && <IconoEng className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {nombres}{extra}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-black text-emerald-400">{formatearVolumen(s.volume ?? 0)}</div>
              <div className="text-[9px] text-slate-500">kg vol</div>
              <div className={`text-[11px] mt-1 transition-transform ${expandida ? 'rotate-180' : ''}`}>▼</div>
            </div>
          </div>
        </button>

        {/* Detalle expandido */}
        {expandida && (
          <div className="px-4 pb-4 border-t border-slate-700/50 pt-3" data-testid={`detalle-historial-${idx}`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Dumbbell className="w-3 h-3" /> Ejercicios ({(s.exercises ?? []).length})
            </p>
            {(s.exercises ?? []).map((ex, i) => {
              const total = s.volume || 1;
              const volBar = Math.min(100, Math.round(((ex.volume ?? 0) / total) * 100));
              return (
                <div key={i} className="py-2 border-b border-slate-700/30 last:border-b-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[13px] font-bold text-white truncate">{ex.name}</span>
                    <span className="text-[11px] font-bold text-emerald-400 shrink-0 ml-2">
                      {ex.weight ?? 0} kg × {ex.sets ?? 0} series
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/80 rounded-full" style={{ width: `${volBar}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{ex.volume ?? 0} kg vol</span>
                  </div>
                </div>
              );
            })}

            {fb && (
              <div className="pt-3 flex gap-4 flex-wrap text-[11px] text-slate-400">
                {fb.dificultad != null && (
                  <span className="flex items-center gap-1.5">
                    <Dumbbell className="w-3 h-3 text-emerald-400" /> {ETIQUETAS_DIFICULTAD[fb.dificultad]}
                  </span>
                )}
                {fb.energia != null && (
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-400" /> {ETIQUETAS_ENERGIA[fb.energia]}
                  </span>
                )}
                {fb.dolor != null && (
                  <span className="flex items-center gap-1.5">
                    <Bandage className="w-3 h-3 text-red-400" /> {ETIQUETAS_DOLOR[fb.dolor]}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-4">
      {/* ── Cabecera + exportación (botón "Excel" del viejo) ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Historial de Sesiones</span>
          <span className="text-[11px] text-slate-500">({sesiones.length})</span>
        </div>
        <button
          onClick={exportar}
          data-testid="boton-exportar-historial"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-600 shadow-lg hover:from-emerald-600 hover:to-emerald-500 transition-all active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* ── Volumen por semana (la gráfica del dashboard del viejo) ── */}
      {valores.length >= 2 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4" data-testid="card-volumen-semanal">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">Volumen por semana</span>
            <span className="text-[10px] text-slate-500 ml-auto">últimas 8 semanas</span>
          </div>
          <GraficaLinea etiquetas={etiquetas} valores={valores} unidad="kg" color="emerald" />
        </div>
      )}

      {/* ── Lista de sesiones ── */}
      {sesiones.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center">
          <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-xs text-slate-400">No hay entrenamientos guardados aún.</p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {esDemo ? 'En modo demo no hay sesiones de ejemplo.' : 'Termina una sesión en Entreno de Hoy y aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sesiones.map((s, idx) => tarjetaSesion(s, idx))}
        </div>
      )}

      {/* Toast local */}
      {toastLocal && (
        <div
          data-testid="toast-historial"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap"
        >
          {toastLocal}
        </div>
      )}
    </div>
  );
};

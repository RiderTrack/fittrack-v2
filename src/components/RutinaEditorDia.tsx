// ═══════════════════════════════════════════════════════════
// ✏️ EDITOR DE DÍA — FitTrack V2 (F7 · Mi Semana)
// Modal para editar UN día de la rutina personal: nombre del
// día, entrena/descansa, ejercicios (agregar desde la biblioteca
// con buscador, series 1-10, reps '8-12', subir/bajar orden,
// quitar). El guardado pasa por el padre (RutinaView), que
// decide con esDemo si escribe de verdad (aplicarEstado).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  X, Plus, Trash2, ChevronUp, ChevronDown, Check, Search, Moon, Dumbbell, Pencil,
} from 'lucide-react';
import type { DiaRutina, Ejercicio, EjercicioRutina } from '../types';
import { normalizarEjercicios } from '../services/rutinaPersonal';

interface RutinaEditorDiaProps {
  diaNum: number;          // 0-6 (para el título)
  diaInicial: DiaRutina;
  biblioteca: Ejercicio[];
  onGuardar: (dia: DiaRutina) => void;
  onCerrar: () => void;
}

const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const RutinaEditorDia: React.FC<RutinaEditorDiaProps> = ({
  diaNum, diaInicial, biblioteca, onGuardar, onCerrar,
}) => {
  const [nombre, setNombre] = useState(diaInicial.nombre);
  const [activo, setActivo] = useState(diaInicial.activo);
  const [ejercicios, setEjercicios] = useState<EjercicioRutina[]>(() =>
    normalizarEjercicios(diaInicial.ejercicios ?? []),
  );
  const [busqueda, setBusqueda] = useState('');
  const [aviso, setAviso] = useState('');

  const porId = useMemo(() => new Map(biblioteca.map((e) => [e.id, e])), [biblioteca]);
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const yaEstan = new Set(ejercicios.map((e) => e.id));
    return biblioteca
      .filter((e) => !yaEstan.has(e.id))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) : false))
      .slice(0, 8);
  }, [busqueda, biblioteca, ejercicios]);

  const agregar = (ex: Ejercicio) => {
    setEjercicios((prev) => [...prev, { id: ex.id, series: 4, reps: '8-12' }]);
    setBusqueda('');
    setAviso('');
  };

  const quitar = (id: string) => {
    setEjercicios((prev) => prev.filter((e) => e.id !== id));
  };

  const mover = (idx: number, delta: -1 | 1) => {
    setEjercicios((prev) => {
      const destino = idx + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(idx, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  };

  const cambiarCampo = (idx: number, campo: 'series' | 'reps', valor: string) => {
    setEjercicios((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [campo]: campo === 'series' ? Math.max(1, Math.min(10, parseInt(valor, 10) || 1)) : valor } : e)),
    );
  };

  const guardar = () => {
    const nombreLimpio = nombre.trim() || NOMBRES_DIAS[diaNum];
    if (activo && ejercicios.length === 0) {
      setAviso('Agregá al menos un ejercicio o marcá el día como descanso');
      return;
    }
    onGuardar({
      activo,
      nombre: nombreLimpio,
      ejercicios: activo ? normalizarEjercicios(ejercicios) : [],
    });
  };

  return (
    <div
      data-testid="editor-dia"
      className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl border border-slate-700/60 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="p-4 border-b border-slate-700/60 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Pencil className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white">Editar {NOMBRES_DIAS[diaNum]}</h3>
            <p className="text-[11px] text-slate-400">
              {activo ? `${ejercicios.length} ejercicio(s) · el orden es el del entreno` : 'Día de descanso'}
            </p>
          </div>
          <button
            onClick={onCerrar}
            title="Cerrar sin guardar"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Nombre + entrena/descansa */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del día (ej: Push A)"
              maxLength={24}
              className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              onClick={() => setActivo((a) => !a)}
              data-testid="editor-toggle-activo"
              className={`px-3 rounded-lg border text-xs font-bold transition-all shrink-0 ${
                activo
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={activo ? 'Marcar como descanso' : 'Marcar como día de entreno'}
            >
              {activo ? <Dumbbell className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Ejercicios del día */}
          <div className="space-y-2">
            {ejercicios.length === 0 && activo && (
              <p className="text-[11px] text-slate-500 text-center rounded-xl border border-dashed border-slate-700 px-3 py-4">
                Sin ejercicios todavía — buscá y agregá abajo.
              </p>
            )}
            {ejercicios.map((er, idx) => {
              const ex = porId.get(er.id);
              return (
                <div
                  key={er.id}
                  data-testid={`editor-ej-${er.id}`}
                  className={`rounded-xl border p-3 ${activo ? 'border-slate-700/60 bg-slate-900/60' : 'border-slate-800 bg-slate-900/40 opacity-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 w-5 shrink-0 tabular-nums">
                      {idx + 1}º
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{ex?.name ?? er.id}</p>
                      <p className="text-[10px] text-slate-500">{ex?.category ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        title="Subir"
                        className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => mover(idx, 1)}
                        disabled={idx === ejercicios.length - 1}
                        title="Bajar"
                        className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => quitar(er.id)}
                        title="Quitar"
                        className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="flex items-center gap-1.5 flex-1">
                      <span className="text-[10px] text-slate-500 shrink-0">Series</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10}
                        value={er.series}
                        onChange={(e) => cambiarCampo(idx, 'series', e.target.value)}
                        disabled={!activo}
                        className="w-full min-w-0 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 flex-1">
                      <span className="text-[10px] text-slate-500 shrink-0">Reps</span>
                      <input
                        type="text"
                        inputMode="text"
                        value={er.reps}
                        onChange={(e) => cambiarCampo(idx, 'reps', e.target.value)}
                        disabled={!activo}
                        placeholder="8-12"
                        maxLength={10}
                        className="w-full min-w-0 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buscador de la biblioteca */}
          {activo && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  data-testid="editor-buscador"
                  placeholder="Buscar ejercicio para agregar…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              {busqueda.trim() && (
                <div className="mt-2 space-y-1">
                  {resultados.length === 0 && (
                    <p className="text-[11px] text-slate-500 py-1">Nada con "{busqueda}" en la biblioteca.</p>
                  )}
                  {resultados.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => agregar(ex)}
                      className="w-full flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-2 text-left hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate flex-1">{ex.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{ex.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {aviso && <p className="text-[11px] text-red-400 text-center">{aviso}</p>}
        </div>

        {/* Pie: guardar */}
        <div className="p-4 border-t border-slate-700/60 shrink-0">
          <button
            onClick={guardar}
            data-testid="editor-guardar"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all"
          >
            <Check className="w-4 h-4" /> Guardar día
          </button>
        </div>
      </div>
    </div>
  );
};

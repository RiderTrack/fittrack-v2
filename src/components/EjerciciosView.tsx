// ═══════════════════════════════════════════════════════════
// 📚 BIBLIOTECA DE EJERCICIOS — FitTrack V2 (F2 · Entreno)
// El catálogo del app viejo: 18 ejercicios base (por grupo
// muscular) + los custom del usuario (state.customExercises,
// misma estructura {id,name,category} del viejo). Muestra el
// PR guardado de cada ejercicio y permite agregar/eliminar
// customs — los custom aparecen en su día del split.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, Trophy, Dumbbell } from 'lucide-react';
import type { EstadoFitTrack, Ejercicio } from '../types';
import { aplicarEstado } from '../services/storageFit';
import { EJERCICIOS_BASE, etiquetaPR, ultimaVez } from '../services/entreno';

interface EjerciciosViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
  onCambio: () => void; // App relee el state
}

/** Categorías fijas del split + las de los custom */
function categorias(biblioteca: Ejercicio[]): string[] {
  const set = new Set<string>([...EJERCICIOS_BASE.map((e) => e.category)]);
  for (const e of biblioteca) if (e.category) set.add(e.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export const EjerciciosView: React.FC<EjerciciosViewProps> = ({ estado, esDemo, onCambio }) => {
  const customs = useMemo<Ejercicio[]>(() => {
    const arr = estado.customExercises;
    return Array.isArray(arr) ? (arr as Ejercicio[]) : [];
  }, [estado]);

  const [agregando, setAgregando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCat, setNuevaCat] = useState('Pecho');
  const [aviso, setAviso] = useState('');

  const biblioteca = useMemo(() => [...EJERCICIOS_BASE, ...customs], [customs]);
  const cats = useMemo(() => categorias(biblioteca), [biblioteca]);
  const idsBase = useMemo(() => new Set(EJERCICIOS_BASE.map((e) => e.id)), []);

  const agregar = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setAviso('Ponle un nombre al ejercicio');
      return;
    }
    if (biblioteca.some((e) => e.name.toLowerCase() === nombre.toLowerCase())) {
      setAviso('Ya existe un ejercicio con ese nombre');
      return;
    }
    const id = `custom-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    const nuevo: Ejercicio = { id, name: nombre, category: nuevaCat };
    if (!esDemo) {
      aplicarEstado((est) => {
        est.customExercises = [...(Array.isArray(est.customExercises) ? (est.customExercises as Ejercicio[]) : []), nuevo];
      });
      onCambio();
    }
    setNuevoNombre('');
    setAgregando(false);
    setAviso('');
  };

  const eliminar = (ej: Ejercicio) => {
    if (!esDemo) {
      aplicarEstado((est) => {
        const lista = Array.isArray(est.customExercises) ? (est.customExercises as Ejercicio[]) : [];
        est.customExercises = lista.filter((e) => e.id !== ej.id);
      });
      onCambio();
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" /> Biblioteca
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {EJERCICIOS_BASE.length} base + {customs.length} custom ={' '}
              <strong className="text-slate-200">{biblioteca.length} ejercicios</strong>
            </p>
          </div>
          <button
            onClick={() => setAgregando((a) => !a)}
            data-testid="boton-agregar-ejercicio"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all"
          >
            <Plus className="w-4 h-4" /> {agregando ? 'Cancelar' : 'Agregar custom'}
          </button>
        </div>

        {/* Formulario de alta (estructura {id,name,category} del viejo) */}
        {agregando && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre del ejercicio (ej: Press Landmine)"
              data-testid="input-nombre-ejercicio"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
            <div className="flex gap-2">
              <select
                value={nuevaCat}
                onChange={(e) => setNuevaCat(e.target.value)}
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60"
              >
                {cats.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={agregar}
                data-testid="boton-confirmar-ejercicio"
                className="px-5 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-all"
              >
                Guardar
              </button>
            </div>
            {esDemo && (
              <p className="text-[11px] text-amber-400/90">Modo demo — el ejercicio no se guarda de verdad.</p>
            )}
            {aviso && <p className="text-[11px] text-red-400">{aviso}</p>}
          </div>
        )}
      </div>

      {/* Listado por categoría */}
      {cats.map((cat) => {
        const lista = biblioteca.filter((e) => e.category === cat);
        return (
          <div key={cat} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40 flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-black text-white uppercase tracking-wider">{cat}</span>
              <span className="text-[10px] text-slate-500 ml-auto">{lista.length}</span>
            </div>
            <ul className="divide-y divide-slate-800">
              {lista.map((ej) => {
                const pr = estado.prs?.[ej.id];
                const uv = ultimaVez(ej.name, estado);
                const esCustom = !idsBase.has(ej.id);
                return (
                  <li key={ej.id} data-testid={`ej-${ej.id}`} className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {ej.name}
                        {esCustom && (
                          <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/40 text-teal-400">
                            CUSTOM
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {uv ? `Última vez ${uv.fecha}: ${uv.resumen}` : 'Sin historial todavía'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pr && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1">
                          <Trophy className="w-3 h-3" /> {etiquetaPR(pr)}
                        </span>
                      )}
                      {esCustom && (
                        <button
                          onClick={() => eliminar(ej)}
                          title={`Eliminar ${ej.name}`}
                          className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

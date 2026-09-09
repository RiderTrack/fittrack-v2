// ═══════════════════════════════════════════════════════════
// 🩺 SALUD VIEW — FitTrack V2 (F10 · HealthTrack fusionado)
// El apartado "Salud" de la barra inferior y del menú hamburguesa:
// el app HealthTrack completo como módulo del FitTrack, en
// pestañas (misma estructura del MediosView):
//   • Resumen: health score (anillo), métricas del día, tip del
//     bot, logros y gráficas de 7 días (agua y sueño)
//   • Hábitos: hidratación (meta + vasos rápidos) y sueño
//   • Registros: signos vitales (PA/FC/O2), síntomas con chips
//     y perfil de salud (sangre, alergias, emergencia)
//   • Medicamentos (F10.1): tratamientos PROFESIONALES — qué
//     pastilla, cuántos mg, a qué horas, por cuántos días,
//     plan de hoy, próxima toma y adherencia de 7 días
//   • Recetas: recetario completo con IA (buscar/importar) y
//     exportar a PDF
// El SaludBot ya NO vive aquí: se mudó junto a los robots (menu
// ☰ → 🤖 ROBOTS · IA, al lado del FitBot) como pediste.
// Acento CYAN (identidad del HealthTrack) sobre el diseño
// slate/emerald del FitTrack. Demo: datos semilla en memoria.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  HeartPulse, Droplets, ClipboardList, ChefHat, Pill,
} from 'lucide-react';
import type { EstadoFitTrack } from '../../types';
import { leerSalud, guardarSalud, hoySalud, aguaDeHoy, type EstadoSalud } from '../../services/salud';
import { TabResumen } from './TabResumen';
import { TabHabitos } from './TabHabitos';
import { TabRegistros } from './TabRegistros';
import { TabMedicamentos } from './TabMedicamentos';
import { TabRecetas } from './TabRecetas';

export type TabSalud = 'resumen' | 'habitos' | 'registros' | 'medicamentos' | 'recetas';

const TABS: { id: TabSalud; nombre: string; icono: React.ReactNode; activo: string }[] = [
  { id: 'resumen', nombre: 'Resumen', icono: <HeartPulse className="w-4 h-4" />, activo: 'bg-cyan-600 border-cyan-500 text-white' },
  { id: 'habitos', nombre: 'Hábitos', icono: <Droplets className="w-4 h-4" />, activo: 'bg-sky-600 border-sky-500 text-white' },
  { id: 'registros', nombre: 'Registros', icono: <ClipboardList className="w-4 h-4" />, activo: 'bg-blue-600 border-blue-500 text-white' },
  { id: 'medicamentos', nombre: 'Meds', icono: <Pill className="w-4 h-4" />, activo: 'bg-teal-600 border-teal-500 text-white' },
  { id: 'recetas', nombre: 'Recetas', icono: <ChefHat className="w-4 h-4" />, activo: 'bg-orange-600 border-orange-500 text-white' },
];

/** Semilla del modo demo (en memoria, no se persiste) */
function semillaDemo(): EstadoSalud {
  const hoy = hoySalud();
  const ayer = new Date(Date.now() - 86_400_000);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const base = leerSalud();
  return {
    ...base,
    agua: { [f(ayer)]: 2100, [hoy]: 1250 },
    sueno: { [hoy]: { fecha: hoy, horas: 7.2, calidad: 'Buena', ini: '23:40', fin: '06:52' } },
    vitales: [
      { id: 1, fecha: `${hoy} 08:15`, sis: 118, dia: 76, fc: 64, sat: 98 },
    ],
    meds: [
      {
        id: 1, nom: 'Creatina', cant: 5, unidad: 'g',
        horas: ['08:30'], cadaDias: 1, inicio: f(ayer), dias: 0,
        obs: 'post-entreno · uso continuo', pausado: false,
        tomas: { [hoy]: { '08:30': 'tomado' } },
      },
      {
        id: 2, nom: 'Paracetamol', cant: 500, unidad: 'mg',
        horas: ['08:00', '14:00', '20:00'], cadaDias: 1, inicio: f(ayer), dias: 5,
        obs: 'indicado por Dr. Pérez · con comida', pausado: false,
        tomas: { [hoy]: { '08:00': 'tomado', '14:00': 'tomado' } },
      },
    ],
    sintomas: [],
    perfil: { ...base.perfil, aguaMeta: 2500, sangre: 'O+' },
  };
}

interface SaludViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
  onCambio: () => void;
  onIrAMedidas: () => void;
  /** F10.1: el SaludBot vive con los robots (☰ → ROBOTS · IA) */
  onIrASaludBot: () => void;
}

export const SaludView: React.FC<SaludViewProps> = ({ estado, esDemo, onCambio, onIrAMedidas, onIrASaludBot }) => {
  const [tab, setTab] = useState<TabSalud>('resumen');
  const [est, setEst] = useState<EstadoSalud>(() =>
    esDemo && Object.keys(leerSalud().agua).length === 0 ? semillaDemo() : leerSalud(),
  );
  const [toastMsg, setToastMsg] = useState('');

  // Toast propio del módulo (mismo look del App, posición más alta:
  // aquí no hay mini-reproductor encima del nav)
  const toast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(''), 2600);
  };

  /** Toda mutación pasa por aquí: guarda + avisa al App (sync F8 re-lee) */
  const mutar = (fn: (e: EstadoSalud) => EstadoSalud) => {
    setEst((prev) => {
      const nuevo = fn(prev);
      if (!esDemo) guardarSalud(nuevo);
      return nuevo;
    });
    onCambio();
  };

  const aguaHoy = useMemo(() => aguaDeHoy(est), [est]);

  return (
    <div className="space-y-4 pb-4" data-testid="salud-view">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-cyan-400" />
          Salud
          <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
            F10.1
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Tu bienestar junto a tu entrenamiento — hidratación, sueño, signos, tratamientos y recetario 🩺
          {aguaHoy > 0 && (
            <span className="ml-1 text-cyan-300 font-bold">· hoy: {aguaHoy}mL 💧</span>
          )}
        </p>
      </div>

      {/* Barra de pestañas (patrón MediosView) */}
      <div className="grid grid-cols-5 gap-1.5" role="tablist" aria-label="Salud">
        {TABS.map(({ id, nombre, icono, activo }) => {
          const activa = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              data-testid={`subtab-salud-${id}`}
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

      {/* Contenido de la pestaña activa */}
      {tab === 'resumen' && (
        <TabResumen est={est} estado={estado} onIrATab={(t) => setTab(t)} onIrAMedidas={onIrAMedidas} onIrASaludBot={onIrASaludBot} />
      )}
      {tab === 'habitos' && <TabHabitos est={est} mutar={mutar} toast={toast} />}
      {tab === 'registros' && <TabRegistros est={est} mutar={mutar} toast={toast} />}
      {tab === 'medicamentos' && <TabMedicamentos est={est} mutar={mutar} toast={toast} />}
      {tab === 'recetas' && <TabRecetas toast={toast} />}

      {/* Toast del módulo */}
      {toastMsg && (
        <div
          data-testid="toast-salud"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-xl bg-slate-800 border border-cyan-500/50 text-sm font-bold text-cyan-200 shadow-2xl whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
};

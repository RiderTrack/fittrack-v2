// ═══════════════════════════════════════════════════════════
// 🤖 SALUDBOT VIEW — FitTrack V2 (F10.1)
// El chat de salud como VISTA PROPIA, junto a los robots:
//   ☰ → 🤖 ROBOTS · IA → SaludBot (al lado del FitBot)
// Antes era la 5ª pestaña del módulo Salud — pediste moverlo
// a donde están los robots, y aquí está.
// Es dueña de su propio acceso al estado de salud (FT2_SALUD):
// lee al montar, y cuando el bot detecta un medicamento lo
// guarda como tratamiento (el usuario completa horarios/días
// en Salud → Medicamentos). El módulo Salud relee al volver.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Bot, Dumbbell as DumbbellIcon, HeartPulse, ArrowRight } from 'lucide-react';
import {
  leerSalud, guardarSalud, guardarMed, type EstadoSalud, type NuevoMedicamento,
} from '../../services/salud';
import { TabSaludBot } from './TabSaludBot';

interface SaludBotViewProps {
  esDemo: boolean;
  onCambio: () => void;
  /** para volver al módulo Salud (botón 'ver mi salud') */
  onIrASalud: () => void;
}

export const SaludBotView: React.FC<SaludBotViewProps> = ({ esDemo, onCambio, onIrASalud }) => {
  const [est] = useState<EstadoSalud>(() => leerSalud());

  /** Guarda el tratamiento detectado en el chat (persiste y avisa) */
  const guardarDesdeChat = (med: NuevoMedicamento) => {
    const nuevo = guardarMed(est, med);
    if (!esDemo) guardarSalud(nuevo);
    onCambio();
  };

  return (
    <div className="space-y-4 pb-4" data-testid="vista-saludbot">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          SaludBot
          <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
            🤖 ROBOTS · IA
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Tu robot de salud: suplementos, nutrición, sueño e hidratación — con tus datos reales de hoy
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700 text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
            <DumbbellIcon className="w-3 h-3 text-emerald-400" /> FitBot · entreno
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5">
            <HeartPulse className="w-3 h-3 text-emerald-400" /> SaludBot · salud
          </span>
          <button
            onClick={onIrASalud}
            data-testid="boton-ver-salud"
            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 ml-auto"
          >
            Ver mi salud <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Chat */}
      <TabSaludBot est={est} onGuardarMed={guardarDesdeChat} />
    </div>
  );
};

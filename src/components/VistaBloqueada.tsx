// ═══════════════════════════════════════════════════════════
// 🔒 VISTA BLOQUEADA — FitTrack V2 (F1)
// Placeholder de las vistas que aterrizan en F2-F5 (patrón del
// roadmap del shell F0, ahora navegable): candado + qué traerá
// la fase + regreso al dashboard.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';

interface VistaBloqueadaProps {
  nombre: string;
  fase: string;
  descripcion: string;
  onVolver: () => void;
}

export const VistaBloqueada: React.FC<VistaBloqueadaProps> = ({ nombre, fase, descripcion, onVolver }) => (
  <div className="flex items-center justify-center py-12">
    <div className="max-w-sm text-center px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 mb-4">
        <Lock className="w-7 h-7 text-slate-400" />
      </div>
      <h2 className="text-lg font-black text-white">{nombre}</h2>
      <span className="inline-block mt-2 text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
        {fase}
      </span>
      <p className="text-sm text-slate-400 mt-4 leading-relaxed">{descripcion}</p>
      <button
        onClick={onVolver}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════
// 💧😴 TAB HÁBITOS — Salud (F10)
// Puerto del screen "Hábitos" del HealthTrack:
//   • Agua: total del día con meta editable, vasos rápidos
//     (+250/+500/+750), monto a medida y reinicio (resetAgua)
//   • Sueño: hora de dormir/despertar (vuelta de medianoche
//     incluida, igual que el viejo) + calidad + historial
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Droplets, Moon, Plus, RotateCcw, Trash2, Check } from 'lucide-react';
import {
  aguaDeHoy, addAgua, resetAgua, cambiarAguaMeta, guardarSueno, borrarSueno,
  CALIDADES_SUENO, type EstadoSalud, type RegistroSueno,
} from '../../services/salud';

interface TabHabitosProps {
  est: EstadoSalud;
  mutar: (fn: (e: EstadoSalud) => EstadoSalud) => void;
  toast: (msg: string) => void;
}

export const TabHabitos: React.FC<TabHabitosProps> = ({ est, mutar, toast }) => {
  const agua = aguaDeHoy(est);
  const meta = est.perfil.aguaMeta || 2000;
  const pct = Math.min(100, Math.round((agua / meta) * 100));
  const [mlCustom, setMlCustom] = useState('');
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTxt, setMetaTxt] = useState(String(meta));

  // Sueño
  const [sIni, setSIni] = useState('23:30');
  const [sFin, setSFin] = useState('07:00');
  const [sCal, setSCal] = useState<RegistroSueno['calidad']>('Buena');
  // tipado explícito: sin él, TS pierde el tipo en la cadena .sort()
  const todosSuenos: RegistroSueno[] = Object.values(est.sueno);
  const suenos = todosSuenos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 5);

  const agregar = (ml: number) => {
    mutar((e) => addAgua(e, ml));
  };

  const guardarS = () => {
    const r = guardarSueno(est, sIni, sFin, sCal);
    if (!r) {
      toast('Revisa las horas de dormir/despertar');
      return;
    }
    mutar(() => r.est);
    toast(`✅ Sueño: ${r.horas}h guardado`);
  };

  return (
    <div className="space-y-4" data-testid="tab-salud-habitos">
      {/* ── AGUA ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700" data-testid="card-agua">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-widest text-cyan-400 flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5" /> HIDRATACIÓN DE HOY
          </p>
          <button
            onClick={() => mutar((e) => resetAgua(e))}
            data-testid="boton-reset-agua"
            title="Reiniciar el día"
            className="w-8 h-8 rounded-lg border border-slate-600 text-slate-400 hover:text-red-300 hover:border-red-500/50 flex items-center justify-center transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-end gap-2 mt-3">
          <p className="text-4xl font-black text-white leading-none" data-testid="agua-hoy">{agua}</p>
          <p className="text-sm text-slate-400 font-bold mb-1">/ {meta} mL</p>
        </div>

        {/* Barra de progreso */}
        <div className="mt-3 h-3 rounded-full bg-slate-700/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
            data-testid="barra-agua"
          />
        </div>
        <p className="text-[10px] text-slate-500 font-bold mt-1 text-right">
          {pct}% {agua >= meta ? '· ¡META CUMPLIDA! 🌟' : `· FALTAN ${meta - agua} mL`}
        </p>

        {/* Vasos rápidos + custom */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[250, 500, 750].map((ml) => (
            <button
              key={ml}
              onClick={() => agregar(ml)}
              data-testid={`boton-agua-${ml}`}
              className="py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-black hover:bg-cyan-500/25 active:scale-95 transition-all flex flex-col items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" /> {ml}mL
            </button>
          ))}
          <div className="flex">
            <input
              value={mlCustom}
              onChange={(e) => setMlCustom(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="mL"
              inputMode="numeric"
              data-testid="input-agua-custom"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-l-xl px-2 text-xs text-white font-bold placeholder:text-slate-600 outline-none focus:border-cyan-500/60"
            />
            <button
              onClick={() => {
                const ml = parseInt(mlCustom, 10);
                if (ml > 0) { agregar(ml); setMlCustom(''); }
              }}
              data-testid="boton-agua-custom"
              className="px-2.5 rounded-r-xl bg-cyan-500 text-white font-black text-xs hover:bg-cyan-400 active:scale-95 transition-all flex items-center"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {editandoMeta ? (
            <>
              <input
                value={metaTxt}
                onChange={(e) => setMetaTxt(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                className="flex-1 bg-slate-900/70 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-cyan-500/60"
              />
              <button
                onClick={() => {
                  const m = parseInt(metaTxt, 10);
                  if (m > 0) mutar((e) => cambiarAguaMeta(e, m));
                  setEditandoMeta(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 text-white text-xs font-black hover:bg-cyan-400 transition-all"
              >
                Guardar
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMetaTxt(String(meta)); setEditandoMeta(true); }}
              data-testid="boton-editar-meta-agua"
              className="text-[10px] font-bold text-slate-500 hover:text-cyan-300 transition-colors"
            >
              ✏️ cambiar meta diaria ({meta} mL)
            </button>
          )}
        </div>
      </div>

      {/* ── SUEÑO ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700" data-testid="card-sueno">
        <p className="text-[10px] font-black tracking-widest text-violet-400 flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5" /> SUEÑO DE ANOCHE
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <label className="text-[9px] font-black text-slate-500 tracking-wider block mb-1">DORMÍ A LAS</label>
            <input
              type="time"
              value={sIni}
              onChange={(e) => setSIni(e.target.value)}
              data-testid="input-sueno-ini"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-2 py-2 text-sm text-white font-bold outline-none focus:border-violet-500/60"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 tracking-wider block mb-1">DESPERTÉ A LAS</label>
            <input
              type="time"
              value={sFin}
              onChange={(e) => setSFin(e.target.value)}
              data-testid="input-sueno-fin"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-2 py-2 text-sm text-white font-bold outline-none focus:border-violet-500/60"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 tracking-wider block mb-1">CALIDAD</label>
            <select
              value={sCal}
              onChange={(e) => setSCal(e.target.value as RegistroSueno['calidad'])}
              data-testid="select-sueno-calidad"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-2 py-2 text-sm text-white font-bold outline-none focus:border-violet-500/60"
            >
              {CALIDADES_SUENO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={guardarS}
          data-testid="boton-guardar-sueno"
          className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all"
        >
          💾 Guardar sueño
        </button>

        {/* Historial */}
        <div className="mt-4 space-y-2" data-testid="lista-sueno">
          {suenos.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">Sin registros todavía</p>
          )}
          {suenos.map((s) => (
            <div key={s.fecha} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <Moon className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{s.horas}h · {s.calidad}</p>
                <p className="text-[10px] text-slate-500">{s.fecha} · {s.ini} → {s.fin}</p>
              </div>
              <button
                onClick={() => mutar((e) => borrarSueno(e, s.fecha))}
                title="Borrar"
                className="w-8 h-8 rounded-lg text-red-400/60 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🩺 TAB RESUMEN — Salud (F10)
// El "Inicio" del HealthTrack: health score en anillo (fórmula
// exacta del viejo), métricas del día (agua, sueño, peso/IMC
// tomado de las Medidas del FitTrack — sin duplicar datos —,
// PA/FC), tip contextual del bot, los 3 logros y las gráficas
// de 7 días (agua y sueño) reutilizando la GraficaLinea de F4.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { Droplets, Moon, Weight, HeartPulse, RefreshCw, ChevronRight, Scale } from 'lucide-react';
import type { EstadoFitTrack } from '../../types';
import {
  aguaDeHoy, suenoDeHoy, calcularScore, tipDelDia, calcularLogros,
  serieAgua, serieSueno, type EstadoSalud,
} from '../../services/salud';
import { GraficaLinea } from '../GraficaLinea';
import type { TabSalud } from './SaludView';

interface TabResumenProps {
  est: EstadoSalud;
  estado: EstadoFitTrack;
  onIrATab: (t: TabSalud) => void;
  onIrAMedidas: () => void;
}

const fmtDia = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export const TabResumen: React.FC<TabResumenProps> = ({ est, estado, onIrATab, onIrAMedidas }) => {
  const score = useMemo(() => calcularScore(est), [est]);
  const agua = aguaDeHoy(est);
  const sueno = suenoDeHoy(est);
  const meta = est.perfil.aguaMeta || 2000;
  const [tip, setTip] = useState(() => tipDelDia(est));

  // Peso/IMC: del módulo Medidas del FitTrack (F4) — sin duplicar
  const medidas = estado.measurements ?? [];
  const ultimaConPeso = [...medidas].reverse().find((m) => m.weight && m.weight > 0);
  const tallaCm = ultimaConPeso?.height ?? (parseFloat(est.perfil.talla) || 0);
  const imc = ultimaConPeso?.weight && tallaCm > 100
    ? ultimaConPeso.weight / Math.pow(tallaCm / 100, 2)
    : null;

  const lastVital = est.vitales[est.vitales.length - 1];
  const logros = useMemo(() => calcularLogros(est, medidas.length), [est, medidas.length]);

  // Anillo (geometría del viejo: r=42 → 263.9 de circunferencia)
  const CIRC = 263.9;
  const offset = CIRC - (CIRC * score.score) / 100;
  const colorAnillo = score.score >= 85 ? '#34d399' : score.score >= 70 ? '#22d3ee' : score.score >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-4" data-testid="tab-salud-resumen">
      {/* Health Score */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
            <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="55" cy="55" r="42" fill="none" stroke={colorAnillo} strokeWidth="10"
              strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 600ms ease' }}
              data-testid="anillo-score"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white" data-testid="score-valor">{score.score}</span>
            <span className="text-[9px] text-slate-400 font-bold tracking-wider">/100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-black ${score.color}`} data-testid="score-etiqueta">{score.etiqueta}</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">{score.mensaje}</p>
          <div className="flex gap-2 mt-3 text-[10px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">💧 {score.detalles.aguaPts}/25</span>
            <span className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300">😴 {score.detalles.suenoPts}/25</span>
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">💊 {score.detalles.medsPts}/10</span>
          </div>
        </div>
      </div>

      {/* Métricas del día */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onIrATab('habitos')}
          data-testid="metrica-agua"
          className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center hover:border-cyan-500/50 transition-all"
        >
          <Droplets className="w-5 h-5 mx-auto text-cyan-400" />
          <p className="text-xl font-black text-white mt-1">{agua}<span className="text-xs text-slate-400">mL</span></p>
          <p className="text-[10px] text-slate-500 font-bold">DE {meta} · {Math.round((agua / meta) * 100)}%</p>
        </button>
        <button
          onClick={() => onIrATab('habitos')}
          data-testid="metrica-sueno"
          className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center hover:border-violet-500/50 transition-all"
        >
          <Moon className="w-5 h-5 mx-auto text-violet-400" />
          <p className="text-xl font-black text-white mt-1">{sueno ? sueno.horas : '--'}<span className="text-xs text-slate-400">h</span></p>
          <p className="text-[10px] text-slate-500 font-bold">{sueno ? sueno.calidad.toUpperCase() : 'SIN REGISTRO'}</p>
        </button>
        <button
          onClick={ultimaConPeso ? onIrAMedidas : onIrAMedidas}
          data-testid="metrica-peso"
          className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center hover:border-emerald-500/50 transition-all"
        >
          {imc ? <Weight className="w-5 h-5 mx-auto text-emerald-400" /> : <Scale className="w-5 h-5 mx-auto text-emerald-400" />}
          <p className="text-xl font-black text-white mt-1">{imc ? imc.toFixed(1) : '--'}</p>
          <p className="text-[10px] text-slate-500 font-bold">
            {ultimaConPeso ? `${ultimaConPeso.weight}KG · IMC` : 'REGISTRA EN MEDIDAS'}
          </p>
        </button>
        <button
          onClick={() => onIrATab('registros')}
          data-testid="metrica-vitales"
          className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center hover:border-red-500/50 transition-all"
        >
          <HeartPulse className="w-5 h-5 mx-auto text-red-400" />
          <p className="text-xl font-black text-white mt-1">{lastVital ? `${lastVital.sis}/${lastVital.dia}` : '--/--'}</p>
          <p className="text-[10px] text-slate-500 font-bold">
            {lastVital ? `mmHg${lastVital.fc ? ` · ${lastVital.fc}LPM` : ''}` : 'SIGNOS VITALES'}
          </p>
        </button>
      </div>

      {/* Tip del bot */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-cyan-500/30">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black tracking-widest text-cyan-400">🤖 TIP DE SALUDBOT</p>
          <button
            onClick={() => setTip(tipDelDia(est))}
            data-testid="boton-otro-tip"
            title="Otro tip"
            className="w-8 h-8 rounded-lg border border-slate-600 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 flex items-center justify-center transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed mt-2" data-testid="tip-salud">{tip}</p>
        <button
          onClick={() => onIrATab('saludbot')}
          className="mt-3 text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          Preguntarle algo a SaludBot <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Logros */}
      <div className="grid grid-cols-3 gap-3" data-testid="logros-salud">
        {logros.map((l) => (
          <div
            key={l.t}
            className={`p-3 rounded-xl border text-center transition-all ${
              l.ok ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/40 border-slate-700/60 opacity-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${l.clases} flex items-center justify-center text-lg mx-auto shadow-lg`}>
              {l.emoji}
            </div>
            <p className="text-[11px] font-black text-white mt-2">{l.t}</p>
            <p className="text-[9px] text-slate-500">{l.d}</p>
          </div>
        ))}
      </div>

      {/* Gráficas 7 días */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700" data-testid="graficas-salud">
        <p className="text-[10px] font-black tracking-widest text-slate-400 mb-3">📈 ÚLTIMOS 7 DÍAS</p>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-cyan-300 mb-1">💧 Agua (mL)</p>
            <GraficaLinea
              etiquetas={serieAgua(est).map((p) => fmtDia(p.dia))}
              valores={serieAgua(est).map((p) => p.valor)}
              unidad="mL"
              color="teal"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-violet-300 mb-1">😴 Sueño (h)</p>
            <GraficaLinea
              etiquetas={serieSueno(est).map((p) => fmtDia(p.dia))}
              valores={serieSueno(est).map((p) => p.valor)}
              unidad="h"
              color="violet"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

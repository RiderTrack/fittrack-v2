// ═══════════════════════════════════════════════════════════
// 📊 ESTADÍSTICAS — FitTrack V2 (F9 · Pro)
// Tercera pestaña del módulo Progreso (Historial · Medidas ·
// Estadísticas). Solo LECTURA del estado: todo el cálculo vive
// en services/analiticas.ts (funciones puras testeables).
// Lo que las apps pro enseñan: resumen de vida, semana vs
// semana, volumen 12 semanas, músculos más entrenados, peso,
// récords con progreso real, consistencia y días favoritos.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import {
  BarChart3, TrendingUp, Scale, Trophy, Target, CalendarDays,
  Flame, Clock, Dumbbell, ChevronRight, PieChart, Activity,
} from 'lucide-react';
import type { EstadoFitTrack, PerfilEntreno } from '../types';
import { formatearVolumen } from '../services/storageFit';
import { GraficaLinea } from './GraficaLinea';
import {
  resumenGlobal, comparativaSemanal, volumenSemanal12,
  distribucionGrupos, evolucionPeso, prsConProgreso, consistencia, diasFavoritos,
} from '../services/analiticas';

interface EstadisticasViewProps {
  estado: EstadoFitTrack;
  perfil: PerfilEntreno | null;
  esDemo: boolean;
  onIrAEntreno: () => void;
  onIrAMedidas: () => void;
}

/** 145 min → "2 h 25 min" · 45 → "45 min" */
function fmtDuracion(min: number): string {
  if (min <= 0) return '0';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Chip de delta con flecha (verde si sube, rojo si baja, neutro si null) */
const ChipDelta: React.FC<{ valor: number | null | undefined; etiqueta: string; invertir?: boolean }> = ({
  valor, etiqueta, invertir = false,
}) => {
  if (valor === null || valor === undefined) return null;
  const subio = valor > 0;
  const positivo = invertir ? !subio && valor !== 0 : subio;
  const color = valor === 0
    ? 'text-slate-400 bg-slate-800/60 border-slate-600/50'
    : positivo
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40'
      : 'text-red-300 bg-red-500/10 border-red-500/40';
  const flecha = valor === 0 ? '→' : subio ? '▲' : '▼';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${color}`}>
      {flecha} {valor > 0 ? '+' : ''}{valor} {etiqueta}
    </span>
  );
};

const COLORES_BARRAS = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-amber-500'];

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({
  estado, perfil, esDemo, onIrAEntreno, onIrAMedidas,
}) => {
  const historial = estado.workoutHistory ?? [];

  // ── Estado vacío: primera experiencia ──
  if (historial.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center" data-testid="estadisticas-vacias">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 mb-4">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-white">Tus estadísticas nacen en el gym</h2>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
          Registra tu primera sesión y aquí vas a ver tu volumen por semana, los músculos que
          entrenas más, la evolución de tu peso, tus récords y tu consistencia.
        </p>
        <button
          onClick={onIrAEntreno}
          data-testid="cta-primer-entreno"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors"
        >
          <Dumbbell className="w-4 h-4" /> Ir a entrenar
        </button>
      </div>
    );
  }

  // ── Motor (todo puro, recalcula por render — historial chico) ──
  const resumen = resumenGlobal(estado);
  const comparativa = comparativaSemanal(estado);
  const vol12 = volumenSemanal12(estado);
  const grupos = distribucionGrupos(estado, 90);
  const peso = evolucionPeso(estado.measurements ?? []);
  const prs = prsConProgreso(estado, 5);
  const consist = consistencia(estado, perfil, 4);
  const dias = diasFavoritos(estado);

  const maxVol12 = Math.max(...vol12.valores, 1);
  const maxGrupo = grupos[0]?.veces ?? 1;
  const maxDias = Math.max(...dias.map((d) => d.veces), 1);
  const mejorDia = dias.reduce((a, b) => (b.veces > a.veces ? b : a), dias[0]);

  const kpis = [
    { icono: <Dumbbell className="w-4 h-4" />, valor: String(resumen.sesiones), etiqueta: 'Sesiones totales', id: 'stats-total-sesiones' },
    { icono: <Activity className="w-4 h-4" />, valor: formatearVolumen(resumen.volumen), etiqueta: 'kg movidos en total', id: 'stats-total-volumen' },
    { icono: <Clock className="w-4 h-4" />, valor: fmtDuracion(resumen.minutos), etiqueta: 'Tiempo entrenado', id: 'stats-total-minutos' },
    { icono: <Flame className="w-4 h-4" />, valor: `${resumen.mejorRacha}d`, etiqueta: 'Mejor racha', id: 'stats-mejor-racha' },
  ];

  return (
    <div className="space-y-4" data-testid="estadisticas-view">

      {/* ── 1 · Resumen global ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Tu historia</span>
          </div>
          {resumen.desde && (
            <span className="text-[10px] text-slate-500" data-testid="stats-desde">
              desde {resumen.desde}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {kpis.map((k) => (
            <div key={k.id} data-testid={k.id} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-2.5 text-center">
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 mb-1.5">
                {k.icono}
              </div>
              <p className="text-base font-black text-white leading-none">{k.valor}</p>
              <p className="text-[9px] text-slate-400 mt-1 leading-tight">{k.etiqueta}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2 · Semana vs semana ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4" data-testid="stats-comparativa">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Esta semana vs la anterior</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Actual</p>
            <p className="text-xl font-black text-white mt-1" data-testid="comp-volumen-actual">
              {formatearVolumen(comparativa.volumenActual)} kg
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5" data-testid="comp-sesiones-actual">
              {comparativa.sesionesActual} {comparativa.sesionesActual === 1 ? 'sesión' : 'sesiones'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Anterior</p>
            <p className="text-xl font-black text-slate-300 mt-1" data-testid="comp-volumen-anterior">
              {formatearVolumen(comparativa.volumenAnterior)} kg
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5" data-testid="comp-sesiones-anterior">
              {comparativa.sesionesAnterior} {comparativa.sesionesAnterior === 1 ? 'sesión' : 'sesiones'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {comparativa.deltaPctVolumen !== null ? (
            <ChipDelta valor={comparativa.deltaPctVolumen} etiqueta="% volumen" />
          ) : (
            <span className="text-[10px] text-slate-500 px-2 py-1 rounded-full border border-slate-600/50 bg-slate-800/60">
              primera semana con datos
            </span>
          )}
          {comparativa.sesionesAnterior > 0 && (
            <ChipDelta valor={comparativa.sesionesActual - comparativa.sesionesAnterior} etiqueta="sesiones" />
          )}
        </div>
      </div>

      {/* ── 3 · Volumen 12 semanas ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold text-white">Volumen · últimas 12 semanas</span>
          </div>
          <span className="text-[10px] text-slate-500">kg por semana</span>
        </div>
        <div className="flex items-end gap-1.5 h-28" data-testid="stats-volumen-semanal">
          {vol12.valores.map((v, i) => {
            const altura = Math.max(4, Math.round((v / maxVol12) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group">
                <span className="text-[8px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatearVolumen(v)}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${v > 0 ? 'bg-gradient-to-t from-emerald-600/70 to-teal-400/80' : 'bg-slate-800'}`}
                  style={{ height: `${altura}%` }}
                  title={`${vol12.etiquetas[i]}: ${formatearVolumen(v)} kg`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1">
          {vol12.etiquetas.map((e, i) => (
            <span key={i} className="flex-1 text-center text-[7px] text-slate-500 truncate">
              {i % 3 === 0 ? e : ''}
            </span>
          ))}
        </div>
      </div>

      {/* ── 4 · Distribución por grupo muscular (90 días) ── */}
      {grupos.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-white">Músculos más entrenados</span>
            </div>
            <span className="text-[10px] text-slate-500">últimos 90 días</span>
          </div>
          <div className="space-y-2.5" data-testid="stats-grupos">
            {grupos.slice(0, 8).map((g, i) => (
              <div key={g.grupo} data-testid={`stats-grupo-${g.grupo.toLowerCase().replace(/[^a-z]/g, '')}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">{g.grupo}</span>
                  <span className="text-[10px] text-slate-400">
                    <span className="font-black text-white">{g.pct}%</span>
                    <span className="text-slate-500"> · {g.veces} {g.veces === 1 ? 'vez' : 'veces'}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${COLORES_BARRAS[i % COLORES_BARRAS.length]} transition-all duration-500`}
                    style={{ width: `${Math.max(4, (g.veces / maxGrupo) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-500 mt-3 leading-relaxed">
            Cuenta cada ejercicio registrado por sesión. Calentamientos y enfriamientos no entran.
          </p>
        </div>
      )}

      {/* ── 5 · Peso corporal ── */}
      {peso.valores.length >= 2 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-bold text-white">Peso corporal</span>
            </div>
            <button
              onClick={onIrAMedidas}
              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
              data-testid="stats-ir-a-medidas"
            >
              Medidas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <GraficaLinea etiquetas={peso.etiquetas} valores={peso.valores} unidad="kg" color="teal" />
          <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="stats-peso-deltas">
            <span className="text-xs text-slate-400">
              {peso.inicial} → <span className="font-black text-white">{peso.actual} kg</span>
            </span>
            <ChipDelta valor={peso.delta} etiqueta="kg" invertir />
            {peso.grasaDelta !== undefined && <ChipDelta valor={peso.grasaDelta} etiqueta="% grasa" invertir />}
            {peso.cinturaDelta !== undefined && <ChipDelta valor={peso.cinturaDelta} etiqueta="cm cintura" invertir />}
            {peso.brazoDelta !== undefined && <ChipDelta valor={peso.brazoDelta} etiqueta="cm brazo" />}
            {peso.musculoDelta !== undefined && <ChipDelta valor={peso.musculoDelta} etiqueta="% músculo" />}
          </div>
        </div>
      )}

      {/* ── 6 · Récords con progreso ── */}
      {prs.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">Tus récords (1RM estimado)</span>
          </div>
          <ul className="space-y-2.5" data-testid="stats-prs">
            {prs.map((pr) => (
              <li
                key={pr.id}
                data-testid={`stats-pr-${pr.id}`}
                className="rounded-xl bg-slate-800/40 border border-slate-700/40 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{pr.nombre}</span>
                  <span className="text-xs font-black text-amber-400 shrink-0">
                    {pr.peso} kg × {pr.reps}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">
                    1RM Epley: <span className="font-bold text-slate-200">{pr.rm1} kg</span>
                  </span>
                  {pr.deltaPct !== undefined ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-bold text-emerald-300" data-testid={`stats-pr-delta-${pr.id}`}>
                      {pr.deltaPct > 0 ? '▲' : '→'} {pr.deltaPct > 0 ? '+' : ''}{pr.deltaPct}% peso
                      {pr.pesoPrimera ? ` (desde ${pr.pesoPrimera} kg)` : ''}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500">sin historial previo</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 7 · Consistencia ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Consistencia</span>
          </div>
          <span className="text-[10px] text-slate-500">
            objetivo: {consist.objetivo}/sem {perfil ? '' : '(default 3)'}
          </span>
        </div>
        <div className="flex items-end gap-3 h-20 mb-2" data-testid="stats-consistencia">
          {consist.semanas.map((sem) => {
            const altura = Math.min(100, Math.round((sem.hechas / consist.objetivo) * 100));
            return (
              <div key={sem.inicioISO} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[9px] font-bold text-slate-300">{sem.hechas}/{consist.objetivo}</span>
                <div className="w-full h-full rounded-lg bg-slate-800 relative overflow-hidden flex items-end">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      sem.hechas >= consist.objetivo
                        ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                        : sem.hechas > 0
                          ? 'bg-gradient-to-t from-teal-700 to-teal-500'
                          : 'bg-slate-700/60'
                    }`}
                    style={{ height: `${Math.max(altura, 6)}%` }}
                  />
                </div>
                <span className="text-[8px] text-slate-500">{sem.actual ? 'actual' : sem.etiqueta}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {consist.hechasTotal} de {consist.esperadas} sesiones esperadas en 4 semanas
          </span>
          <span
            className={`text-sm font-black ${consist.pct >= 80 ? 'text-emerald-400' : consist.pct >= 50 ? 'text-teal-400' : 'text-slate-300'}`}
            data-testid="stats-consistencia-pct"
          >
            {consist.pct}%
          </span>
        </div>
      </div>

      {/* ── 8 · Días favoritos ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-bold text-white">Días favoritos</span>
          </div>
          {mejorDia.veces > 0 && (
            <span className="text-[10px] text-slate-500">
              tu día: <span className="font-bold text-sky-300">{mejorDia.dia}</span>
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 h-16" data-testid="stats-dias">
          {dias.map((d) => (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[9px] font-bold text-slate-400">{d.veces || ''}</span>
              <div
                className={`w-full rounded-t-md transition-all ${d.veces === maxDias && d.veces > 0 ? 'bg-gradient-to-t from-sky-600 to-sky-400' : 'bg-slate-700/70'}`}
                style={{ height: `${Math.max(8, (d.veces / maxDias) * 100)}%` }}
              />
              <span className="text-[8px] text-slate-500">{d.dia}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nota demo */}
      {esDemo && (
        <p className="text-center text-[10px] text-slate-500 leading-relaxed" data-testid="stats-nota-demo">
          Datos de ejemplo del modo demo — crea tu cuenta para ver tus estadísticas reales.
        </p>
      )}
    </div>
  );
};

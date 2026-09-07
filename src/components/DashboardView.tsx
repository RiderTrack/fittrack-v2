// ═══════════════════════════════════════════════════════════
// 📊 DASHBOARD — FitTrack V2 (F1 · Acceso)
// Réplica del dashboard del app viejo leyendo el state real
// (FITTRACK_ALPHA_V2_STATE, SOLO LECTURA): sesiones/volumen de
// la semana, racha, peso con la meta 93→87, última sesión,
// PRs, mini gráfico de 5 sesiones, heatmap 15 semanas y la
// sugerencia del día (mismo mapeo de día → grupo del viejo).
// ═══════════════════════════════════════════════════════════

import React from 'react';
import {
  Flame, Dumbbell, TrendingUp, Scale, Trophy, CalendarDays,
  Activity, Zap, PackageCheck, ChevronRight, BarChart3,
} from 'lucide-react';
import type { EstadoFitTrack, PerfilEntreno, PRLevantamiento, SesionEntreno } from '../types';
import {
  sesionesUltimosDias, volumenTotal, formatearVolumen, diasDesde, progresoPeso,
} from '../services/storageFit';
import { comparativaSemanal } from '../services/analiticas';

// Mapeo del viejo: getDay() → grupo sugerido
const GRUPO_POR_DIA = ['Descanso', 'Pecho + Tríceps', 'Espalda + Bíceps', 'Core + Cardio', 'Piernas', 'Hombros', 'Full Body'];

const ETIQUETA_MODO: Record<string, string> = {
  hipertrofia: 'Hipertrofia',
  fuerza: 'Fuerza',
  potencia: 'Potencia',
  descarga: 'Descarga',
};

interface DashboardViewProps {
  nombre: string;
  estado: EstadoFitTrack;
  perfil: PerfilEntreno | null;
  esDemo: boolean;
  onIrPerfil: () => void;
  onIrAEstadisticas: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  nombre, estado, perfil, esDemo, onIrPerfil, onIrAEstadisticas,
}) => {
  const sesionesSemana = sesionesUltimosDias(estado, 7);
  const volumenSemana = volumenTotal(sesionesSemana);
  const racha = typeof estado.streak === 'number' ? estado.streak : 0;
  const historial = estado.workoutHistory ?? [];
  const ultimaSesion: SesionEntreno | undefined = historial[0];
  const pesoActual = estado.measurements?.[0]?.weight ?? 93;
  const progreso = progresoPeso(pesoActual);

  // PRs: top 4 en orden de inserción (como el viejo)
  const mapaPRs: Record<string, PRLevantamiento> = estado.prs ?? {};
  const prs = Object.entries(mapaPRs).slice(0, 4);

  // Mini gráfico: últimas 5 sesiones en orden cronológico (como el viejo)
  const ultimas5 = historial.slice(0, 5).reverse();
  const maxVol = Math.max(...ultimas5.map((s) => s.volume ?? 0), 1);

  // Sugerencia del día (mismo mapeo del viejo, sin motor FitBot aún)
  const hoy = new Date().getDay();
  const sugerenciaHoy = GRUPO_POR_DIA[hoy];

  // Heatmap 15 semanas (como renderHeatmap del viejo): lunes de hace 14 semanas
  const diasEntreno = new Set(historial.map((s) => s.date));
  const hoyFecha = new Date();
  const lunesBase = new Date(hoyFecha);
  lunesBase.setDate(hoyFecha.getDate() - hoyFecha.getDay() - 14 * 7 + 1); // lunes semana -14
  const celdas: { fecha: string; activo: boolean }[] = [];
  for (let i = 0; i < 15 * 7; i++) {
    const d = new Date(lunesBase);
    d.setDate(lunesBase.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    celdas.push({ fecha: iso, activo: diasEntreno.has(iso) });
  }

  const diasSinEntrenar = diasDesde(estado.lastWorkoutDate ?? null);
  const textoRacha = racha >= 5 ? '¡En racha!' : racha >= 3 ? 'Buen ritmo' : racha > 0 ? 'Sigue así' : 'A romper el hielo';

  // F9 · Comparativa semanal compacta (el detalle vive en Estadísticas)
  const comp = comparativaSemanal(estado);
  const deltaComp = comp.deltaPctVolumen;

  const kpis = [
    { icono: <Dumbbell className="w-5 h-5" />, valor: String(sesionesSemana.length), etiqueta: 'Sesiones esta semana', id: 'kpi-sesiones' },
    { icono: <Activity className="w-5 h-5" />, valor: `${formatearVolumen(volumenSemana)} kg`, etiqueta: 'Volumen semanal', id: 'kpi-volumen' },
    { icono: <Flame className="w-5 h-5" />, valor: `${racha} ${racha === 1 ? 'día' : 'días'}`, etiqueta: textoRacha, id: 'kpi-racha' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Banner datos migrados (solo cuenta real con datos viejos) ── */}
      {!esDemo && historial.length > 0 && (
        <div
          data-testid="banner-migracion"
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3"
        >
          <PackageCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300 leading-relaxed">
            Tus <span className="font-bold">{historial.length} sesiones</span>,{' '}
            {estado.measurements?.length ?? 0} medidas y {Object.keys(estado.prs ?? {}).length} PRs del
            FitTrack actual ya están aquí. Nada se perdió en la actualización.
          </p>
        </div>
      )}

      {/* ── Saludo + sugerencia del día ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white leading-tight">
              Hola {nombre.split(' ')[0]} 👋
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              {perfil ? ` · ${ETIQUETA_MODO[perfil.objetivo] ?? perfil.objetivo} · ${perfil.dias} días/sem` : ''}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400">Hoy toca:</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300" data-testid="sugerencia-dia">
                {sugerenciaHoy}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div
            key={k.id}
            data-testid={k.id}
            className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5 text-center"
          >
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 mb-2">
              {k.icono}
            </div>
            <p className="text-xl font-black text-white leading-none">{k.valor}</p>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">{k.etiqueta}</p>
          </div>
        ))}
      </div>

      {/* ── Comparativa semanal (F9): esta semana vs la anterior ── */}
      {comp.volumenAnterior > 0 && (
        <div
          data-testid="dash-comparativa"
          className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Semana vs anterior</p>
            <p className="text-xs text-slate-300 mt-0.5">
              {formatearVolumen(comp.volumenActual)} kg vs {formatearVolumen(comp.volumenAnterior)} kg
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-black ${
              deltaComp !== null && deltaComp < 0
                ? 'text-red-300 bg-red-500/10 border-red-500/40'
                : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40'
            }`}
            data-testid="dash-comparativa-delta"
          >
            {deltaComp === null ? '—' : deltaComp > 0 ? '▲' : deltaComp < 0 ? '▼' : '→'}
            {deltaComp !== null ? `${Math.abs(deltaComp)}%` : ''}
          </span>
        </div>
      )}

      {/* ── Peso actual (meta 93→87 del viejo) ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold text-white">Peso actual</span>
          </div>
          <span className="text-lg font-black text-teal-400" data-testid="peso-actual">
            {pesoActual.toFixed(1)} kg
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-500">Inicio: 93 kg</span>
          <span className="text-[10px] text-emerald-400 font-bold" data-testid="peso-progreso">{progreso}%</span>
          <span className="text-[10px] text-slate-500">Meta: 87 kg</span>
        </div>
      </div>

      {/* ── Última sesión + PRs ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Última sesión</span>
          </div>
          {ultimaSesion ? (
            <>
              <p className="text-sm font-bold text-white leading-tight">
                {ultimaSesion.routineName ?? 'Sesión'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {ultimaSesion.date}
                {ultimaSesion.time ? ` · ${ultimaSesion.time}` : ''}
                {ultimaSesion.mode ? ` · ${ETIQUETA_MODO[ultimaSesion.mode] ?? ultimaSesion.mode}` : ''}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-slate-300">
                  <span className="font-bold text-white">{formatearVolumen(ultimaSesion.volume ?? 0)}</span> kg volume
                </span>
                {ultimaSesion.exercises?.length ? (
                  <span className="text-xs text-slate-300">
                    <span className="font-bold text-white">{ultimaSesion.exercises.length}</span> ejercicios
                  </span>
                ) : null}
              </div>
              {diasSinEntrenar !== null && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {diasSinEntrenar === 0 ? 'Hoy entrenaste' : `Hace ${diasSinEntrenar} ${diasSinEntrenar === 1 ? 'día' : 'días'}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Aún no hay sesiones registradas. Tu primer entrenamiento aterriza en F2 · Entreno.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">PRs recientes</span>
          </div>
          {prs.length > 0 ? (
            <ul className="space-y-2">
              {prs.map(([id, pr]) => (
                <li key={id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate pr-2">{pr.name ?? id.replace(/-/g, ' ')}</span>
                  <span className="font-bold text-amber-400 shrink-0">
                    {pr.weight} kg × {pr.reps}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Sin PRs aún. Se marcan solos cuando superas tus marcas (F2).
            </p>
          )}
        </div>
      </div>

      {/* ── Mini gráfico + heatmap ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Volumen de las últimas 5 sesiones</span>
        </div>
        <div className="flex items-end gap-2 h-24 mb-1" data-testid="mini-grafico">
          {ultimas5.map((s, i) => {
            const altura = Math.max(6, Math.round(((s.volume ?? 0) / maxVol) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                <span className="text-[9px] font-mono text-slate-400">{formatearVolumen(s.volume ?? 0)}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-600/70 to-teal-400/80 transition-all"
                  style={{ height: `${altura}%` }}
                />
              </div>
            );
          })}
          {ultimas5.length === 0 && (
            <p className="text-xs text-slate-400">Sin sesiones todavía.</p>
          )}
        </div>
        <div className="flex gap-2">
          {ultimas5.map((s, i) => (
            <span key={i} className="flex-1 text-center text-[9px] text-slate-500 truncate">
              {s.date?.slice(5)}
            </span>
          ))}
        </div>

        {/* Heatmap 15 semanas (columnas = semanas, filas = días) */}
        <div className="mt-5 pt-4 border-t border-slate-700/50">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            Actividad · últimas 15 semanas
          </p>
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1" data-testid="heatmap">
            {Array.from({ length: 15 }, (_, semana) => (
              <div key={semana} className="flex flex-col gap-1">
                {Array.from({ length: 7 }, (_, dia) => {
                  const celda = celdas[semana * 7 + dia];
                  if (!celda) return <div key={dia} className="w-2.5 h-2.5" />;
                  return (
                    <div
                      key={dia}
                      title={celda.fecha}
                      className={`w-2.5 h-2.5 rounded-[3px] ${
                        celda.activo ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA: Estadísticas completas (F9) ── */}
      <button
        onClick={onIrAEstadisticas}
        data-testid="cta-estadisticas"
        className="w-full rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-3.5 flex items-center gap-3 hover:border-emerald-400/60 transition-all group"
      >
        <BarChart3 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-white">Ver estadísticas completas</p>
          <p className="text-[11px] text-slate-400 leading-tight">
            Volumen 12 semanas, músculos, récords, consistencia y peso
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-300 transition-colors shrink-0" />
      </button>

      {/* Link al perfil */}
      <button
        onClick={onIrPerfil}
        className="w-full text-center text-xs text-slate-400 hover:text-emerald-300 transition-colors pb-2"
      >
        Ver mi perfil y datos migrados →
      </button>
    </div>
  );
};

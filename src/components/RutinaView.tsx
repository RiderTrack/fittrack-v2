// ═══════════════════════════════════════════════════════════
// 📅 RUTINA · MI SEMANA — FitTrack V2 (F2 · Entreno, F7 · editor)
// Vista del split semanal del app viejo (WEEKLY_SPLIT) + el
// EDITOR de rutina personal de F7: "Personalizar mi semana"
// clona el split clásico (con los ejercicios de la biblioteca
// que ya caían cada día) y de ahí se edita día por día: nombre,
// entrena/descansa, ejercicios con series×reps y orden. Con la
// rutina personal ACTIVA, Entreno de Hoy la usa en vez del
// split; con OFF vuelve el clásico (los datos quedan guardados).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { CalendarDays, Dumbbell, Info, Pencil, Moon, Sparkles, Zap } from 'lucide-react';
import type { DiaRutina, EstadoFitTrack, ModoEntreno, RutinaPersonal } from '../types';
import { aplicarEstado } from '../services/storageFit';
import {
  EJERCICIOS_BASE, PARAMETROS_MODO, SPLIT_SEMANAL, bibliotecaCompleta,
  ejerciciosDelDia, leerModoActivo, splitDeHoy,
} from '../services/entreno';
import {
  activarRutinaPersonal, crearDesdeSplit, guardarDiaRutina, guardarRutinaPersonal,
  leerRutinaPersonal, normalizarDia,
} from '../services/rutinaPersonal';
import { RutinaEditorDia } from './RutinaEditorDia';

interface RutinaViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
  onModoCambiado: () => void;     // App relee el state
  onRutinaCambiada?: () => void;  // F7: se editó/activó la rutina personal
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // Lunes → Domingo

const ETIQUETAS_MODO: Record<ModoEntreno, string> = {
  fuerza: 'Fuerza (5×3-5, 87% 1RM)',
  hipertrofia: 'Hipertrofia (4×8-12, 70% 1RM)',
  potencia: 'Potencia (3×1-3, 90-95% 1RM)',
  descarga: 'Descarga (3×12-15, 50% 1RM)',
  descanso: 'Descanso',
};

export const RutinaView: React.FC<RutinaViewProps> = ({ estado, esDemo, onModoCambiado, onRutinaCambiada }) => {
  const hoy = useMemo(() => new Date().getDay(), []);
  const splitHoy = useMemo(() => splitDeHoy(), []);
  const [modo, setModo] = useState<ModoEntreno>(() => leerModoActivo(estado));
  const [editandoDia, setEditandoDia] = useState<number | null>(null);

  const biblioteca = useMemo(() => bibliotecaCompleta(estado), [estado]);
  const params = modo !== 'descanso' ? PARAMETROS_MODO[modo] : null;
  const rutina = useMemo(() => leerRutinaPersonal(estado), [estado]);

  const cambiarModo = (nuevo: ModoEntreno) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    if (!esDemo) {
      aplicarEstado((est) => { est.activeMode = nuevo; }); // changeWorkoutMode del viejo
      onModoCambiado();
    }
  };

  // ── F7: crear la rutina personal desde el split clásico ──
  const personalizar = () => {
    const nueva = crearDesdeSplit(estado);
    if (!esDemo) {
      guardarRutinaPersonal(nueva);
      onRutinaCambiada?.();
    }
  };

  // ── F7: toggle activa (ON = rutina personal, OFF = split clásico) ──
  const alternarActiva = () => {
    if (!esDemo) {
      activarRutinaPersonal(!rutina?.activa);
      onRutinaCambiada?.();
    }
  };

  // ── F7: guardar un día editado ──
  const guardarDia = (diaNum: number, dia: DiaRutina) => {
    if (!esDemo) {
      guardarDiaRutina(diaNum, dia);
      onRutinaCambiada?.();
    }
    setEditandoDia(null);
  };

  const diaDe = (n: number): DiaRutina =>
    rutina?.dias?.[n] ? normalizarDia(rutina.dias[n], SPLIT_SEMANAL[n].name) : {
      activo: SPLIT_SEMANAL[n].target.length > 0,
      nombre: SPLIT_SEMANAL[n].name,
      ejercicios: [],
    };

  const totalEjercicios = ORDEN_SEMANA.reduce((n, d) => n + diaDe(d).ejercicios.length, 0);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-400" /> Mi Semana
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          {rutina?.activa ? (
            <>
              Tu rutina personal está <strong className="text-emerald-400">activa</strong>: Entreno de Hoy usa
              estos ejercicios con sus series y reps. Hoy te toca{' '}
              <strong className="text-slate-200">{diaDe(hoy).nombre}</strong>.
            </>
          ) : (
            <>
              Split semanal del FitTrack original. Hoy te toca{' '}
              <strong className="text-slate-200">{splitHoy.name}</strong>
              {splitHoy.target.length > 0 && ` (${splitHoy.target.join(' + ')})`}.
            </>
          )}
        </p>

        {/* Modo activo */}
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <p className="text-[11px] text-slate-400 mb-2">
            Modo activo: <strong className="text-emerald-400">{ETIQUETAS_MODO[modo]}</strong>
            {params && <span className="text-slate-500"> · {params.sets} series × {params.reps} reps</span>}
            {rutina?.activa && <span className="text-slate-500"> · los descansos y la progresión siguen el modo</span>}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de entreno">
            {(Object.keys(ETIQUETAS_MODO) as ModoEntreno[]).map((m) => {
              const activo = modo === m;
              return (
                <button
                  key={m}
                  onClick={() => cambiarModo(m)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    activo
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {ETIQUETAS_MODO[m]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* F7 · Sin rutina personal: invitación a personalizar */}
      {!rutina && (
        <div
          data-testid="banner-personalizar"
          className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.06] p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-white">Armá TU semana (nuevo)</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Elegí qué ejercicios tocan cada día, en qué orden y con cuántas series×reps.
                Arranca con lo que ya tenés (tu biblioteca en el split de siempre) y editá a gusto.
              </p>
              <button
                onClick={personalizar}
                data-testid="boton-personalizar"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all"
              >
                <Pencil className="w-4 h-4" /> Personalizar mi semana
              </button>
              {esDemo && (
                <p className="text-[11px] text-amber-400/90 mt-2">Modo demo — la rutina no se guarda de verdad.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* F7 · Rutina personal existente: toggle + resumen */}
      {rutina && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Zap className={`w-4 h-4 ${rutina.activa ? 'text-emerald-400' : 'text-slate-500'}`} />
              Mi rutina personal
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {rutina.activa ? (
                <>Activa · {totalEjercicios} ejercicio(s) en la semana — tocá un día para editarlo</>
              ) : (
                <>Pausada — está el split clásico. Tocá un día para editarla o reactivá para usarla</>
              )}
            </p>
          </div>
          <button
            onClick={alternarActiva}
            data-testid="boton-toggle-rutina"
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${
              rutina.activa
                ? 'border-slate-600 text-slate-300 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300'
                : 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-400'
            }`}
          >
            {rutina.activa ? 'Pausar (split clásico)' : 'Usar mi rutina'}
          </button>
        </div>
      )}

      {/* Días de la semana */}
      <div className="space-y-2.5">
        {ORDEN_SEMANA.map((diaNum) => {
          const split = SPLIT_SEMANAL[diaNum];
          const esHoy = diaNum === hoy;
          const dia = diaDe(diaNum);
          const usaPersonal = !!rutina && (rutina.activa || dia.ejercicios.length > 0);
          const entrenable = dia.activo;
          const etiqueta = usaPersonal ? dia.nombre : split.name;
          const detalle = usaPersonal
            ? dia.activo
              ? dia.ejercicios.length > 0
                ? `${dia.ejercicios.length} ejercicio(s) · ${dia.ejercicios.map((e) => `${e.series}×${e.reps}`).join(' · ').slice(0, 60)}`
                : 'Sin ejercicios — tocá para agregar'
              : 'Descanso (pausado en tu rutina)'
            : split.target.length > 0
              ? `${split.target.join(' + ')} · ${ejerciciosDelDia(estado, split).length} ejercicio(s) en biblioteca`
              : 'Recuperación total — sin entreno';
          return (
            <button
              key={diaNum}
              onClick={() => rutina && setEditandoDia(diaNum)}
              data-testid={`dia-${diaNum}`}
              className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-all ${
                esHoy
                  ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
                  : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500'
              } ${rutina ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  esHoy ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800 border border-slate-700'
                }`}
              >
                {entrenable ? (
                  <Dumbbell className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-[9px] font-mono font-bold text-slate-400 mt-0.5">
                  {DIAS[diaNum].slice(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white truncate">
                  {etiqueta}
                  {esHoy && (
                    <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 align-middle">
                      HOY
                    </span>
                  )}
                  {usaPersonal && !dia.activo && (
                    <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-400 align-middle">
                      DESCANSO
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{detalle}</p>
              </div>
              {rutina && (
                <Pencil className="w-4 h-4 text-slate-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 flex gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {rutina ? (
            <>
              Editás tocando un día: nombre, ejercicios (de la Biblioteca, {EJERCICIOS_BASE.length} base + tus
              custom), series, reps y orden. La rutina personal vive en tu state — entra sola al respaldo JSON
              de Ajustes. Pausar no borra nada.
            </>
          ) : (
            <>
              Los ejercicios de cada día salen de la Biblioteca ({EJERCICIOS_BASE.length} base + los custom
              que agregues): aparecen en el día de su grupo muscular. Personalizá para elegir exactamente
              qué toca cada día.
            </>
          )}
        </p>
      </div>

      {/* F7 · Modal editor de día */}
      {rutina && editandoDia !== null && (
        <RutinaEditorDia
          diaNum={editandoDia}
          diaInicial={diaDe(editandoDia)}
          biblioteca={biblioteca}
          onGuardar={(dia) => guardarDia(editandoDia, dia)}
          onCerrar={() => setEditandoDia(null)}
        />
      )}
    </div>
  );
};

/** Referencia de tipo para lecturas externas (usada por tests de cableado) */
export type { RutinaPersonal };

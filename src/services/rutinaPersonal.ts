// ═══════════════════════════════════════════════════════════
// 🗓️ RUTINA PERSONAL — FitTrack V2 (F7 · Mi Semana)
// El editor de rutinas que el app viejo nunca tuvo: el usuario
// elige qué ejercicios tocan cada día, en qué orden y con cuántas
// series×reps. Vive en state.rutinaPersonal (campo NUEVO de la
// v2: el viejo no lo escribía → cero choque + entra solo al
// respaldo JSON de F6). Lecturas PURAS (para smoke test sin DOM)
// + 3 escrituras vía aplicarEstado (el punto único de siempre).
// Prioridad en Entreno de Hoy: rutina FitBot de HOY > rutina
// personal > split clásico (la personal REEMPLAZA al split, no
// a una rutina que el robot generó hoy a pedido).
// ═══════════════════════════════════════════════════════════

import type { DiaRutina, Ejercicio, EjercicioRutina, EstadoFitTrack, RutinaPersonal } from '../types';
import { aplicarEstado } from './storageFit';
import { PARAMETROS_MODO, SPLIT_SEMANAL, bibliotecaCompleta, ejerciciosDelDia, leerModoActivo } from './entreno';

const DIAS_RUTINA = [0, 1, 2, 3, 4, 5, 6] as const;

// ── Lecturas (puras, defensivas: state corrupto → null) ──

/** Lee la rutina personal del estado; null si no existe o está rota */
export function leerRutinaPersonal(estado: EstadoFitTrack): RutinaPersonal | null {
  const r = estado.rutinaPersonal;
  if (!r || typeof r !== 'object' || !r.dias || typeof r.dias !== 'object') return null;
  return r as RutinaPersonal;
}

/** Día de hoy por getDay() (0=domingo, mismo criterio del split) */
export function diaDeHoy(): number {
  return new Date().getDay();
}

/**
 * Ejercicios de un día de la rutina personal, MAPEADOS a la
 * biblioteca y en el ORDEN del array. Los ids que ya no existan
 * (custom eliminado) se filtran solos — la rutina no se rompe.
 */
export function ejerciciosDelDiaPersonal(estado: EstadoFitTrack, diaNum: number): Ejercicio[] {
  const r = leerRutinaPersonal(estado);
  if (!r || !r.activa) return [];
  const dia = r.dias[diaNum];
  if (!dia || !dia.activo || !Array.isArray(dia.ejercicios)) return [];
  const biblioteca = bibliotecaCompleta(estado);
  const porId = new Map(biblioteca.map((e) => [e.id, e]));
  const out: Ejercicio[] = [];
  for (const er of dia.ejercicios) {
    const ex = porId.get(er.id);
    if (ex) out.push(ex);
  }
  return out;
}

/**
 * Series×reps objetivo de un ejercicio de HOY (para pre-cargar la
 * sesión, igual que paramsItemRutina hace con la del FitBot).
 * null si la rutina no está activa o el ejercicio no es de hoy.
 */
export function paramsEjercicioHoy(estado: EstadoFitTrack, exId: string): { series: number; reps: string } | null {
  const r = leerRutinaPersonal(estado);
  if (!r || !r.activa) return null;
  const dia = r.dias[diaDeHoy()];
  if (!dia || !dia.activo) return null;
  const er = (dia.ejercicios ?? []).find((e) => e.id === exId);
  if (!er) return null;
  return { series: er.series, reps: er.reps };
}

// ── Construcción y saneamiento (puros) ──

/** Clamp de series (1-10) y dedupe de ids repetidos (gana el 1º) */
export function normalizarEjercicios(lista: EjercicioRutina[]): EjercicioRutina[] {
  const vistos = new Set<string>();
  const out: EjercicioRutina[] = [];
  for (const er of lista ?? []) {
    if (!er || typeof er.id !== 'string' || !er.id || vistos.has(er.id)) continue;
    vistos.add(er.id);
    out.push({
      id: er.id,
      series: Math.min(10, Math.max(1, Math.round(Number(er.series) || 3))),
      reps: String(er.reps ?? '').trim() || '10',
    });
  }
  return out;
}

/** Sanea un día entero (nombre con fallback, ejercicios normalizados) */
export function normalizarDia(dia: DiaRutina, nombreFallback: string): DiaRutina {
  return {
    activo: !!dia.activo,
    nombre: String(dia.nombre ?? '').trim() || nombreFallback,
    ejercicios: normalizarEjercicios(dia.ejercicios ?? []),
  };
}

/**
 * Crea la rutina personal INICIAL desde el split clásico: cada
 * día arranca con los ejercicios de la biblioteca que ya caían en
 * ese día (base + customs) y las series×reps del modo activo —
 * así "Personalizar" nunca arranca de cero, es editar lo de hoy.
 */
export function crearDesdeSplit(estado: EstadoFitTrack): RutinaPersonal {
  const modo = leerModoActivo(estado);
  const p = PARAMETROS_MODO[modo];
  const seriesDef = p?.sets ?? 4;
  const repsDef = p?.reps ?? '10';
  const dias: Record<number, DiaRutina> = {};
  for (const n of DIAS_RUTINA) {
    const split = SPLIT_SEMANAL[n];
    const ejercicios = ejerciciosDelDia(estado, split).map<EjercicioRutina>((ex) => ({
      id: ex.id,
      series: seriesDef,
      reps: repsDef,
    }));
    dias[n] = {
      activo: split.target.length > 0,
      nombre: split.name,
      ejercicios,
    };
  }
  return { activa: true, dias, actualizada: new Date().toISOString() };
}

// ── Escrituras (aplicarEstado — merge natural, F7 nunca toca
//    los otros campos del state; la vista decide con esDemo) ──

/** Guarda la rutina entera (crear / editar día / reactivar) */
export function guardarRutinaPersonal(rutina: RutinaPersonal): void {
  aplicarEstado((est) => {
    est.rutinaPersonal = rutina;
  });
}

/** Guarda UN día (el editor de Mi Semana trabaja día por día) */
export function guardarDiaRutina(diaNum: number, dia: DiaRutina): void {
  aplicarEstado((est) => {
    const r = (est.rutinaPersonal as RutinaPersonal | undefined) ?? { activa: true, dias: {} };
    r.dias = r.dias ?? {};
    r.dias[diaNum] = dia;
    r.actualizada = new Date().toISOString();
    est.rutinaPersonal = r;
  });
}

/** Prende/apaga la rutina personal (off = vuelve el split clásico) */
export function activarRutinaPersonal(activa: boolean): void {
  aplicarEstado((est) => {
    const r = est.rutinaPersonal as RutinaPersonal | undefined;
    if (r) {
      r.activa = activa;
      r.actualizada = new Date().toISOString();
      est.rutinaPersonal = r;
    }
  });
}

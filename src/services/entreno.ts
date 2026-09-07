// ═══════════════════════════════════════════════════════════
// 🏋️ ENTRENO — FitTrack V2 (F2 · Entreno)
// Lógica EXACTA del app viejo (index.html), extraída sin
// invención: split semanal, parámetros por modo, biblioteca
// base de 18 ejercicios, progresión inteligente de cargas,
// cálculo de 1RM (Epley) y descansos por modo.
// Fuente: index.html L2925-2944, L3542-3557, L3571-3626,
// L3495-3498, L4114-4139.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, Ejercicio, ModoEntreno, PRLevantamiento, SesionEntreno } from '../types';

// ── Split semanal del viejo (WEEKLY_SPLIT, index.html L3542) ──
// Lunes Pecho+Tríceps · Martes Espalda+Bíceps · Miércoles
// Descarga Activa (Core+Movilidad) · Jueves Piernas · Viernes
// Hombros · Sábado Cardio · Domingo Descanso absoluto.
export interface DiaSplit {
  name: string;
  target: string[];
}

export const SPLIT_SEMANAL: Record<number, DiaSplit> = {
  1: { name: 'Pecho + Tríceps', target: ['Pecho', 'Tríceps'] },
  2: { name: 'Espalda + Bíceps', target: ['Espalda', 'Bíceps'] },
  3: { name: 'Descarga Activa', target: ['Core', 'Movilidad'] },
  4: { name: 'Piernas', target: ['Piernas'] },
  5: { name: 'Hombros', target: ['Hombros'] },
  6: { name: 'Cardio', target: ['Cardio'] },
  0: { name: 'Descanso absoluto', target: [] },
};

/** Split del día de hoy (getTodayRoutineDetails, L3559) */
export function splitDeHoy(): DiaSplit {
  return SPLIT_SEMANAL[new Date().getDay()] ?? SPLIT_SEMANAL[0];
}

// ── Parámetros por modo (MODE_PARAMETERS, index.html L3552) ──
export interface ParametrosModo {
  name: string;
  sets: number;
  reps: string;
  percentage: string;
  note: string;
}

export const PARAMETROS_MODO: Record<Exclude<ModoEntreno, 'descanso'>, ParametrosModo> = {
  fuerza: { name: 'Fuerza', sets: 5, reps: '5', percentage: '87% 1RM', note: 'Descanso largo sugerido.' },
  hipertrofia: { name: 'Hipertrofia', sets: 4, reps: '10', percentage: '70% 1RM', note: 'Enfócate en la fase excéntrica.' },
  potencia: { name: 'Potencia', sets: 3, reps: '3', percentage: '90-95% 1RM', note: 'Movimientos dinámicos y explosivos.' },
  descarga: { name: 'Descarga', sets: 3, reps: '15', percentage: '50% 1RM', note: 'Recuperación muscular activa.' },
};

// ── Biblioteca base (DEFAULT_EXERCISES, index.html L2925) ──
export const EJERCICIOS_BASE: Ejercicio[] = [
  { id: 'press-banca', name: 'Press banca', category: 'Pecho' },
  { id: 'press-inclinado', name: 'Press inclinado', category: 'Pecho' },
  { id: 'aperturas', name: 'Aperturas', category: 'Pecho' },
  { id: 'jalon', name: 'Jalón', category: 'Espalda' },
  { id: 'remo', name: 'Remo', category: 'Espalda' },
  { id: 'dominadas', name: 'Dominadas', category: 'Espalda' },
  { id: 'press-militar', name: 'Press militar', category: 'Hombros' },
  { id: 'elevaciones-laterales', name: 'Elevaciones laterales', category: 'Hombros' },
  { id: 'curl-barra', name: 'Curl barra', category: 'Bíceps' },
  { id: 'curl-alterno', name: 'Curl alterno', category: 'Bíceps' },
  { id: 'extension-polea', name: 'Extensión polea', category: 'Tríceps' },
  { id: 'fondos', name: 'Fondos', category: 'Tríceps' },
  { id: 'sentadilla', name: 'Sentadilla', category: 'Piernas' },
  { id: 'prensa', name: 'Prensa', category: 'Piernas' },
  { id: 'peso-muerto-rumano', name: 'Peso muerto rumano', category: 'Piernas' },
  { id: 'zancadas', name: 'Zancadas', category: 'Piernas' },
  { id: 'crunch', name: 'Crunch', category: 'Core' },
  { id: 'plancha', name: 'Plancha', category: 'Core' },
];

/** Biblioteca completa: base + custom del estado (join del viejo, L3651) */
export function bibliotecaCompleta(estado: EstadoFitTrack): Ejercicio[] {
  const custom = Array.isArray(estado.customExercises) ? (estado.customExercises as Ejercicio[]) : [];
  return [...EJERCICIOS_BASE, ...custom];
}

/** Ejercicios de hoy: biblioteca filtrada por categorías del split (L3651-3653) */
export function ejerciciosDelDia(estado: EstadoFitTrack, split: DiaSplit): Ejercicio[] {
  return bibliotecaCompleta(estado).filter((ex) => split.target.includes(ex.category));
}

// ── Fórmulas exactas del viejo ──

/** 1RM estimado, fórmula Epley del viejo (calculate1RM, L3495) */
export function calcular1RM(peso: number, reps: number): number {
  if (reps === 1) return peso;
  return peso * (1 + reps / 30);
}

/** Volumen = series × reps × peso (calculateVolume, L3500) */
export function calcularVolumen(series: number, reps: number, peso: number): number {
  return series * reps * peso;
}

// ── Progresión inteligente (calcularProgresion, L3571-3626) ──
// Busca el ejercicio en las últimas 10 sesiones; si lo completó
// 2+ veces sube el peso (+2.5 fuerza/hipertrofia, +1.25 resto);
// sin historial usa % del PR según modo; todo redondeado a 2.5 kg.
export interface Progresion {
  peso: number;
  indicador: 'subir' | 'mantener' | 'pr';
  razon: string;
  ultimoPeso: number | null;
  vecesCompletado: number;
}

export function calcularProgresion(
  exId: string,
  exName: string,
  modo: ModoEntreno,
  estado: EstadoFitTrack,
): Progresion {
  const record: PRLevantamiento | undefined = estado.prs?.[exId];
  const historial = estado.workoutHistory ?? [];

  let ultimoPeso: number | null = null;
  let vecesCompletado = 0;

  for (const sesion of historial.slice(0, 10)) {
    const ej = (sesion.exercises ?? []).find((e) => e.name?.toLowerCase() === exName?.toLowerCase());
    if (ej && (ej.weight ?? 0) > 0) {
      if (ultimoPeso === null) {
        ultimoPeso = ej.weight ?? 0;
      }
      vecesCompletado++;
    }
  }

  let pesoBase = ultimoPeso ?? record?.weight ?? 60;
  let pesoPropuesto = pesoBase;
  let indicador: Progresion['indicador'] = 'mantener';
  let razon = '';

  if (vecesCompletado >= 2 && ultimoPeso) {
    const incremento = modo === 'fuerza' ? 2.5 : modo === 'hipertrofia' ? 2.5 : 1.25;
    pesoPropuesto = pesoBase + incremento;
    indicador = 'subir';
    razon = `+${incremento} kg vs última sesión`;
  } else if (vecesCompletado === 0 && record) {
    const factor: Record<string, number> = { fuerza: 0.87, hipertrofia: 0.7, potencia: 0.9, descarga: 0.5 };
    pesoPropuesto = Math.round(((record.weight ?? 60) * (factor[modo] ?? 0.7)) / 2.5) * 2.5;
    razon = `${Math.round((factor[modo] ?? 0.7) * 100)}% de PR (${record.weight} kg)`;
    indicador = 'pr';
  } else if (ultimoPeso) {
    razon = 'Igual que última sesión';
  } else {
    pesoBase = 60;
    pesoPropuesto = 60;
    razon = 'Peso inicial sugerido';
  }

  pesoPropuesto = Math.round(pesoPropuesto / 2.5) * 2.5;

  return { peso: pesoPropuesto, indicador, razon, ultimoPeso, vecesCompletado };
}

// ── Descanso por modo (getDescansoEjercicio default, L4136-4138) ──
// En F2 no hay rutina FitBot activa: siempre default por modo.
export function descansoPorModo(modo: ModoEntreno): number {
  return modo === 'fuerza' ? 120 : modo === 'potencia' ? 180 : 90;
}

// ── Última vez que se hizo un ejercicio (getUltimaVez, L3739) ──
// Soporta series clásicas (sets: número) y FitBot (sets: array).
export interface UltimaVez {
  fecha: string;
  resumen: string;
}

export function ultimaVez(nombre: string, estado: EstadoFitTrack): UltimaVez | null {
  const hist = estado.workoutHistory ?? [];
  for (const sesion of hist) {
    const ex = (sesion.exercises ?? []).find((e) => e.name?.toLowerCase() === nombre.toLowerCase());
    if (!ex) continue;
    const setsEx = ex.sets as unknown;
    if (Array.isArray(setsEx) && setsEx.length > 0) {
      const sets = setsEx as { weight?: number; reps?: number }[];
      const mejor = sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
      return { fecha: sesion.date, resumen: `${sets.length}×${mejor.reps ?? '?'} · ${mejor.weight ?? 0} kg` };
    }
    if (typeof setsEx === 'number' && setsEx > 0) {
      return { fecha: sesion.date, resumen: `${setsEx} series · ${ex.weight ?? 0} kg` };
    }
  }
  return null;
}

// ── Check de PR (checkPersonalRecord, L3504) ──
// Devuelve el nuevo PR si supera al guardado (comparando 1RM
// Epley, campo "value" del viejo). No muta: solo calcula.
export function esNuevoPR(
  estado: EstadoFitTrack,
  exId: string,
  peso: number,
  reps: number,
): PRLevantamiento | null {
  const guardado = estado.prs?.[exId];
  const nuevo1RM = calcular1RM(peso, reps);
  if (!guardado || nuevo1RM > (guardado.value ?? calcular1RM(guardado.weight, guardado.reps))) {
    return { weight: peso, reps, value: nuevo1RM, date: hoyISO() };
  }
  return null;
}

// ── helpers de fecha (mismos del storageFit) ──
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function horaHHMM(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Modo activo guardado por el viejo (state.activeMode, default 'hipertrofia') */
export function leerModoActivo(estado: EstadoFitTrack): ModoEntreno {
  const modo = estado.activeMode;
  const validos: ModoEntreno[] = ['hipertrofia', 'fuerza', 'potencia', 'descarga', 'descanso'];
  return validos.includes(modo as ModoEntreno) ? (modo as ModoEntreno) : 'hipertrofia';
}

/** Etiqueta de PR para tarjetas: "100 kg × 5" o "S/R" (L3663) */
export function etiquetaPR(record?: PRLevantamiento): string {
  return record ? `${record.weight} kg × ${record.reps}` : 'S/R';
}

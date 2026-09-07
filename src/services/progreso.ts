// ═══════════════════════════════════════════════════════════
// 📈 PROGRESO — FitTrack V2 (F4 · Progreso)
// Puertos exactos del app viejo: historial de sesiones con
// feedback, medidas corporales (peso rápido + gráfica con
// tendencia, formulario completo con IMC/grasa/músculo),
// volumen semanal y exportación. Fuente: index.html del viejo
// L4564-L4608 (peso rápido + gráficas), L5908-L6006
// (renderHistory), L6009-L6134 (medidas), L4510-L4531 (vol.
// semanal). El ExcelJS del viejo se reemplaza por CSV nativo
// (cero dependencias nuevas, mismo botón verde).
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, MedidaCorporal } from '../types';
import { hoyISO } from './storageFit';
import { calcular1RM } from './entreno';

/** Etiquetas de feedback (mismas listas del renderHistory del viejo, L5957-5959) */
export const ETIQUETAS_DIFICULTAD = ['', 'Muy fácil', 'Fácil', 'Perfecto', 'Duro', 'Agotador'];
export const ETIQUETAS_ENERGIA = ['', 'Agotado', 'Regular', 'Bien', 'Excelente'];
export const ETIQUETAS_DOLOR = ['Sin dolor', 'Leve', 'Moderado', 'Severo'];

// ═══════════════════════════════════════════════════════════
// 📝 FORMULARIO DE MEDIDAS (inputs controlados como el viejo)
// ═══════════════════════════════════════════════════════════

/** Campos del formulario (strings de los inputs, parseo al guardar) */
export interface EntradaMedidas {
  height: string;
  weight: string;
  chest: string;
  waist: string;
  arms: string;
  thighs: string;
  hips: string;
  bodyfat: string;
  visceral: string;
  muscle: string;
}

export const ENTRADA_VACIA: EntradaMedidas = {
  height: '', weight: '', chest: '', waist: '', arms: '',
  thighs: '', hips: '', bodyfat: '', visceral: '', muscle: '',
};

/** IMC → etiqueta (misma escala del viejo, L6023) */
export function etiquetaIMC(imc: number): string {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  return 'Obesidad';
}

/** Grasa visceral → etiqueta (misma escala del viejo, L6033) */
export function etiquetaVisceral(v: number): string {
  if (v <= 9) return 'Normal';
  if (v <= 14) return 'Alto';
  return 'Muy alto';
}

/** Cálculos automáticos en vivo del formulario (calcularMedidas del viejo, L6009) */
export interface AnalisisMedidas {
  imc: number | null;
  imcEtiqueta: string;
  pesoGrasa: number | null;
  pesoMuscular: number | null;
  visceralEtiqueta: string | null;
}

/**
 * Analiza lo tecleado en el formulario. La talla por defecto es 187
 * (igual que el viejo) para que el IMC salga sin teclearla.
 */
export function analizarMedidas(entrada: EntradaMedidas, tallaPorDefecto = 187): AnalisisMedidas {
  const peso = parseFloat(entrada.weight) || 0;
  const talla = parseFloat(entrada.height) || tallaPorDefecto;
  const grasa = parseFloat(entrada.bodyfat) || 0;
  const musculo = parseFloat(entrada.muscle) || 0;
  const visceral = parseFloat(entrada.visceral) || 0;

  if (!peso) {
    return { imc: null, imcEtiqueta: '', pesoGrasa: null, pesoMuscular: null, visceralEtiqueta: null };
  }
  const t = talla / 100;
  const imc = peso / (t * t);
  return {
    imc,
    imcEtiqueta: etiquetaIMC(imc),
    pesoGrasa: grasa > 0 ? (peso * grasa) / 100 : null,
    pesoMuscular: musculo > 0 ? (peso * musculo) / 100 : null,
    visceralEtiqueta: visceral > 0 ? etiquetaVisceral(visceral) : null,
  };
}

// ═══════════════════════════════════════════════════════════
// 💾 REGISTROS (mutadores para aplicarEstado — el punto
// único de escritura del state, igual que F2/F3)
// ═══════════════════════════════════════════════════════════

/**
 * Construye el registro desde el formulario (saveMeasurements del
 * viejo, L6038): el peso es obligatorio, el resto cae a 0. El IMC
 * se calcula y redondea a 1 decimal solo si la talla es > 0.
 */
export function construirRegistro(entrada: EntradaMedidas): MedidaCorporal | null {
  const peso = parseFloat(entrada.weight);
  if (!peso || peso <= 0) return null;

  const registro: MedidaCorporal = {
    date: hoyISO(),
    weight: peso,
    height: parseFloat(entrada.height) || 0,
    chest: parseFloat(entrada.chest) || 0,
    waist: parseFloat(entrada.waist) || 0,
    arms: parseFloat(entrada.arms) || 0,
    thighs: parseFloat(entrada.thighs) || 0,
    hips: parseFloat(entrada.hips) || 0,
    bodyfat: parseFloat(entrada.bodyfat) || 0,
    visceral: parseFloat(entrada.visceral) || 0,
    muscle: parseFloat(entrada.muscle) || 0,
  };
  if (registro.height && registro.height > 0) {
    const t = registro.height / 100;
    registro.imc = parseFloat((registro.weight / (t * t)).toFixed(1));
  }
  return registro;
}

/** Encola el registro al frente del historial (state.measurements.unshift del viejo, L6062) */
export function aplicarRegistroMedidas(est: EstadoFitTrack, registro: MedidaCorporal): void {
  est.measurements = est.measurements ?? [];
  est.measurements.unshift(registro);
}

/**
 * Peso rápido del día (registrarPesoRapido del viejo, L4564): si ya
 * existe medida de hoy solo actualiza el peso; si no, crea el
 * registro mínimo. Devuelve qué pasó (para el toast).
 */
export function aplicarPesoRapido(est: EstadoFitTrack, peso: number): 'actualizado' | 'creado' {
  const hoy = hoyISO();
  est.measurements = est.measurements ?? [];
  const existente = est.measurements.find((m) => m.date === hoy);
  if (existente) {
    existente.weight = peso;
    return 'actualizado';
  }
  est.measurements.unshift({ date: hoy, weight: peso, chest: 0, waist: 0, arms: 0, thighs: 0, hips: 0 });
  return 'creado';
}

// ═══════════════════════════════════════════════════════════
// 📊 GRÁFICAS (misma matemática del viejo, sin librerías)
// ═══════════════════════════════════════════════════════════

/** Evolución del peso: cronológico, últimos 30 registros (renderGraficoPeso del viejo, L4583) */
export function datosGraficoPeso(medidas: MedidaCorporal[]): { etiquetas: string[]; valores: number[] } {
  const datos = medidas.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30);
  return {
    etiquetas: datos.map((m) => m.date.slice(5)),
    valores: datos.map((m) => m.weight ?? 0),
  };
}

/**
 * Tendencia del peso (L4593): promedio de los últimos 7 registros
 * vs los 7 anteriores — estable si |diff| < 0.15 kg. Verde al bajar
 * (cutting), ámbar al subir.
 */
export function tendenciaPeso(
  valores: number[],
): { tipo: 'estable' | 'baja' | 'sube'; kg: number } | null {
  if (valores.length < 4) return null;
  const mitad = Math.min(7, Math.floor(valores.length / 2));
  const recientes = valores.slice(-mitad);
  const previos = valores.slice(-mitad * 2, -mitad);
  if (previos.length === 0) return null;
  const prom = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const diff = prom(recientes) - prom(previos);
  if (Math.abs(diff) < 0.15) return { tipo: 'estable', kg: diff };
  return diff < 0 ? { tipo: 'baja', kg: Math.abs(diff) } : { tipo: 'sube', kg: diff };
}

/** Volumen total por semana (lunes como inicio) de las últimas 8 semanas (renderGraficoVolumen del viejo, L4510) */
export function volumenSemanal(estado: EstadoFitTrack): { etiquetas: string[]; valores: number[] } {
  const semanas: Record<string, number> = {};
  (estado.workoutHistory ?? []).forEach((s) => {
    if (!s.date) return;
    const f = new Date(s.date + 'T12:00:00');
    const lunes = new Date(f);
    lunes.setDate(f.getDate() - ((f.getDay() + 6) % 7));
    const key =
      `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
    semanas[key] = (semanas[key] ?? 0) + (s.volume ?? 0);
  });
  const keys = Object.keys(semanas).sort().slice(-8);
  return { etiquetas: keys.map((k) => k.slice(5)), valores: keys.map((k) => semanas[k]) };
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTACIÓN (botón Excel del viejo → CSV nativo)
// El viejo cargaba ExcelJS desde CDN; aquí el mismo botón verde
// baja un CSV con BOM UTF-8 que Excel abre con columnas y
// acentos correctos. Cero dependencias nuevas.
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 🔎 F7 · HISTORIAL POR EJERCICIO — la vista de detalle
// Recorre workoutHistory buscando el ejercicio por nombre (case-
// insensitive, como ultimaVez) y soporta los DOS shapes que el
// historial real tiene: clásico ({sets:number, weight, volume},
// lo que escribe finalizarSesion) y FitBot ({sets:[{weight,reps}]},
// lo que escribe el robot). Orden CRONOLÓGICO (más viejo primero)
// para alimentar la gráfica directo; la lista de detalle la
// recorre al revés (lo último arriba).
// ═══════════════════════════════════════════════════════════

/** Una aparición del ejercicio en el historial (cronológica) */
export interface HistorialEjercicio {
  fecha: string;     // 'YYYY-MM-DD'
  series: number;    // series hechas
  pesoMax: number;   // kg del trabajo más pesado
  repsTop: number | null; // reps de la serie más pesada (null si el registro viejo no las guardó)
  volumen: number;   // kg totales del ejercicio esa sesión
  rm1: number | null; // 1RM Epley de la mejor serie (null sin reps)
  resumen: string;   // "4 series · 85 kg · 2 720 kg" (para la lista)
}

/**
 * Historial completo de UN ejercicio, más viejo primero.
 * Vacío si nunca se registró. Pura (sin storage) → smoke-testeable.
 */
export function historialDeEjercicio(nombre: string, estado: EstadoFitTrack): HistorialEjercicio[] {
  const objetivo = (nombre ?? '').toLowerCase();
  if (!objetivo) return [];
  const hist = estado.workoutHistory ?? [];
  const apariciones: HistorialEjercicio[] = [];
  for (let i = hist.length - 1; i >= 0; i--) { // cronológico: recorro al revés
    const sesion = hist[i];
    const ex = (sesion.exercises ?? []).find((e) => (e.name ?? '').toLowerCase() === objetivo);
    if (!ex) continue;
    const setsEx = ex.sets as unknown;
    if (Array.isArray(setsEx) && setsEx.length > 0) {
      // Shape FitBot: sets = [{weight, reps}]
      const sets = setsEx as { weight?: number; reps?: number }[];
      const mejor = sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
      const pesoMax = mejor.weight ?? 0;
      const repsTop = mejor.reps ?? null;
      const volumen = sets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0);
      apariciones.push({
        fecha: sesion.date,
        series: sets.length,
        pesoMax,
        repsTop,
        volumen: Math.round(volumen),
        rm1: repsTop && pesoMax > 0 ? Math.round(calcular1RM(pesoMax, repsTop) * 10) / 10 : null,
        resumen: `${sets.length} series · ${pesoMax} kg`,
      });
    } else if (typeof setsEx === 'number' && setsEx > 0) {
      // Shape clásico (finalizarSesion): sets número + weight (máx)
      const pesoMax = ex.weight ?? 0;
      apariciones.push({
        fecha: sesion.date,
        series: setsEx,
        pesoMax,
        repsTop: null,
        volumen: typeof ex.volume === 'number' ? ex.volume : 0,
        rm1: null, // el clásico no guardó reps por serie
        resumen: `${setsEx} series · ${pesoMax} kg`,
      });
    }
  }
  return apariciones;
}

/** Datos para la gráfica de peso de un ejercicio (cronológico, máx 30) */
export function datosGraficoEjercicio(historial: HistorialEjercicio[]): { etiquetas: string[]; valores: number[] } {
  const datos = historial.slice(-30);
  return {
    etiquetas: datos.map((h) => h.fecha.slice(5)),
    valores: datos.map((h) => h.pesoMax),
  };
}

function esc(v: string | number | undefined | null): string {
  return String(v ?? '').replace(/;/g, ',').replace(/\n/g, ' ');
}

/** Exporta sesiones + medidas a un CSV descargable. false si no hay datos. */
export function exportarHistorialCSV(estado: EstadoFitTrack): boolean {
  const sesiones = estado.workoutHistory ?? [];
  const medidas = estado.measurements ?? [];
  if (sesiones.length === 0 && medidas.length === 0) return false;

  const lineas: string[] = [];
  lineas.push('ENTRENAMIENTOS');
  lineas.push('Fecha;Hora;Rutina;Modo;Volumen (kg);Ejercicios;Dificultad;Energía;Dolor');
  sesiones.forEach((s) => {
    const fb = s.feedback;
    lineas.push([
      esc(s.date),
      esc(s.time ?? ''),
      esc(s.routineName ?? ''),
      esc(s.mode ?? ''),
      esc(s.volume ?? 0),
      esc((s.exercises ?? []).length),
      esc(fb?.dificultad ? ETIQUETAS_DIFICULTAD[fb.dificultad] : ''),
      esc(fb?.energia ? ETIQUETAS_ENERGIA[fb.energia] : ''),
      esc(fb?.dolor != null ? ETIQUETAS_DOLOR[fb.dolor] : ''),
    ].join(';'));
  });

  lineas.push('');
  lineas.push('MEDIDAS CORPORALES');
  lineas.push('Fecha;Peso (kg);Talla (cm);IMC;Pecho;Cintura;Brazos;Muslos;Cadera;Grasa %;Visceral;Músculo %');
  medidas.forEach((m) => {
    lineas.push([
      esc(m.date), esc(m.weight ?? ''), esc(m.height ?? ''), esc(m.imc ?? ''),
      esc(m.chest ?? ''), esc(m.waist ?? ''), esc(m.arms ?? ''), esc(m.thighs ?? ''), esc(m.hips ?? ''),
      esc(m.bodyfat ?? ''), esc(m.visceral ?? ''), esc(m.muscle ?? ''),
    ].join(';'));
  });

  try {
    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittrack-historial-${hoyISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

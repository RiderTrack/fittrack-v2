// ═══════════════════════════════════════════════════════════
// 📊 ANALÍTICAS — FitTrack V2 (F9 · Pro)
// Motor de estadísticas de la pestaña "Estadísticas" (módulo
// Progreso): TODO lectura pura del estado — nunca escribe.
// Responde lo que las apps pro responden: cuánto he entrenado
// en total, cómo va esta semana vs la anterior, qué músculos
// entreno más, cómo evoluciona mi peso, cuánto han subido mis
// récords y qué tan consistente soy con mi objetivo.
//
// Fuentes del mapeo ejercicio → grupo muscular (en orden):
//   1. Biblioteca propia (base 18 + customs) → category
//   2. DB FitBot (225 ejercicios) → 'Grupo Muscular'
//   3. Nombre de la rutina de la sesión (ej. 'Pecho + Tríceps')
//   4. 'Otro' (honesto: mejor eso que inventar)
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, PerfilEntreno, SesionEntreno, MedidaCorporal } from '../types';
import { bibliotecaCompleta } from './entreno';
import { FB_EJERCICIOS_DB } from '../data/fitbotDb';

// ── Helpers de fecha (sin TZ: a mediodía, como todo el app) ──

/** Fecha 'YYYY-MM-DD' de un Date (local, como hoyISO) */
function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lunes 00:00 de la semana de d */
function lunesDe(d: Date): Date {
  const lunes = new Date(d);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return lunes;
}

/** Diferencia en días entre dos fechas ISO (a − b) */
function diasEntre(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T12:00:00').getTime();
  const b = new Date(bISO + 'T12:00:00').getTime();
  return Math.round((a - b) / 86400000);
}

// ── 1. Resumen global: la vida entrena ──────────────────────

export interface ResumenGlobal {
  sesiones: number;      // total de sesiones registradas
  volumen: number;       // kg movidos en toda la historia (kg totales)
  minutos: number;       // minutos entrenados (duración de sesiones clásicas)
  mejorRacha: number;    // mayor racha de días consecutivos (calculada, no el streak actual)
  desde?: string;        // fecha de la primera sesión ('YYYY-MM-DD')
}

/** Racha máxima de días consecutivos con entreno (del historial, no del streak actual) */
export function rachaMaxima(fechasISO: string[]): number {
  const unicas = [...new Set(fechasISO.filter(Boolean))].sort();
  if (unicas.length === 0) return 0;
  let mejor = 1;
  let actual = 1;
  for (let i = 1; i < unicas.length; i++) {
    actual = diasEntre(unicas[i], unicas[i - 1]) === 1 ? actual + 1 : 1;
    if (actual > mejor) mejor = actual;
  }
  return mejor;
}

export function resumenGlobal(estado: EstadoFitTrack): ResumenGlobal {
  const historial = estado.workoutHistory ?? [];
  let volumen = 0;
  let minutos = 0;
  for (const s of historial) {
    volumen += s.volume ?? 0;
    minutos += s.duration ?? 0;
  }
  const fechas = historial.map((s) => s.date).filter((d): d is string => !!d);
  return {
    sesiones: historial.length,
    volumen: Math.round(volumen),
    minutos,
    mejorRacha: rachaMaxima(fechas),
    desde: fechas.length ? [...fechas].sort()[0] : undefined,
  };
}

// ── 2. Comparativa semanal: hoy vs la semana pasada ─────────

export interface ComparativaSemanal {
  volumenActual: number;      // kg de esta semana (desde lunes)
  volumenAnterior: number;    // kg de la semana pasada completa
  deltaPctVolumen: number | null; // % de cambio (null si no hay semana previa)
  sesionesActual: number;
  sesionesAnterior: number;
}

/** Volumen total de las sesiones dentro de [desde, hasta) en ISO */
function volumenEntre(sesiones: SesionEntreno[], desdeISO: string, hastaISO: string): { volumen: number; sesiones: number } {
  let volumen = 0;
  let n = 0;
  for (const s of sesiones) {
    if (!s.date) continue;
    if (s.date >= desdeISO && s.date < hastaISO) {
      volumen += s.volume ?? 0;
      n++;
    }
  }
  return { volumen: Math.round(volumen), sesiones: n };
}

export function comparativaSemanal(estado: EstadoFitTrack): ComparativaSemanal {
  const historial = estado.workoutHistory ?? [];
  const lunesActual = lunesDe(new Date());
  const lunesAnterior = new Date(lunesActual);
  lunesAnterior.setDate(lunesActual.getDate() - 7);

  const actual = volumenEntre(historial, fechaISO(lunesActual), fechaISO(new Date(lunesActual.getTime() + 7 * 86400000)));
  const anterior = volumenEntre(historial, fechaISO(lunesAnterior), fechaISO(lunesActual));

  return {
    volumenActual: actual.volumen,
    volumenAnterior: anterior.volumen,
    deltaPctVolumen:
      anterior.volumen > 0 ? Math.round(((actual.volumen - anterior.volumen) / anterior.volumen) * 100) : null,
    sesionesActual: actual.sesiones,
    sesionesAnterior: anterior.sesiones,
  };
}

// ── 3. Volumen semanal · 12 semanas (con semanas vacías) ────
// A diferencia de volumenSemanal (progreso.ts, 8 semanas con
// huecos), esta SIEMPRE devuelve 12 semanas consecutivas con 0
// en las vacías → la línea de tiempo es real, sin saltos.

export function volumenSemanal12(estado: EstadoFitTrack): { etiquetas: string[]; valores: number[] } {
  const porSemana: Record<string, number> = {};
  const lunes = lunesDe(new Date());
  const claves: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() - i * 7);
    const key = fechaISO(d);
    claves.push(key);
    porSemana[key] = 0;
  }
  const primera = claves[0];
  const ultima = claves[claves.length - 1];
  for (const s of estado.workoutHistory ?? []) {
    if (!s.date || s.date < primera || s.date > ultima) continue;
    const f = new Date(s.date + 'T12:00:00');
    const key = fechaISO(lunesDe(f));
    if (key in porSemana) porSemana[key] += s.volume ?? 0;
  }
  return {
    etiquetas: claves.map((k) => k.slice(5)), // 'MM-DD'
    valores: claves.map((k) => Math.round(porSemana[k])),
  };
}

// ── 4. Distribución por grupo muscular ──────────────────────

/** Grupos del app (normalizados: la DB FitBot dice 'Hombro'/'Pierna') */
const GRUPOS_AUX = new Set(['Calentamiento', 'Enfriamiento', 'Rehabilitación']); // no son músculo: se excluyen

function normalizarGrupo(g: string): string {
  if (g === 'Hombro') return 'Hombros';
  if (g === 'Pierna') return 'Piernas';
  return g;
}

const GRUPOS_CONOCIDOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Movilidad', 'Full Body'];

export interface DistribucionGrupo {
  grupo: string;
  veces: number;   // número de ejercicios de ese grupo entrenados
  volumen: number; // kg de esos ejercicios (si la sesión lo guardó)
  pct: number;     // % sobre el total de veces
}

/** Mapa nombre → grupo con las DOS bibliotecas (propia + FitBot 225).
 *  Incluye calentamiento/enfriamiento/rehabilitación: así el conteo
 *  los reconoce y los EXCLUYE (si no, caerían a 'Otro'). */
function mapaNombreAGrupo(estado: EstadoFitTrack): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const ex of bibliotecaCompleta(estado)) {
    if (ex?.name) mapa.set(ex.name.toLowerCase().trim(), ex.category);
  }
  for (const ex of FB_EJERCICIOS_DB) {
    const nombre = ex['Ejercicio'];
    if (nombre && !mapa.has(nombre.toLowerCase().trim())) {
      const grupo = normalizarGrupo(ex['Grupo Muscular'] ?? '');
      if (grupo) mapa.set(nombre.toLowerCase().trim(), grupo);
    }
  }
  return mapa;
}

/** Grupos mencionados en el nombre de la rutina ('Pecho + Tríceps' → ambos) */
function gruposDelNombreRutina(routineName?: string): string[] {
  if (!routineName) return [];
  return GRUPOS_CONOCIDOS.filter((g) => routineName.toLowerCase().includes(g.toLowerCase()));
}

export function distribucionGrupos(estado: EstadoFitTrack, dias = 90): DistribucionGrupo[] {
  const historial = estado.workoutHistory ?? [];
  if (historial.length === 0) return [];
  const corte = new Date();
  corte.setHours(12, 0, 0, 0);
  corte.setDate(corte.getDate() - dias);
  const corteISO = fechaISO(corte);

  const mapa = mapaNombreAGrupo(estado);
  const conteo: Record<string, { veces: number; volumen: number }> = {};

  for (const s of historial) {
    // El historial va de newest→oldest: parar al pasar el corte
    if (!s.date || s.date < corteISO) continue;
    const porNombre = gruposDelNombreRutina(s.routineName);
    for (const e of s.exercises ?? []) {
      const nombre = (e?.name ?? '').toLowerCase().trim();
      if (!nombre) continue;
      let grupo = mapa.get(nombre);
      if (!grupo) grupo = porNombre[0]; // fallback: grupo de la rutina del día
      if (!grupo) grupo = 'Otro';
      if (GRUPOS_AUX.has(grupo)) continue; // calentamiento/enfriamiento no cuentan
      if (!conteo[grupo]) conteo[grupo] = { veces: 0, volumen: 0 };
      conteo[grupo].veces++;
      conteo[grupo].volumen += e.volume ?? 0;
    }
  }

  const total = Object.values(conteo).reduce((acc, c) => acc + c.veces, 0);
  return Object.entries(conteo)
    .map(([grupo, c]) => ({
      grupo,
      veces: c.veces,
      volumen: Math.round(c.volumen),
      pct: total > 0 ? Math.round((c.veces / total) * 100) : 0,
    }))
    .sort((a, b) => b.veces - a.veces);
}

// ── 5. Evolución del peso (medidas) ─────────────────────────
// measurements va newest→first: primera = la MÁS VIEJA.

export interface EvolucionPeso {
  etiquetas: string[];   // cronológicas (vieja → nueva)
  valores: number[];     // kg
  inicial?: number;
  actual?: number;
  delta?: number;        // actual − inicial (negativo = bajó)
  grasaDelta?: number;   // % grasa
  cinturaDelta?: number; // cm
  brazoDelta?: number;   // cm
  musculoDelta?: number; // % masa muscular
}

export function evolucionPeso(medidas: MedidaCorporal[]): EvolucionPeso {
  const conPeso = medidas.filter((m) => typeof m.weight === 'number' && m.weight > 0);
  const cronologicas = [...conPeso].reverse(); // vieja → nueva
  const { etiquetas, valores } = {
    etiquetas: cronologicas.map((m) => m.date?.slice(5) ?? ''),
    valores: cronologicas.map((m) => m.weight as number),
  };

  const ev: EvolucionPeso = { etiquetas, valores };
  if (cronologicas.length >= 2) {
    const primera = cronologicas[0];
    const ultima = cronologicas[cronologicas.length - 1];
    ev.inicial = primera.weight;
    ev.actual = ultima.weight;
    ev.delta = Math.round(((ultima.weight ?? 0) - (primera.weight ?? 0)) * 10) / 10;
    if (typeof primera.bodyfat === 'number' && typeof ultima.bodyfat === 'number') {
      ev.grasaDelta = Math.round((ultima.bodyfat - primera.bodyfat) * 10) / 10;
    }
    if (typeof primera.waist === 'number' && typeof ultima.waist === 'number' && primera.waist > 0 && ultima.waist > 0) {
      ev.cinturaDelta = Math.round((ultima.waist - primera.waist) * 10) / 10;
    }
    if (typeof primera.arms === 'number' && typeof ultima.arms === 'number' && primera.arms > 0 && ultima.arms > 0) {
      ev.brazoDelta = Math.round((ultima.arms - primera.arms) * 10) / 10;
    }
    if (typeof primera.muscle === 'number' && typeof ultima.muscle === 'number' && primera.muscle > 0 && ultima.muscle > 0) {
      ev.musculoDelta = Math.round((ultima.muscle - primera.muscle) * 10) / 10;
    }
  }
  return ev;
}

// ── 6. PRs con progreso real (peso primera vez → PR) ────────

export interface PRProgreso {
  id: string;
  nombre: string;
  peso: number;
  reps: number;
  rm1: number;             // Epley del PR
  pesoPrimera?: number;    // peso de la primera vez que se registró
  deltaPct?: number;       // % peso PR vs primera vez (null si no hay historial)
  fecha?: string;
}

export function prsConProgreso(estado: EstadoFitTrack, max = 5): PRProgreso[] {
  const prs = Object.entries(estado.prs ?? {});
  if (prs.length === 0) return [];

  // Historial cronológico (vieja → nueva) para buscar la primera vez
  const historial = [...(estado.workoutHistory ?? [])].filter((s) => s.date).reverse();

  const resultado: PRProgreso[] = prs.map(([id, pr]) => {
    const nombre = pr.name ?? id.replace(/-/g, ' ');
    const rm1 = pr.value && pr.value > 0 ? pr.value : Math.round(pr.weight * (1 + pr.reps / 30));
    const buscado = nombre.toLowerCase().trim();

    let pesoPrimera: number | undefined;
    for (const s of historial) {
      const encontro = (s.exercises ?? []).find((e) => (e?.name ?? '').toLowerCase().trim() === buscado);
      if (encontro && typeof encontro.weight === 'number' && encontro.weight > 0) {
        pesoPrimera = encontro.weight;
        break; // la PRIMERA aparición (historial ya está cronológico)
      }
    }
    const deltaPct =
      pesoPrimera && pesoPrimera > 0 ? Math.round(((pr.weight - pesoPrimera) / pesoPrimera) * 100) : undefined;

    return { id, nombre, peso: pr.weight, reps: pr.reps, rm1, pesoPrimera, deltaPct, fecha: pr.date };
  });

  // Top por 1RM estimado (los lifts más pesados primero)
  return resultado.sort((a, b) => b.rm1 - a.rm1).slice(0, max);
}

// ── 7. Consistencia vs objetivo del perfil ──────────────────

export interface SemanaConsistencia {
  inicioISO: string;  // lunes de esa semana
  etiqueta: string;   // 'MM-DD'
  hechas: number;     // sesiones de esa semana
  actual: boolean;    // es la semana en curso (incompleta)
}

export interface Consistencia {
  objetivo: number;   // sesiones/semana según perfil (default 3)
  semanas: SemanaConsistencia[];
  hechasTotal: number;
  esperadas: number;  // objetivo × semanas (la actual cuenta proporcional? no: entera, más simple y motivadora)
  pct: number;        // hechas / esperadas (cap 100)
}

export function consistencia(estado: EstadoFitTrack, perfil: PerfilEntreno | null, semanas = 4): Consistencia {
  const objetivo = perfil?.dias && perfil.dias > 0 ? perfil.dias : 3;
  const historial = estado.workoutHistory ?? [];
  const lunes = lunesDe(new Date());

  const detalle: SemanaConsistencia[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = new Date(lunes);
    inicio.setDate(lunes.getDate() - i * 7);
    const inicioISO = fechaISO(inicio);
    const finISO = fechaISO(new Date(inicio.getTime() + 7 * 86400000));
    const { sesiones } = volumenEntre(historial, inicioISO, finISO);
    detalle.push({ inicioISO, etiqueta: inicioISO.slice(5), hechas: sesiones, actual: i === 0 });
  }

  const hechasTotal = detalle.reduce((acc, s) => acc + s.hechas, 0);
  const esperadas = objetivo * semanas;
  return { objetivo, semanas: detalle, hechasTotal, esperadas, pct: Math.min(100, Math.round((hechasTotal / esperadas) * 100)) };
}

// ── 8. Días favoritos (frecuencia por día de la semana) ─────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function diasFavoritos(estado: EstadoFitTrack): { dia: string; veces: number }[] {
  const conteo = new Array(7).fill(0) as number[];
  for (const s of estado.workoutHistory ?? []) {
    if (!s.date) continue;
    const d = new Date(s.date + 'T12:00:00');
    if (!Number.isNaN(d.getTime())) conteo[d.getDay()]++;
  }
  // Orden visual Lunes→Domingo (como el heatmap del dashboard)
  const ordenVisual = [1, 2, 3, 4, 5, 6, 0];
  return ordenVisual.map((i) => ({ dia: DIAS_SEMANA[i], veces: conteo[i] }));
}

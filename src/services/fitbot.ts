// ═══════════════════════════════════════════════════════════
// 🤖 ROBOT FITBOT — FitTrack V2 (F3 · Robots)
// Motor de decisión del robot PROPIO del app viejo, portado a
// TypeScript sin inventar nada: evaluarPerfil (A-H), memoria y
// aprendizaje del historial, reglas personalizadas y el
// generador de rutinas con patrones de movimiento y prioridad
// de equipo (barra → mancuerna → máquina/polea).
// Fuente: index.html del viejo L2551-2913 (FitBotEngine) y
// L7175-7310 (generarRutinaMulti). La DB vive en data/fitbotDb.
// ═══════════════════════════════════════════════════════════

import type {
  AnalisisFitBot, Ejercicio, EjercicioBloque, EjercicioDB, EstadoDiarioFitBot,
  EstadoFitTrack, PerfilFitBot, PRLevantamiento, RutinaFitBot, SesionEntreno,
} from '../types';
import { FB_CALENTAMIENTO, FB_CONSEJOS, FB_EJERCICIOS_DB, FB_PERFILES, FB_REHABILITACION, FB_REGLAS_PERSONALIZADAS, type ReglaEstado } from '../data/fitbotDb';
import { aplicarEstado, hoyISO } from './storageFit';

// ═══════════════════════════════════════════════════════════
// 🔍 MOTOR DE DECISIÓN (FitBotEngine.evaluarPerfil, L2554)
// ═══════════════════════════════════════════════════════════

/** Evalúa el estado del usuario y retorna el perfil recomendado (A-H) */
export function evaluarPerfil(estado: EstadoDiarioFitBot): AnalisisFitBot {
  const { energia = '', sueno = '', fatiga = 0, dolor_hombro = 0, dolor_muneca = 0 } = estado;

  // PRIORIDAD 1: Seguridad (dolor severo)
  if (dolor_hombro >= 8 && dolor_muneca >= 8) return { perfil: 'D', razon: 'Dolor severo — Solo movilidad y rehabilitación', icono: 'triangle-alert', urgente: true };
  if (dolor_hombro >= 8) return { perfil: 'F', razon: 'Dolor de hombro — Activando protección', icono: 'triangle-alert', urgente: true };
  if (dolor_muneca >= 8) return { perfil: 'G', razon: 'Dolor de muñeca — Adaptando agarres', icono: 'triangle-alert', urgente: true };

  // PRIORIDAD 2: Recuperación (fatiga/sueño)
  if (fatiga >= 8 || (sueno === 'Malo' && fatiga >= 6)) return { perfil: 'D', razon: 'Fatiga alta — Semana de recuperación activa', icono: 'moon', urgente: false };

  // PRIORIDAD 3: Energía
  if (energia === 'Muy baja') return { perfil: 'D', razon: 'Energía muy baja — Rutina corta 30 min', icono: 'zap', urgente: false };
  if (energia === 'Baja' && sueno === 'Malo') return { perfil: 'C', razon: 'Energía baja — Sesión conservadora', icono: 'zap', urgente: false };

  // ESCENARIOS COMBINADOS
  if (energia === 'Muy Alta' && sueno === 'Excelente' && fatiga <= 2) return { perfil: 'E', razon: 'Condiciones perfectas — Modo récords', icono: 'rocket', urgente: false };
  if (energia === 'Alta' && sueno === 'Bueno' && fatiga <= 3) {
    if (dolor_hombro >= 4) return { perfil: 'F', razon: 'Buen día pero protegemos hombro', icono: 'dumbbell', urgente: false };
    return { perfil: 'A', razon: 'Excelente estado — Sesión agresiva', icono: 'dumbbell', urgente: false };
  }
  if (energia === 'Alta' && (sueno === 'Regular' || fatiga <= 5)) return { perfil: 'B', razon: 'Buen estado — Sesión normal', icono: 'thumbs-up', urgente: false };
  if (energia === 'Media' && sueno === 'Regular') return { perfil: 'C', razon: 'Estado moderado — Sesión conservadora', icono: 'meh', urgente: false };
  if (sueno === 'Malo' || fatiga >= 6) return { perfil: 'D', razon: 'Recuperación prioritaria hoy', icono: 'moon', urgente: false };

  // Default
  return { perfil: 'B', razon: 'Estado normal — Sesión estándar', icono: 'thumbs-up', urgente: false };
}

/** Mensajes de análisis del día (generarMensaje del viejo, sin HTML) */
export function generarMensaje(estado: EstadoDiarioFitBot, resultado: AnalisisFitBot, nombre: string): string[] {
  const perfil = FB_PERFILES[resultado.perfil];
  const { energia = '', sueno = '', fatiga = 0, dolor_hombro = 0, dolor_muneca = 0 } = estado;
  const nombreCorto = nombre || 'Rudy';
  const consejo = getConsejo(estado);
  const fatEval = evaluarFatiga(estado);
  const msgs: string[] = [];

  // Mensaje 1: Saludo + análisis
  let m1 = `¡Hola ${nombreCorto}!\n\n**Análisis de hoy:**\n1. Energía: **${energia}**\n2. Sueño: **${sueno}**\n3. Fatiga: **${fatiga}/10** — ${fatEval.nivel}`;
  if (dolor_hombro > 0) m1 += `\n4. Hombro: **${dolor_hombro}/10**`;
  if (dolor_muneca > 0) m1 += `\n5. Muñeca: **${dolor_muneca}/10**`;
  msgs.push(m1);

  // Mensaje 2: Perfil recomendado
  let m2 = `**Perfil recomendado: ${perfil.id} — ${perfil.nombre}**\n\n${resultado.razon}\n\n1. Intensidad: **${perfil.intensidad}**\n2. Volumen: **${perfil.volumen}**\n3. Duración: **${perfil.duracion}**\n4. Objetivo: **${perfil.objetivo}**`;
  if (resultado.urgente) m2 += `\n\n⚠️ **ALERTA:** ${resultado.razon}`;
  msgs.push(m2);

  // Mensaje 3: Consejo (si aplica)
  if (consejo) msgs.push(`💡 **Consejo del día:**\n${consejo}`);

  return msgs;
}

/** Consejo según situación (getConsejo del viejo) */
export function getConsejo(estado: EstadoDiarioFitBot): string | null {
  const { dolor_hombro = 0, fatiga = 0, sueno = '', energia = '' } = estado;
  if (dolor_hombro >= 4) return FB_CONSEJOS.find((c) => c.situacion === 'Dolor de hombro')?.respuesta ?? null;
  if (fatiga >= 6) return FB_CONSEJOS.find((c) => c.situacion === 'Cansado')?.respuesta ?? null;
  if (sueno === 'Malo') return FB_CONSEJOS.find((c) => c.situacion === 'Sin dormir bien')?.respuesta ?? null;
  if (energia === 'Alta' || energia === 'Muy Alta') return FB_CONSEJOS.find((c) => c.situacion === 'Energía alta')?.respuesta ?? null;
  return null;
}

/** Evalúa fatiga y recomienda acción (evaluarFatiga del viejo) */
export function evaluarFatiga(estado: EstadoDiarioFitBot): { nivel: string; accion: string } {
  const score = estado.fatiga ?? 1;
  if (score >= 9) return { nivel: 'Crítico', accion: 'Descanso total recomendado' };
  if (score >= 7) return { nivel: 'Alto', accion: 'Solo 30 min, ejercicios básicos' };
  if (score >= 4) return { nivel: 'Moderado', accion: 'Reduce 1-2 series por ejercicio' };
  return { nivel: 'Bajo', accion: 'Entrena normal' };
}

/** Filtra ejercicios según limitaciones (filtrarEjercicios del viejo) */
export function filtrarEjercicios(ejercicios: EjercicioDB[], estado: EstadoDiarioFitBot): EjercicioDB[] {
  let filtrados = [...ejercicios];
  if ((estado.dolor_hombro ?? 0) >= 4) {
    filtrados = filtrados.filter((e) => e['Seguro Hombro'] === 'Sí' || e['Seguro Hombro'] === 'Si');
  }
  if ((estado.dolor_muneca ?? 0) >= 4) {
    filtrados = filtrados.filter((e) => e['Seguro Muñeca'] === 'Sí' || e['Seguro Muñeca'] === 'Si');
  }
  return filtrados;
}

/** Calentamiento recomendado (getCalentamiento del viejo) */
export function getCalentamiento(estado: EstadoDiarioFitBot): EjercicioBloque[] {
  if ((estado.dolor_hombro ?? 0) >= 4) return FB_CALENTAMIENTO.filter((e) => e['Zona'] === 'Hombro');
  return FB_CALENTAMIENTO.slice(0, 3);
}

/** Evalúa las reglas personalizadas (evalReglas del viejo) */
export function evalReglas(estado: EstadoDiarioFitBot): { id: string; cat: string; prior: string; rec: string; accion: string }[] {
  const reglaEstado: ReglaEstado = {
    energia: estado.energia ?? '',
    sueno: estado.sueno ?? '',
    fatiga: estado.fatiga ?? 0,
    dolor_hombro: estado.dolor_hombro ?? 0,
    dolor_muneca: estado.dolor_muneca ?? 0,
  };
  const activas: { id: string; cat: string; prior: string; rec: string; accion: string }[] = [];
  for (const r of FB_REGLAS_PERSONALIZADAS) {
    try {
      if (r.test && r.test(reglaEstado)) {
        activas.push({ id: r.id, cat: r.cat, prior: r.prior, rec: r.rec, accion: r.accion });
      }
    } catch { /* regla rota: ignorar como el viejo */ }
  }
  const orden: Record<string, number> = { 'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 };
  return activas.sort((a, b) => (orden[a.prior] ?? 9) - (orden[b.prior] ?? 9));
}

// ═══════════════════════════════════════════════════════════
// 🧠 MEMORIA Y APRENDIZAJE (leerMemoria/ajustarPerfil, L2782)
// ═══════════════════════════════════════════════════════════

export interface MemoriaFitBot {
  ultimaSesion: SesionEntreno | null;
  diasDesdeUltimo: number | null;
  gruposRecientes: string[];
  feedbackUltimo: SesionEntreno['feedback'];
  ajustePerfil: string;
  volumenTendencia: string | null;
}

/** Lee el historial y construye el resumen para el bot (leerMemoria del viejo) */
export function leerMemoria(
  historial: SesionEntreno[],
  _prs: Record<string, PRLevantamiento> | undefined,
  estadoDiario?: EstadoDiarioFitBot,
): MemoriaFitBot {
  const memoria: MemoriaFitBot = {
    ultimaSesion: null,
    diasDesdeUltimo: null,
    gruposRecientes: [],
    feedbackUltimo: null,
    ajustePerfil: estadoDiario?._ajustePerfil ?? 'mantener',
    volumenTendencia: null,
  };
  if (!historial || historial.length === 0) return memoria;

  const hoy = new Date();
  const ultima = historial[0];
  memoria.ultimaSesion = ultima;

  // Días desde último entreno
  const [y, m, d] = (ultima.date ?? '').split('-').map(Number);
  if (y && m && d) {
    memoria.diasDesdeUltimo = Math.floor((hoy.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  }

  // Feedback de la última sesión
  if (ultima.feedback) memoria.feedbackUltimo = ultima.feedback;

  // Grupos trabajados en los últimos 3 días (para evitar repetir)
  const hace3 = new Date(hoy.getTime() - 3 * 86_400_000);
  const limite3 = `${hace3.getFullYear()}-${String(hace3.getMonth() + 1).padStart(2, '0')}-${String(hace3.getDate()).padStart(2, '0')}`;
  memoria.gruposRecientes = historial
    .filter((s) => (s.date ?? '') >= limite3)
    .flatMap((s) => (s.exercises ?? []).map((e) => e.name ?? ''))
    .filter(Boolean)
    .slice(0, 10);

  // Tendencia de volumen (últimas 4 sesiones)
  if (historial.length >= 2) {
    const vols = historial.slice(0, 4).map((s) => s.volume ?? 0);
    memoria.volumenTendencia = vols[0] >= vols[1] ? 'subiendo' : 'bajando';
  }
  return memoria;
}

/** Ajusta el perfil según feedback y días de descanso (viejo L2820) */
export function ajustarPerfilPorMemoria(perfilBase: PerfilFitBot, memoria: MemoriaFitBot): PerfilFitBot {
  let perfil = perfilBase;

  // Si fue muy duro la última vez → bajar un escalón
  if (memoria.ajustePerfil === 'bajar') {
    const escala: Record<PerfilFitBot, PerfilFitBot> = { 'A': 'B', 'B': 'C', 'C': 'D', 'D': 'D', 'E': 'B', 'F': 'F', 'G': 'G', 'H': 'C' };
    perfil = escala[perfil] ?? perfil;
  }
  // Si fue fácil → subir
  if (memoria.ajustePerfil === 'subir') {
    const escala: Partial<Record<PerfilFitBot, PerfilFitBot>> = { 'D': 'C', 'C': 'B', 'B': 'A', 'F': 'B', 'G': 'B' };
    perfil = escala[perfil] ?? perfil;
  }
  // Muchos días sin entrenar → arrancar conservador
  if ((memoria.diasDesdeUltimo ?? 0) >= 5) {
    const escala: Partial<Record<PerfilFitBot, PerfilFitBot>> = { 'A': 'B', 'E': 'B' };
    perfil = escala[perfil] ?? perfil;
  }
  return perfil;
}

/** Mensajes de contexto de memoria (mensajeMemoria del viejo) */
export function mensajeMemoria(memoria: MemoriaFitBot): string[] {
  const msgs: string[] = [];
  if (memoria.diasDesdeUltimo !== null) {
    if (memoria.diasDesdeUltimo === 0) msgs.push('Ya entrenaste hoy. Considera una sesión ligera.');
    else if (memoria.diasDesdeUltimo === 1) msgs.push('Entrenaste ayer — el cuerpo está en recuperación activa.');
    else if (memoria.diasDesdeUltimo >= 5) msgs.push(`Llevas ${memoria.diasDesdeUltimo} días sin entrenar — empezamos conservador.`);
  }
  if (memoria.feedbackUltimo) {
    const dif = memoria.feedbackUltimo?.dificultad ?? 0;
    if (dif >= 4) msgs.push('La última sesión fue muy dura — ajusté la intensidad a la baja.');
    else if (dif <= 2 && dif > 0) msgs.push('La última sesión fue fácil — subí un poco la intensidad.');
  }
  if (memoria.ajustePerfil === 'bajar') msgs.push('Perfil ajustado: intensidad reducida.');
  if (memoria.ajustePerfil === 'subir') msgs.push('Perfil ajustado: intensidad aumentada.');
  return msgs;
}

// ═══════════════════════════════════════════════════════════
// 🏗️ GENERADOR DE RUTINAS (generarRutinaMulti, L7175)
// Prioridad: Barra Multi → Mancuerna Multi → Barra Aislado →
// Mancuerna Aislado → Máquina/Polea. Sin repetir patrón de
// movimiento. Calentamiento y enfriamiento automáticos.
// ═══════════════════════════════════════════════════════════

/** Mapa target → grupos musculares (TARGETS_MAP del viejo) */
export const TARGETS_MAP: Record<string, string[]> = {
  'pecho': ['Pecho'],
  'espalda': ['Espalda'],
  'hombros': ['Hombro'],
  'biceps': ['Bíceps'],
  'triceps': ['Tríceps'],
  'piernas': ['Pierna'],
  'core': ['Core'],
  'cardio': ['Cardio'],
  'calentamiento': ['Calentamiento'],
  'enfriamiento': ['Enfriamiento'],
  'rehabilitacion': ['Rehabilitación'],
  'recuperacion': ['Enfriamiento', 'Calentamiento'],
  'tren-superior': ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps'],
  'tren-inferior': ['Pierna'],
  'full-body': ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core'],
  'movilidad': ['Calentamiento', 'Enfriamiento'],
};

/** Patrones de movimiento que NO se repiten en una misma sesión (PATRONES del viejo) */
const PATRONES: Record<string, string[]> = {
  'peso muerto': ['peso muerto', 'rumano', 'pierna rígida', 'convencional', 'sumo', 'stiff', 'rdl'],
  'sentadilla': ['sentadilla', 'squat', 'goblet', 'frontal', 'smith', 'hack squat'],
  'hip thrust': ['hip thrust', 'glute bridge'],
  'prensa': ['prensa', 'leg press'],
  'press banca': ['press plano', 'press banca', 'press pecho'],
  'press inclinado': ['press inclinado'],
  'press militar': ['press militar', 'press hombro', 'overhead press', 'ohp'],
  'press arnold': ['press arnold'],
  'remo': ['remo', 'row', 't-bar', 'seal row', 'inverted row'],
  'jalon': ['jalón', 'jal', 'pulldown', 'dominadas', 'pull'],
  'curl biceps': ['curl bíceps', 'curl biceps', 'curl barra', 'curl martillo', 'curl alternado', 'curl predicador', 'curl concentrado', 'curl bayesian', 'curl 21', 'curl spider', 'curl inverso'],
  'extension triceps': ['tríceps', 'triceps', 'skull', 'fondos', 'press cerrado', 'extensión', 'kickback', 'jm press'],
  'lateral': ['lateral', 'elevación lateral', 'rear delt'],
  'step ups': ['step up', 'zancada', 'búlgara', 'lunges'],
  'face pull': ['face pull'],
};

function getPatron(nombre: string): string {
  const n = nombre.toLowerCase();
  for (const [patron, keywords] of Object.entries(PATRONES)) {
    if (keywords.some((kw) => n.includes(kw))) return patron;
  }
  return n;
}

/** Genera la rutina desde los targets del wizard (port exacto) */
export function generarRutinaMulti(
  targets: string[],
  estadoDiario: EstadoDiarioFitBot,
  maxEjUsuario: number | null,
  estadoGlobal: EstadoFitTrack,
): RutinaFitBot {
  // Grupos combinados
  let grupos: string[] = [];
  targets.forEach((t) => { (TARGETS_MAP[t] ?? []).forEach((g) => { if (!grupos.includes(g)) grupos.push(g); }); });
  if (!grupos.length) grupos = ['Pecho', 'Espalda'];

  const perfil = evaluarPerfil(estadoDiario).perfil;

  // CANTIDAD: la elegida por el usuario, o default por perfil
  const esDescarga = perfil === 'D' || estadoGlobal.fitbot?.perfilActual === 'D';
  const maxEj = maxEjUsuario ? maxEjUsuario : esDescarga ? 3 : perfil === 'C' ? 4 : 5;

  // POOL PRINCIPAL (excluir calentamiento/enfriamiento/rehab)
  const pool = FB_EJERCICIOS_DB.filter((e) => {
    if (['Calentamiento', 'Enfriamiento', 'Rehabilitación'].includes(e['Grupo Muscular'])) return false;
    if ((estadoDiario.dolor_hombro ?? 0) >= 4 && e['Seguro Hombro'] !== 'Sí') return false;
    if ((estadoDiario.dolor_muneca ?? 0) >= 4 && e['Seguro Muñeca'] !== 'Sí') return false;
    if ((estadoDiario.dolor_rodilla ?? 0) >= 4 && e['Grupo Muscular'] === 'Pierna' && e['Tipo'] !== 'Aislado') return false;
    return true;
  });

  let ejerciciosDia = pool.filter((e) => grupos.includes(e['Grupo Muscular']));
  if (ejerciciosDia.length === 0) ejerciciosDia = pool;

  // PRIORIDAD de equipo
  const p1 = ejerciciosDia.filter((e) => e['Equipo'] === 'Barra' && e['Tipo'] === 'Multiarticular');
  const p2 = ejerciciosDia.filter((e) => e['Equipo'] === 'Mancuernas' && e['Tipo'] === 'Multiarticular');
  const p3 = ejerciciosDia.filter((e) => e['Equipo'] === 'Barra' && e['Tipo'] !== 'Multiarticular');
  const p4 = ejerciciosDia.filter((e) => e['Equipo'] === 'Mancuernas' && e['Tipo'] !== 'Multiarticular');
  const p5 = ejerciciosDia.filter((e) => ['Máquina', 'Polea', 'Banda', 'Peso corporal'].includes(e['Equipo']));

  const maquinasMin = maxEj <= 3 ? 1 : maxEj <= 5 ? 1 : 2;
  const pesosLibreMax = maxEj - maquinasMin;

  const offset = new Date().getDay();
  let seleccion: EjercicioDB[] = [];
  const patronesUsados = new Set<string>();

  const addPriority = (arr: EjercicioDB[], limite: number) => {
    for (let i = 0; i < arr.length && seleccion.length < limite; i++) {
      const ex = arr[(i + offset) % arr.length];
      const patron = getPatron(ex['Ejercicio']);
      if (seleccion.find((s) => s['ID'] === ex['ID'])) continue;
      if (patronesUsados.has(patron)) continue;
      seleccion.push(ex);
      patronesUsados.add(patron);
    }
  };

  addPriority(p1, pesosLibreMax);
  addPriority(p2, pesosLibreMax);
  addPriority(p3, pesosLibreMax);
  addPriority(p4, pesosLibreMax);
  addPriority(p5, maxEj);

  // Deduplicar
  const seen = new Set<number>();
  seleccion = seleccion.filter((e) => { if (!e || seen.has(e['ID'])) return false; seen.add(e['ID']); return true; });
  seleccion = seleccion.slice(0, maxEj);

  // Calentamiento y enfriamiento automáticos
  const calentamiento = FB_EJERCICIOS_DB.filter((e) => e['Grupo Muscular'] === 'Calentamiento')
    .slice(0, (estadoDiario.dolor_hombro ?? 0) >= 4 ? 3 : 2);
  const enfriamiento = FB_EJERCICIOS_DB.filter((e) => e['Grupo Muscular'] === 'Enfriamiento').slice(0, 2);

  const tipoLabel = targets.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
  return {
    tipoRutina: tipoLabel,
    ejercicios: seleccion.map((e) => e['Ejercicio']),
    ejerciciosCompletos: seleccion,
    calentamiento,
    enfriamiento,
    volumen: perfil === 'D' ? 'Bajo' : maxEj >= 6 ? 'Alto' : 'Medio',
    intensidad: FB_PERFILES[perfil]?.intensidad ?? 'Media',
    nota: getConsejo(estadoDiario) ?? '',
  };
}

/** Sesión de rehabilitación (generarRutinaRehab del viejo, L7122) */
export function generarRutinaRehab(estadoDiario: EstadoDiarioFitBot): RutinaFitBot {
  const rehabPool: EjercicioBloque[] = FB_REHABILITACION;

  // Ejercicios seguros del Excel según molestias
  const seguros = FB_EJERCICIOS_DB.filter((e) => {
    if ((estadoDiario.dolor_hombro ?? 0) >= 4 && e['Seguro Hombro'] !== 'Sí') return false;
    if ((estadoDiario.dolor_muneca ?? 0) >= 4 && e['Seguro Muñeca'] !== 'Sí') return false;
    return ['Rehabilitación', 'Calentamiento', 'Enfriamiento', 'Core'].includes(e['Grupo Muscular']);
  }).slice(0, 4);

  const ejerciciosCompletos: (EjercicioDB | EjercicioBloque)[] = [
    ...rehabPool.slice(0, 3),
    ...seguros.slice(0, 3),
  ];

  return {
    tipoRutina: 'Rehabilitación',
    ejercicios: ejerciciosCompletos.map((e) => e['Ejercicio']),
    ejerciciosCompletos,
    calentamiento: FB_CALENTAMIENTO.slice(0, 2),
    enfriamiento: FB_EJERCICIOS_DB.filter((e) => e['Grupo Muscular'] === 'Enfriamiento').slice(0, 2),
    volumen: 'Muy bajo',
    intensidad: 'Muy baja',
    nota: 'Sin cargas pesadas. Enfócate en el movimiento controlado.',
  };
}

// ═══════════════════════════════════════════════════════════
// 💾 PERSISTENCIA (mismas claves y shape del viejo)
// ═══════════════════════════════════════════════════════════

const CLAVE_RUTINA_HOY = 'FITTRACK_RUTINA_HOY';
const CLAVE_RUTINA_FECHA = 'FITTRACK_RUTINA_FECHA';

/** Guarda el check-in diario en state.fitbot.estadoDiario (merge como el viejo) */
export function guardarEstadoDiario(datos: EstadoDiarioFitBot, esDemo: boolean): void {
  if (esDemo) return;
  aplicarEstado((est) => {
    if (!est.fitbot) est.fitbot = {};
    est.fitbot.estadoDiario = { ...(est.fitbot.estadoDiario ?? {}), ...datos };
  });
}

/** Guarda el perfil activo (state.fitbot.perfilActual) */
export function guardarPerfilActual(perfil: PerfilFitBot, esDemo: boolean): void {
  if (esDemo) return;
  aplicarEstado((est) => {
    if (!est.fitbot) est.fitbot = {};
    est.fitbot.perfilActual = perfil;
  });
}

/**
 * Carga la rutina como "Rutina de Hoy" — igual que cargarRutinaFitBot
 * del viejo: state.fitbot + FITTRACK_RUTINA_HOY + FITTRACK_RUTINA_FECHA
 * (persistencia agresiva: si la app se cierra, la rutina sigue ahí).
 */
export function guardarRutinaHoy(rutina: RutinaFitBot, esDemo: boolean): void {
  const fecha = hoyISO();
  if (!esDemo) {
    aplicarEstado((est) => {
      if (!est.fitbot) est.fitbot = {};
      est.fitbot.rutinaRecomendada = rutina;
      est.fitbot.rutinaFecha = fecha;
      est.fitbot.rutinaActivaEnPantalla = true;
    });
    try {
      window.localStorage.setItem(CLAVE_RUTINA_HOY, JSON.stringify(rutina));
      window.localStorage.setItem(CLAVE_RUTINA_FECHA, fecha);
    } catch { /* sin espacio */ }
  }
}

/** ¿Hay rutina del robot activa HOY? (lee las claves del viejo) */
export function leerRutinaHoy(): RutinaFitBot | null {
  try {
    const fecha = window.localStorage.getItem(CLAVE_RUTINA_FECHA);
    if (fecha !== hoyISO()) return null;
    const crudo = window.localStorage.getItem(CLAVE_RUTINA_HOY);
    if (!crudo) return null;
    const rutina = JSON.parse(crudo) as RutinaFitBot;
    return rutina?.ejerciciosCompletos?.length ? rutina : null;
  } catch { return null; }
}

/** Descarta la rutina del robot (vuelve al split semanal) */
export function quitarRutinaHoy(esDemo: boolean): void {
  if (!esDemo) {
    aplicarEstado((est) => {
      if (est.fitbot) {
        est.fitbot.rutinaRecomendada = null;
        est.fitbot.rutinaActivaEnPantalla = false;
      }
    });
  }
  try {
    window.localStorage.removeItem(CLAVE_RUTINA_HOY);
    window.localStorage.removeItem(CLAVE_RUTINA_FECHA);
  } catch { /* sin storage */ }
}

// ═══════════════════════════════════════════════════════════
// 🔌 ADAPTADORES → flujo de entreno F2
// ═══════════════════════════════════════════════════════════

/** ID estable de un ítem de rutina (para PRs y progresión) */
export function idItemRutina(item: EjercicioDB | EjercicioBloque): string {
  return `fitbot-${String(item['ID'])}`;
}

/** Nombre del ítem (fila del Excel o bloque W o R) */
export function itemNombre(item: EjercicioDB | EjercicioBloque): string {
  return item['Ejercicio'] ?? '';
}

/** Grupo muscular (fila Excel) o zona (bloque W o R) */
export function itemGrupo(item: EjercicioDB | EjercicioBloque): string {
  return (item as EjercicioDB)['Grupo Muscular'] ?? (item as EjercicioBloque)['Zona'] ?? '';
}

/** Series del ítem (0 = usar las del modo activo) */
export function itemSeries(item: EjercicioDB | EjercicioBloque): number {
  const s = (item as EjercicioDB)['Series'];
  const n = typeof s === 'number' ? s : parseInt(String(s ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Reps del ítem ('' = usar las del modo activo). Bloques: duración */
export function itemReps(item: EjercicioDB | EjercicioBloque): string {
  return (item as EjercicioDB)['Reps'] ?? (item as EjercicioBloque)['Duración'] ?? '';
}

/** Equipo del ítem */
export function itemEquipo(item: EjercicioDB | EjercicioBloque): string {
  return (item as EjercicioDB)['Equipo'] ?? '';
}

/** La rutina activa como lista de ejercicios del flujo F2 (calentamiento + principales + enfriamiento) */
export function ejerciciosDeRutina(rutina: RutinaFitBot): Ejercicio[] {
  const out: Ejercicio[] = [];
  const push = (item: EjercicioDB | EjercicioBloque) => {
    out.push({ id: idItemRutina(item), name: itemNombre(item), category: itemGrupo(item) });
  };
  (rutina.calentamiento ?? []).forEach(push);
  (rutina.ejerciciosCompletos ?? []).forEach(push);
  (rutina.enfriamiento ?? []).forEach(push);
  return out;
}

/** Series/reps específicas de un ejercicio de la rutina activa (null = usar modo) */
export function paramsItemRutina(exId: string): { series: number; reps: string } | null {
  const rutina = leerRutinaHoy();
  if (!rutina) return null;
  const items = [
    ...(rutina.calentamiento ?? []),
    ...(rutina.ejerciciosCompletos ?? []),
    ...(rutina.enfriamiento ?? []),
  ];
  const item = items.find((it) => idItemRutina(it) === exId);
  if (!item) return null;
  const series = itemSeries(item);
  const reps = itemReps(item);
  if (!series && !reps) return null;
  return { series, reps };
}

/** Etiqueta de la rutina activa para el banner de Hoy ("FitBot: Pecho + Tríceps") */
export function etiquetaRutinaHoy(): string | null {
  const rutina = leerRutinaHoy();
  return rutina ? rutina.tipoRutina : null;
}

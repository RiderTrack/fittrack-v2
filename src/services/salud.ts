// ═══════════════════════════════════════════════════════════
// 🩺 SALUD — FitTrack V2 (F10 · HealthTrack fusionado)
// Puerto del módulo de datos del app HealthTrack (single
// index.html → modularizado). Sus 7 almacenes IndexedDB
// (agua, sueno, peso, cardio, meds, sintomas, perfil) viven
// ahora en UNA clave FT2_SALUD:
//   • agua: {fecha → mL totales del día}  (igual que el viejo,
//     que hacía dbGet+dbPut por fecha)
//   • sueno: {fecha → registro} (uno por día, como el viejo)
//   • vitales: el "cardio" del viejo = presión sistólica/
//     diastólica + FC + saturación O2 (signos vitales)
//   • meds / sintomas: arrays con id (como el viejo)
//   • perfil: perfil de salud (sangre, alergias, emergencia…)
// PESO: NO se duplica — ya vive en Medidas (F4) del FitTrack;
// el Resumen toma el último peso + talla de ahí para el IMC.
// Prefijo FT2_ → entra SOLO al respaldo JSON y al reset (F6)
// sin tocar una línea de respaldo.ts.
//
// F10.1 — MEDICAMENTOS PROFESIONALES: el modelo simple del viejo
// (nombre+dosis+hora+check) pasó a un TRATAMIENTO de verdad:
// cantidad (mg/g/mL…), HORARIOS múltiples al día, cada cuántos
// días, fecha de inicio y DURACIÓN en días (0 = uso continuo),
// pausa, y un registro de tomas por fecha+hora que alimenta el
// plan del día, la próxima dosis y la adherencia de 7 días.
// Los meds del modelo viejo se migran solos al leer.
// ═══════════════════════════════════════════════════════════

// ── Tipos (shapes del HealthTrack viejo) ──────────────────────
export interface RegistroSueno {
  fecha: string;      // 'YYYY-MM-DD'
  horas: number;      // 7.5
  calidad: 'Excelente' | 'Buena' | 'Regular' | 'Mala';
  ini: string;        // '23:30'
  fin: string;        // '07:00'
}

export interface RegistroVital {
  id: number;
  fecha: string;      // 'YYYY-MM-DD HH:MM'
  sis: number;        // sistólica mmHg
  dia: number;        // diastólica mmHg
  fc: number | null;  // frecuencia cardíaca lpm
  sat: number | null; // saturación O2 %
}

export interface Medicamento {
  id: number;
  nom: string;
  cant: number;        // cantidad por toma: 500
  unidad: string;      // 'mg' | 'g' | 'µg' | 'mL' | 'gotas' | 'cápsulas' | 'comprimidos' | 'IU'
  horas: string[];     // a qué horas tomar: ['08:00','14:00','20:00']
  cadaDias: number;    // 1 = todos los días, 2 = cada 2 días, …
  inicio: string;      // 'YYYY-MM-DD' — inicio del tratamiento
  dias: number;        // 0 = uso continuo · >0 = duración del tratamiento
  obs: string;
  pausado: boolean;    // pausar sin borrar (efecto guardado, viaje…)
  tomas: Record<string, Record<string, 'tomado' | 'saltado'>>; // fecha → hora → estado
}

export type NuevoMedicamento = Omit<Medicamento, 'id'>;

export const UNIDADES_MED: string[] = ['mg', 'g', 'µg', 'mL', 'gotas', 'cápsulas', 'comprimidos', 'IU'];

/** Una toma puntual del día (para el plan de hoy) */
export interface DosisDia {
  med: Medicamento;
  hora: string;
  estado: 'tomado' | 'saltado' | null; // null = pendiente
}

export interface ProximaDosis {
  med: Medicamento;
  hora: string;
  fecha: string;
  esManana: boolean;
}

export interface Adherencia {
  tomadas: number;
  saltadas: number;
  omitidas: number;   // venció la hora sin registrar
  pendientes: number; // aún se puede tomar
  total: number;
  pct: number;        // 0-100 sobre las dosis ya decididas
}

export interface RegistroSintoma {
  id: number;
  fecha: string;
  hora: string;
  nombres: string[];  // ['🤢 Náuseas', '🌡️ Fiebre']
  sev: number;        // 1-10
  nota: string;
}

export interface PerfilSalud {
  nombre: string;
  edad: string;
  talla: string;      // cm — fallback del IMC si Medidas no tiene
  sangre: string;     // tipo de sangre
  alergias: string;
  emergencia: string; // contacto de emergencia
  seguro: string;
  aguaMeta: number;   // mL objetivo diario (2000 por defecto)
}

export interface EstadoSalud {
  agua: Record<string, number>;
  sueno: Record<string, RegistroSueno>;
  vitales: RegistroVital[];
  meds: Medicamento[];
  sintomas: RegistroSintoma[];
  perfil: PerfilSalud;
}

// ── Constantes ────────────────────────────────────────────────
const CLAVE_SALUD = 'FT2_SALUD';

export const SINTOMAS_CHIP: string[] = [
  '😣 Dolor', '💫 Mareos', '🤢 Náuseas', '🌡️ Fiebre', '😮‍💨 Tos',
  '🔴 Inflamación', '😴 Cansancio', '🤕 Cefalea',
];

export const CALIDADES_SUENO: RegistroSueno['calidad'][] = ['Excelente', 'Buena', 'Regular', 'Mala'];

const AGUA_META_DEFECTO = 2000;

const PERFIL_DEFECTO: PerfilSalud = {
  nombre: '', edad: '', talla: '', sangre: '', alergias: '',
  emergencia: '', seguro: '', aguaMeta: AGUA_META_DEFECTO,
};

const ESTADO_DEFECTO: EstadoSalud = {
  agua: {}, sueno: {}, vitales: [], meds: [], sintomas: [],
  perfil: { ...PERFIL_DEFECTO },
};

// ── Helpers de fecha (hoy() y hora() del viejo) ───────────────
export function hoySalud(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function horaSalud(): string {
  return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

// ── Lectura / escritura ───────────────────────────────────────
export function leerSalud(): EstadoSalud {
  const s = ls();
  if (!s) return clonar(ESTADO_DEFECTO);
  try {
    const crudo = JSON.parse(s.getItem(CLAVE_SALUD) ?? 'null');
    if (!crudo || typeof crudo !== 'object') return clonar(ESTADO_DEFECTO);
    // merge defensivo: lo que falte usa el defecto
    return {
      agua: crudo.agua ?? {},
      sueno: crudo.sueno ?? {},
      vitales: Array.isArray(crudo.vitales) ? crudo.vitales : [],
      meds: Array.isArray(crudo.meds) ? crudo.meds.map(migrarMed).filter((m): m is Medicamento => m !== null) : [],
      sintomas: Array.isArray(crudo.sintomas) ? crudo.sintomas : [],
      perfil: { ...PERFIL_DEFECTO, ...(crudo.perfil ?? {}) },
    };
  } catch {
    return clonar(ESTADO_DEFECTO);
  }
}

export function guardarSalud(est: EstadoSalud): void {
  const s = ls();
  if (!s) return;
  try { s.setItem(CLAVE_SALUD, JSON.stringify(est)); } catch { /* storage lleno */ }
}

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function siguienteId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id ?? 0), 0) + 1;
}

// ── AGUA ──────────────────────────────────────────────────────
export function addAgua(est: EstadoSalud, ml: number): EstadoSalud {
  const hoy = hoySalud();
  return { ...est, agua: { ...est.agua, [hoy]: (est.agua[hoy] ?? 0) + Math.max(0, Math.round(ml)) } };
}

export function resetAgua(est: EstadoSalud): EstadoSalud {
  const hoy = hoySalud();
  const agua = { ...est.agua };
  delete agua[hoy];
  return { ...est, agua };
}

export function aguaDeHoy(est: EstadoSalud): number {
  return est.agua[hoySalud()] ?? 0;
}

export function cambiarAguaMeta(est: EstadoSalud, meta: number): EstadoSalud {
  const m = Math.min(5000, Math.max(500, Math.round(meta) || AGUA_META_DEFECTO));
  return { ...est, perfil: { ...est.perfil, aguaMeta: m } };
}

// ── SUEÑO (cálculo del viejo: vuelta de medianoche incluida) ──
export function horasEntre(ini: string, fin: string): number | null {
  const p = (t: string): number | null => {
    if (!t || !t.includes(':')) return null;
    const [h, m] = t.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const h1 = p(ini);
  const h2 = p(fin);
  if (h1 === null || h2 === null) return null;
  const mins = h2 >= h1 ? h2 - h1 : 1440 - h1 + h2;
  const horas = Math.round((mins / 60) * 10) / 10;
  return Number.isFinite(horas) ? horas : null;
}

export function guardarSueno(
  est: EstadoSalud,
  ini: string,
  fin: string,
  calidad: RegistroSueno['calidad'],
): { est: EstadoSalud; horas: number } | null {
  const horas = horasEntre(ini, fin);
  if (horas === null || horas <= 0) return null;
  const fecha = hoySalud();
  const reg: RegistroSueno = { fecha, horas, calidad, ini, fin };
  return { est: { ...est, sueno: { ...est.sueno, [fecha]: reg } }, horas };
}

export function borrarSueno(est: EstadoSalud, fecha: string): EstadoSalud {
  const sueno = { ...est.sueno };
  delete sueno[fecha];
  return { ...est, sueno };
}

export function suenoDeHoy(est: EstadoSalud): RegistroSueno | null {
  return est.sueno[hoySalud()] ?? null;
}

// ── SIGNOS VITALES ────────────────────────────────────────────
export function guardarVital(
  est: EstadoSalud,
  sis: number,
  dia: number,
  fc: number | null,
  sat: number | null,
): EstadoSalud {
  const reg: RegistroVital = {
    id: siguienteId(est.vitales),
    fecha: `${hoySalud()} ${horaSalud()}`,
    sis: Math.round(sis),
    dia: Math.round(dia),
    fc,
    sat,
  };
  return { ...est, vitales: [...est.vitales, reg] };
}

export function borrarVital(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, vitales: est.vitales.filter((v) => v.id !== id) };
}

// ── MEDICAMENTOS ──────────────────────────────────────────────
// F10.1 · tratamientos profesionales — la app NO receta ni opina:
// registra EXACTAMENTE lo que indicó el médico y ayuda a
// cumplirlo (plan del día, próxima dosis y adherencia).
export function guardarMed(est: EstadoSalud, med: NuevoMedicamento): EstadoSalud {
  const nuevo: Medicamento = { ...med, id: siguienteId(est.meds) };
  return { ...est, meds: [...est.meds, nuevo] };
}

export function actualizarMed(est: EstadoSalud, med: Medicamento): EstadoSalud {
  return { ...est, meds: est.meds.map((m) => (m.id === med.id ? med : m)) };
}

export function borrarMed(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, meds: est.meds.filter((m) => m.id !== id) };
}

export function alternarPausaMed(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, meds: est.meds.map((m) => (m.id === id ? { ...m, pausado: !m.pausado } : m)) };
}

/** Marca una toma: 'tomado' | 'saltado' | null (null = deshacer) */
export function marcarToma(
  est: EstadoSalud,
  id: number,
  fecha: string,
  hora: string,
  estado: 'tomado' | 'saltado' | null,
): EstadoSalud {
  return {
    ...est,
    meds: est.meds.map((m) => {
      if (m.id !== id) return m;
      const dia = { ...(m.tomas[fecha] ?? {}) };
      if (estado === null) delete dia[hora];
      else dia[hora] = estado;
      return { ...m, tomas: { ...m.tomas, [fecha]: dia } };
    }),
  };
}

/** ¿El tratamiento está vigente ESE día? (pausa + cadencia + duración) */
export function medActivoEn(med: Medicamento, fecha: string): boolean {
  if (med.pausado) return false;
  if (!med.inicio || med.inicio > fecha) return false;
  if (med.dias > 0 && fecha > sumarDias(med.inicio, med.dias - 1)) return false;
  const cada = Math.max(1, Math.round(med.cadaDias) || 1);
  if (cada > 1 && diasEntre(med.inicio, fecha) % cada !== 0) return false;
  return true;
}

export type EstadoMed = 'activo' | 'pausado' | 'finalizado';

export function estadoMed(med: Medicamento): EstadoMed {
  if (med.pausado) return 'pausado';
  if (med.dias > 0 && hoySalud() > sumarDias(med.inicio, med.dias - 1)) return 'finalizado';
  return 'activo';
}

/** Todas las tomas de una fecha, ordenadas por hora */
export function dosisDelDia(est: EstadoSalud, fecha: string): DosisDia[] {
  const out: DosisDia[] = [];
  est.meds.forEach((med) => {
    if (!medActivoEn(med, fecha)) return;
    const dia = med.tomas[fecha] ?? {};
    med.horas.forEach((h) => out.push({ med, hora: h, estado: dia[h] ?? null }));
  });
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function dosisDeHoy(est: EstadoSalud): DosisDia[] {
  return dosisDelDia(est, hoySalud());
}

export function dosisPendientesDeHoy(est: EstadoSalud): DosisDia[] {
  return dosisDeHoy(est).filter((d) => d.estado === null);
}

/** La siguiente toma pendiente (hoy o mañana) — para el plan de hoy */
export function proximaDosis(est: EstadoSalud): ProximaDosis | null {
  const hoy = hoySalud();
  const ahora = ahoraMinutos();
  const pendHoy = dosisDeHoy(est).find((d) => d.estado === null && minutosDeHora(d.hora) > ahora);
  if (pendHoy) return { med: pendHoy.med, hora: pendHoy.hora, fecha: hoy, esManana: false };
  const manana = sumarDias(hoy, 1);
  const primeraManana = dosisDelDia(est, manana)[0];
  if (primeraManana) return { med: primeraManana.med, hora: primeraManana.hora, fecha: manana, esManana: true };
  return null;
}

/** Adherencia de los últimos N días (hoy incluido, solo dosis ya decididas) */
export function adherencia(est: EstadoSalud, dias = 7): Adherencia {
  const hoy = hoySalud();
  const ahora = ahoraMinutos();
  let tomadas = 0, saltadas = 0, omitidas = 0, pendientes = 0;
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = sumarDias(hoy, -i);
    const esHoy = fecha === hoy;
    dosisDelDia(est, fecha).forEach((d) => {
      if (d.estado === 'tomado') tomadas += 1;
      else if (d.estado === 'saltado') saltadas += 1;
      else if (!esHoy || minutosDeHora(d.hora) <= ahora) omitidas += 1;
      else pendientes += 1;
    });
  }
  const decididas = tomadas + saltadas + omitidas;
  return {
    tomadas, saltadas, omitidas, pendientes,
    total: decididas + pendientes,
    pct: decididas > 0 ? Math.round((tomadas / decididas) * 100) : 100,
  };
}

/** Día N del tratamiento (para 'día 3 de 7') */
export function diaNumTratamiento(med: Medicamento): number {
  return Math.max(1, diasEntre(med.inicio, hoySalud()) + 1);
}

export function fechaFinMed(med: Medicamento): string | null {
  return med.dias > 0 ? sumarDias(med.inicio, med.dias - 1) : null;
}

export function textoDuracion(med: Medicamento): string {
  if (!med.dias) return 'uso continuo';
  return `${med.dias} ${med.dias === 1 ? 'día' : 'días'}`;
}

export function formatoDosis(med: Medicamento): string {
  if (!med.cant || !med.unidad) return '';
  return `${med.cant} ${med.unidad}`;
}

/** 'Paracetamol 500 mg' (para el bot y las notificaciones) */
export function nombreConDosis(med: Medicamento): string {
  const d = formatoDosis(med);
  return d ? `${med.nom} ${d}` : med.nom;
}

/** Ahora en minutos desde medianoche (hora local del teléfono) */
export function ahoraMinutos(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function minutosDeHora(h: string): number {
  const [H, M] = h.split(':').map(Number);
  return (H || 0) * 60 + (M || 0);
}

function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const db = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((db - da) / 86_400_000);
}

function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// ── MIGRACIÓN de meds del modelo viejo (F10) ──────────────────
// '500mg' + '08:00' + 'diario' + tomado → cant/unidad/horas/
// cadaDias/inicio/dias + tomas de hoy. Corre una sola vez al
// leer; lo que se guarda ya viene en el modelo nuevo.
function migrarMed(m: Record<string, unknown>): Medicamento | null {
  if (!m || typeof m !== 'object') return null;

  // ¿ya viene en el modelo nuevo (F10.1)?
  const horasViejas = Array.isArray(m.horas);
  const horas: string[] = horasViejas
    ? (m.horas as unknown[]).map(normalizarHora).filter((h: string): boolean => esHoraValida(h))
    : typeof m.hor === 'string' && esHoraValida(normalizarHora(m.hor)) ? [normalizarHora(m.hor)] : [];
  const horasFinal = horas.length ? Array.from(new Set(horas)) : ['08:00'];

  let cant = typeof m.cant === 'number' && Number.isFinite(m.cant) ? m.cant : 0;
  let unidad = typeof m.unidad === 'string' ? m.unidad : '';
  const restos: string[] = [];
  if (!cant || !unidad) {
    const dos = typeof m.dos === 'string' ? m.dos.trim() : '';
    const mm = dos.match(/(\d+(?:[.,]\d+)?)\s*(µg|mcg|mg|g|ml|iu)\b/i);
    if (mm) {
      cant = parseFloat(mm[1].replace(',', '.')) || 0;
      unidad = normalizarUnidad(mm[2]);
    } else if (dos) {
      restos.push(`dosis: ${dos}`);
    }
  }

  const frq = typeof m.frq === 'string' ? m.frq.trim() : '';
  if (frq && !/^diari[oa]$/i.test(frq) && !/^todos los d[ií]as$/i.test(frq)) restos.push(frq);
  const obsViejo = typeof m.obs === 'string' ? m.obs.trim() : '';
  if (obsViejo) restos.push(obsViejo);

  const tomas: Medicamento['tomas'] = horasViejas && typeof m.tomas === 'object' && m.tomas
    ? (m.tomas as Medicamento['tomas'])
    : {};
  // check 'tomado' del modelo viejo → primera toma de hoy registrada
  if (!horasViejas && m.tomado === true) {
    tomas[hoySalud()] = { [horasFinal[0]]: 'tomado' };
  }

  return {
    id: typeof m.id === 'number' ? m.id : 0,
    nom: typeof m.nom === 'string' ? m.nom : '',
    cant,
    unidad,
    horas: horasFinal,
    cadaDias: Math.max(1, Math.round(Number(m.cadaDias)) || 1),
    inicio: typeof m.inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.inicio) ? m.inicio : hoySalud(),
    dias: Math.max(0, Math.round(Number(m.dias)) || 0),
    obs: restos.join(' · '),
    pausado: m.pausado === true,
    tomas,
  };
}

function esHoraValida(h: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(h) && minutosDeHora(h) < 1440;
}

function normalizarHora(h: string): string {
  const [H, M] = h.split(':');
  return `${String(parseInt(H, 10)).padStart(2, '0')}:${String(M ?? '00').padStart(2, '0')}`;
}

function normalizarUnidad(u: string): string {
  const l = u.toLowerCase();
  if (l === 'mcg' || l === 'µg') return 'µg';
  if (l === 'mg') return 'mg';
  if (l === 'g') return 'g';
  if (l === 'ml') return 'mL';
  if (l === 'iu') return 'IU';
  return u;
}

// ── SÍNTOMAS ──────────────────────────────────────────────────
export function guardarSintoma(
  est: EstadoSalud,
  nombres: string[],
  sev: number,
  nota: string,
): EstadoSalud {
  const reg: RegistroSintoma = {
    id: siguienteId(est.sintomas),
    fecha: hoySalud(),
    hora: horaSalud(),
    nombres: [...nombres],
    sev: Math.min(10, Math.max(1, Math.round(sev) || 1)),
    nota: nota.trim(),
  };
  return { ...est, sintomas: [...est.sintomas, reg] };
}

export function borrarSintoma(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, sintomas: est.sintomas.filter((s) => s.id !== id) };
}

// ── PERFIL SALUD ──────────────────────────────────────────────
export function guardarPerfilSalud(est: EstadoSalud, campos: Partial<PerfilSalud>): EstadoSalud {
  return { ...est, perfil: { ...est.perfil, ...campos } };
}

// ── HEALTH SCORE (fórmula exacta del viejo) ───────────────────
// base 40 + agua (máx 25) + sueño (25/15/5/0) + meds (máx 10)
export interface ScoreSalud {
  score: number;
  etiqueta: 'Excelente' | 'Bueno' | 'Regular' | 'Mejorable';
  color: string;   // clase tailwind de texto
  mensaje: string;
  detalles: { aguaPts: number; suenoPts: number; medsPts: number };
}

export function calcularScore(est: EstadoSalud): ScoreSalud {
  const meta = est.perfil.aguaMeta || AGUA_META_DEFECTO;
  const ml = aguaDeHoy(est);
  const aguaPts = Math.round(Math.min(ml / meta, 1) * 25);
  const s = suenoDeHoy(est);
  let suenoPts = 0;
  if (s) {
    if (s.horas >= 7.5) suenoPts = 25;
    else if (s.horas >= 6) suenoPts = 15;
    else suenoPts = 5;
  }
  let medsPts = 10;
  const dosisHoy = dosisDeHoy(est);
  if (dosisHoy.length > 0) {
    const tomadas = dosisHoy.filter((d) => d.estado === 'tomado').length;
    medsPts = Math.round((tomadas / dosisHoy.length) * 10);
  }
  const score = Math.min(100, Math.max(10, 40 + aguaPts + suenoPts + medsPts));

  let etiqueta: ScoreSalud['etiqueta'] = 'Mejorable';
  let color = 'text-red-400';
  let mensaje = 'Registra tus hábitos diarios para mejorar tu puntuación.';
  if (score >= 85) {
    etiqueta = 'Excelente'; color = 'text-emerald-400';
    mensaje = '¡Increíble! Tus hábitos de hoy están en perfectas condiciones.';
  } else if (score >= 70) {
    etiqueta = 'Bueno'; color = 'text-cyan-400';
    mensaje = 'Mantienes un nivel saludable. Sigue hidratándote bien.';
  } else if (score >= 50) {
    etiqueta = 'Regular'; color = 'text-amber-400';
    mensaje = 'Nivel intermedio. Mejora el descanso y toma más agua.';
  }
  return { score, etiqueta, color, mensaje, detalles: { aguaPts, suenoPts, medsPts } };
}

// ── TIP DEL BOT (consejo contextual del viejo) ────────────────
export function tipDelDia(est: EstadoSalud): string {
  const meta = est.perfil.aguaMeta || AGUA_META_DEFECTO;
  const ml = aguaDeHoy(est);
  const s = suenoDeHoy(est);
  const tips: string[] = [];
  if (ml < meta * 0.5) tips.push(`💧 Solo llevas ${ml}mL. Toma agua ahora mismo.`);
  else if (ml >= meta) tips.push(`🌟 Meta de hidratación cumplida: ${ml}mL. ¡Excelente!`);
  else tips.push(`💧 Llevas ${ml}mL. Te faltan ${meta - ml}mL para tu meta.`);
  if (!s) tips.push('😴 No tienes sueño registrado hoy. Apunta tu descanso.');
  else if (s.horas < 6) tips.push(`😴 Dormiste ${s.horas}h. Intenta dormir 7-8h esta noche.`);
  else tips.push(`😴 Buen descanso de ${s.horas}h. Tu cuerpo se recupera bien.`);
  const pend = dosisPendientesDeHoy(est).length;
  if (pend > 0) tips.push(`💊 Tienes ${pend} ${pend === 1 ? 'dosis pendiente' : 'dosis pendientes'} hoy.`);
  const last = est.sintomas[est.sintomas.length - 1];
  if (last) tips.push(`⚠️ Reportaste: ${last.nombres[0] ?? ''} (Sev: ${last.sev}/10). Monitóralo.`);
  tips.push('🏃 15 min de caminata tras comer reduce picos de glucosa hasta 30%.');
  tips.push('🍎 Prefiere carbohidratos complejos para energía sostenida.');
  tips.push('🏋️ Entrenar fuerza 3 veces por semana acelera tu metabolismo en reposo.');
  return tips[Math.floor(Math.random() * tips.length)];
}

// ── LOGROS (3 medallas del viejo; la 3ª usa las Medidas de F4) ─
export interface LogroSalud {
  t: string;
  d: string;
  emoji: string;
  clases: string;
  ok: boolean;
}

export function calcularLogros(est: EstadoSalud, totalMedidasFitTrack: number): LogroSalud[] {
  const diasAgua = Object.values(est.agua).filter((ml) => ml >= 1500).length;
  const noches = Object.values(est.sueno).filter((s) => s.horas >= 7).length;
  return [
    {
      t: 'Acuático Pro', d: '3 días hidratado', emoji: '💧',
      clases: 'from-blue-500 to-cyan-400', ok: diasAgua >= 3,
    },
    {
      t: 'Sueño de Oro', d: '3 noches ≥7h', emoji: '🌙',
      clases: 'from-indigo-500 to-purple-500', ok: noches >= 3,
    },
    {
      t: 'Control Total', d: '4+ medidas corporales', emoji: '⚖️',
      clases: 'from-teal-500 to-emerald-400', ok: totalMedidasFitTrack >= 4,
    },
  ];
}

// ── SERIES 7 DÍAS para las gráficas del Resumen ───────────────
export interface PuntoDia { dia: string; valor: number }

export function serieAgua(est: EstadoSalud, dias = 7): PuntoDia[] {
  return ultimosDias(dias).map((d) => ({ dia: d, valor: est.agua[d] ?? 0 }));
}

export function serieSueno(est: EstadoSalud, dias = 7): PuntoDia[] {
  return ultimosDias(dias).map((d) => ({ dia: d, valor: est.sueno[d]?.horas ?? 0 }));
}

function ultimosDias(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    out.push(`${d.getFullYear()}-${m}-${dia}`);
  }
  return out;
}

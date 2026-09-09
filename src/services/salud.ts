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
  dos: string;        // dosis '500mg'
  hor: string;        // hora '08:00'
  frq: string;        // frecuencia 'cada 8h'
  obs: string;
  tomado: boolean;
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
      meds: Array.isArray(crudo.meds) ? crudo.meds : [],
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
export function guardarMed(
  est: EstadoSalud,
  nom: string,
  dos: string,
  hor: string,
  frq: string,
  obs: string,
): EstadoSalud {
  const med: Medicamento = { id: siguienteId(est.meds), nom, dos, hor, frq, obs, tomado: false };
  return { ...est, meds: [...est.meds, med] };
}

export function toggleMed(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, meds: est.meds.map((m) => (m.id === id ? { ...m, tomado: !m.tomado } : m)) };
}

export function borrarMed(est: EstadoSalud, id: number): EstadoSalud {
  return { ...est, meds: est.meds.filter((m) => m.id !== id) };
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
  if (est.meds.length > 0) {
    medsPts = Math.round((est.meds.filter((m) => m.tomado).length / est.meds.length) * 10);
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
  const pend = est.meds.filter((m) => !m.tomado).length;
  if (pend > 0) tips.push(`💊 Tienes ${pend} medicamento(s) pendiente(s) hoy.`);
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

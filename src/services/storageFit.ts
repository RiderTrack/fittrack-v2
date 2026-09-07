// ═══════════════════════════════════════════════════════════
// 💾 STORAGE FIT — FitTrack V2 (F1 · Acceso)
// Puente hacia las claves localStorage del app VIEJO.
// Regla de oro de la migración: las claves FITTRACK_* son del
// app viejo — se LEEN con sus estructuras exactas y solo se
// escriben las que el viejo ya escribía (login + onboarding).
// El state completo (FITTRACK_ALPHA_V2_STATE) en F1 es SOLO
// LECTURA: lo escribirán F2/F3 al entrenar y medir.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, PerfilEntreno, SesionEntreno } from '../types';

/** Nombres exactos de las claves viejas que F1 toca */
export const CLAVES = {
  USER_ID: 'FITTRACK_USER_ID',
  USER_NAME: 'FITTRACK_USER_NAME',
  USER_EMAIL: 'FITTRACK_USER_EMAIL',
  USER_PHOTO: 'FITTRACK_USER_PHOTO',
  NOMBRE: 'FITTRACK_NOMBRE',
  ONBOARDING: 'FITTRACK_ONBOARDING_OK',
  PERFIL: 'FITTRACK_PERFIL_COMPLETO',
  STATE: 'FITTRACK_ALPHA_V2_STATE',
} as const;

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function leerTexto(clave: string): string {
  try { return storage()?.getItem(clave) ?? ''; } catch { return ''; }
}

function leerJSON<T>(clave: string): T | null {
  try {
    const crudo = storage()?.getItem(clave);
    if (!crudo) return null;
    return JSON.parse(crudo) as T;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
// 🧑 CUENTA (mismas 4 claves que el viejo escribía al loguear)
// ═══════════════════════════════════════════════════════════

export interface UsuarioLocal {
  uid: string;
  nombre: string;
  email: string;
  foto: string;
}

/** Guarda la cuenta en localStorage (idéntico al onAuthStateChanged del viejo) */
export function guardarUsuarioLocal(u: UsuarioLocal) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CLAVES.USER_ID, u.uid);
    s.setItem(CLAVES.USER_NAME, u.nombre);
    s.setItem(CLAVES.USER_EMAIL, u.email);
    s.setItem(CLAVES.USER_PHOTO, u.foto);
  } catch { /* sin espacio */ }
}

/** Borra solo la caché de cuenta (lo que el viejo hacía al cerrar sesión) */
export function limpiarUsuarioLocal() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(CLAVES.USER_ID);
    s.removeItem(CLAVES.USER_NAME);
    s.removeItem(CLAVES.USER_EMAIL);
    s.removeItem(CLAVES.USER_PHOTO);
  } catch { /* sin storage */ }
}

/** Cuenta cacheada (para pintar el perfil sin esperar a Firebase) */
export function leerUsuarioLocal(): UsuarioLocal | null {
  const uid = leerTexto(CLAVES.USER_ID);
  if (!uid) return null;
  return {
    uid,
    nombre: leerTexto(CLAVES.USER_NAME) || 'Campeón',
    email: leerTexto(CLAVES.USER_EMAIL),
    foto: leerTexto(CLAVES.USER_PHOTO),
  };
}

// ═══════════════════════════════════════════════════════════
// 🚪 ONBOARDING (claves del onboarding morado del viejo)
// ═══════════════════════════════════════════════════════════

/** ¿El usuario ya pasó el onboarding (en el viejo o en la v2)? */
export function tieneOnboarding(): boolean {
  return leerTexto(CLAVES.ONBOARDING) === '1';
}

/**
 * Completa el onboarding escribiendo EXACTAMENTE lo que el viejo:
 * FITTRACK_NOMBRE (nombre elegido) + FITTRACK_ONBOARDING_OK = '1'.
 */
export function completarOnboarding(nombre: string) {
  const s = storage();
  if (!s) return;
  try {
    if (nombre.trim()) s.setItem(CLAVES.NOMBRE, nombre.trim());
    s.setItem(CLAVES.ONBOARDING, '1');
  } catch { /* sin espacio */ }
}

/** Nombre preferido: el del onboarding primero, el de Google de respaldo */
export function leerNombrePreferido(): string {
  return leerTexto(CLAVES.NOMBRE) || leerTexto(CLAVES.USER_NAME);
}

// ═══════════════════════════════════════════════════════════
// 🏋️ DATOS (lectura compatible con el state del viejo)
// ═══════════════════════════════════════════════════════════

/** State completo del viejo (parse defensivo: si está corrupto, vacío) */
export function leerEstado(): EstadoFitTrack {
  return leerJSON<EstadoFitTrack>(CLAVES.STATE) ?? {};
}

/** Perfil del wizard (clave independiente del viejo, anti-merge) */
export function leerPerfil(): PerfilEntreno | null {
  return leerJSON<PerfilEntreno>(CLAVES.PERFIL);
}

/**
 * Guarda el perfil con la MISMA estructura del viejo
 * ({objetivo,nivel,dias,equipo,fecha} en FITTRACK_PERFIL_COMPLETO,
 * clave independiente que el app viejo lee con prioridad).
 */
export function guardarPerfil(p: PerfilEntreno) {
  const s = storage();
  if (!s) return;
  try { s.setItem(CLAVES.PERFIL, JSON.stringify(p)); } catch { /* sin espacio */ }
}

// ═══════════════════════════════════════════════════════════
// 🏋️ F2 · ENTRENO — ESCRITURA DEL STATE
// El README lo prometía: "el state completo lo escriben F2/F3
// al entrenar y medir". Este es el punto ÚNICO de escritura:
// lee el state fresco, aplica la mutación y lo devuelve entero
// a FITTRACK_ALPHA_V2_STATE (idéntico al saveState del viejo),
// preservando los campos que F2 no toca (fitbot, theme, etc.).
// ═══════════════════════════════════════════════════════════

/**
 * Actualiza FITTRACK_ALPHA_V2_STATE de forma quirúrgica:
 * aplicarEstado(est => { est.streak = 5 }) — la mutación ve el
 * objeto real (merge natural con los campos del viejo).
 * Devuelve el estado ya guardado.
 */
export function aplicarEstado(mutador: (estado: EstadoFitTrack) => void): EstadoFitTrack {
  const estado = leerEstado();
  mutador(estado);
  const s = storage();
  if (s) {
    try { s.setItem(CLAVES.STATE, JSON.stringify(estado)); } catch { /* sin espacio */ }
  }
  return estado;
}

// ═══════════════════════════════════════════════════════════
// 🧮 HELPERS (fórmulas EXACTAS del dashboard del viejo)
// ═══════════════════════════════════════════════════════════

function fechaISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

export function hoyISO(): string {
  return fechaISO(new Date());
}

/** Sesiones de los últimos N días (mismo filtro del viejo: date >= hoy-N) */
export function sesionesUltimosDias(estado: EstadoFitTrack, dias: number): SesionEntreno[] {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const limiteISO = fechaISO(limite);
  return (estado.workoutHistory ?? []).filter((s) => s.date >= limiteISO);
}

/** Suma de volumen (kg) de una lista de sesiones */
export function volumenTotal(sesiones: SesionEntreno[]): number {
  return sesiones.reduce((total, s) => total + (typeof s.volume === 'number' ? s.volume : 0), 0);
}

/** 12345 → "12.3k" · 850 → "850" (mismo formato del viejo) */
export function formatearVolumen(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

/** Días desde una fecha 'YYYY-MM-DD' (null si no hay fecha) */
export function diasDesde(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return null;
  const pasada = new Date(y, m - 1, d);
  const hoy = new Date();
  return Math.floor((hoy.getTime() - pasada.getTime()) / 86_400_000);
}

/**
 * Progreso del peso — fórmula del viejo (meta personal real de la
 * cuenta): inicio 93 kg → meta 87 kg. peso<=87 → 100 %, >=93 → 0 %.
 */
export function progresoPeso(pesoActual: number): number {
  if (pesoActual <= 87) return 100;
  if (pesoActual >= 93) return 0;
  return Math.round(((93 - pesoActual) / 6) * 100);
}

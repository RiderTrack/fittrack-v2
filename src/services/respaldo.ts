// ═══════════════════════════════════════════════════════════
// 💾 RESPALDO — FitTrack V2 (F6 · Ajustes)
// El app viejo solo tenía la nube silenciosa de Firebase; F6
// añade el respaldo que nunca tuvo: UN archivo JSON con todas
// las claves del teléfono (estado completo, perfil, clave IA,
// Spotify, GymChat, radios, podcasts) para pasarlo a otro
// celular o sobrevivir a una limpieza. La restauración vuelve
// a escribir cada clave EXACTA con su valor EXACTO — cero
// migración. Incluye el reset total del viejo (13 claves +
// las nuevas FT2_, ahora por prefijo).
// ═══════════════════════════════════════════════════════════

import { hoyISO } from './storageFit';

/** Prefijos de TODAS las claves de FitTrack (viejas + v2). Nada fuera de esto se toca. */
export const PREFIJOS_RESPALDO = ['FITTRACK_', 'SPOTIFY_', 'GYMCHAT_', 'FT2_'] as const;

/** Estructura del archivo de respaldo */
export interface RespaldoFitTrack {
  app: 'fittrack-v2';
  fase: string;
  version: number;
  fecha: string; // ISO
  claves: Record<string, string>;
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function esNuestra(clave: string): boolean {
  return PREFIJOS_RESPALDO.some((p) => clave.startsWith(p));
}

/** Recolecta todas las claves de FitTrack con sus valores actuales */
export function recolectarClaves(): Record<string, string> {
  const s = storage();
  const claves: Record<string, string> = {};
  if (!s) return claves;
  try {
    for (let i = 0; i < s.length; i++) {
      const clave = s.key(i);
      if (clave && esNuestra(clave)) {
        const valor = s.getItem(clave);
        if (valor !== null) claves[clave] = valor;
      }
    }
  } catch { /* sin storage */ }
  return claves;
}

/** Peso del state completo en bytes (guarda de espacio para las fotos) */
export function pesoState(): number {
  try {
    const s = storage();
    if (!s) return 0;
    return (s.getItem('FITTRACK_ALPHA_V2_STATE') ?? '').length;
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTAR (un JSON compartible/descargable)
// ═══════════════════════════════════════════════════════════

export interface ResultadoExportar {
  ok: boolean;
  motivo?: 'sin-datos' | 'cancelado';
  compartido?: boolean; // true = Web Share, false = descarga directa
  archivo?: string;
  nClaves?: number;
}

/** Nombre del archivo: FitTrack-respaldo-YYYY-MM-DD.json */
export function nombreRespaldo(): string {
  return `FitTrack-respaldo-${hoyISO()}.json`;
}

/**
 * Exporta TODAS las claves a un JSON. Si el teléfono puede
 * compartir archivos (WhatsApp, Drive, correo…) abre el share;
 * si no, dispara la descarga (mismo mecanismo del CSV de F4).
 */
export async function exportarRespaldo(): Promise<ResultadoExportar> {
  const claves = recolectarClaves();
  const nClaves = Object.keys(claves).length;
  if (nClaves === 0) return { ok: false, motivo: 'sin-datos' };

  const doc: RespaldoFitTrack = {
    app: 'fittrack-v2',
    fase: 'F6',
    version: 2,
    fecha: new Date().toISOString(),
    claves,
  };

  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const archivo = nombreRespaldo();

  // 1) Intentar el share nativo (igual que el Excel del viejo)
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const file = new File([blob], archivo, { type: 'application/json' });
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Respaldo de FitTrack' });
      return { ok: true, compartido: true, archivo, nClaves };
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, motivo: 'cancelado', nClaves };
    // otros errores del share → caer a la descarga
  }

  // 2) Descarga directa (patrón exportarHistorialCSV de progreso.ts)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, compartido: false, archivo, nClaves };
  } catch {
    return { ok: false, nClaves };
  }
}

// ═══════════════════════════════════════════════════════════
// 📥 IMPORTAR (validar → confirmar → escribir → reiniciar)
// ═══════════════════════════════════════════════════════════

/** Resultado de validar un respaldo (patrón de claude.ts: ok + datos opcionales) */
export interface ResultadoValidar {
  ok: boolean;
  doc?: RespaldoFitTrack;
  nClaves?: number;
  error?: string;
}

/**
 * Valida el texto de un respaldo: formato, claves dentro del
 * namespace de FitTrack y valores string (nada raro se cuela).
 */
export function parsearRespaldo(texto: string): ResultadoValidar {
  let doc: any;
  try {
    doc = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'El archivo no es un respaldo válido (JSON corrupto).' };
  }
  if (!doc || typeof doc !== 'object' || !doc.claves || typeof doc.claves !== 'object') {
    return { ok: false, error: 'El archivo no tiene la estructura de un respaldo de FitTrack.' };
  }
  const entradas = Object.entries(doc.claves as Record<string, unknown>);
  if (entradas.length === 0) {
    return { ok: false, error: 'El respaldo no contiene claves.' };
  }
  for (const [clave, valor] of entradas) {
    if (!esNuestra(clave) || typeof valor !== 'string') {
      return { ok: false, error: `Clave inesperada en el respaldo: "${clave}".` };
    }
  }
  return {
    ok: true,
    doc: {
      app: 'fittrack-v2',
      fase: String(doc.fase ?? '?'),
      version: Number(doc.version ?? 2),
      fecha: String(doc.fecha ?? ''),
      claves: doc.claves as Record<string, string>,
    },
    nClaves: entradas.length,
  };
}

/** Escribe cada clave del respaldo con su valor EXACTO. Devuelve cuántas escribió. */
export function aplicarRespaldo(doc: RespaldoFitTrack): number {
  const s = storage();
  if (!s) return 0;
  let n = 0;
  try {
    for (const [clave, valor] of Object.entries(doc.claves)) {
      try { s.setItem(clave, valor); n++; } catch { /* clave sin espacio */ }
    }
  } catch { /* sin storage */ }
  return n;
}

// ═══════════════════════════════════════════════════════════
// 🧹 RESET TOTAL (resetLocalCompleto del viejo, ahora por prefijo)
// El viejo borraba 13 claves; la v2 añadió FT2_* (radios,
// podcasts, tema…). Se borra TODO lo de FitTrack — la cuenta
// Google y Firebase no se tocan (mismo aviso del viejo).
// ═══════════════════════════════════════════════════════════

/** Borra todas las claves de FitTrack del teléfono. Devuelve cuántas borró. */
export function resetearDatosLocales(): number {
  const s = storage();
  if (!s) return 0;
  let n = 0;
  const aBorrar: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const clave = s.key(i);
      if (clave && esNuestra(clave)) aBorrar.push(clave);
    }
    for (const clave of aBorrar) {
      try { s.removeItem(clave); n++; } catch { /* ya borrada */ }
    }
  } catch { /* sin storage */ }
  return n;
}

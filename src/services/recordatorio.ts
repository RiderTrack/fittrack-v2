// ═══════════════════════════════════════════════════════════
// 🔔 RECORDATORIO — FitTrack V2 (F6 · Ajustes)
// Puerto exacto del recordatorio diario del app viejo (L4781-
// L4856): misma notificación (id 777001, canal fittrack-
// recordatorio, repetición diaria nativa con schedule.on),
// mismos textos y mismo guardado en state.recordatorio (¡la
// clave del viejo sobrevive sin migración y entra al respaldo!).
// En web NO funciona (el viejo avisaba: "Necesitas la nueva
// APK"); en APK pide permiso y programa la notificación.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack } from '../types';
import { esAPK } from './platform';
import { aplicarEstado, leerEstado } from './storageFit';

/** ID de la notificación (EXACTO del viejo, L4782) */
export const RECORDATORIO_NOTIF_ID = 777001;

/** Canal nativo (EXACTO del viejo, L4809) */
const RECORDATORIO_CANAL = 'fittrack-recordatorio';

/** Texto de la notificación (EXACTO del viejo, L4816-4817) */
export const RECORDATORIO_TITULO = '¡Hora de entrenar!';
export const RECORDATORIO_CUERPO = 'Tu sesión de hoy te espera. ¡A romperla!';

export interface RecordatorioEntreno {
  activo: boolean;
  hora: string; // 'HH:MM' — default del input del viejo: '18:00'
}

/** Hora por defecto del input del viejo */
export const HORA_DEFAULT = '18:00';

/** Lee state.recordatorio con default inactivo (mismo default implícito del viejo) */
export function leerRecordatorio(estado: EstadoFitTrack): RecordatorioEntreno {
  const r = estado.recordatorio as RecordatorioEntreno | undefined;
  if (r && typeof r.activo === 'boolean' && typeof r.hora === 'string' && r.hora) {
    return { activo: r.activo, hora: r.hora };
  }
  return { activo: false, hora: HORA_DEFAULT };
}

/** '18:00' → { hour: 18, minute: 0 } (parse del viejo, L4812) */
export function parsearHora(hora: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Import perezoso del plugin (no existe en web dev sin instalar la APK) */
async function plugin(): Promise<any | null> {
  if (!esAPK()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return (mod as any).LocalNotifications ?? null;
  } catch { return null; }
}

/** Resultado de activar/desactivar (patrón de claude.ts: ok + error opcional) */
export interface ResultadoRecordatorio {
  ok: boolean;
  /** 'web' (no es APK), 'permiso' (denegado), 'hora' (formato inválido) u otro mensaje de error */
  error?: 'web' | 'permiso' | 'hora' | string;
}

/**
 * Activa el recordatorio diario (toggleRecordatorio del viejo):
 * pide permiso, crea el canal y programa la repetición diaria.
 * Guarda {activo, hora} en el state (idéntico al viejo).
 */
export async function activarRecordatorio(hora: string): Promise<ResultadoRecordatorio> {
  const hm = parsearHora(hora);
  if (!hm) return { ok: false, error: 'hora' };

  const ln = await plugin();
  if (!ln) return { ok: false, error: 'web' };

  try {
    // Permiso (Android 13+ muestra el diálogo del sistema)
    const perm = await ln.requestPermissions();
    if (!perm || (perm.display && perm.display !== 'granted')) {
      return { ok: false, error: 'permiso' };
    }

    // Canal + programación diaria (idéntico al viejo)
    try { await ln.createChannel({
      id: RECORDATORIO_CANAL,
      name: 'Recordatorio de entrenamiento',
      importance: 4,
      visibility: 1,
      vibration: true,
    }); } catch { /* el canal ya existe en algunos Androids */ }

    await ln.schedule({
      notifications: [{
        id: RECORDATORIO_NOTIF_ID,
        title: RECORDATORIO_TITULO,
        body: RECORDATORIO_CUERPO,
        channelId: RECORDATORIO_CANAL,
        schedule: { on: { hour: hm.hour, minute: hm.minute }, allowWhileIdle: true },
      }],
    });
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }

  aplicarEstado((est) => { est.recordatorio = { activo: true, hora }; });
  return { ok: true };
}

/** Desactiva y cancela la notificación (_cancelarNotifRecordatorio del viejo) */
export async function desactivarRecordatorio(): Promise<ResultadoRecordatorio> {
  const ln = await plugin();
  if (ln) {
    try { await ln.cancel({ notifications: [{ id: RECORDATORIO_NOTIF_ID }] }); } catch { /* ya no estaba */ }
  }
  aplicarEstado((est) => { est.recordatorio = { activo: false, hora: leerRecordatorio(est).hora }; });
  return { ok: true };
}

/**
 * Al arrancar la app: si el recordatorio estaba activo, lo
 * reprograma en silencio (initRecordatorioUI del viejo — así
 * sobrevive a reinicios del teléfono y a reinstalaciones de la
 * APK con el state restaurado del respaldo).
 */
export async function asegurarRecordatorioAlArrancar(): Promise<void> {
  const rec = leerRecordatorio(leerEstado());
  if (!rec.activo) return;
  const ln = await plugin();
  if (!ln) return;
  try {
    try { await ln.createChannel({
      id: RECORDATORIO_CANAL,
      name: 'Recordatorio de entrenamiento',
      importance: 4,
      visibility: 1,
      vibration: true,
    }); } catch { /* canal ya existe */ }
    const hm = parsearHora(rec.hora) ?? parsearHora(HORA_DEFAULT)!;
    await ln.schedule({
      notifications: [{
        id: RECORDATORIO_NOTIF_ID,
        title: RECORDATORIO_TITULO,
        body: RECORDATORIO_CUERPO,
        channelId: RECORDATORIO_CANAL,
        schedule: { on: { hour: hm.hour, minute: hm.minute }, allowWhileIdle: true },
      }],
    });
  } catch { /* sin permiso tras reinstalar: se re-pedirá al tocar Activar */ }
}

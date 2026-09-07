// ═══════════════════════════════════════════════════════════
// 📸 FOTOS DE PROGRESO — FitTrack V2 (F6 · Ajustes)
// Puerto del feature del viejo (subirFotoProgreso L4859 +
// renderFotosProgreso L4914) con UN cambio: la foto comprimida
// (mismos parámetros del viejo: máx 900px, JPEG 0.8) se
// guarda COMO dataURL dentro de state.fotosProgreso — el mismo
// campo del viejo, misma estructura {date,url}. Así las fotos
// viejas subidas a Firebase Storage siguen apareciendo (sus
// http URLs renderizan igual) y las nuevas NO dependen de
// reglas remotas de Storage: cero configuración extra.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, FotoProgreso } from '../types';
import { aplicarEstado, hoyISO, leerEstado } from './storageFit';

/** Máx 900px por lado y JPEG 0.8 — EXACTOS del viejo (L4878-4883) */
export const MAX_LADO = 900;
export const CALIDAD_JPEG = 0.8;

/**
 * Guarda de espacio: el localStorage del WebView tiene ~5 MB.
 * Si el state ya pasa de ~4.5 MB la foto nueva se rechaza con
 * un mensaje claro (exportar respaldo y borrar fotos viejas).
 */
export const LIMITE_STATE = 4_500_000;

/** Resultado de agregar una foto (patrón de claude.ts: ok + motivo opcional) */
export interface ResultadoFoto {
  ok: boolean;
  /** 'lleno' = el localStorage pasó el límite de seguridad */
  motivo?: 'lleno';
}

/**
 * Lee un File de la cámara/galería y lo comprime EXACTO como
 * el viejo: FileReader → Image → canvas (máx 900px en el lado
 * mayor) → JPEG 0.8 → dataURL.
 */
export function comprimirFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error procesando la imagen'));
      img.onload = () => {
        try {
          const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
          const ancho = Math.max(1, Math.round(img.width * escala));
          const alto = Math.max(1, Math.round(img.height * escala));
          const canvas = document.createElement('canvas');
          canvas.width = ancho;
          canvas.height = alto;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Error procesando la imagen');
          ctx.drawImage(img, 0, 0, ancho, alto);
          resolve(canvas.toDataURL('image/jpeg', CALIDAD_JPEG));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Error procesando la imagen'));
        }
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(file);
  });
}

/** Fotos de progreso del state, ordenadas por fecha ASC (igual que renderFotosProgreso) */
export function fotosOrdenadas(estado: EstadoFitTrack): FotoProgreso[] {
  return [...(estado.fotosProgreso ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Agrega la foto de HOY al state ({date, url} — misma forma que
 * push del viejo). Con guard de espacio: rechaza si el state
 * con la foto nueva pasaría el límite.
 */
export function agregarFoto(dataUrl: string): ResultadoFoto {
  const estado = leerEstado();
  const pesoFuturo = JSON.stringify(estado).length + dataUrl.length;
  if (pesoFuturo > LIMITE_STATE) return { ok: false, motivo: 'lleno' };
  aplicarEstado((est) => {
    if (!Array.isArray(est.fotosProgreso)) est.fotosProgreso = [];
    est.fotosProgreso.push({ date: hoyISO(), url: dataUrl });
  });
  return { ok: true };
}

/** Borra la foto en la posición INDICE del array ORDENADO (el que ve el usuario) */
export function borrarFoto(indiceOrdenado: number): void {
  aplicarEstado((est) => {
    const ordenadas = [...(est.fotosProgreso ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (indiceOrdenado < 0 || indiceOrdenado >= ordenadas.length) return;
    const borrada = ordenadas[indiceOrdenado];
    const idxReal = (est.fotosProgreso ?? []).indexOf(borrada);
    if (idxReal >= 0) est.fotosProgreso?.splice(idxReal, 1);
  });
}

/** Par antes/ahora del comparador: la primera y la última foto (≥2, como el viejo) */
export function parComparador(estado: EstadoFitTrack): { antes: FotoProgreso; ahora: FotoProgreso } | null {
  const fotos = fotosOrdenadas(estado);
  if (fotos.length < 2) return null;
  return { antes: fotos[0], ahora: fotos[fotos.length - 1] };
}

// ═══════════════════════════════════════════════════════════
// ✨ FOTOS IA — FitTrack V2 (F10.3 · fotos de recetas con IA)
// Genera la foto PROFESIONAL del plato para las recetas: la
// clave Anthropic del usuario (texto) no genera imágenes, así
// que esto usa un generador de imágenes público y GRATUITO que
// NO requiere API key ni registro (Pollinations) — nada de
// claves en el código ni en el teléfono, el candado de secretos
// sigue intacto.
// La imagen baja por HTTPS, pasa por el MISMO compresor de
// fotos del F6 (canvas JPEG 900px, calidad 0.8) y entra a la
// galería de la receta como cualquier foto propia — respeta
// MAX_IMAGENES_RECETA y LIMITE_RECETAS desde la UI.
// ═══════════════════════════════════════════════════════════

import { MAX_LADO, CALIDAD_JPEG } from './fotosProgreso';

/** Endpoint público de generación (sin API key — por diseño) */
const URL_BASE = 'https://image.pollinations.ai/prompt/';

/** La generación puede tardar entre 5s y ~60s según la cola del
 *  servicio gratuito — corte de emergencia a los 75s con mensaje claro. */
const TIMEOUT_MS = 75_000;

/** Datos mínimos de la receta para construir la foto del plato */
export interface RecetaParaFoto {
  nombre: string;
  categoria: string;
  ingredientes?: string[];
}

/** Estilo de foto por categoría — el "look" profesional del plato */
const ESTILO_POR_CATEGORIA: Record<string, string> = {
  desayuno: 'served in a ceramic bowl, fresh morning light on a wooden table',
  almuerzo: 'served on a rustic ceramic plate over a wooden table, midday natural light',
  cena: 'served on a dark ceramic plate, warm dim restaurant-style lighting',
  snack: 'served on a small clean plate, bright minimal background',
  postre: 'elegant dessert plating on a white plate, soft studio lighting',
};

/** Quita cantidades y medidas del ingrediente para quedarse solo
 *  con el ALIMENTO ("200g de pechilla de pollo" → "pechilla de pollo") */
export function alimentoLimpio(ing: string): string {
  return String(ing ?? '')
    .replace(/[\d.,/]+/g, ' ')                       // números: 200, 1/2, 1.5
    .replace(/\b(g|kg|mg|ml|l|taza[s]?|cucharada[s]?|cucharadita[s]?|unidad(es)?|gramo[s]?|litro[s]?|trozo[s]?|diente[s]?|hoja[s]?|rama[s]?|pizca[s]?|sobre[s]?|taza[s]?)\b/gi, ' ')
    .replace(/\b(de|del|la|el|con|y|en|para|al)\b/gi, ' ') // conectores sueltos
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prompt de FOTOGRAFÍA PROFESIONAL de comida para el plato
 *  (exportado para el smoke test — inglés porque el generador
 *  responde mejor con descriptores técnicos de fotografía). */
export function construirPromptFoto(r: RecetaParaFoto): string {
  const nombre = String(r.nombre ?? '').trim() || 'plato principal saludable';
  const alimentos = (r.ingredientes ?? [])
    .map(alimentoLimpio)
    .filter((x) => x.length > 2 && x.length < 40)
    .slice(0, 4);
  const estilo = ESTILO_POR_CATEGORIA[r.categoria] ?? ESTILO_POR_CATEGORIA.almuerzo;
  return [
    `Professional food photography of ${nombre}`,
    alimentos.length ? `made with ${alimentos.join(', ')}` : '',
    estilo,
    'garnished with fresh herbs, 45 degree angle shot, soft natural window lighting,',
    'shallow depth of field, appetizing, ultra realistic, high detail, food magazine cover quality',
  ].filter(Boolean).join(', ');
}

/** URL completa del generador (exportado para el smoke test) */
export function urlFotoIA(prompt: string, semilla?: number): string {
  const seed = semilla ?? Math.floor(Math.random() * 1_000_000_000);
  return `${URL_BASE}${encodeURIComponent(prompt)}?width=960&height=720&nologo=true&model=flux&seed=${seed}`;
}

/** Genera la foto del plato y la devuelve como dataURL JPEG
 *  comprimido (≤900px, mismo formato que las fotos propias).
 *  Estrategia doble: fetch directo (blob → compresor del F6) y,
 *  si la red/CORS lo bloquea, <img crossorigin> + canvas. */
export async function generarFotoRecetaIA(r: RecetaParaFoto, semilla?: number): Promise<string> {
  const url = urlFotoIA(construirPromptFoto(r), semilla);
  try {
    return await descargarYComprimir(url);
  } catch (e) {
    // Fallback: cargar como <img> y dibujarla al canvas (sirve
    // cuando el fetch falla pero el browser sí puede mostrar la
    // imagen — mismo destino de compresión).
    try {
      return await dibujarDesdeImg(url);
    } catch {
      throw new Error(
        e instanceof Error && /abort/i.test(e.message)
          ? 'La IA tardó demasiado (cola del servicio gratuito) — toca de nuevo para reintentar'
          : 'No se pudo generar la foto (revisa tu conexión e inténtalo de nuevo)',
      );
    }
  }
}

// ── Estrategia 1: fetch → blob → File → compresor del F6 ────
async function descargarYComprimir(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob.size < 1024) throw new Error('respuesta vacía');
    const file = new File([blob], 'foto-ia.jpg', { type: blob.type || 'image/jpeg' });
    const { comprimirFoto } = await import('./fotosProgreso');
    return await comprimirFoto(file);
  } finally {
    clearTimeout(timer);
  }
}

// ── Estrategia 2: <img crossorigin> → canvas (fallback) ──────
function dibujarDesdeImg(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout img')); }, TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const ancho = Math.max(1, Math.round(img.width * escala));
        const alto = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('sin canvas');
        ctx.drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/jpeg', CALIDAD_JPEG));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('error canvas'));
      }
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error('img onerror')); };
    img.src = url;
  });
}

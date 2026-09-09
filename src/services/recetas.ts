// ═══════════════════════════════════════════════════════════
// 🍽️ RECETAS — FitTrack V2 (F10.2 · Recetas editables + galería)
// El recetario del HealthTrack viejo (localStorage ht_recetas)
// ahora en su propio módulo bajo la clave FT2_RECETAS (entra
// al respaldo JSON y al reset por el prefijo FT2_).
// F10.2 — dos pedidos del usuario:
//   • EDITAR: actualizarReceta() abre la receta guardada en el
//     formulario y guarda los cambios SIN duplicar (mantiene id
//     y fecha originales).
//   • IMÁGENES: ahora es una GALERÍA (imagenes: string[]) — se
//     pueden agregar/quitar fotos al crear, al editar y sobre
//     el resultado de la IA antes de guardarlo. Máx 4 por
//     receta y guarda de peso total para no reventar el
//     localStorage del WebView (~5 MB).
// MIGRACIÓN AUTOMÁTICA: las recetas F10/F10.1 tenían UNA imagen
// suelta (campo imagen) — al leer se convierte sola a galería
// (imagenes = [imagen]) y el campo viejo se elimina al guardar.
// Las imágenes usan el mismo compresor de fotos de progreso
// (canvas JPEG) para no reventar el storage con base64 gigantes.
// ═══════════════════════════════════════════════════════════

import { comprimirFoto } from './fotosProgreso';

export interface Receta {
  id: number;
  nombre: string;
  categoria: string;     // desayuno | almuerzo | cena | snack | postre
  tiempo: number;        // minutos
  porciones: number;
  calorias: number;      // kcal por porción
  prot: number;          // g proteína por porción (F10.1)
  carbs: number;         // g carbohidratos por porción (F10.1)
  grasa: number;         // g grasa por porción (F10.1)
  dificultad: number;    // 1 Fácil · 2 Media · 3 Avanzada (F10.1)
  imagenes: string[];    // dataURLs JPEG comprimidos — galería (F10.2, la 1ª es la principal)
  ingredientes: string[];
  pasos: string[];
  notas: string;
  fecha: string;         // ISO
}

/** Shape que podían tener las recetas guardadas antes de F10.2 */
type RecetaGuardada = Partial<Receta> & { imagen?: string };

const CLAVE_RECETAS = 'FT2_RECETAS';

/** Máximo de fotos por receta (guarda de espacio del WebView) */
export const MAX_IMAGENES_RECETA = 4;

/** Guarda de peso: el recetario COMPLETO no puede pasar de 3 MB
 *  (el localStorage tiene ~5 MB y comparte espacio con todo). */
export const LIMITE_RECETAS = 3_000_000;

/** Bytes (aprox, chars del JSON) que ocupa una lista de recetas */
export function pesoRecetas(arr: Receta[]): number {
  try { return JSON.stringify(arr).length; } catch { return 0; }
}

export const CATEGORIAS_RECETA: { id: string; nombre: string; emoji: string }[] = [
  { id: 'todas', nombre: 'Todas', emoji: '🍽️' },
  { id: 'desayuno', nombre: 'Desayuno', emoji: '🌅' },
  { id: 'almuerzo', nombre: 'Almuerzo', emoji: '☀️' },
  { id: 'cena', nombre: 'Cena', emoji: '🌙' },
  { id: 'snack', nombre: 'Snack', emoji: '🍎' },
  { id: 'postre', nombre: 'Postre', emoji: '🍰' },
];

/** Color de identidad por categoría (chips y tarjetas pro) */
const CLASES_CAT: Record<string, string> = {
  desayuno: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
  almuerzo: 'bg-sky-500/10 border-sky-500/40 text-sky-300',
  cena: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300',
  snack: 'bg-lime-500/10 border-lime-500/40 text-lime-300',
  postre: 'bg-pink-500/10 border-pink-500/40 text-pink-300',
};

export function claseCategoria(cat: string): string {
  return CLASES_CAT[cat] ?? 'bg-slate-500/10 border-slate-500/40 text-slate-300';
}

export function emojiCategoria(cat: string): string {
  return CATEGORIAS_RECETA.find((c) => c.id === cat)?.emoji ?? '🍽️';
}

export const DIFICULTADES_RECETA: { n: number; nombre: string; cls: string }[] = [
  { n: 1, nombre: 'Fácil', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  { n: 2, nombre: 'Media', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  { n: 3, nombre: 'Avanzada', cls: 'text-rose-300 border-rose-500/40 bg-rose-500/10' },
];

export function dificultadReceta(n: number): { nombre: string; cls: string } {
  return DIFICULTADES_RECETA.find((d) => d.n === n) ?? DIFICULTADES_RECETA[0];
}

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

// ── CRUD ──────────────────────────────────────────────────────
export function leerRecetas(): Receta[] {
  const s = ls();
  if (!s) return [];
  try {
    const arr = JSON.parse(s.getItem(CLAVE_RECETAS) ?? '[]');
    return Array.isArray(arr)
      ? arr.filter((r) => r && r.nombre).map(normalizarReceta)
      : [];
  } catch { return []; }
}

/** Backfill defensivo: recetas guardadas antes de F10.1 salen
 *  con prot/carbs/grasa/dificultad completos (0/0/0/1), y las de
 *  antes de F10.2 con su imagen suelta convertida a galería
 *  (imagen → imagenes[0]). El campo viejo se elimina al guardar. */
function normalizarReceta(r: RecetaGuardada): Receta {
  const { imagen: _vieja, ...sinImagen } = r;
  const imagenes = Array.isArray(r.imagenes)
    ? r.imagenes.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : typeof _vieja === 'string' && _vieja.length > 0
      ? [_vieja]
      : [];
  return {
    ...(sinImagen as Receta),
    imagenes,
    prot: enteroOPredeterminado(r.prot, 0),
    carbs: enteroOPredeterminado(r.carbs, 0),
    grasa: enteroOPredeterminado(r.grasa, 0),
    dificultad: Math.min(3, Math.max(1, Math.round(Number(r.dificultad)) || 1)),
    ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes : [],
    pasos: Array.isArray(r.pasos) ? r.pasos : [],
  };
}

function enteroOPredeterminado(v: unknown, def: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

export function guardarRecetas(arr: Receta[]): void {
  const s = ls();
  if (!s) return;
  try { s.setItem(CLAVE_RECETAS, JSON.stringify(arr)); } catch { /* storage lleno */ }
}

/** Agrega (arriba, como el viejo con unshift) y devuelve la lista nueva.
 *  id = máximo existente + 1 (Date.now() colisionaba al crear dos seguidas) */
export function agregarReceta(r: Omit<Receta, 'id' | 'fecha'>): Receta[] {
  const arr = leerRecetas();
  const id = arr.reduce((max, x) => Math.max(max, x.id ?? 0), Date.now() - 1) + 1;
  const nueva: Receta = { ...r, id, fecha: new Date().toISOString() };
  arr.unshift(nueva);
  guardarRecetas(arr);
  return arr;
}

/** F10.2 · EDITAR: aplica los cambios sobre la receta existente
 *  (mismo id, misma fecha original — no se duplica ni reordena). */
export function actualizarReceta(id: number, cambios: Omit<Receta, 'id' | 'fecha'>): Receta[] {
  const arr = leerRecetas();
  const nuevo = arr.map((r) => (r.id === id ? { ...r, ...cambios, id, fecha: r.fecha } : r));
  guardarRecetas(nuevo);
  return nuevo;
}

export function borrarReceta(id: number): Receta[] {
  const arr = leerRecetas().filter((r) => r.id !== id);
  guardarRecetas(arr);
  return arr;
}

// ── IMAGEN (compresión compartida con fotos de progreso F6) ───
export async function comprimirImagenReceta(file: File): Promise<string> {
  return comprimirFoto(file);
}

// ── FILTRO ────────────────────────────────────────────────────
export function filtrarRecetas(arr: Receta[], categoria: string, busqueda: string): Receta[] {
  const q = busqueda.trim().toLowerCase();
  return arr.filter((r) => {
    const okCat = categoria === 'todas' || r.categoria === categoria;
    const okQ = !q || r.nombre.toLowerCase().includes(q) ||
      (r.ingredientes ?? []).some((i) => i.toLowerCase().includes(q));
    return okCat && okQ;
  });
}

// ── PARSER LOCAL (puerto de parsearRecetaLocal del viejo) ─────
// Detecta receta en texto plano SIN IA: nombre = 1ª línea,
// líneas con unidades → ingredientes, numeradas/largas → pasos,
// categoría por palabras clave.
export interface RecetaParseada {
  nombre: string;
  categoria: string;
  tiempo: number;
  porciones: number;
  calorias: number;
  prot: number;
  carbs: number;
  grasa: number;
  dificultad: number;
  imagenes: string[];
  ingredientes: string[];
  pasos: string[];
  notas: string;
}

export function parsearRecetaTexto(texto: string): RecetaParseada | null {
  const lineas = texto.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 1);
  if (lineas.length < 3) return null;

  let nombre = lineas[0].replace(/^(receta|recipe|nombre|title)[:\s]*/i, '').trim();
  if (nombre.length > 60) nombre = nombre.substring(0, 60);

  const ingredientes: string[] = [];
  const pasos: string[] = [];
  const unidades = /(\d+[\.,]?\d*\s*(g|kg|ml|l|taza|tazas|cucharada|cucharadas|cucharadita|cucharaditas|unidad|unidades|gramos|litro|litros|trozo|trozos|diente|dientes|hoja|hojas|rama|ramas|pizca|pizcas|sobre|sobres))/i;
  const numPaso = /^(\d+[\.\)]\s*|paso\s*\d+[:\s]*|-\s*)/i;

  lineas.slice(1).forEach((l) => {
    if (unidades.test(l) && l.length < 80) {
      ingredientes.push(l.replace(/^[-•*]\s*/, ''));
    } else if (numPaso.test(l) || l.length > 40) {
      pasos.push(l.replace(numPaso, '').trim());
    } else if (l.length > 5 && l.length < 60) {
      ingredientes.push(l.replace(/^[-•*]\s*/, ''));
    }
  });

  if (!ingredientes.length) ingredientes.push('Ingredientes no detectados — edítalos manualmente');
  if (!pasos.length) pasos.push('Preparación no detectada — edítala manualmente');

  let cat = 'almuerzo';
  const txt = texto.toLowerCase();
  if (/desayuno|breakfast|ma\u00f1ana|avena|cereal|tostada/.test(txt)) cat = 'desayuno';
  else if (/cena|dinner|noche/.test(txt)) cat = 'cena';
  else if (/snack|merienda|bocado/.test(txt)) cat = 'snack';
  else if (/postre|dulce|torta|pastel|helado|chocolate/.test(txt)) cat = 'postre';

  return {
    nombre, categoria: cat, tiempo: 0, porciones: 1, calorias: 0,
    prot: 0, carbs: 0, grasa: 0, dificultad: 1,
    imagenes: [], ingredientes, pasos, notas: '',
  };
}

// ── EXPORTAR (imprimir → el usuario guarda PDF desde el diálogo) ─
export function imprimirReceta(r: Receta): void {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const ings = (r.ingredientes ?? []).map((i) => `<li>${escHtml(i)}</li>`).join('');
  const pasos = (r.pasos ?? []).map((p) => `<li>${escHtml(p)}</li>`).join('');
  const imgs = (r.imagenes ?? []).filter(Boolean);
  const img = imgs.length
    ? `<div style="display:grid;grid-template-columns:${imgs.length > 1 ? 'repeat(2,1fr)' : '1fr'};gap:10px;margin:0 auto 18px">${imgs.map((x) => `<img src="${x}" style="width:100%;max-width:420px;border-radius:12px;display:block" />`).join('')}</div>`
    : '';
  const dif = dificultadReceta(r.dificultad).nombre;
  const macros = r.prot || r.carbs || r.grasa
    ? ` · P ${r.prot}g · C ${r.carbs}g · G ${r.grasa}g` : '';
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escHtml(r.nombre)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;max-width:680px;margin:32px auto;padding:0 18px;color:#111}
  h1{font-size:26px;margin:0 0 4px}
  .cat{color:#0e7490;text-transform:uppercase;letter-spacing:2px;font-size:12px;margin-bottom:14px}
  .tags{font-size:13px;color:#444;margin-bottom:20px}
  h2{font-size:15px;color:#0e7490;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;margin:22px 0 8px}
  li{font-size:14px;line-height:1.7;margin-bottom:4px}
  .notas{font-style:italic;font-size:13px;color:#555;margin-top:18px}
  .pie{margin-top:28px;font-size:11px;color:#999;text-align:center}
</style></head><body>
${img}
<h1>${escHtml(r.nombre)}</h1>
<div class="cat">${escHtml(emojiCategoria(r.categoria))} ${escHtml(r.categoria)}</div>
<div class="tags">⏱ ${r.tiempo || '--'} min · 🔥 ${r.calorias || '--'} kcal por porción${macros} · ${r.porciones} porción(es) · ${dif}</div>
<h2>Ingredientes</h2><ol>${ings}</ol>
<h2>Preparación</h2><ol>${pasos}</ol>
${r.notas ? `<p class="notas">📝 ${escHtml(r.notas)}</p>` : ''}
<div class="pie">Generado por FitTrack V2 · Recetario</div>
</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* usuario imprime manual */ } }, 350);
}

function escHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

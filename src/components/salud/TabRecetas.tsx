// ═══════════════════════════════════════════════════════════
// 🍽️ TAB RECETAS — Salud (F10.3 · fotos IA + detalle revista)
// El recetario del HealthTrack, completo:
//   • Lista con buscador + filtro por categoría (chips del viejo)
//   • Alta con ingredientes y pasos dinámicos + macros (F10.1)
//   • F10.2 EDITAR: cualquier receta guardada se reabre en el
//     formulario y se guarda SIN duplicar (actualizarReceta,
//     mantiene id y fecha). Botón ✏️ en el detalle.
//   • F10.2 IMÁGENES: galería de hasta 4 fotos por receta —
//     se agregan/quitan al crear, al editar y ANTES de guardar
//     el resultado de la IA ("Editar antes de guardar"). El
//     detalle muestra la galería con miniaturas.
//   • F10.3 FOTO IA: botón ✨ que GENERA la foto profesional del
//     plato con IA (servicio público sin API key — la clave
//     Anthropic solo hace texto). En 3 lugares: el formulario,
//     el preview de la IA (antes de guardar) y el detalle de
//     una receta guardada (se guarda directo).
//   • F10.3 DETALLE REVISTA: si hay foto, el título va SOBRE la
//     imagen con degradado (look de revista de cocina).
//   • Detalle con exportar PDF (vista de impresión — el diálogo
//     del sistema guarda el PDF, en web y en Android)
//   • IA: buscar receta ("pollo al horno fitness") e importar
//     texto pegado (lo ordena como receta) — usa la clave IA del
//     perfil, NUNCA hardcodeada. Modo "Sin IA": parser local.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Printer, Sparkles, Search, X, Clock, Flame,
  Users, Save, ClipboardPaste, Bot, ChefHat, ImagePlus, Pencil,
  Wand2, Loader2,
} from 'lucide-react';
import {
  leerRecetas, agregarReceta, actualizarReceta, borrarReceta, filtrarRecetas,
  CATEGORIAS_RECETA, DIFICULTADES_RECETA, emojiCategoria, claseCategoria, dificultadReceta,
  parsearRecetaTexto, imprimirReceta, comprimirImagenReceta,
  MAX_IMAGENES_RECETA, LIMITE_RECETAS, type Receta,
} from '../../services/recetas';
import { buscarRecetaIA, analizarRecetaIA } from '../../services/saludIa';
import { leerKeyClaude } from '../../services/claude';
import { generarFotoRecetaIA } from '../../services/fotosIa';

interface TabRecetasProps {
  toast: (msg: string) => void;
}

type PreviewReceta = Omit<Receta, 'id' | 'fecha'>;

const FORM_VACIO: PreviewReceta = {
  nombre: '', categoria: 'almuerzo', tiempo: 0, porciones: 1,
  calorias: 0, prot: 0, carbs: 0, grasa: 0, dificultad: 1,
  imagenes: [], ingredientes: [''], pasos: [''], notas: '',
};

export const TabRecetas: React.FC<TabRecetasProps> = ({ toast }) => {
  const [recetas, setRecetas] = useState<Receta[]>(() => leerRecetas());
  const [cat, setCat] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<Receta | null>(null);
  const [imgActiva, setImgActiva] = useState(0); // F10.2: foto activa de la galería del detalle

  // Form alta/edición (F10.2: editandoId ≠ null → guarda sobre esa receta)
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [f, setF] = useState<PreviewReceta>({ ...FORM_VACIO });

  // IA
  const [iaQuery, setIaQuery] = useState('');
  const [iaCargando, setIaCargando] = useState(false);
  const [iaResultado, setIaResultado] = useState<PreviewReceta | null>(null);
  const [importTexto, setImportTexto] = useState('');
  const [importAbierto, setImportAbierto] = useState(false);
  const [importCargando, setImportCargando] = useState(false);
  const [usarIA, setUsarIA] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const tieneKey = Boolean(leerKeyClaude());

  // F10.3 · generador de foto IA (independiente por vista: form / preview / detalle)
  const [fotoIaCargando, setFotoIaCargando] = useState(false);
  const [fotoIaPreview, setFotoIaPreview] = useState(false);
  const [fotoIaDetalle, setFotoIaDetalle] = useState(false);

  const lista = useMemo(() => filtrarRecetas(recetas, cat, busqueda), [recetas, cat, busqueda]);

  // ── helpers de form ──
  const setIng = (i: number, v: string) => {
    setF((p) => ({ ...p, ingredientes: p.ingredientes.map((x, n) => (n === i ? v : x)) }));
  };
  const setPaso = (i: number, v: string) => {
    setF((p) => ({ ...p, pasos: p.pasos.map((x, n) => (n === i ? v : x)) }));
  };

  /** Abre el formulario VACÍO (botón Nueva) */
  const abrirNueva = () => {
    setF({ ...FORM_VACIO, ingredientes: [''], pasos: [''] });
    setEditandoId(null);
    setFormAbierto(true);
    setIaResultado(null);
  };

  /** F10.2 · EDITAR: carga una receta guardada en el formulario */
  const abrirFormEdicion = (r: Receta) => {
    setF({
      ...r,
      imagenes: [...(r.imagenes ?? [])],
      ingredientes: (r.ingredientes ?? []).length ? [...r.ingredientes] : [''],
      pasos: (r.pasos ?? []).length ? [...r.pasos] : [''],
    });
    setEditandoId(r.id);
    setFormAbierto(true);
    setDetalle(null);
    setIaResultado(null);
  };

  /** F10.2: editar el resultado de la IA ANTES de guardarlo
   *  (corregir campos + agregar fotos) — después se guarda normal */
  const abrirFormDesdePreview = (r: PreviewReceta) => {
    setF({
      ...r,
      imagenes: [...(r.imagenes ?? [])],
      ingredientes: (r.ingredientes ?? []).length ? [...r.ingredientes] : [''],
      pasos: (r.pasos ?? []).length ? [...r.pasos] : [''],
    });
    setEditandoId(null);
    setFormAbierto(true);
    setIaResultado(null);
  };

  const cerrarForm = () => {
    setFormAbierto(false);
    setEditandoId(null);
    setF({ ...FORM_VACIO, ingredientes: [''], pasos: [''] });
  };

  const guardarRecetaForm = () => {
    if (!f.nombre.trim()) { toast('Escribe el nombre de la receta'); return; }
    const limpio: PreviewReceta = {
      ...f,
      nombre: f.nombre.trim(),
      ingredientes: f.ingredientes.map((i) => i.trim()).filter(Boolean),
      pasos: f.pasos.map((p) => p.trim()).filter(Boolean),
      notas: f.notas.trim(),
      imagenes: (f.imagenes ?? []).filter(Boolean),
    };
    if (editandoId != null) {
      setRecetas(actualizarReceta(editandoId, limpio));
      cerrarForm();
      toast('✏️ Receta actualizada');
    } else {
      setRecetas(agregarReceta(limpio));
      cerrarForm();
      toast('✅ Receta guardada');
    }
  };

  const guardarPreview = (r: PreviewReceta) => {
    setRecetas(agregarReceta(r));
    setIaResultado(null);
    setImportTexto('');
    setImportAbierto(false);
    toast('✅ Receta guardada en tu recetario');
  };

  const buscarIA = async () => {
    if (!iaQuery.trim()) { toast('Escribe qué receta quieres buscar'); return; }
    setIaCargando(true);
    setIaResultado(null);
    const r = await buscarRecetaIA(iaQuery.trim());
    setIaCargando(false);
    if (r.error || !r.receta) { toast(`⚠️ ${r.error ?? 'No se pudo procesar. Intenta de nuevo.'}`); return; }
    setIaResultado(r.receta);
  };

  const importar = async () => {
    if (importTexto.trim().length < 30) { toast('Pega el texto de la receta (más largo)'); return; }
    if (usarIA) {
      setImportCargando(true);
      const r = await analizarRecetaIA(importTexto.trim());
      setImportCargando(false);
      if (r.error || !r.receta) { toast(`⚠️ ${r.error ?? 'No se detectó receta. Prueba el modo Sin IA.'}`); return; }
      setIaResultado(r.receta);
      setImportAbierto(false);
    } else {
      const rec = parsearRecetaTexto(importTexto.trim());
      if (!rec) { toast('⚠️ El texto es muy corto. Necesita nombre, ingredientes y pasos.'); return; }
      setIaResultado(rec);
      setImportAbierto(false);
    }
  };

  // ── F10.2 · galería: varias fotos, agregar y quitar ──
  const quitarImagen = (i: number) => {
    setF((p) => ({ ...p, imagenes: p.imagenes.filter((_, n) => n !== i) }));
  };

  /** Guarda compartida de ESPACIO (F10.3 — la usan las fotos propias
   *  Y las de IA): cabe otra foto en ESTA receta (máx 4) y el
   *  recetario completo no pasa de LIMITE_RECETAS ni editando
   *  (guarda inmediata) ni al guardar (nueva / preview IA). */
  const cabeEnRecetario = (base: PreviewReceta | Receta, extra: string[], idEditar: number | null): boolean => {
    if ((base.imagenes?.length ?? 0) + extra.length > MAX_IMAGENES_RECETA) {
      toast(`Máximo ${MAX_IMAGENES_RECETA} fotos por receta`);
      return false;
    }
    const conFotos = [...(base.imagenes ?? []), ...extra];
    const futuras: Receta[] = idEditar != null
      ? recetas.map((r) => (r.id === idEditar ? { ...r, imagenes: conFotos } : r))
      : [{ ...base, imagenes: conFotos, id: -1, fecha: '' }, ...recetas];
    try {
      if (JSON.stringify(futuras).length > LIMITE_RECETAS) {
        toast('⚠️ El recetario llegó a su límite de espacio — exporta un respaldo o borra fotos viejas');
        return false;
      }
    } catch { /* seguimos sin medir */ }
    return true;
  };

  const elegirImagenes = async (files: FileList | undefined) => {
    if (!files || files.length === 0) return;
    const espacio = MAX_IMAGENES_RECETA - (f.imagenes?.length ?? 0);
    if (espacio <= 0) { toast(`Máximo ${MAX_IMAGENES_RECETA} fotos por receta`); return; }

    const nuevas: string[] = [];
    for (let i = 0; i < Math.min(files.length, espacio); i++) {
      try {
        nuevas.push(await comprimirImagenReceta(files[i]));
      } catch { toast('⚠️ Una imagen no se pudo procesar'); }
    }
    if (nuevas.length === 0) return;
    if (!cabeEnRecetario(f, nuevas, editandoId)) return;

    setF((p) => ({ ...p, imagenes: [...(p.imagenes ?? []), ...nuevas] }));
    if (files.length > espacio) toast(`Máximo ${MAX_IMAGENES_RECETA} fotos: se agregaron ${espacio} de ${files.length}`);
  };

  // ── F10.3 · FOTO IA DEL PLATO (3 entradas: form · preview · detalle) ──
  // La IA de texto (clave Anthropic del usuario) no genera imágenes:
  // la foto la crea el generador público SIN API key y entra a la
  // galería igual que una foto propia (mismo compresor 900px).
  const generarFotoIAForm = async () => {
    if (!f.nombre.trim()) { toast('Escribe primero el nombre del plato'); return; }
    setFotoIaCargando(true);
    try {
      const foto = await generarFotoRecetaIA({ nombre: f.nombre.trim(), categoria: f.categoria, ingredientes: f.ingredientes });
      if (cabeEnRecetario(f, [foto], editandoId)) {
        setF((p) => ({ ...p, imagenes: [...(p.imagenes ?? []), foto] }));
        toast('✨ Foto IA del plato lista');
      }
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : 'No se pudo generar la foto'}`);
    } finally {
      setFotoIaCargando(false);
    }
  };

  /** Foto IA sobre el resultado de la IA ANTES de guardarlo */
  const generarFotoIAPreview = async () => {
    const r = iaResultado;
    if (!r) return;
    setFotoIaPreview(true);
    try {
      const foto = await generarFotoRecetaIA({ nombre: r.nombre, categoria: r.categoria, ingredientes: r.ingredientes });
      if (cabeEnRecetario(r, [foto], null)) {
        setIaResultado({ ...r, imagenes: [...(r.imagenes ?? []), foto] });
        toast('✨ Foto IA del plato lista');
      }
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : 'No se pudo generar la foto'}`);
    } finally {
      setFotoIaPreview(false);
    }
  };

  /** Foto IA desde el DETALLE de una receta ya guardada — se
   *  guarda DIRECTO con actualizarReceta, sin abrir el form */
  const generarFotoIADetalle = async () => {
    const r = detalle;
    if (!r) return;
    if ((r.imagenes?.length ?? 0) >= MAX_IMAGENES_RECETA) { toast(`Máximo ${MAX_IMAGENES_RECETA} fotos por receta`); return; }
    setFotoIaDetalle(true);
    try {
      const foto = await generarFotoRecetaIA({ nombre: r.nombre, categoria: r.categoria, ingredientes: r.ingredientes });
      if (cabeEnRecetario(r, [foto], r.id)) {
        const nuevas = [...(r.imagenes ?? []), foto];
        setRecetas(actualizarReceta(r.id, { ...r, imagenes: nuevas }));
        setDetalle({ ...r, imagenes: nuevas });
        setImgActiva(nuevas.length - 1);
        toast('✨ Foto IA agregada a la receta');
      }
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : 'No se pudo generar la foto'}`);
    } finally {
      setFotoIaDetalle(false);
    }
  };

  const abrirDetalle = (r: Receta) => {
    setDetalle(r);
    setImgActiva(0);
  };

  const inputCls = 'w-full bg-slate-900/70 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-orange-500/60 placeholder:text-slate-600';
  const labelCls = 'text-[9px] font-black text-slate-500 tracking-wider block mb-1';

  const VistaPreview = ({ r }: { r: PreviewReceta }) => (
    <div className="p-4 rounded-2xl border border-orange-500/50 bg-orange-500/5" data-testid="preview-receta">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          {emojiCategoria(r.categoria)} {r.nombre}
        </h3>
        <button onClick={() => setIaResultado(null)} className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 text-slate-400 flex items-center justify-center shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2 mt-2 text-[10px] font-bold flex-wrap">
        {r.tiempo > 0 && <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"><Clock className="w-3 h-3 inline" /> {r.tiempo} min</span>}
        {r.calorias > 0 && <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"><Flame className="w-3 h-3 inline" /> {r.calorias} kcal</span>}
        <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"><Users className="w-3 h-3 inline" /> {r.porciones} porc.</span>
        <span className={`px-2 py-1 rounded-lg border ${dificultadReceta(r.dificultad).cls}`}>{dificultadReceta(r.dificultad).nombre}</span>
      </div>
      {(r.prot > 0 || r.carbs > 0 || r.grasa > 0) && (
        <div className="flex gap-2 mt-1.5 text-[10px] font-bold flex-wrap" data-testid="macros-preview">
          <span className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">🥩 P {r.prot}g</span>
          <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">🍞 C {r.carbs}g</span>
          <span className="px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">🥑 G {r.grasa}g</span>
        </div>
      )}
      {(r.imagenes ?? []).length > 0 && (
        <div className="mt-3" data-testid="preview-imagenes">
          <img src={r.imagenes[0]} alt="" className="w-full h-36 object-cover rounded-xl" />
          {r.imagenes.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {r.imagenes.slice(1).map((img, n) => <img key={n} src={img} alt="" className="w-full h-14 object-cover rounded-lg" />)}
            </div>
          )}
        </div>
      )}
      {/* F10.3 · foto IA del plato — sobre el resultado de la IA, antes de guardar */}
      {(r.imagenes?.length ?? 0) < MAX_IMAGENES_RECETA && (
        <button
          onClick={() => void generarFotoIAPreview()}
          disabled={fotoIaPreview}
          data-testid="boton-foto-ia-preview"
          className="mt-3 w-full py-2.5 rounded-xl border border-violet-500/50 bg-violet-500/10 text-violet-200 text-xs font-black hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {fotoIaPreview
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando foto IA… puede tardar ~15s</>
            : <><Wand2 className="w-4 h-4" /> Generar foto IA del plato ✨</>}
        </button>
      )}
      <p className="text-[10px] font-black tracking-widest text-orange-400 mt-3">INGREDIENTES</p>
      <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1 mt-1">
        {r.ingredientes.map((i, n) => <li key={n} className="border-b border-slate-700/40 pb-1">{i}</li>)}
      </ol>
      <p className="text-[10px] font-black tracking-widest text-orange-400 mt-3">PREPARACIÓN</p>
      <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1 mt-1">
        {r.pasos.map((p, n) => <li key={n} className="border-b border-slate-700/40 pb-1"><b>Paso {n + 1}:</b> {p}</li>)}
      </ol>
      {r.notas && <p className="text-xs text-slate-400 italic mt-3">📝 {r.notas}</p>}
      {/* F10.2: retocar el resultado de la IA + ponerle fotos ANTES de guardarlo */}
      <button
        onClick={() => abrirFormDesdePreview(r)}
        data-testid="boton-editar-preview"
        className="mt-3 w-full py-2 rounded-xl border border-orange-500/50 bg-slate-800 text-orange-200 text-xs font-black hover:bg-slate-700 transition-all flex items-center justify-center gap-1.5"
      >
        <Pencil className="w-3.5 h-3.5" /> Editar antes de guardar / agregar fotos
      </button>
      <button onClick={() => guardarPreview(r)} data-testid="boton-guardar-preview" className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
        <Save className="w-4 h-4 inline" /> Guardar en mi Recetario
      </button>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="tab-salud-recetas">

      {/* Buscador + categorías */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="buscar por nombre o ingrediente…"
              data-testid="input-buscar-receta"
              className={`${inputCls} pl-9`}
            />
          </div>
          <button
            onClick={() => (formAbierto && editandoId == null ? setFormAbierto(false) : abrirNueva())}
            data-testid="boton-nueva-receta"
            title="Nueva receta"
            className="px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-black text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3" data-testid="chips-categorias">
          {CATEGORIAS_RECETA.map((c) => {
            const on = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                data-testid={`chip-cat-${c.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                  on ? 'bg-orange-500/25 border-orange-500/60 text-orange-200' : 'bg-slate-900/60 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {c.emoji} {c.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form de alta/edición (colapsable) */}
      {formAbierto && (
        <div className="p-4 rounded-2xl bg-slate-800 border border-orange-500/40" data-testid="form-receta">
          <p className="text-[10px] font-black tracking-widest text-orange-400" data-testid="titulo-form-receta">
            {editandoId != null ? '✏️ EDITAR RECETA' : '✍️ NUEVA RECETA'}
          </p>
          {editandoId != null && (
            <p className="text-[10px] text-slate-500 mt-1">
              Los cambios se guardan sobre la receta original (misma fecha, sin duplicar).
            </p>
          )}
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre de la receta *" data-testid="input-receta-nombre" className={`${inputCls} mt-2`} />
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <label className={labelCls}>CATEGORÍA</label>
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} data-testid="select-receta-cat" className={inputCls}>
                {CATEGORIAS_RECETA.filter((c) => c.id !== 'todas').map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>MINUTOS</label>
              <input value={f.tiempo || ''} onChange={(e) => setF({ ...f, tiempo: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-tiempo" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PORCIONES</label>
              <input value={f.porciones || ''} onChange={(e) => setF({ ...f, porciones: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-porciones" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KCAL/PORC.</label>
              <input value={f.calorias || ''} onChange={(e) => setF({ ...f, calorias: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-calorias" className={inputCls} />
            </div>
          </div>

          {/* Macros por porción (F10.1 · receta profesional) */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <label className={labelCls}>PROT (G)</label>
              <input value={f.prot || ''} onChange={(e) => setF({ ...f, prot: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-prot" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CARB (G)</label>
              <input value={f.carbs || ''} onChange={(e) => setF({ ...f, carbs: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-carbs" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>GRASA (G)</label>
              <input value={f.grasa || ''} onChange={(e) => setF({ ...f, grasa: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 })} inputMode="numeric" data-testid="input-receta-grasa" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DIFICULTAD</label>
              <div className="grid grid-cols-3 gap-0.5" data-testid="seg-dificultad">
                {DIFICULTADES_RECETA.map((d) => (
                  <button
                    key={d.n}
                    onClick={() => setF({ ...f, dificultad: d.n })}
                    data-testid={`boton-dificultad-${d.n}`}
                    title={d.nombre}
                    className={`py-2 rounded-lg text-[9px] font-black border transition-all ${
                      f.dificultad === d.n ? d.cls : 'bg-slate-900/60 border-slate-600 text-slate-500'
                    }`}
                  >
                    {d.n === 1 ? '●' : d.n === 2 ? '●●' : '●●●'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ingredientes dinámicos */}
          <p className="text-[10px] font-black tracking-widest text-slate-400 mt-3">INGREDIENTES</p>
          <div className="space-y-1.5" data-testid="form-ingredientes">
            {f.ingredientes.map((ing, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={ing} onChange={(e) => setIng(i, e.target.value)} placeholder={`${i + 1}. 200g de pollo`} className={inputCls} />
                <button onClick={() => setF((p) => ({ ...p, ingredientes: p.ingredientes.filter((_, n) => n !== i) }))} className="w-9 rounded-xl border border-slate-600 text-red-400/70 hover:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setF((p) => ({ ...p, ingredientes: [...p.ingredientes, ''] }))} data-testid="boton-agregar-ingrediente" className="mt-1.5 w-full py-1.5 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400 hover:border-orange-500/60 hover:text-orange-300 transition-all">
            <Plus className="w-3.5 h-3.5 inline" /> Ingrediente
          </button>

          {/* Pasos dinámicos */}
          <p className="text-[10px] font-black tracking-widest text-slate-400 mt-3">PREPARACIÓN</p>
          <div className="space-y-1.5" data-testid="form-pasos">
            {f.pasos.map((paso, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={paso} onChange={(e) => setPaso(i, e.target.value)} placeholder={`Paso ${i + 1}…`} className={inputCls} />
                <button onClick={() => setF((p) => ({ ...p, pasos: p.pasos.filter((_, n) => n !== i) }))} className="w-9 rounded-xl border border-slate-600 text-red-400/70 hover:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setF((p) => ({ ...p, pasos: [...p.pasos, ''] }))} data-testid="boton-agregar-paso" className="mt-1.5 w-full py-1.5 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400 hover:border-orange-500/60 hover:text-orange-300 transition-all">
            <Plus className="w-3.5 h-3.5 inline" /> Paso
          </button>

          {/* F10.2 · Galería de imágenes (varias fotos, agregar/quitar) */}
          <div className="mt-3" data-testid="form-imagenes">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { void elegirImagenes(e.target.files); e.target.value = ''; }}
              data-testid="input-receta-imagenes"
            />
            {(f.imagenes ?? []).length > 0 && (
              <div className="grid grid-cols-4 gap-1.5" data-testid="galeria-form">
                {f.imagenes.map((img, i) => (
                  <div key={i} className={`relative ${i === 0 ? 'col-span-4' : ''}`}>
                    <img src={img} alt="" className={`w-full object-cover rounded-xl ${i === 0 ? 'h-36' : 'h-20'}`} data-testid={`imagen-form-${i}`} />
                    <button
                      onClick={() => quitarImagen(i)}
                      data-testid={`boton-quitar-imagen-${i}`}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                      title={i === 0 ? 'Quitar foto principal' : 'Quitar foto'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-black text-orange-200 tracking-wider">
                        PRINCIPAL
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(f.imagenes ?? []).length < MAX_IMAGENES_RECETA && (
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="boton-agregar-imagenes"
                className="mt-1.5 w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400 hover:border-orange-500/60 hover:text-orange-300 transition-all flex items-center justify-center gap-1.5"
              >
                <ImagePlus className="w-4 h-4" />
                {(f.imagenes ?? []).length === 0
                  ? `Fotos del plato (opcional · hasta ${MAX_IMAGENES_RECETA})`
                  : `Agregar foto (${(f.imagenes ?? []).length}/${MAX_IMAGENES_RECETA})`}
              </button>
            )}
            {/* F10.3 · foto IA del plato — generador público SIN API key */}
            {(f.imagenes ?? []).length < MAX_IMAGENES_RECETA && (
              <button
                onClick={() => void generarFotoIAForm()}
                disabled={fotoIaCargando}
                data-testid="boton-foto-ia-form"
                className="mt-1.5 w-full py-2.5 rounded-xl border border-violet-500/50 bg-violet-500/10 text-violet-200 text-xs font-black hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {fotoIaCargando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando foto IA… puede tardar ~15s</>
                  : <><Wand2 className="w-4 h-4" /> Generar foto IA del plato ✨</>}
              </button>
            )}
          </div>

          <textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="notas / tips…" rows={2} className={`${inputCls} mt-2 resize-none`} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={cerrarForm} data-testid="boton-cancelar-receta" className="py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 text-slate-300 text-sm font-black hover:bg-slate-700 transition-all">
              <X className="w-4 h-4 inline" /> Cancelar
            </button>
            <button onClick={guardarRecetaForm} data-testid="boton-guardar-receta" className="py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
              <Save className="w-4 h-4 inline" /> {editandoId != null ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* IA: buscar + importar */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-emerald-500/30" data-testid="card-recetas-ia">
        <p className="text-[10px] font-black tracking-widest text-emerald-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> IA DEL RECETARIO
          {!tieneKey && <span className="ml-1 text-amber-400 normal-case font-normal">· configura tu clave IA en Mi Perfil</span>}
        </p>

        {/* Buscar con IA */}
        <div className="flex gap-2 mt-3">
          <input
            value={iaQuery}
            onChange={(e) => setIaQuery(e.target.value)}
            placeholder="pollo al horno fitness, avena nocturna…"
            data-testid="input-ia-receta"
            className={inputCls}
            onKeyDown={(e) => { if (e.key === 'Enter') void buscarIA(); }}
          />
          <button
            onClick={() => void buscarIA()}
            disabled={iaCargando}
            data-testid="boton-buscar-ia"
            className="px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            {iaCargando ? <Bot className="w-4 h-4 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{iaCargando ? 'Buscando…' : 'Crear'}</span>
          </button>
        </div>

        {/* Importar texto */}
        {importAbierto ? (
          <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700" data-testid="form-importar">
            <textarea
              value={importTexto}
              onChange={(e) => setImportTexto(e.target.value)}
              placeholder="Pega aquí el texto de la receta copiado de cualquier fuente…"
              rows={4}
              data-testid="input-importar-texto"
              className={`${inputCls} resize-none`}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setUsarIA((v) => !v)}
                data-testid="boton-alternar-ia"
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                  usarIA ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-700/50 border-slate-600 text-slate-400'
                }`}
              >
                {usarIA ? '🤖 Con IA' : '⚡ Sin IA'}
              </button>
              <div className="flex-1" />
              <button onClick={() => setImportAbierto(false)} className="px-3 py-1.5 rounded-lg bg-slate-700/60 text-slate-300 text-xs font-black">
                Cerrar
              </button>
              <button
                onClick={() => void importar()}
                disabled={importCargando}
                data-testid="boton-importar"
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-black disabled:opacity-50"
              >
                {importCargando ? 'Analizando…' : 'Analizar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setImportAbierto(true)}
            data-testid="boton-abrir-importar"
            className="mt-2 w-full py-2 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400 hover:border-emerald-500/60 hover:text-emerald-300 transition-all flex items-center justify-center gap-1.5"
          >
            <ClipboardPaste className="w-3.5 h-3.5" /> Importar receta pegada (con IA o sin IA)
          </button>
        )}
      </div>

      {/* Resultado IA / importación (preview antes de guardar) */}
      {iaResultado && <VistaPreview r={iaResultado} />}

      {/* Lista de recetas */}
      <div className="grid sm:grid-cols-2 gap-3" data-testid="lista-recetas">
        {lista.length === 0 && (
          <div className="sm:col-span-2 p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center">
            <ChefHat className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm text-slate-400 font-bold mt-2">Sin recetas todavía</p>
            <p className="text-xs text-slate-500 mt-1">Crea una, impórtala o pídesela a la IA ✨</p>
          </div>
        )}
        {lista.map((r) => (
          <button
            key={r.id}
            onClick={() => abrirDetalle(r)}
            data-testid={`receta-${r.id}`}
            className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-left hover:border-orange-500/50 transition-all active:scale-[0.98]"
          >
            {r.imagenes?.length ? (
              <div className="relative">
                <img src={r.imagenes[0]} alt="" className="w-full h-28 object-cover rounded-xl mb-2" />
                {r.imagenes.length > 1 && (
                  <span
                    data-testid="badge-mas-imagenes"
                    className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/75 text-[10px] font-black text-white flex items-center gap-1"
                  >
                    <ImagePlus className="w-3 h-3" /> {r.imagenes.length}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-full h-28 rounded-xl bg-gradient-to-br from-slate-700/60 to-slate-800 mb-2 flex items-center justify-center text-3xl">
                {emojiCategoria(r.categoria)}
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wide ${claseCategoria(r.categoria)}`}>
                {emojiCategoria(r.categoria)} {r.categoria}
              </span>
              <span className={`ml-auto px-1.5 py-0.5 rounded-md border text-[9px] font-black ${dificultadReceta(r.dificultad).cls}`}>
                {dificultadReceta(r.dificultad).nombre}
              </span>
            </div>
            <p className="text-sm font-black text-white leading-tight">{r.nombre}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {r.tiempo ? `⏱ ${r.tiempo}min · ` : ''}{r.calorias ? `🔥 ${r.calorias}kcal · ` : ''}{r.porciones} porc.
            </p>
            {r.prot > 0 || r.carbs > 0 || r.grasa > 0 ? (
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold" data-testid={`macros-card-${r.id}`}>
                🥩 {r.prot}g · 🍞 {r.carbs}g · 🥑 {r.grasa}g <span className="text-slate-600 font-normal">por porción</span>
              </p>
            ) : (
              <p className="text-[10px] text-slate-600 mt-0.5">{(r.ingredientes ?? []).length} ingredientes</p>
            )}
          </button>
        ))}
      </div>

      {/* Detalle (modal) */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setDetalle(null)}
          data-testid="modal-detalle-receta"
        >
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* F10.3 · header estilo REVISTA: con foto, el título va
                SOBRE la imagen con degradado — look de revista de
                cocina (más profesional). Sin foto: header simple. */}
            {detalle.imagenes?.length > 0 ? (
              <div className="relative -mx-5 -mt-5 mb-3 rounded-t-3xl overflow-hidden shrink-0" data-testid="hero-detalle">
                <img src={detalle.imagenes[imgActiva]} alt="" className="w-full h-52 sm:h-60 object-cover" data-testid="imagen-activa-detalle" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
                <button onClick={() => setDetalle(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
                <span className={`absolute top-3 left-3 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wide ${claseCategoria(detalle.categoria)}`}>
                  {emojiCategoria(detalle.categoria)} {detalle.categoria}
                </span>
                <h3 className="absolute bottom-3 left-4 right-4 text-xl font-black text-white leading-tight drop-shadow-lg">
                  {detalle.nombre}
                </h3>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-lg font-black text-white leading-tight">
                  {emojiCategoria(detalle.categoria)} {detalle.nombre}
                </h3>
                <button onClick={() => setDetalle(null)} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 text-slate-400 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Miniaturas de la galería (F10.2 · ahora bajo el hero) */}
            {detalle.imagenes?.length > 1 && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" data-testid="galeria-detalle">
                {detalle.imagenes.map((img, n) => (
                  <button
                    key={n}
                    onClick={() => setImgActiva(n)}
                    data-testid={`thumb-detalle-${n}`}
                    className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      n === imgActiva ? 'border-orange-500' : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-14 h-14 object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* F10.3 · foto IA en el DETALLE — se guarda directo con
                actualizarReceta, sin abrir el formulario */}
            {(detalle.imagenes?.length ?? 0) < MAX_IMAGENES_RECETA && (
              <button
                onClick={() => void generarFotoIADetalle()}
                disabled={fotoIaDetalle}
                data-testid="boton-foto-ia-detalle"
                className="w-full mb-3 py-2 rounded-xl border border-violet-500/50 bg-violet-500/10 text-violet-200 text-xs font-black hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {fotoIaDetalle
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando foto IA…</>
                  : <><Wand2 className="w-4 h-4" /> {detalle.imagenes?.length ? 'Otra foto IA ✨' : 'Generar foto IA del plato ✨'}</>}
              </button>
            )}

            <div className="flex gap-2 text-[10px] font-bold flex-wrap mb-3">
              {!(detalle.imagenes?.length > 0) && (
                <span className={`px-2 py-1 rounded-md border uppercase tracking-wide font-black ${claseCategoria(detalle.categoria)}`}>
                  {emojiCategoria(detalle.categoria)} {detalle.categoria}
                </span>
              )}
              <span className={`px-2 py-1 rounded-md border font-black ${dificultadReceta(detalle.dificultad).cls}`}>
                {dificultadReceta(detalle.dificultad).nombre}
              </span>
              {detalle.tiempo > 0 && <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"><Clock className="w-3 h-3 inline" /> {detalle.tiempo} min</span>}
              <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"><Users className="w-3 h-3 inline" /> {detalle.porciones} porc.</span>
            </div>
            {/* Macros por porción (F10.1) */}
            <div className="grid grid-cols-4 gap-2 mb-4" data-testid="macros-detalle">
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <p className="text-base leading-none">🔥</p>
                <p className="text-sm font-black text-white mt-1">{detalle.calorias || '--'}</p>
                <p className="text-[8px] text-slate-500 font-black tracking-wider">KCAL</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/8 border border-rose-500/25 text-center">
                <p className="text-base leading-none">🥩</p>
                <p className="text-sm font-black text-white mt-1">{detalle.prot || 0}<span className="text-[9px] text-slate-400">g</span></p>
                <p className="text-[8px] text-rose-300/80 font-black tracking-wider">PROT</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/8 border border-amber-500/25 text-center">
                <p className="text-base leading-none">🍞</p>
                <p className="text-sm font-black text-white mt-1">{detalle.carbs || 0}<span className="text-[9px] text-slate-400">g</span></p>
                <p className="text-[8px] text-amber-300/80 font-black tracking-wider">CARB</p>
              </div>
              <div className="p-2 rounded-xl bg-yellow-500/8 border border-yellow-500/25 text-center">
                <p className="text-base leading-none">🥑</p>
                <p className="text-sm font-black text-white mt-1">{detalle.grasa || 0}<span className="text-[9px] text-slate-400">g</span></p>
                <p className="text-[8px] text-yellow-300/80 font-black tracking-wider">GRASA</p>
              </div>
            </div>
            <p className="text-[10px] font-black tracking-widest text-orange-400">INGREDIENTES</p>
            <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1.5 mt-1.5 mb-4">
              {detalle.ingredientes.map((i, n) => <li key={n} className="border-b border-slate-700/40 pb-1.5">{i}</li>)}
            </ol>
            <p className="text-[10px] font-black tracking-widest text-orange-400">PREPARACIÓN</p>
            <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1.5 mt-1.5">
              {detalle.pasos.map((p, n) => <li key={n} className="border-b border-slate-700/40 pb-1.5"><b>Paso {n + 1}:</b> {p}</li>)}
            </ol>
            {detalle.notas && <p className="text-xs text-slate-400 italic mt-4">📝 {detalle.notas}</p>}

            {/* F10.2: Editar entra en la fila de acciones */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <button
                onClick={() => imprimirReceta(detalle)}
                data-testid="boton-exportar-receta"
                className="py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> PDF
              </button>
              <button
                onClick={() => abrirFormEdicion(detalle)}
                data-testid="boton-editar-receta"
                className="py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-sm font-black hover:bg-sky-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={() => {
                  setRecetas(borrarReceta(detalle.id));
                  setDetalle(null);
                  toast('Receta eliminada');
                }}
                data-testid="boton-borrar-receta"
                className="py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm font-black hover:bg-red-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

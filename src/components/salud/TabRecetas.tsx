// ═══════════════════════════════════════════════════════════
// 🍽️ TAB RECETAS — Salud (F10)
// El recetario del HealthTrack, completo:
//   • Lista con buscador + filtro por categoría (chips del viejo)
//   • Alta/edición con ingredientes y pasos dinámicos + foto
//     (comprimida con el compresor de fotos de progreso F6)
//   • Detalle con exportar PDF (vista de impresión — el diálogo
//     del sistema guarda el PDF, en web y en Android)
//   • IA: buscar receta ("pollo al horno fitness") e importar
//     texto pegado (lo ordena como receta) — usa la clave IA del
//     perfil, NUNCA hardcodeada. Modo "Sin IA": parser local.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Printer, Sparkles, Search, X, Clock, Flame,
  Users, Save, ClipboardPaste, Bot, ChefHat, ImagePlus,
} from 'lucide-react';
import {
  leerRecetas, agregarReceta, borrarReceta, filtrarRecetas,
  CATEGORIAS_RECETA, DIFICULTADES_RECETA, emojiCategoria, claseCategoria, dificultadReceta,
  parsearRecetaTexto, imprimirReceta,
  comprimirImagenReceta, type Receta,
} from '../../services/recetas';
import { buscarRecetaIA, analizarRecetaIA } from '../../services/saludIa';
import { leerKeyClaude } from '../../services/claude';

interface TabRecetasProps {
  toast: (msg: string) => void;
}

type PreviewReceta = Omit<Receta, 'id' | 'fecha'>;

export const TabRecetas: React.FC<TabRecetasProps> = ({ toast }) => {
  const [recetas, setRecetas] = useState<Receta[]>(() => leerRecetas());
  const [cat, setCat] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<Receta | null>(null);

  // Form alta
  const [formAbierto, setFormAbierto] = useState(false);
  const [f, setF] = useState<PreviewReceta>({
    nombre: '', categoria: 'almuerzo', tiempo: 0, porciones: 1,
    calorias: 0, prot: 0, carbs: 0, grasa: 0, dificultad: 1,
    imagen: '', ingredientes: [''], pasos: [''], notas: '',
  });

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

  const lista = useMemo(() => filtrarRecetas(recetas, cat, busqueda), [recetas, cat, busqueda]);

  // ── helpers de form ──
  const setIng = (i: number, v: string) => {
    setF((p) => ({ ...p, ingredientes: p.ingredientes.map((x, n) => (n === i ? v : x)) }));
  };
  const setPaso = (i: number, v: string) => {
    setF((p) => ({ ...p, pasos: p.pasos.map((x, n) => (n === i ? v : x)) }));
  };

  const guardarRecetaForm = () => {
    if (!f.nombre.trim()) { toast('Escribe el nombre de la receta'); return; }
    const limpio: PreviewReceta = {
      ...f,
      nombre: f.nombre.trim(),
      ingredientes: f.ingredientes.map((i) => i.trim()).filter(Boolean),
      pasos: f.pasos.map((p) => p.trim()).filter(Boolean),
      notas: f.notas.trim(),
    };
    setRecetas(agregarReceta(limpio));
    setFormAbierto(false);
    setF({ nombre: '', categoria: 'almuerzo', tiempo: 0, porciones: 1, calorias: 0, prot: 0, carbs: 0, grasa: 0, dificultad: 1, imagen: '', ingredientes: [''], pasos: [''], notas: '' });
    toast('✅ Receta guardada');
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

  const elegirImagen = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await comprimirImagenReceta(file);
      setF((p) => ({ ...p, imagen: dataUrl }));
    } catch { toast('⚠️ No se pudo procesar la imagen'); }
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
      {r.imagen && <img src={r.imagen} alt="" className="w-full max-h-40 object-cover rounded-xl mt-3" />}
      <p className="text-[10px] font-black tracking-widest text-orange-400 mt-3">INGREDIENTES</p>
      <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1 mt-1">
        {r.ingredientes.map((i, n) => <li key={n} className="border-b border-slate-700/40 pb-1">{i}</li>)}
      </ol>
      <p className="text-[10px] font-black tracking-widest text-orange-400 mt-3">PREPARACIÓN</p>
      <ol className="list-decimal list-inside text-sm text-slate-200 space-y-1 mt-1">
        {r.pasos.map((p, n) => <li key={n} className="border-b border-slate-700/40 pb-1"><b>Paso {n + 1}:</b> {p}</li>)}
      </ol>
      {r.notas && <p className="text-xs text-slate-400 italic mt-3">📝 {r.notas}</p>}
      <button onClick={() => guardarPreview(r)} data-testid="boton-guardar-preview" className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
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
            onClick={() => setFormAbierto((v) => !v)}
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

      {/* Form de alta (colapsable) */}
      {formAbierto && (
        <div className="p-4 rounded-2xl bg-slate-800 border border-orange-500/40" data-testid="form-receta">
          <p className="text-[10px] font-black tracking-widest text-orange-400">✍️ NUEVA RECETA</p>
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

          {/* Imagen */}
          <div className="mt-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegirImagen(e.target.files?.[0])} data-testid="input-receta-imagen" />
            {f.imagen ? (
              <div className="relative">
                <img src={f.imagen} alt="" className="w-full max-h-36 object-cover rounded-xl" />
                <button onClick={() => setF({ ...f, imagen: '' })} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400 hover:border-orange-500/60 hover:text-orange-300 transition-all flex items-center justify-center gap-1.5">
                <ImagePlus className="w-4 h-4" /> Foto del plato (opcional)
              </button>
            )}
          </div>

          <textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="notas / tips…" rows={2} className={`${inputCls} mt-2 resize-none`} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => setFormAbierto(false)} className="py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 text-slate-300 text-sm font-black hover:bg-slate-700 transition-all">
              <X className="w-4 h-4 inline" /> Cancelar
            </button>
            <button onClick={guardarRecetaForm} data-testid="boton-guardar-receta" className="py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
              <Save className="w-4 h-4 inline" /> Guardar
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
            onClick={() => setDetalle(r)}
            data-testid={`receta-${r.id}`}
            className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-left hover:border-orange-500/50 transition-all active:scale-[0.98]"
          >
            {r.imagen ? (
              <img src={r.imagen} alt="" className="w-full h-28 object-cover rounded-xl mb-2" />
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
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-lg font-black text-white leading-tight">
                {emojiCategoria(detalle.categoria)} {detalle.nombre}
              </h3>
              <button onClick={() => setDetalle(null)} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 text-slate-400 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {detalle.imagen && <img src={detalle.imagen} alt="" className="w-full max-h-48 object-cover rounded-2xl mb-3" />}
            <div className="flex gap-2 text-[10px] font-bold flex-wrap mb-3">
              <span className={`px-2 py-1 rounded-md border uppercase tracking-wide font-black ${claseCategoria(detalle.categoria)}`}>
                {emojiCategoria(detalle.categoria)} {detalle.categoria}
              </span>
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
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => imprimirReceta(detalle)}
                data-testid="boton-exportar-receta"
                className="py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Exportar PDF
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

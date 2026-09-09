// ═══════════════════════════════════════════════════════════
// 💊 TAB MEDICAMENTOS — Salud (F10.1)
// Lo que pediste: registrar un tratamiento COMO UN PROFESIONAL,
// no un simple listado:
//   • QUÉ: nombre + cantidad (mg/g/mL…) por toma
//   • CUÁNDO: horarios múltiples ('08:00','14:00','20:00')
//     y cada cuántos días (diario, cada 2 días…)
//   • CUÁNTO TIEMPO: fecha de inicio + duración en días
//     (0 = uso continuo para suplementos)
//   • CUMPLIMIENTO: plan de hoy con Tomar/Saltar por hora,
//     próxima dosis con cuenta atrás y adherencia de 7 días
// La app NO es médico: registra lo que TU médico te indicó y
// te ayuda a cumplirlo. Ese aviso va fijado abajo.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  Pill, Plus, Trash2, Check, X, Clock, PauseCircle, PlayCircle,
  Pencil, CalendarDays, ShieldAlert, Trophy,
} from 'lucide-react';
import {
  hoySalud, guardarMed, actualizarMed, borrarMed, alternarPausaMed, marcarToma,
  dosisDeHoy, proximaDosis, adherencia, estadoMed, diaNumTratamiento,
  fechaFinMed, textoDuracion, formatoDosis, UNIDADES_MED,
  ahoraMinutos, type EstadoSalud, type Medicamento, type NuevoMedicamento,
  type EstadoMed,
} from '../../services/salud';

interface TabMedicamentosProps {
  est: EstadoSalud;
  mutar: (fn: (e: EstadoSalud) => EstadoSalud) => void;
  toast: (msg: string) => void;
}

/** Formulario (alta y edición comparten shape) */
interface FormMed {
  nom: string;
  cant: string;
  unidad: string;
  horas: string[];
  cadaDias: number;
  dias: string;       // '' cuando uso continuo
  usoContinuo: boolean;
  inicio: string;
  obs: string;
}

const FORM_VACIO: FormMed = {
  nom: '', cant: '', unidad: 'mg', horas: [], cadaDias: 1,
  dias: '', usoContinuo: false, inicio: hoySalud(), obs: '',
};

const aMinutos = (h: string): number => {
  const [H, M] = h.split(':').map(Number);
  return (H || 0) * 60 + (M || 0);
};

/** 'en 2h 15m' / 'en 45m' / 'ahora' */
const cuentaAtras = (hora: string): string => {
  const dif = aMinutos(hora) - ahoraMinutos();
  if (dif <= 0) return 'ahora';
  const h = Math.floor(dif / 60);
  const m = dif % 60;
  if (h === 0) return `en ${m}m`;
  if (m === 0) return `en ${h}h`;
  return `en ${h}h ${m}m`;
};

const fmtFechaCorta = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const CHIP_ESTADO: Record<EstadoMed, { txt: string; cls: string }> = {
  activo: { txt: 'ACTIVO', cls: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' },
  pausado: { txt: 'PAUSADO', cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  finalizado: { txt: 'FINALIZADO', cls: 'bg-slate-500/15 border-slate-500/40 text-slate-400' },
};

export const TabMedicamentos: React.FC<TabMedicamentosProps> = ({ est, mutar, toast }) => {
  const [verTodos, setVerTodos] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [f, setF] = useState<FormMed>(FORM_VACIO);
  const [horaInput, setHoraInput] = useState('');

  // ── Datos calculados ──
  const hoy = hoySalud();
  const plan = useMemo(() => dosisDeHoy(est), [est]);
  const prox = useMemo(() => proximaDosis(est), [est]);
  const adh = useMemo(() => adherencia(est, 7), [est]);
  const ahora = ahoraMinutos();

  const medsVisibles = useMemo(
    () => (verTodos ? est.meds : est.meds.filter((m) => estadoMed(m) !== 'finalizado')),
    [est.meds, verTodos],
  );

  const tomar = (id: number, hora: string) => {
    mutar((e) => marcarToma(e, id, hoy, hora, 'tomado'));
    toast('✅ Toma registrada');
  };
  const saltar = (id: number, hora: string) => {
    mutar((e) => marcarToma(e, id, hoy, hora, 'saltado'));
    toast('⏭️ Dosis saltada');
  };
  const deshacer = (id: number, hora: string) => {
    mutar((e) => marcarToma(e, id, hoy, hora, null));
  };

  // ── Form ──
  const abrirNuevo = () => {
    setF({ ...FORM_VACIO, inicio: hoy });
    setEditandoId(null);
    setFormAbierto(true);
  };

  const abrirEditar = (m: Medicamento) => {
    setF({
      nom: m.nom,
      cant: m.cant ? String(m.cant) : '',
      unidad: m.unidad || 'mg',
      horas: [...m.horas],
      cadaDias: m.cadaDias || 1,
      dias: m.dias ? String(m.dias) : '',
      usoContinuo: !m.dias,
      inicio: m.inicio || hoy,
      obs: m.obs,
    });
    setEditandoId(m.id);
    setFormAbierto(true);
  };

  const agregarHora = () => {
    const h = horaInput.trim();
    if (!/^\d{1,2}:\d{2}$/.test(h)) { toast('⚠️ Elige una hora válida'); return; }
    const norm = `${String(parseInt(h.split(':')[0], 10)).padStart(2, '0')}:${h.split(':')[1]}`;
    if (f.horas.includes(norm)) { toast('⚠️ Esa hora ya está en el plan'); return; }
    if (f.horas.length >= 6) { toast('⚠️ Máximo 6 tomas al día'); return; }
    setF((p) => ({ ...p, horas: [...p.horas, norm].sort() }));
    setHoraInput('');
  };

  const quitarHora = (h: string) => setF((p) => ({ ...p, horas: p.horas.filter((x) => x !== h) }));

  const guardarTratamiento = () => {
    if (!f.nom.trim()) { toast('⚠️ Ingresa el nombre del medicamento'); return; }
    if (f.horas.length === 0) { toast('⚠️ Agrega al menos una hora (a qué horas tomas)'); return; }
    const cant = parseFloat(f.cant.replace(',', '.')) || 0;
    const dias = f.usoContinuo ? 0 : Math.max(0, parseInt(f.dias, 10) || 0);
    if (!f.usoContinuo && dias <= 0) { toast('⚠️ Ingresa cuántos días dura el tratamiento (o marca uso continuo)'); return; }
    const inicio = /^\d{4}-\d{2}-\d{2}$/.test(f.inicio) ? f.inicio : hoy;

    if (editandoId !== null) {
      const previo = est.meds.find((m) => m.id === editandoId);
      if (previo) {
        const editado: Medicamento = {
          ...previo,
          nom: f.nom.trim(),
          cant, unidad: f.unidad,
          horas: [...f.horas].sort(),
          cadaDias: Math.max(1, f.cadaDias),
          dias, inicio,
          obs: f.obs.trim(),
        };
        mutar((e) => actualizarMed(e, editado));
      }
      toast('✅ Tratamiento actualizado');
    } else {
      const nuevo: NuevoMedicamento = {
        nom: f.nom.trim(),
        cant, unidad: f.unidad,
        horas: [...f.horas].sort(),
        cadaDias: Math.max(1, f.cadaDias),
        dias, inicio,
        obs: f.obs.trim(),
        pausado: false,
        tomas: {},
      };
      mutar((e) => guardarMed(e, nuevo));
      toast('✅ Tratamiento registrado');
    }
    setFormAbierto(false);
    setEditandoId(null);
    setF({ ...FORM_VACIO, inicio: hoy });
  };

  const inputCls = 'w-full bg-slate-900/70 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-cyan-500/60 placeholder:text-slate-600';
  const labelCls = 'text-[9px] font-black text-slate-500 tracking-wider block mb-1';

  const adhColor = adh.pct >= 85 ? 'text-emerald-400' : adh.pct >= 60 ? 'text-cyan-400' : 'text-amber-400';
  const adhBar = adh.pct >= 85 ? 'bg-emerald-500' : adh.pct >= 60 ? 'bg-cyan-500' : 'bg-amber-500';

  return (
    <div className="space-y-4" data-testid="tab-salud-medicamentos">

      {/* ── HERO: próxima toma + adherencia ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-600/20 to-sky-600/10 border border-cyan-500/30" data-testid="hero-meds">
        <div className="flex items-start gap-4">
          {/* Próxima dosis */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black tracking-widest text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> PRÓXIMA TOMA
            </p>
            {prox ? (
              <>
                <p className="text-lg font-black text-white leading-tight mt-1 truncate" data-testid="proxima-nombre">
                  {prox.med.nom}{formatoDosis(prox.med) ? <span className="text-cyan-300"> {formatoDosis(prox.med)}</span> : null}
                </p>
                <p className="text-xs text-slate-300 mt-0.5" data-testid="proxima-cuando">
                  {prox.esManana ? 'mañana' : 'hoy'} a las <b className="text-white">{prox.hora}</b>
                  {!prox.esManana && <span className="text-cyan-300 font-bold"> · {cuentaAtras(prox.hora)}</span>}
                  {prox.med.horas.length > 1 && <span className="text-slate-500"> · {prox.med.horas.length} tomas/día</span>}
                </p>
                {!prox.esManana && (
                  <button
                    onClick={() => tomar(prox.med.id, prox.hora)}
                    data-testid="boton-tomar-proxima"
                    className="mt-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 text-white text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Ya lo tomé
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm font-bold text-slate-300 mt-1.5" data-testid="proxima-vacia">
                Sin tomas programadas. Registra lo que te indicó tu médico 👇
              </p>
            )}
          </div>
          {/* Adherencia 7 días */}
          <div className="text-center shrink-0 w-[86px]" data-testid="adherencia-7d">
            <p className="text-2xl font-black text-white">{adh.total > 0 ? `${adh.pct}%` : '--'}</p>
            <p className={`text-[10px] font-black ${adh.total > 0 ? adhColor : 'text-slate-500'}`}>ADHERENCIA</p>
            <p className="text-[8px] text-slate-500">últimos 7 días</p>
            {adh.total > 0 && (
              <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mt-1.5">
                <div className={`h-full rounded-full ${adhBar} transition-all`} style={{ width: `${adh.pct}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PLAN DE HOY (timeline de tomas) ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-widest text-cyan-400 flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" /> PLAN DE HOY
          </p>
          <span className="text-[10px] font-bold text-slate-500">
            {plan.filter((d) => d.estado === 'tomado').length}/{plan.length} tomadas
          </span>
        </div>

        <div className="mt-3 space-y-2" data-testid="lista-plan-hoy">
          {plan.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-3">
              Hoy no tienes tomas programadas{est.meds.length > 0 ? ' (revisa pausas y horarios)' : ''}
            </p>
          )}
          {plan.map((d) => {
            const atrasada = d.estado === null && aMinutos(d.hora) <= ahora;
            const esProxima = prox !== null && !prox.esManana && d.med.id === prox.med.id && d.hora === prox.hora;
            return (
              <div
                key={`${d.med.id}-${d.hora}`}
                data-testid={`fila-dosis-${d.med.id}-${d.hora.replace(':', '')}`}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  d.estado === 'tomado'
                    ? 'bg-emerald-500/8 border-emerald-500/25'
                    : d.estado === 'saltado'
                      ? 'bg-slate-900/50 border-slate-700/60 opacity-60'
                      : atrasada
                        ? 'bg-amber-500/8 border-amber-500/40'
                        : 'bg-slate-900/50 border-slate-700/60'
                }`}
              >
                {/* Hora */}
                <div className={`w-14 text-center shrink-0 rounded-lg py-1.5 border ${
                  d.estado === 'tomado' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : atrasada ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}>
                  <p className="text-sm font-black leading-none">{d.hora}</p>
                  {esProxima && <p className="text-[7px] font-black text-cyan-300 mt-0.5">AHORA</p>}
                  {atrasada && <p className="text-[7px] font-black text-amber-300 mt-0.5">ATRASADA</p>}
                </div>
                {/* Med */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold text-white truncate ${d.estado === 'tomado' ? 'line-through opacity-70' : ''}`}>
                    {d.med.nom}{formatoDosis(d.med) && <span className="text-slate-400 font-normal"> · {formatoDosis(d.med)}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {d.estado === 'tomado' ? '✓ tomado' : d.estado === 'saltado' ? '⏭️ saltada' : atrasada ? 'tomas apenas puedas' : cuentaAtras(d.hora)}
                    {d.med.cadaDias > 1 && ` · cada ${d.med.cadaDias} días`}
                    {d.med.obs ? ` · ${d.med.obs}` : ''}
                  </p>
                </div>
                {/* Acciones */}
                {d.estado === null ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => tomar(d.med.id, d.hora)}
                      data-testid={`boton-tomar-${d.med.id}`}
                      title="Marcar como tomado"
                      className="w-8 h-8 rounded-full border-2 border-emerald-500/60 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 flex items-center justify-center transition-all active:scale-90"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => saltar(d.med.id, d.hora)}
                      data-testid={`boton-saltar-${d.med.id}`}
                      title="Saltar esta dosis"
                      className="w-8 h-8 rounded-full border-2 border-slate-600 text-slate-400 hover:border-amber-500/60 hover:text-amber-400 flex items-center justify-center transition-all active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => deshacer(d.med.id, d.hora)}
                    data-testid={`boton-deshacer-${d.med.id}`}
                    title="Deshacer"
                    className={`w-8 h-8 rounded-lg text-xs font-black shrink-0 flex items-center justify-center transition-all ${
                      d.estado === 'tomado' ? 'text-emerald-400/70 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    ↺
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FORM NUEVO/EDITAR ── */}
      {formAbierto ? (
        <div className="p-4 rounded-2xl bg-slate-800 border border-cyan-500/40" data-testid="form-tratamiento">
          <p className="text-[10px] font-black tracking-widest text-cyan-400">
            {editandoId !== null ? '✏️ EDITAR TRATAMIENTO' : '➕ NUEVO TRATAMIENTO'}
          </p>

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 mt-3">
            <div>
              <label className={labelCls}>MEDICAMENTO *</label>
              <input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Paracetamol" data-testid="input-med-nom" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CANTIDAD</label>
              <input value={f.cant} onChange={(e) => setF({ ...f, cant: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="500" inputMode="decimal" data-testid="input-med-cant" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>UNIDAD</label>
              <select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} data-testid="select-med-unidad" className={inputCls}>
                {UNIDADES_MED.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Horarios */}
          <label className={`${labelCls} mt-3`}>A QUÉ HORAS *</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={horaInput}
              onChange={(e) => setHoraInput(e.target.value)}
              data-testid="input-med-hora"
              className={inputCls}
            />
            <button
              onClick={agregarHora}
              data-testid="boton-agregar-hora"
              className="px-4 rounded-xl bg-cyan-600 text-white font-black hover:opacity-90 active:scale-95 transition-all flex items-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2" data-testid="chips-horas">
            {f.horas.length === 0 && <p className="text-[10px] text-slate-500">Ej.: 08:00 · 14:00 · 20:00 (una por toma del día)</p>}
            {f.horas.map((h) => (
              <span key={h} data-testid={`chip-hora-${h.replace(':', '')}`} className="px-2.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-xs font-black flex items-center gap-1.5">
                ⏰ {h}
                <button onClick={() => quitarHora(h)} className="text-cyan-400/60 hover:text-cyan-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Frecuencia + duración */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div>
              <label className={labelCls}>FRECUENCIA</label>
              <select value={f.cadaDias} onChange={(e) => setF({ ...f, cadaDias: parseInt(e.target.value, 10) || 1 })} data-testid="select-med-cada" className={inputCls}>
                <option value={1}>Todos los días</option>
                <option value={2}>Cada 2 días</option>
                <option value={3}>Cada 3 días</option>
                <option value={7}>1 vez por semana</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>INICIO</label>
              <input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} data-testid="input-med-inicio" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DURACIÓN (DÍAS)</label>
              <input
                value={f.usoContinuo ? '' : f.dias}
                onChange={(e) => setF({ ...f, dias: e.target.value.replace(/[^0-9]/g, '').slice(0, 3), usoContinuo: false })}
                disabled={f.usoContinuo}
                placeholder="7"
                inputMode="numeric"
                data-testid="input-med-dias"
                className={`${inputCls} disabled:opacity-40`}
              />
            </div>
          </div>
          <button
            onClick={() => setF((p) => ({ ...p, usoContinuo: !p.usoContinuo, dias: p.usoContinuo ? p.dias : '' }))}
            data-testid="check-uso-continuo"
            className={`mt-2 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
              f.usoContinuo ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-900/60 border-slate-600 text-slate-400'
            }`}
          >
            {f.usoContinuo ? '✓ ' : ''}Uso continuo (suplemento / tratamiento permanente)
          </button>

          <input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="observaciones: 'con comida', 'indicado por Dr. Pérez'…" data-testid="input-med-obs" className={`${inputCls} mt-3`} />

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 text-slate-300 text-sm font-black hover:bg-slate-700 transition-all">
              <X className="w-4 h-4 inline" /> Cancelar
            </button>
            <button onClick={guardarTratamiento} data-testid="boton-guardar-tratamiento" className="py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
              <Check className="w-4 h-4 inline" /> {editandoId !== null ? 'Actualizar' : 'Registrar'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={abrirNuevo}
          data-testid="boton-nuevo-tratamiento"
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Registrar tratamiento
        </button>
      )}

      {/* ── TRATAMIENTOS ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-widest text-slate-400 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> TRATAMIENTOS
          </p>
          <button
            onClick={() => setVerTodos((v) => !v)}
            data-testid="boton-filtro-estado"
            className="px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-600 text-[10px] font-black text-slate-400 hover:text-slate-200 transition-all"
          >
            {verTodos ? 'VER ACTIVOS' : 'VER TODOS'}
          </button>
        </div>

        <div className="mt-3 space-y-3" data-testid="lista-tratamientos">
          {medsVisibles.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-3">
              {est.meds.length === 0 ? 'Sin tratamientos registrados' : 'Sin tratamientos en este filtro'}
            </p>
          )}
          {medsVisibles.map((m) => {
            const st = estadoMed(m);
            const chip = CHIP_ESTADO[st];
            const fin = fechaFinMed(m);
            const pendHoy = plan.find((d) => d.med.id === m.id && d.estado === null);
            return (
              <div
                key={m.id}
                data-testid={`card-tratamiento-${m.id}`}
                className={`p-3 rounded-xl bg-slate-900/50 border border-slate-700/60 ${st === 'finalizado' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st === 'finalizado' ? 'bg-slate-700/40' : 'bg-cyan-500/15'}`}>
                    <Pill className={`w-5 h-5 ${st === 'finalizado' ? 'text-slate-500' : 'text-cyan-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">
                      {m.nom}{formatoDosis(m) && <span className="text-cyan-300 font-normal"> · {formatoDosis(m)}</span>}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-black text-[9px]">{chip.txt}</span>
                      <span>
                        {m.dias > 0
                          ? `día ${diaNumTratamiento(m)} de ${m.dias}${fin ? ` · termina ${fmtFechaCorta(fin)}` : ''}`
                          : `${textoDuracion(m)} · desde ${fmtFechaCorta(m.inicio)}`}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => abrirEditar(m)} data-testid={`boton-editar-${m.id}`} title="Editar" className="w-8 h-8 rounded-lg text-slate-400/70 hover:text-cyan-300 flex items-center justify-center">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { mutar((e) => alternarPausaMed(e, m.id)); toast(m.pausado ? '▶️ Tratamiento reanudado' : '⏸️ Tratamiento pausado'); }}
                      data-testid={`boton-pausar-${m.id}`}
                      title={m.pausado ? 'Reanudar' : 'Pausar'}
                      className="w-8 h-8 rounded-lg text-slate-400/70 hover:text-amber-300 flex items-center justify-center"
                    >
                      {m.pausado ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { mutar((e) => borrarMed(e, m.id)); toast('Tratamiento eliminado'); }} data-testid={`boton-borrar-${m.id}`} title="Eliminar" className="w-8 h-8 rounded-lg text-red-400/60 hover:text-red-400 flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Horarios + toma rápida */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {m.horas.map((h) => (
                    <span key={h} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-black text-slate-300">⏰ {h}</span>
                  ))}
                  {m.cadaDias > 1 && (
                    <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-black text-amber-300">cada {m.cadaDias} días</span>
                  )}
                  {pendHoy && st === 'activo' && (
                    <button
                      onClick={() => tomar(m.id, pendHoy.hora)}
                      data-testid={`boton-tomar-rapido-${m.id}`}
                      className="ml-auto px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 transition-all"
                    >
                      ✓ Tomar {pendHoy.hora}
                    </button>
                  )}
                </div>
                {m.obs && <p className="text-[10px] text-slate-500 mt-1.5">📝 {m.obs}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AVISO: la app no es médico ── */}
      <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-2" data-testid="aviso-no-medico">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Registra <b className="text-slate-300">exactamente lo que te indicó tu médico o farmacéutico</b>: dosis, horarios y duración.
          FitTrack te recuerda y mide tu cumplimiento — <b className="text-slate-300">no receta, no cambia dosis ni reemplaza consulta médica</b>.
          Ante cualquier duda, consulta al profesional que te lo recetó.
        </p>
      </div>

      {/* Adherencia extendida */}
      {adh.total > 0 && (
        <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 flex items-center gap-4" data-testid="detalle-adherencia">
          <Trophy className={`w-8 h-8 shrink-0 ${adhColor}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white">
              Cumplimiento de los últimos 7 días: <span className={adhColor}>{adh.pct}%</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {adh.tomadas} tomadas · {adh.saltadas} saltadas · {adh.omitidas} omitidas · {adh.pendientes} por tomar
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

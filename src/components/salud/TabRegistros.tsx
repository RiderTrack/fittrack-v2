// ═══════════════════════════════════════════════════════════
// 📋 TAB REGISTROS — Salud (F10)
// Puerto del screen "Salud" del HealthTrack:
//   • Signos vitales: presión sistólica/diastólica + FC + O2
//     (el "cardio" del viejo) con validación
//   • Síntomas: chips del viejo (Dolor, Mareos, Náuseas, Fiebre,
//     Tos, Inflamación, Cansancio, Cefalea) + severidad 1-10
//   • Medicamentos: alta + check de "tomado" (entra al score)
//   • Perfil de salud: sangre, alergias, contacto de emergencia
//     (visible en el resumen para quien te atienda)
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { HeartPulse, Thermometer, Pill, Trash2, Check, UserRound, AlertTriangle } from 'lucide-react';
import {
  guardarVital, borrarVital, guardarSintoma, borrarSintoma,
  guardarMed, toggleMed, borrarMed, guardarPerfilSalud,
  SINTOMAS_CHIP, type EstadoSalud,
} from '../../services/salud';

interface TabRegistrosProps {
  est: EstadoSalud;
  mutar: (fn: (e: EstadoSalud) => EstadoSalud) => void;
  toast: (msg: string) => void;
}

export const TabRegistros: React.FC<TabRegistrosProps> = ({ est, mutar, toast }) => {
  // ── Signos vitales
  const [sis, setSis] = useState('');
  const [dia, setDia] = useState('');
  const [fc, setFc] = useState('');
  const [sat, setSat] = useState('');

  // ── Síntomas
  const [chipsOn, setChipsOn] = useState<string[]>([]);
  const [sev, setSev] = useState('5');
  const [nota, setNota] = useState('');

  // ── Medicamentos
  const [mNom, setMNom] = useState('');
  const [mDos, setMDos] = useState('');
  const [mHor, setMHor] = useState('');
  const [mFrq, setMFrq] = useState('');
  const [mObs, setMObs] = useState('');

  // ── Perfil salud
  const [pf, setPf] = useState(est.perfil);
  const [pfGuardado, setPfGuardado] = useState(false);

  const toggleChip = (txt: string) => {
    setChipsOn((prev) => (prev.includes(txt) ? prev.filter((x) => x !== txt) : [...prev, txt]));
  };

  const guardarV = () => {
    const s = parseInt(sis, 10);
    const d = parseInt(dia, 10);
    if (!s || !d) { toast('⚠️ Ingresa presión sistólica y diastólica'); return; }
    if (s < 60 || s > 250 || d < 40 || d > 150) { toast('⚠️ Presión fuera de rango razonable'); return; }
    mutar((e) => guardarVital(e, s, d, fc ? parseInt(fc, 10) : null, sat ? parseInt(sat, 10) : null));
    setSis(''); setDia(''); setFc(''); setSat('');
    toast('✅ Signos vitales guardados');
  };

  const guardarSint = () => {
    if (chipsOn.length === 0) { toast('⚠️ Selecciona al menos un síntoma'); return; }
    mutar((e) => guardarSintoma(e, chipsOn, parseInt(sev, 10) || 1, nota));
    setChipsOn([]); setNota(''); setSev('5');
    toast('✅ Síntoma registrado');
  };

  const guardarM = () => {
    if (!mNom.trim()) { toast('⚠️ Ingresa el nombre'); return; }
    mutar((e) => guardarMed(e, mNom.trim(), mDos.trim(), mHor.trim(), mFrq.trim(), mObs.trim()));
    setMNom(''); setMDos(''); setMHor(''); setMFrq(''); setMObs('');
    toast('✅ Medicamento guardado');
  };

  const guardarPerfil = () => {
    const aguaMeta = parseInt(String(pf.aguaMeta), 10) || est.perfil.aguaMeta || 2000;
    mutar((e) => guardarPerfilSalud(e, { ...pf, aguaMeta }));
    setPfGuardado(true);
    window.setTimeout(() => setPfGuardado(false), 2200);
    toast('✅ Perfil de salud guardado');
  };

  const inputCls = 'w-full bg-slate-900/70 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-blue-500/60 placeholder:text-slate-600';
  const labelCls = 'text-[9px] font-black text-slate-500 tracking-wider block mb-1';

  return (
    <div className="space-y-4" data-testid="tab-salud-registros">

      {/* ── SIGNOS VITALES ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <p className="text-[10px] font-black tracking-widest text-red-400 flex items-center gap-1.5">
          <HeartPulse className="w-3.5 h-3.5" /> SIGNOS VITALES
        </p>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div>
            <label className={labelCls}>SISTÓLICA</label>
            <input value={sis} onChange={(e) => setSis(e.target.value.replace(/[^0-9]/g, ''))} placeholder="120" inputMode="numeric" data-testid="input-sis" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DIASTÓLICA</label>
            <input value={dia} onChange={(e) => setDia(e.target.value.replace(/[^0-9]/g, ''))} placeholder="80" inputMode="numeric" data-testid="input-dia" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>FC (LPM)</label>
            <input value={fc} onChange={(e) => setFc(e.target.value.replace(/[^0-9]/g, ''))} placeholder="70" inputMode="numeric" data-testid="input-fc" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>O2 (%)</label>
            <input value={sat} onChange={(e) => setSat(e.target.value.replace(/[^0-9]/g, ''))} placeholder="98" inputMode="numeric" data-testid="input-sat" className={inputCls} />
          </div>
        </div>
        <button onClick={guardarV} data-testid="boton-guardar-vital" className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
          💓 Guardar signos
        </button>
        <div className="mt-3 space-y-2" data-testid="lista-vitales">
          {est.vitales.length === 0 && <p className="text-xs text-slate-500 text-center py-2">Sin registros</p>}
          {[...est.vitales].reverse().slice(0, 5).map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <HeartPulse className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{v.sis}/{v.dia} mmHg{v.fc ? ` · ${v.fc} lpm` : ''}</p>
                <p className="text-[10px] text-slate-500">{v.fecha}{v.sat ? ` · O2: ${v.sat}%` : ''}</p>
              </div>
              <button onClick={() => mutar((e) => borrarVital(e, v.id))} className="w-8 h-8 rounded-lg text-red-400/60 hover:text-red-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── SÍNTOMAS ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <p className="text-[10px] font-black tracking-widest text-amber-400 flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5" /> SÍNTOMAS
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3" data-testid="chips-sintomas">
          {SINTOMAS_CHIP.map((s) => {
            const on = chipsOn.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleChip(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                  on ? 'bg-amber-500/25 border-amber-500/60 text-amber-200' : 'bg-slate-900/60 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2 mt-3">
          <div>
            <label className={labelCls}>SEVERIDAD (1-10)</label>
            <input value={sev} onChange={(e) => setSev(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" data-testid="input-sev" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>NOTA (OPCIONAL)</label>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="después de entrenar pierna…" data-testid="input-nota-sintoma" className={inputCls} />
          </div>
        </div>
        <button onClick={guardarSint} data-testid="boton-guardar-sintoma" className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
          🌡️ Registrar síntoma
        </button>
        <div className="mt-3 space-y-2" data-testid="lista-sintomas">
          {est.sintomas.length === 0 && <p className="text-xs text-slate-500 text-center py-2">Sin síntomas</p>}
          {[...est.sintomas].reverse().slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Thermometer className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.nombres.join(', ')}</p>
                <p className="text-[10px] text-slate-500">{s.fecha} · Sev: {s.sev}/10{s.nota ? ` · ${s.nota}` : ''}</p>
              </div>
              <button onClick={() => mutar((e) => borrarSintoma(e, s.id))} className="w-8 h-8 rounded-lg text-red-400/60 hover:text-red-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── MEDICAMENTOS ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <p className="text-[10px] font-black tracking-widest text-cyan-400 flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5" /> MEDICAMENTOS Y SUPLEMENTOS
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className={labelCls}>NOMBRE *</label>
            <input value={mNom} onChange={(e) => setMNom(e.target.value)} placeholder="Creatina" data-testid="input-med-nom" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DOSIS</label>
            <input value={mDos} onChange={(e) => setMDos(e.target.value)} placeholder="5g" data-testid="input-med-dos" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>HORA</label>
            <input value={mHor} onChange={(e) => setMHor(e.target.value)} placeholder="08:00" data-testid="input-med-hor" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>FRECUENCIA</label>
            <input value={mFrq} onChange={(e) => setMFrq(e.target.value)} placeholder="diario" data-testid="input-med-frq" className={inputCls} />
          </div>
        </div>
        <input value={mObs} onChange={(e) => setMObs(e.target.value)} placeholder="observaciones (opcional)" data-testid="input-med-obs" className={`${inputCls} mt-2`} />
        <button onClick={guardarM} data-testid="boton-guardar-med" className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
          💊 Guardar medicamento
        </button>
        <div className="mt-3 space-y-2" data-testid="lista-meds">
          {est.meds.length === 0 && <p className="text-xs text-slate-500 text-center py-2">Sin medicamentos</p>}
          {est.meds.map((m) => (
            <div key={m.id} className={`flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/60 transition-opacity ${m.tomado ? 'opacity-55' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
                <Pill className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{m.tomado ? <s>{m.nom}</s> : m.nom}{m.dos ? <span className="text-slate-400 font-normal"> — {m.dos}</span> : null}</p>
                <p className="text-[10px] text-slate-500">{m.hor ? `⏰ ${m.hor} ` : ''}{m.frq}{m.obs ? ` · ${m.obs}` : ''}</p>
              </div>
              <button
                onClick={() => mutar((e) => toggleMed(e, m.id))}
                data-testid={`boton-tomado-${m.id}`}
                title={m.tomado ? 'Marcar como pendiente' : 'Marcar como tomado'}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  m.tomado ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10' : 'border-slate-600 text-transparent hover:border-cyan-500/60'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => mutar((e) => borrarMed(e, m.id))} className="w-8 h-8 rounded-lg text-red-400/60 hover:text-red-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── PERFIL DE SALUD ── */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700" data-testid="card-perfil-salud">
        <p className="text-[10px] font-black tracking-widest text-slate-400 flex items-center gap-1.5">
          <UserRound className="w-3.5 h-3.5" /> PERFIL DE SALUD
        </p>
        <p className="text-[10px] text-slate-500 mt-1 mb-3 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400/70" />
          Útil en emergencias: tipo de sangre, alergias y a quién llamar.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>EDAD</label>
            <input value={pf.edad} onChange={(e) => setPf({ ...pf, edad: e.target.value })} placeholder="28" inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>TIPO DE SANGRE</label>
            <select value={pf.sangre} onChange={(e) => setPf({ ...pf, sangre: e.target.value })} data-testid="select-sangre" className={inputCls}>
              <option value="">—</option>
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <input value={pf.alergias} onChange={(e) => setPf({ ...pf, alergias: e.target.value })} placeholder="alergias (penicilina, lactosa…)" data-testid="input-alergias" className={`${inputCls} mt-2`} />
        <input value={pf.emergencia} onChange={(e) => setPf({ ...pf, emergencia: e.target.value })} placeholder="contacto de emergencia (nombre y teléfono)" data-testid="input-emergencia" className={`${inputCls} mt-2`} />
        <input value={pf.seguro} onChange={(e) => setPf({ ...pf, seguro: e.target.value })} placeholder="seguro de salud (opcional)" className={`${inputCls} mt-2`} />
        <button onClick={guardarPerfil} data-testid="boton-guardar-perfil-salud" className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-slate-600 to-slate-500 text-white text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
          {pfGuardado ? '✅ Guardado' : '💾 Guardar perfil de salud'}
        </button>

        {/* Tarjeta de emergencia */}
        {(pf.sangre || pf.alergias || pf.emergencia) && (
          <div className="mt-4 p-3 rounded-xl border border-red-500/40 bg-red-500/10" data-testid="tarjeta-emergencia">
            <p className="text-[10px] font-black tracking-widest text-red-400">🚨 EN CASO DE EMERGENCIA</p>
            <div className="mt-2 text-xs text-slate-200 space-y-1">
              {pf.sangre && <p>Sangre: <b>{pf.sangre}</b></p>}
              {pf.alergias && <p>Alergias: <b>{pf.alergias}</b></p>}
              {pf.emergencia && <p>Llamar a: <b>{pf.emergencia}</b></p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

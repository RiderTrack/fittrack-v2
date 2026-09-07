// ═══════════════════════════════════════════════════════════
// 📏 MEDIDAS — FitTrack V2 (F4 · Progreso)
// Puerto React de la vista "Medidas" del viejo: peso rápido de
// hoy (actualiza o crea el registro del día), gráfica de
// evolución del peso con tendencia 7v7, formulario completo
// (talla, perímetros, grasa, músculo) con cálculos automáticos
// de IMC y el historial de medidas. Fuente: L1646-L1776 (vista)
// + registrarPesoRapido L4564 + renderGraficoPeso L4583 +
// calcularMedidas L6009 + saveMeasurements L6038 +
// renderMeasurements L6080. (Las fotos de progreso via Firebase
// Storage quedan para F6 para no tocar reglas remotas aquí.)
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useRef, useState } from 'react';
import {
  Scale, Zap, Ruler, Flame, HeartPulse, Dumbbell,
  ArrowUp, ArrowDown, ArrowRight, CheckCircle2,
} from 'lucide-react';
import type { EstadoFitTrack, MedidaCorporal } from '../types';
import { aplicarEstado, hoyISO } from '../services/storageFit';
import {
  ENTRADA_VACIA, type EntradaMedidas, analizarMedidas, aplicarPesoRapido, aplicarRegistroMedidas,
  construirRegistro, datosGraficoPeso, etiquetaIMC, etiquetaVisceral, tendenciaPeso,
} from '../services/progreso';
import { vibrar } from '../services/feedback';
import { GraficaLinea } from './GraficaLinea';

// Grid del formulario (mismos campos y placeholders del viejo, L1685-L1745)
const CAMPOS: { campo: keyof EntradaMedidas; etiqueta: string; placeholder: string; paso?: string }[] = [
  { campo: 'height', etiqueta: 'Talla (cm)', placeholder: '187', paso: '0.1' },
  { campo: 'weight', etiqueta: 'Peso (kg)', placeholder: '93', paso: '0.1' },
  { campo: 'chest', etiqueta: 'Pecho (cm)', placeholder: '115' },
  { campo: 'waist', etiqueta: 'Cintura (cm)', placeholder: '95' },
  { campo: 'arms', etiqueta: 'Brazos (cm)', placeholder: '42' },
  { campo: 'thighs', etiqueta: 'Muslos (cm)', placeholder: '65' },
  { campo: 'hips', etiqueta: 'Cadera (cm)', placeholder: '105' },
  { campo: 'bodyfat', etiqueta: 'Grasa (%)', placeholder: '18.5', paso: '0.1' },
  { campo: 'visceral', etiqueta: 'Grasa visceral', placeholder: '8', paso: '0.1' },
  { campo: 'muscle', etiqueta: 'Músculo (%)', placeholder: '45', paso: '0.1' },
];

interface MedidasViewProps {
  estado: EstadoFitTrack;
  esDemo: boolean;
  onCambio: () => void; // fuerza re-lectura de claves tras guardar
}

export const MedidasView: React.FC<MedidasViewProps> = ({ estado, esDemo, onCambio }) => {
  const [medidas, setMedidas] = useState<MedidaCorporal[]>(() => [...(estado.measurements ?? [])]);
  const [entrada, setEntrada] = useState<EntradaMedidas>(ENTRADA_VACIA);
  const [pesoRapido, setPesoRapido] = useState('');
  const [toastLocal, setToastLocal] = useState('');
  const timerToast = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const avisar = (mensaje: string) => {
    setToastLocal(mensaje);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToastLocal(''), 2500);
  };

  // Cálculos automáticos en vivo del formulario (calcularMedidas del viejo)
  const analisis = useMemo(() => analizarMedidas(entrada), [entrada]);

  // Gráfica de peso + tendencia (renderGraficoPeso del viejo)
  const grafico = useMemo(() => datosGraficoPeso(medidas), [medidas]);
  const tendencia = useMemo(() => tendenciaPeso(grafico.valores), [grafico]);

  // ── Peso rápido de hoy (registrarPesoRapido del viejo) ──
  const guardarPesoRapido = () => {
    const peso = parseFloat(pesoRapido);
    if (!peso || peso < 30 || peso > 300) {
      avisar('Ingresa un peso válido');
      return;
    }
    const hoy = hoyISO();
    if (!esDemo) {
      aplicarEstado((est) => { aplicarPesoRapido(est, peso); });
    }
    const idx = medidas.findIndex((m) => m.date === hoy);
    if (idx >= 0) {
      setMedidas((arr) => arr.map((m, i) => (i === idx ? { ...m, weight: peso } : m)));
      avisar(`Peso de hoy actualizado: ${peso.toFixed(1)} kg`);
    } else {
      setMedidas((arr) => [{ date: hoy, weight: peso, chest: 0, waist: 0, arms: 0, thighs: 0, hips: 0 }, ...arr]);
      avisar(`Peso registrado: ${peso.toFixed(1)} kg`);
    }
    setPesoRapido('');
    vibrar([100]);
    onCambio();
  };

  // ── Registrar medidas completas (saveMeasurements del viejo) ──
  const registrarMedidas = () => {
    const registro = construirRegistro(entrada);
    if (!registro) {
      avisar('El peso es obligatorio');
      return;
    }
    if (!esDemo) {
      aplicarEstado((est) => { aplicarRegistroMedidas(est, registro); });
    }
    setMedidas((arr) => [registro, ...arr]);
    setEntrada(ENTRADA_VACIA);
    vibrar([100]);
    onCambio();
    avisar('Medidas registradas correctamente');
  };

  /** Tarjeta del historial de medidas (renderMeasurements del viejo, L6094) */
  const tarjetaMedida = (m: MedidaCorporal, i: number) => (
    <div key={i} data-testid={`tarjeta-medida-${i}`} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-emerald-400">{m.date}</span>
        <span className="text-lg font-black text-white">{(m.weight ?? 0).toFixed(1)} kg</span>
      </div>

      {m.imc ? (
        <p className="text-[11px] text-slate-300 mb-2">
          IMC: <strong>{m.imc}</strong> — {etiquetaIMC(m.imc)}
        </p>
      ) : null}

      {(m.bodyfat ?? 0) > 0 || (m.visceral ?? 0) > 0 || (m.muscle ?? 0) > 0 ? (
        <div className="flex gap-3 flex-wrap text-[11px] text-slate-400 mb-2">
          {(m.bodyfat ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Grasa: <strong className="text-slate-200">{m.bodyfat}%</strong> ({(((m.weight ?? 0) * (m.bodyfat ?? 0)) / 100).toFixed(1)}kg)
            </span>
          )}
          {(m.visceral ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <HeartPulse className="w-3 h-3 text-red-400" />
              Visceral: <strong className="text-slate-200">{m.visceral}</strong>
            </span>
          )}
          {(m.muscle ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Dumbbell className="w-3 h-3 text-emerald-400" />
              Músculo: <strong className="text-slate-200">{m.muscle}%</strong> ({(((m.weight ?? 0) * (m.muscle ?? 0)) / 100).toFixed(1)}kg)
            </span>
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        {[
          m.chest ? `Pecho: ${m.chest}cm` : '',
          m.waist ? `Cintura: ${m.waist}cm` : '',
          m.arms ? `Brazos: ${m.arms}cm` : '',
          m.thighs ? `Muslos: ${m.thighs}cm` : '',
          m.hips ? `Cadera: ${m.hips}cm` : '',
        ].filter(Boolean).join(' · ')}
      </p>
    </div>
  );

  const clasesInput = 'w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2.5 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60';

  return (
    <div className="space-y-4 pb-4">
      {/* ── Peso rápido de hoy ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4" data-testid="card-peso-rapido">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <Zap className="w-4 h-4 text-amber-400" /> Peso rápido de hoy
          </span>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={pesoRapido}
              onChange={(e) => setPesoRapido(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') guardarPesoRapido(); }}
              placeholder="kg"
              data-testid="input-peso-rapido"
              className="w-20 rounded-xl bg-slate-800/70 border border-slate-700 px-2 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60"
            />
            <button
              onClick={guardarPesoRapido}
              data-testid="boton-peso-rapido"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-[0.98]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* ── Evolución del peso (renderGraficoPeso del viejo) ── */}
      {grafico.valores.length >= 2 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4" data-testid="card-grafica-peso">
          <div className="flex justify-between items-center mb-2">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <Scale className="w-4 h-4 text-teal-400" /> Evolución del peso
            </span>
            {tendencia && (
              <span
                className={`flex items-center gap-1 text-[11px] font-bold ${
                  tendencia.tipo === 'baja' ? 'text-emerald-400' : tendencia.tipo === 'sube' ? 'text-amber-400' : 'text-slate-400'
                }`}
                data-testid="tendencia-peso"
              >
                {tendencia.tipo === 'baja' ? <ArrowDown className="w-3.5 h-3.5" /> : tendencia.tipo === 'sube' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                {tendencia.tipo === 'estable' ? 'Estable' : `${tendencia.kg.toFixed(1)} kg (tendencia)`}
              </span>
            )}
          </div>
          <GraficaLinea etiquetas={grafico.etiquetas} valores={grafico.valores} unidad="kg" color="teal" />
        </div>
      )}

      {/* ── Formulario completo (measure-grid del viejo) ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Registrar medidas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {CAMPOS.map(({ campo, etiqueta, placeholder, paso }) => (
            <div key={campo} className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-3 py-2">
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5" htmlFor={`medida-${campo}`}>
                {etiqueta}
              </label>
              <input
                id={`medida-${campo}`}
                type="number"
                step={paso}
                inputMode="decimal"
                value={entrada[campo]}
                onChange={(e) => setEntrada((en) => ({ ...en, [campo]: e.target.value }))}
                placeholder={placeholder}
                data-testid={`input-medida-${campo}`}
                className={clasesInput}
              />
            </div>
          ))}
        </div>

        {/* Cálculos automáticos (medidas-calculos del viejo) */}
        {analisis.imc != null && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3" data-testid="calculos-medidas">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-2.5">Cálculos automáticos</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <p className="text-[11px] text-slate-500">IMC</p>
                <p className="text-base font-black text-white">{analisis.imc.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">{analisis.imcEtiqueta}</p>
              </div>
              {analisis.pesoGrasa != null && (
                <div>
                  <p className="text-[11px] text-slate-500">Peso en grasa</p>
                  <p className="text-base font-black text-white">{analisis.pesoGrasa.toFixed(1)} kg</p>
                </div>
              )}
              {analisis.pesoMuscular != null && (
                <div>
                  <p className="text-[11px] text-slate-500">Peso muscular</p>
                  <p className="text-base font-black text-white">{analisis.pesoMuscular.toFixed(1)} kg</p>
                </div>
              )}
              {analisis.visceralEtiqueta != null && (
                <div>
                  <p className="text-[11px] text-slate-500">Grasa visceral</p>
                  <p className="text-base font-black text-white">{entrada.visceral} — {analisis.visceralEtiqueta}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={registrarMedidas}
          data-testid="boton-registrar-medidas"
          className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-[0.99]"
        >
          Registrar Medidas
        </button>
      </div>

      {/* ── Historial de medidas ── */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-bold text-white">Historial de Medidas</span>
          <span className="text-[11px] text-slate-500">({medidas.length})</span>
        </div>
        {medidas.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center">
            <p className="text-xs text-slate-400">Sin medidas guardadas aún.</p>
            <p className="text-[11px] text-slate-500 mt-1.5">Empieza con el peso rápido de arriba.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {medidas.map((m, i) => tarjetaMedida(m, i))}
          </div>
        )}
      </div>

      {/* Toast local */}
      {toastLocal && (
        <div
          data-testid="toast-medidas"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap"
        >
          {toastLocal}
        </div>
      )}
    </div>
  );
};

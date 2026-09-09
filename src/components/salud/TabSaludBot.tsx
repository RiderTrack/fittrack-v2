// ═══════════════════════════════════════════════════════════
// 🤖 SALUDBOT — FitTrack V2 (F10.1)
// El chat de salud del HealthTrack: asistente de bienestar con
// el contexto REAL del usuario (agua, sueño, tratamientos con
// horarios, síntomas, presión). Usa la MISMA clave IA del
// perfil que el robot de entrenamiento (FITTRACK_ANTHROPIC_KEY
// — nunca hardcodeada).
// F10.1: ya NO es pestaña del módulo Salud — vive junto a los
// robots (☰ → 🤖 ROBOTS · IA) en su propia vista
// (SaludBotView.tsx, que es la que persiste).
// Cuando la respuesta parece un medicamento, ofrece guardarlo
// como tratamiento (el usuario completa horarios/días).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Pill, Check, X, KeyRound } from 'lucide-react';
import { chatSaludBot, pareceMedicamento } from '../../services/saludIa';
import type { EstadoSalud, NuevoMedicamento } from '../../services/salud';
import { hoySalud } from '../../services/salud';
import { leerKeyClaude, type MensajeIA } from '../../services/claude';

interface InterfazMensaje {
  role: 'user' | 'assistant';
  content: string;
  idMed?: boolean;      // muestra el bloque "¿guardar medicamento?"
  medGuardado?: boolean;
}

interface TabSaludBotProps {
  est: EstadoSalud;
  /** guarda el tratamiento detectado en el chat (lo persiste la vista) */
  onGuardarMed: (med: NuevoMedicamento) => void;
}

const SUGERENCIAS = [
  '¿Qué suplemento me conviene para ganar masa muscular?',
  'Tips para dormir mejor entrenando en la noche',
  '¿Cuánta agua debo tomar si entreno 1 hora?',
  '¿La creatina me hace daño al riñón?',
];

export const TabSaludBot: React.FC<TabSaludBotProps> = ({ est, onGuardarMed }) => {
  const [mensajes, setMensajes] = useState<InterfazMensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const tieneKey = Boolean(leerKeyClaude());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, cargando]);

  const enviar = async (contenido?: string) => {
    const msg = (contenido ?? texto).trim();
    if (!msg || cargando) return;
    setTexto('');
    const historial: MensajeIA[] = [
      ...mensajes.filter((m) => !m.idMed).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: msg },
    ];
    setMensajes((prev) => [...prev, { role: 'user', content: msg }]);
    setCargando(true);

    const r = await chatSaludBot(historial, est);
    setCargando(false);
    if (r.error) {
      setMensajes((prev) => [...prev, { role: 'assistant', content: `⚠️ ${r.error}` }]);
      return;
    }
    const esMed = pareceMedicamento(r.texto);
    setMensajes((prev) => [...prev, { role: 'assistant', content: r.texto, idMed: esMed }]);
  };

  const guardarDesdeBot = (i: number) => {
    // Extrae nombre/dosis de la respuesta (heurística simple:
    // primera línea con mg/g o el nombre tras "tomar")
    const m = mensajes[i];
    if (!m) return;
    const lineaMed = m.content.split('\n').find((l) => /\d+\s*(mg|g|ml|iu)/i.test(l)) ?? m.content.split('\n')[0] ?? 'Medicamento';
    const nombre = lineaMed.replace(/[*•\-\d.]+\s*/g, ' ').trim().slice(0, 60) || 'Medicamento';
    const dosMatch = lineaMed.match(/(\d+(?:[\.,]\d+)?)\s*(mg|g|ml|iu|µg)/i);
    const med: NuevoMedicamento = {
      nom: nombre,
      cant: dosMatch ? parseFloat(dosMatch[1].replace(',', '.')) : 0,
      unidad: dosMatch ? dosMatch[2].toLowerCase() : '',
      horas: ['08:00'],
      cadaDias: 1,
      inicio: hoySalud(),
      dias: 0,
      obs: 'Guardado desde SaludBot · completa horarios y duración',
      pausado: false,
      tomas: {},
    };
    onGuardarMed(med);
    setMensajes((prev) => prev.map((x, n) => (n === i ? { ...x, medGuardado: true } : x)));
  };

  const renderTexto = (t: string) => {
    const html = t
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br>') }} />;
  };

  return (
    <div className="flex flex-col rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden" data-testid="saludbot-view">
      {/* Header del chat */}
      <div className="p-4 border-b border-slate-700/60 bg-gradient-to-r from-emerald-600/15 to-cyan-600/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">SaludBot</p>
            <p className="text-[10px] text-slate-400">Suplementos · nutrición · sueño · hidratación — con tus datos de hoy</p>
          </div>
        </div>
      </div>

      {/* Aviso de clave */}
      {!tieneKey && (
        <div className="m-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-2" data-testid="aviso-clave-ia">
          <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Falta tu <b>clave IA de Anthropic</b>. Configúrala una sola vez en
            <b> Mi Perfil → Robot IA · Claude</b> — vive solo en tu teléfono y es la misma
            que usa el robot de entrenamiento.
          </p>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[52vh] custom-scrollbar" data-testid="chat-saludbot">
        {mensajes.length === 0 && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-xl ft-pulso">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-300 mt-3">Preguntale lo que quieras 🩺</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => void enviar(s)}
                  data-testid="chip-sugerencia-saludbot"
                  className="px-3 py-1.5 rounded-full border border-slate-600 bg-slate-900/60 text-[11px] font-bold text-slate-300 hover:border-emerald-500/60 hover:text-emerald-300 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-cyan-600/90 text-white rounded-br-md'
                    : 'bg-slate-900/80 border border-slate-700 text-slate-200 rounded-bl-md'
                }`}
                data-testid={`msg-saludbot-${m.role}`}
              >
                {m.role === 'user' ? m.content : renderTexto(m.content)}
              </div>
            </div>

            {/* Bloque guardar medicamento (patrón del viejo) */}
            {m.idMed && !m.medGuardado && m.role === 'assistant' && (
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2" data-testid="bloque-guardar-med">
                <Pill className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="flex-1 text-[11px] text-emerald-300 font-bold">¿Guardar como tratamiento? (completa horarios en Medicamentos)</p>
                <button
                  onClick={() => guardarDesdeBot(i)}
                  data-testid="boton-guardar-med-bot"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-black hover:bg-emerald-500/30 transition-all flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Sí
                </button>
                <button
                  onClick={() => setMensajes((prev) => prev.map((x, n) => (n === i ? { ...x, medGuardado: true } : x)))}
                  className="px-2 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-[11px] font-black hover:text-slate-200 transition-all flex items-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {m.medGuardado && (
              <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Guardado en Medicamentos — ajusta horarios y duración
              </p>
            )}
          </div>
        ))}

        {cargando && (
          <div className="flex items-center gap-2 text-slate-400" data-testid="saludbot-cargando">
            <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-pulse text-emerald-400" />
            </div>
            <span className="text-xs font-bold animate-pulse">Consultando a SaludBot…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700/60 flex gap-2 bg-slate-900/40">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
          placeholder="Pregúntale sobre salud, suplementos…"
          data-testid="input-saludbot"
          className="flex-1 bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white font-bold placeholder:text-slate-600 outline-none focus:border-emerald-500/60"
        />
        <button
          onClick={() => void enviar()}
          disabled={cargando || !texto.trim()}
          data-testid="boton-enviar-saludbot"
          className="px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="px-3 pb-2 text-[9px] text-slate-600 text-center flex items-center justify-center gap-1">
        <User className="w-2.5 h-2.5" /> SaludBot no reemplaza consulta médica
      </p>
    </div>
  );
};

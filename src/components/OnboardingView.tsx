// ═══════════════════════════════════════════════════════════
// 🚀 ONBOARDING — FitTrack V2 (F1 · Acceso)
// Une los DOS onboardings del app vieja en un solo arranque:
//   Etapa 0: nombre (onboarding morado → FITTRACK_NOMBRE)
//   Etapas 1-4: wizard de perfil (objetivo/nivel/días/equipo,
//   exactamente las 4 preguntas y valores del viejo →
//   FITTRACK_PERFIL_COMPLETO con la misma estructura).
// El guardado lo decide App (cuenta real vs demo) vía callback.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Dumbbell, ArrowLeft, ArrowRight, Sparkles, SkipForward } from 'lucide-react';
import type { PerfilEntreno, RespuestaOnboarding } from '../types';
import { hoyISO } from '../services/storageFit';

interface OnboardingViewProps {
  nombreInicial: string;
  onFinalizar: (respuesta: RespuestaOnboarding) => void;
}

// Opciones EXACTAS del wizard del app viejo (mismos valores guardados)
const OPCIONES = {
  objetivo: [
    { valor: 'hipertrofia', etiqueta: 'Ganar músculo', detalle: 'Volumen e hipertrofia' },
    { valor: 'fuerza', etiqueta: 'Fuerza pura', detalle: 'Cargas máximas' },
    { valor: 'potencia', etiqueta: 'Potencia', detalle: 'Explosividad' },
    { valor: 'descarga', etiqueta: 'Retomar suave', detalle: 'Volver al gym sin achicarse' },
  ],
  nivel: [
    { valor: 'principiante', etiqueta: 'Principiante', detalle: 'Menos de 1 año' },
    { valor: 'intermedio', etiqueta: 'Intermedio', detalle: '1 a 2 años' },
    { valor: 'avanzado', etiqueta: 'Avanzado', detalle: 'Más de 2 años' },
  ],
  dias: [
    { valor: 2, etiqueta: '2 días', detalle: 'Semana ligera' },
    { valor: 3, etiqueta: '3 días', detalle: 'Clásico' },
    { valor: 4, etiqueta: '4 días', detalle: 'Serio' },
    { valor: 5, etiqueta: '5 días', detalle: 'Full compromiso' },
  ],
  equipo: [
    { valor: 'gym-completo', etiqueta: 'Gym completo', detalle: 'Máquinas y barras' },
    { valor: 'gym-pequeno', etiqueta: 'Gym pequeño', detalle: 'Lo esencial' },
    { valor: 'casa', etiqueta: 'En casa', detalle: 'Equipo casero' },
    { valor: 'peso-corporal', etiqueta: 'Peso corporal', detalle: 'Sin equipo' },
  ],
} as const;

const PREGUNTAS = [
  { titulo: '¿Cuál es tu objetivo principal?', sub: 'Define cómo se arman tus rutinas', clave: 'objetivo' },
  { titulo: '¿Cuál es tu experiencia con fuerza?', sub: 'Ajusta la dificultad de los ejercicios', clave: 'nivel' },
  { titulo: '¿Cuántos días por semana entrenas?', sub: 'Tu semana perfecta de gym', clave: 'dias' },
  { titulo: '¿Dónde entrenas?', sub: 'El equipo disponible manda', clave: 'equipo' },
] as const;

export const OnboardingView: React.FC<OnboardingViewProps> = ({ nombreInicial, onFinalizar }) => {
  const [paso, setPaso] = useState(0); // 0 = nombre, 1-4 = wizard, 5 = listo
  const [nombre, setNombre] = useState(nombreInicial);
  const [respuestas, setRespuestas] = useState<Record<string, string | number>>({});
  const [error, setError] = useState('');

  const totalPasos = 5;
  const progreso = Math.round((paso / totalPasos) * 100);

  const elegir = (clave: string, valor: string | number) => {
    setRespuestas((r) => ({ ...r, [clave]: valor }));
  };

  const siguiente = () => {
    if (paso === 0) {
      if (!nombre.trim()) {
        setError('Escribe tu nombre (o cómo quieres que te llamemos)');
        return;
      }
      setError('');
      setPaso(1);
      return;
    }
    if (paso >= 1 && paso <= 4) {
      const clave = PREGUNTAS[paso - 1].clave as string;
      if (respuestas[clave] === undefined) {
        setError('Elige una opción para continuar');
        return;
      }
      setError('');
      setPaso(paso + 1);
      return;
    }
  };

  const atras = () => {
    setError('');
    setPaso((p) => Math.max(0, p - 1));
  };

  const finalizar = () => {
    const perfil: PerfilEntreno | null =
      respuestas['objetivo'] !== undefined && respuestas['nivel'] !== undefined &&
      respuestas['dias'] !== undefined && respuestas['equipo'] !== undefined
        ? {
            objetivo: String(respuestas['objetivo']),
            nivel: String(respuestas['nivel']),
            dias: Number(respuestas['dias']),
            equipo: String(respuestas['equipo']),
            fecha: hoyISO(),
          }
        : null;
    onFinalizar({ nombre: nombre.trim(), perfil });
  };

  const saltarPerfil = () => {
    onFinalizar({ nombre: nombre.trim(), perfil: null });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-slate-950 to-teal-900/20" />

      <div className="relative w-full max-w-md py-6">
        {/* Logo + progreso */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white leading-tight">Configura tu FitTrack</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 shrink-0">
            {paso}/{totalPasos}
          </span>
        </div>

        {/* Tarjeta */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          {/* ── Paso 0: nombre (onboarding morado del viejo) ── */}
          {paso === 0 && (
            <div>
              <h2 className="text-lg font-bold text-white">¿Cómo te llamamos?</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                El nombre que verás en tu saludo cada día.
              </p>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={30}
                autoFocus
                placeholder="Tu nombre"
                data-testid="input-nombre"
                className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && siguiente()}
              />
            </div>
          )}

          {/* ── Pasos 1-4: wizard de perfil (preguntas del viejo) ── */}
          {paso >= 1 && paso <= 4 && (
            <div>
              <h2 className="text-lg font-bold text-white leading-snug">{PREGUNTAS[paso - 1].titulo}</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">{PREGUNTAS[paso - 1].sub}</p>
              <div className="grid gap-2.5">
                {OPCIONES[PREGUNTAS[paso - 1].clave as keyof typeof OPCIONES].map((op) => {
                  const activo = respuestas[PREGUNTAS[paso - 1].clave as string] === op.valor;
                  return (
                    <button
                      key={String(op.valor)}
                      onClick={() => elegir(PREGUNTAS[paso - 1].clave as string, op.valor)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                        activo
                          ? 'border-emerald-500/70 bg-emerald-500/10'
                          : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500/60'
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">{op.etiqueta}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{op.detalle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Paso 5: listo ── */}
          {paso === 5 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-xl ft-pulso">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black text-white">¡Listo, {nombre.split(' ')[0]}!</h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {respuestas['objetivo'] !== undefined ? (
                  <>
                    Perfil guardado:{' '}
                    <span className="text-emerald-400 font-bold">
                      {OPCIONES.objetivo.find((o) => o.valor === respuestas['objetivo'])?.etiqueta}
                    </span>{' '}
                    · {String(respuestas['dias'])} días/semana. Tus rutinas aterrizan en F2.
                  </>
                ) : (
                  'Puedes configurar tu perfil de entrenamiento cuando quieras desde Mi Perfil.'
                )}
              </p>
            </div>
          )}

          {/* Error de validación */}
          {error && (
            <div className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="mt-6 flex items-center gap-3">
            {paso > 0 && (
              <button
                onClick={atras}
                className="w-10 h-10 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 transition-all shrink-0"
                title="Atrás"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {paso < 5 ? (
              <button
                onClick={siguiente}
                data-testid="boton-continuar"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 siempre-blanco font-bold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.98] shadow-lg"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finalizar}
                data-testid="boton-finalizar"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 siempre-blanco font-bold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.98] shadow-lg"
              >
                Empezar a entrenar
              </button>
            )}
          </div>

          {/* Saltar el wizard (el perfil era opcional en el viejo) */}
          {paso >= 1 && paso <= 4 && (
            <button
              onClick={saltarPerfil}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Lo configuro después
            </button>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-emerald-400/70 tracking-wider mt-5">
          FASE 1 · ACCESO · ONBOARDING
        </p>
      </div>
    </div>
  );
};

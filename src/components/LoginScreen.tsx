// ═══════════════════════════════════════════════════════════
// 📱 LOGIN SCREEN — FitTrack V2 (F0: "login vacío")
// Vista visual clonada del estilo de RiderTrack V2 (mismo layout
// de tarjeta centrada, logo con gradiente y botón Google).
// En F0 el botón NO llama a Firebase: muestra el aviso de que
// el acceso real se cablea en F1. Así se verifica el hito del
// plan sin riesgo de tocar OAuth antes de tiempo.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Dumbbell, Info } from 'lucide-react';

interface LoginScreenProps {
  onVerEsqueleto?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onVerEsqueleto }) => {
  const [info, setInfo] = useState('');

  const handleGoogle = () => {
    setInfo('Fase 0 — el acceso con Google se conecta en F1. Esta pantalla es la maqueta visual.');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Fondo con gradiente (mismo patrón RiderTrack, acento fitness) */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-slate-950 to-teal-900/20" />

      {/* Contenedor del login */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-2xl">
            <Dumbbell className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">FitTrack</h1>
          <p className="text-slate-400 text-sm">Tu entrenamiento, ahora modular</p>
        </div>

        {/* Tarjeta */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white">Bienvenido, campeón</h2>
            <p className="text-xs text-slate-400 mt-1">
              Misma cuenta Google, mismos datos del FitTrack actual
            </p>
          </div>

          {/* Botón Google */}
          <button
            onClick={handleGoogle}
            data-testid="boton-google-f0"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98] shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>

          {/* Aviso F0 */}
          {info && (
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Modo demo: ver el esqueleto sin sesión (verificación F0) */}
          <button
            onClick={onVerEsqueleto}
            data-testid="boton-demo-f0"
            className="mt-4 w-full text-center text-xs text-slate-400 hover:text-emerald-300 transition-colors"
          >
            Ver el esqueleto (demo) →
          </button>

          {/* Pie */}
          <div className="mt-6 pt-4 border-t border-slate-700/50 text-center">
            <span className="text-[10px] font-mono text-emerald-400/70 tracking-wider">
              V2.0 · FASE 0 · FUNDACIÓN
            </span>
          </div>
        </div>

        {/* Nota de datos */}
        <p className="text-center text-[11px] text-slate-500 mt-4 leading-relaxed max-w-xs mx-auto">
          Los datos de tus rutinas y medidas viven en este dispositivo y se
          conservan al actualizar: misma app, mismo origen.
        </p>
      </div>
    </div>
  );
};

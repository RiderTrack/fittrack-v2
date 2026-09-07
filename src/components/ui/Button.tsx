// ═══════════════════════════════════════════════════════════
// 🔘 BUTTON — FitTrack V2 (F0)
// Botón reutilizable base (mismo espíritu que components/ui
// de RiderTrack V2). Variantes: primary (gradiente esmeralda),
// outline y ghost. A partir de F1 todas las vistas lo usan.
// ═══════════════════════════════════════════════════════════

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  cargando?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:scale-[0.98] select-none';

const VARIANTES: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/30 ' +
    'hover:from-emerald-400 hover:to-teal-500 hover:shadow-emerald-900/50',
  outline:
    'border border-slate-600 text-slate-200 hover:border-emerald-500/60 hover:text-white ' +
    'hover:bg-emerald-500/10',
  ghost:
    'text-slate-300 hover:text-white hover:bg-slate-800',
};

const TAMANOS: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  cargando = false,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  return (
    <button
      className={`${BASE} ${VARIANTES[variant]} ${TAMANOS[size]} ${className}`}
      disabled={disabled || cargando}
      {...rest}
    >
      {cargando && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

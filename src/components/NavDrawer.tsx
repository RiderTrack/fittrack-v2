// ═══════════════════════════════════════════════════════════
// ☰ NAV DRAWER (MENÚ HAMBURGUESA) — FitTrack V2 (F10)
// La app creció (12 pantallas + el módulo Salud del HealthTrack):
// la barra inferior ya no daba para más. Este cajón lateral
// agrupa TODO el FitTrack en secciones, como pediste:
//   Inicio · Entreno · Progreso · Salud · Medios · Chat · Cuenta
// Se abre con el ☰ del header (y con el logo), se cierra con
// backdrop, X, ESC o al elegir. El badge de GymChat vive aquí
// (usa el mismo MediosFitProvider). La barra inferior queda
// REDUCIDA a los 5 destinos de uso diario.
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import {
  LayoutDashboard, CalendarCheck, CalendarRange, BookOpen, Bot, History,
  Ruler, TrendingUp, HeartPulse, Music, MessageCircle, UserRound, Settings,
  Dumbbell as LogoIcon, X,
} from 'lucide-react';
import type { VistaApp } from '../types';
import { useMediosFit } from './medios/MediosFitProvider';
import { versionApp } from '../services/platform';

interface ItemNav {
  vista: VistaApp;
  nombre: string;
  icono: React.ReactNode;
}

interface GrupoNav {
  titulo: string;
  items: ItemNav[];
  acento: string; // color del título del grupo
}

const GRUPOS: GrupoNav[] = [
  {
    titulo: 'INICIO',
    acento: 'text-slate-400',
    items: [{ vista: 'dashboard', nombre: 'Dashboard', icono: <LayoutDashboard className="w-4 h-4" /> }],
  },
  {
    titulo: 'ENTRENO',
    acento: 'text-emerald-400',
    items: [
      { vista: 'hoy', nombre: 'Entreno de Hoy', icono: <CalendarCheck className="w-4 h-4" /> },
      { vista: 'rutina', nombre: 'Mi Semana', icono: <CalendarRange className="w-4 h-4" /> },
      { vista: 'ejercicios', nombre: 'Biblioteca', icono: <BookOpen className="w-4 h-4" /> },
      { vista: 'fitbot', nombre: 'FitBot · 225 ejercicios', icono: <Bot className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'PROGRESO',
    acento: 'text-teal-400',
    items: [
      { vista: 'historial', nombre: 'Historial', icono: <History className="w-4 h-4" /> },
      { vista: 'medidas', nombre: 'Medidas', icono: <Ruler className="w-4 h-4" /> },
      { vista: 'estadisticas', nombre: 'Estadísticas', icono: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'SALUD',
    acento: 'text-cyan-400',
    items: [
      { vista: 'salud', nombre: 'Salud · HealthTrack', icono: <HeartPulse className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'MEDIOS',
    acento: 'text-violet-400',
    items: [{ vista: 'medios', nombre: 'Spotify · Radio · YT · Podcasts', icono: <Music className="w-4 h-4" /> }],
  },
  {
    titulo: 'CHAT',
    acento: 'text-blue-400',
    items: [{ vista: 'chat', nombre: 'GymChat', icono: <MessageCircle className="w-4 h-4" /> }],
  },
  {
    titulo: 'CUENTA',
    acento: 'text-slate-400',
    items: [
      { vista: 'perfil', nombre: 'Mi Perfil', icono: <UserRound className="w-4 h-4" /> },
      { vista: 'config', nombre: 'Ajustes', icono: <Settings className="w-4 h-4" /> },
    ],
  },
];

interface NavDrawerProps {
  abierto: boolean;
  vista: VistaApp;
  onCerrar: () => void;
  onIr: (v: VistaApp) => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ abierto, vista, onCerrar, onIr }) => {
  // ESC cierra el cajón
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  // No leídos de GymChat (mismo provider del badge de la barra)
  const m = useMediosFit();
  const noLeidos = m.chatNoLeidos;

  const ir = (v: VistaApp) => {
    onIr(v);
    onCerrar();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCerrar}
        data-testid="drawer-backdrop"
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[85vw] bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col transition-transform duration-300 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="nav-drawer"
        role="dialog"
        aria-label="Menú principal"
      >
        {/* Cabecera del cajón */}
        <div className="p-4 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <LogoIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white leading-tight">FitTrack V2</p>
            <p className="text-[10px] font-mono text-emerald-400">{versionApp()}</p>
          </div>
          <button
            onClick={onCerrar}
            data-testid="boton-cerrar-drawer"
            title="Cerrar menú"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-emerald-500/60 flex items-center justify-center transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grupos */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className={`text-[9px] font-black tracking-[0.18em] px-2 mb-1.5 ${g.acento}`}>{g.titulo}</p>
              <div className="space-y-0.5">
                {g.items.map(({ vista: v, nombre, icono }) => {
                  const activa = v === vista || (v === 'hoy' && (vista === 'rutina' || vista === 'ejercicios')) || (v === 'historial' && (vista === 'medidas' || vista === 'estadisticas'));
                  return (
                    <button
                      key={v}
                      onClick={() => ir(v)}
                      data-testid={`drawer-${v}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                        activa
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                          : 'border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="shrink-0">{icono}</span>
                      <span className="flex-1 text-left truncate">{nombre}</span>
                      {v === 'chat' && noLeidos > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {noLeidos > 99 ? '99+' : noLeidos}
                        </span>
                      )}
                      {v === 'salud' && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shrink-0">
                          NUEVO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie */}
        <div className="p-4 border-t border-slate-700/60">
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Todo tu fitness y salud en un solo lugar 💪🩺
          </p>
        </div>
      </aside>
    </>
  );
};

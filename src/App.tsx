// ═══════════════════════════════════════════════════════════
// 🚀 APP — FitTrack V2 (F0 · FUNDACIÓN)
// Arquitectura gemela de RiderTrack V2:
//   • Cerca de auth: onAuthChange decide login vs shell
//   • Navegación por vista activa (activeView) — sin router
//   • Tema claro/oscuro con la clase .light en <html>
//   • ErrorBoundary por vista a partir de F1
// En F0 el login no llama a OAuth: es la maqueta del plan. El
// link "Ver el esqueleto" abre el shell en modo demo para que
// la fundación se pueda verificar en el APK sin esperar a F1.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, CalendarCheck, ClipboardList, Dumbbell, History, Ruler,
  Bot, MessageCircle, Music, Radio, Settings, User, Dumbbell as LogoIcon,
  Sun, Moon, LogOut, Rocket,
} from 'lucide-react';
import type { User as UsuarioFirebase } from 'firebase/auth';
import { onAuthChange, cerrarSesion } from './services/firebase';
import { nombrePlataforma, versionApp } from './services/platform';
import { CLAVE_TEMA, VistaApp } from './types';
import { LoginScreen } from './components/LoginScreen';

// Roadmap oficial del plan de migración (tabla del informe):
// cada vista del app viejo con la fase en que aterriza en la v2.
const ROADMAP: { vista: VistaApp; nombre: string; fase: string; icono: React.ReactNode }[] = [
  { vista: 'dashboard', nombre: 'Dashboard', fase: 'F1', icono: <LayoutDashboard className="w-5 h-5" /> },
  { vista: 'perfil', nombre: 'Mi Perfil', fase: 'F1', icono: <User className="w-5 h-5" /> },
  { vista: 'hoy', nombre: 'Entreno de Hoy', fase: 'F2', icono: <CalendarCheck className="w-5 h-5" /> },
  { vista: 'rutina', nombre: 'Editor de Rutinas', fase: 'F2', icono: <ClipboardList className="w-5 h-5" /> },
  { vista: 'ejercicios', nombre: 'Ejercicios', fase: 'F2', icono: <Dumbbell className="w-5 h-5" /> },
  { vista: 'historial', nombre: 'Historial', fase: 'F3', icono: <History className="w-5 h-5" /> },
  { vista: 'medidas', nombre: 'Medidas Corporales', fase: 'F3', icono: <Ruler className="w-5 h-5" /> },
  { vista: 'fitbot', nombre: 'FitBot IA', fase: 'F4', icono: <Bot className="w-5 h-5" /> },
  { vista: 'gymchat', nombre: 'GymChat', fase: 'F4', icono: <MessageCircle className="w-5 h-5" /> },
  { vista: 'spotify', nombre: 'Spotify', fase: 'F4', icono: <Music className="w-5 h-5" /> },
  { vista: 'radio', nombre: 'Radio Peruana', fase: 'F4', icono: <Radio className="w-5 h-5" /> },
  { vista: 'config', nombre: 'Configuración', fase: 'F5', icono: <Settings className="w-5 h-5" /> },
];

const ETIQUETA_FASE: Record<string, string> = {
  F1: 'F1 · Acceso',
  F2: 'F2 · Entreno',
  F3: 'F3 · Progreso',
  F4: 'F4 · Extras',
  F5: 'F5 · Empaquetado',
};

export default function App() {
  const [usuario, setUsuario] = useState<UsuarioFirebase | null>(null);
  const [cargando, setCargando] = useState(true);
  const [demo, setDemo] = useState(false);
  const [temaClaro, setTemaClaro] = useState(false);

  // Cerca de auth: si una sesión viva existe, entra directo al shell.
  useEffect(() => {
    const desuscribir = onAuthChange((u) => {
      setUsuario(u);
      setCargando(false);
    });
    return desuscribir;
  }, []);

  // Tema claro/oscuro persistido (clave nueva FT2_, sin tocar las viejas)
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_TEMA);
      if (guardado === 'claro') setTemaClaro(true);
    } catch { /* sin storage */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', temaClaro);
    try {
      localStorage.setItem(CLAVE_TEMA, temaClaro ? 'claro' : 'oscuro');
    } catch { /* sin storage */ }
  }, [temaClaro]);

  const toggleTema = () => setTemaClaro((t) => !t);

  // ── Cargando: mini splash ──
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl ft-pulso">
          <LogoIcon className="w-8 h-8 text-white" />
        </div>
        <p className="text-slate-400 text-sm font-mono">FitTrack V2 · F0</p>
      </div>
    );
  }

  // ── Sin sesión: login vacío (maqueta F0) ──
  if (!usuario && !demo) {
    return <LoginScreen onVerEsqueleto={() => setDemo(true)} />;
  }

  // ── Shell (demo F0 o sesión real a partir de F1) ──
  return (
    <div className="min-h-screen bg-slate-950 custom-scrollbar">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <LogoIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white leading-tight">FitTrack V2</h1>
            <p className="text-[11px] text-slate-400 leading-tight truncate">
              {demo ? 'Modo demo · sin sesión' : (usuario?.displayName || usuario?.email || 'Campeón')}
              {' · '}
              {nombrePlataforma()}
            </p>
          </div>
          <span
            data-testid="badge-fase-0"
            className="ml-auto text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0"
          >
            F0 · FUNDACIÓN
          </span>
          <button
            onClick={toggleTema}
            data-testid="boton-tema"
            title="Cambiar tema"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all shrink-0"
          >
            {temaClaro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {!demo && (
            <button
              onClick={() => cerrarSesion()}
              title="Cerrar sesión"
              className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          {demo && (
            <button
              onClick={() => setDemo(false)}
              title="Volver al login"
              className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero de fundación */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-teal-500/10 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">Fundación lista</h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Esqueleto React 19 + Vite + TypeScript + Tailwind 4 + Capacitor 6, con el
                mismo appId y el mismo Firebase del FitTrack actual. Desde aquí cada fase
                del plan aterriza una vista: la app vieja queda congelada como referencia
                y tus datos no se tocan.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {versionApp()} · Compilado y APK debug desde GitHub Actions.
              </p>
            </div>
          </div>
        </div>

        {/* Grid del roadmap (las 12 vistas del app viejo) */}
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Ruta de migración — cada vista aterriza en su fase
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ROADMAP.map(({ vista, nombre, fase, icono }) => (
            <div
              key={vista}
              className={`rounded-xl border p-4 transition-all hover:scale-[1.02] ${
                fase === 'F1'
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06] hover:border-emerald-400/60'
                  : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500/60'
              }`}
            >
              <div className={`mb-2 ${fase === 'F1' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {icono}
              </div>
              <div className="text-sm font-bold text-white leading-tight">{nombre}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    fase === 'F1'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {ETIQUETA_FASE[fase]}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">
                {fase === 'F1' ? 'Siguiente fase' : 'En espera'}
              </div>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="mt-8 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 text-center">
          <p className="text-xs text-slate-400 leading-relaxed">
            Protocolo activo: clon fresco · parches quirúrgicos · changelog doble.
            La app actual sigue instalada y funcional hasta que la v2 la reemplace.
          </p>
        </div>
      </main>
    </div>
  );
}

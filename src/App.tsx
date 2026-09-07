// ═══════════════════════════════════════════════════════════
// 🚀 APP — FitTrack V2 (F4 · PROGRESO)
// Arquitectura gemela de RiderTrack V2:
//   • Cerca de auth: onAuthStateChanged decide login vs shell
//   • Onboarding en el primer arranque (claves del viejo)
//   • Navegación por vista activa (activeView) — sin router
//   • F1: login, onboarding, dashboard y Mi Perfil reales
//   • F2: Entreno de Hoy (sesión real), Mi Semana y Biblioteca
//   • F3: los dos robots (FitBot 225 ejercicios + IA Claude)
//   • F4: Historial y Medidas (progreso con gráficas)
//   • F5-F6: resto de vistas (placeholder con candado)
//   • Tema claro/oscuro persistido (FT2_TEMA)
//   • Modo demo: app completa con datos de ejemplo, sin sesión
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, CalendarCheck, History, Settings, User, Bot,
  Dumbbell as LogoIcon, Sun, Moon, LogOut,
} from 'lucide-react';
import { cerrarSesion } from './services/firebase';
import { nombrePlataforma, versionApp } from './services/platform';
import { CLAVE_TEMA, type PerfilEntreno, type RespuestaOnboarding, type VistaApp } from './types';
import {
  tieneOnboarding, completarOnboarding, guardarPerfil, leerEstado, leerPerfil, leerNombrePreferido,
} from './services/storageFit';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingView } from './components/OnboardingView';
import { DashboardView } from './components/DashboardView';
import { PerfilView } from './components/PerfilView';
import { EntrenoView } from './components/EntrenoView';
import { RutinaView } from './components/RutinaView';
import { EjerciciosView } from './components/EjerciciosView';
import { FitBotView } from './components/FitBotView';
import { HistorialView } from './components/HistorialView';
import { MedidasView } from './components/MedidasView';
import { VistaBloqueada } from './components/VistaBloqueada';
import { ESTADO_DEMO, PERFIL_DEMO, USUARIO_DEMO } from './data/demoData';

// Vistas bloqueadas: qué traerá cada fase (roadmap del plan)
const VISTAS_FUTURAS: Partial<Record<VistaApp, { fase: string; nombre: string; descripcion: string }>> = {
  gymchat: { fase: 'F5 · Extras', nombre: 'GymChat', descripcion: 'Chat con tus amigos del gym por código FIT- (Firestore en tiempo real).' },
  spotify: { fase: 'F5 · Extras', nombre: 'Spotify', descripcion: 'Tu música para entrenar, integrada con tu cuenta.' },
  radio: { fase: 'F5 · Extras', nombre: 'Radio Peruana', descripcion: 'Radio en vivo mientras levantas hierro.' },
  config: { fase: 'F6 · Empaquetado', nombre: 'Configuración', descripcion: 'Tema, recordatorios, respaldo/limpieza de datos y fotos de progreso.' },
};

// Sub-pestañas del módulo F2 · Entreno (hoy / rutina / ejercicios)
const SUBTABS_F2: { vista: VistaApp; nombre: string }[] = [
  { vista: 'hoy', nombre: 'Hoy' },
  { vista: 'rutina', nombre: 'Mi Semana' },
  { vista: 'ejercicios', nombre: 'Biblioteca' },
];

// Sub-pestañas del módulo F4 · Progreso (historial / medidas)
const SUBTABS_F4: { vista: VistaApp; nombre: string }[] = [
  { vista: 'historial', nombre: 'Historial' },
  { vista: 'medidas', nombre: 'Medidas' },
];

// Nav inferior (móvil-first, centrada como el header): 4 activas + 2 de fases próximas
const NAV: { vista: VistaApp; nombre: string; icono: React.ReactNode }[] = [
  { vista: 'dashboard', nombre: 'Dashboard', icono: <LayoutDashboard className="w-5 h-5" /> },
  { vista: 'perfil', nombre: 'Mi Perfil', icono: <User className="w-5 h-5" /> },
  { vista: 'hoy', nombre: 'Entreno', icono: <CalendarCheck className="w-5 h-5" /> },
  { vista: 'fitbot', nombre: 'FitBot', icono: <Bot className="w-5 h-5" /> },
  { vista: 'historial', nombre: 'Historial', icono: <History className="w-5 h-5" /> },
  { vista: 'config', nombre: 'Ajustes', icono: <Settings className="w-5 h-5" /> },
];

export default function App() {
  const { usuario, cuenta, cargando } = useAuth();
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [demo, setDemo] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [temaClaro, setTemaClaro] = useState(false);
  const [toast, setToast] = useState('');
  const [version, setVersion] = useState(0); // fuerza re-lectura de claves tras guardar

  // Tema claro/oscuro persistido (clave nueva FT2_, sin tocar las viejas)
  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_TEMA) === 'claro') setTemaClaro(true);
    } catch { /* sin storage */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', temaClaro);
    try {
      localStorage.setItem(CLAVE_TEMA, temaClaro ? 'claro' : 'oscuro');
    } catch { /* sin storage */ }
  }, [temaClaro]);

  // Toast auto-ocultable
  const timerToast = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToast(''), 2800);
  };

  // Datos según modo (demo: en memoria · real: claves del viejo, solo lectura)
  const datos = useMemo(() => {
    if (demo) {
      return {
        nombre: USUARIO_DEMO.nombre,
        estado: ESTADO_DEMO,
        perfil: leerPerfil() ?? PERFIL_DEMO,
      };
    }
    return {
      nombre: leerNombrePreferido() || cuenta?.nombre || 'Campeón',
      estado: leerEstado(),
      perfil: leerPerfil(),
    };
  }, [demo, cuenta, version]);

  // Onboarding del primer arranque (mismo gating que el viejo)
  const necesitaOnboarding = !editandoPerfil && (demo || !!usuario) && !tieneOnboarding();

  // Finaliza onboarding (primera vez o edición desde el perfil)
  const finalizarOnboarding = ({ nombre, perfil }: RespuestaOnboarding) => {
    completarOnboarding(nombre);
    if (perfil) guardarPerfil(perfil);
    setEditandoPerfil(false);
    setVersion((v) => v + 1);
    setVista(editandoPerfil ? 'perfil' : 'dashboard');
    mostrarToast(editandoPerfil ? 'Perfil actualizado' : '¡Bienvenido, campeón!');
  };

  // Cerrar sesión (o salir del demo): en APK también firma out de Google
  // para que al volver pida selector de cuentas (mismo patrón del viejo).
  const salir = async () => {
    if (demo) {
      setDemo(false);
      setVista('dashboard');
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try { await GoogleAuth.signOut(); } catch { /* ya estaba fuera */ }
      }
    } catch { /* plugin no disponible en web */ }
    await cerrarSesion();
    setVista('dashboard');
  };

  const cambiarVista = (v: VistaApp) => {
    setVista(v);
    const info = VISTAS_FUTURAS[v];
    if (info) mostrarToast(`${info.nombre} llega en ${info.fase}`);
  };

  // ── Cargando: mini splash ──
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl ft-pulso">
          <LogoIcon className="w-8 h-8 text-white" />
        </div>
        <p className="text-slate-400 text-sm font-mono">FitTrack V2 · F4</p>
      </div>
    );
  }

  // ── Sin sesión (y sin demo): login real ──
  if (!usuario && !demo) {
    return (
      <LoginScreen
        onVerDemo={() => {
          setDemo(true);
          setVista('dashboard');
        }}
      />
    );
  }

  // ── Onboarding: primer arranque o edición del perfil ──
  if (necesitaOnboarding || editandoPerfil) {
    return (
      <OnboardingView
        nombreInicial={editandoPerfil ? datos.nombre : (usuario?.displayName?.split(' ')[0] ?? '')}
        onFinalizar={finalizarOnboarding}
      />
    );
  }

  // ── Shell F2 ──
  const infoFutura = VISTAS_FUTURAS[vista];
  const enModuloF2 = vista === 'hoy' || vista === 'rutina' || vista === 'ejercicios';
  const enModuloF4 = vista === 'historial' || vista === 'medidas';

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
              {demo ? 'Modo demo · datos de ejemplo' : datos.nombre}
              {' · '}
              {nombrePlataforma()}
            </p>
          </div>
          <span
            data-testid="badge-fase-4"
            className="ml-auto text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0"
          >
            F4 · PROGRESO
          </span>
          <button
            onClick={() => setTemaClaro((t) => !t)}
            data-testid="boton-tema"
            title="Cambiar tema"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all shrink-0"
          >
            {temaClaro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={salir}
            title={demo ? 'Salir del demo' : 'Cerrar sesión'}
            data-testid="boton-salir"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-4 py-5 pb-28">
        {/* Sub-pestañas del módulo F2 · Entreno */}
        {enModuloF2 && (
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Módulo Entreno">
            {SUBTABS_F2.map(({ vista: v, nombre }) => {
              const activa = vista === v;
              return (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  data-testid={`subtab-${v}`}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    activa
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {nombre}
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-pestañas del módulo F4 · Progreso */}
        {enModuloF4 && (
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Módulo Progreso">
            {SUBTABS_F4.map(({ vista: v, nombre }) => {
              const activa = vista === v;
              return (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  data-testid={`subtab-${v}`}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    activa
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {nombre}
                </button>
              );
            })}
          </div>
        )}

        {vista === 'dashboard' && (
          <DashboardView
            nombre={datos.nombre}
            estado={datos.estado}
            perfil={datos.perfil}
            esDemo={demo}
            onIrPerfil={() => cambiarVista('perfil')}
            onVerVistaSiguiente={() => cambiarVista('hoy')}
          />
        )}

        {vista === 'hoy' && (
          <EntrenoView
            nombre={datos.nombre}
            estado={datos.estado}
            esDemo={demo}
            onSesionGuardada={() => setVersion((v) => v + 1)}
            onIrABiblioteca={() => setVista('ejercicios')}
            onVolverDashboard={() => cambiarVista('dashboard')}
            onRutinaCambiada={() => setVersion((v) => v + 1)}
          />
        )}

        {vista === 'rutina' && (
          <RutinaView
            estado={datos.estado}
            esDemo={demo}
            onModoCambiado={() => setVersion((v) => v + 1)}
          />
        )}

        {vista === 'ejercicios' && (
          <EjerciciosView
            estado={datos.estado}
            esDemo={demo}
            onCambio={() => setVersion((v) => v + 1)}
          />
        )}

        {vista === 'fitbot' && (
          <FitBotView
            nombre={datos.nombre}
            estado={datos.estado}
            perfil={datos.perfil}
            esDemo={demo}
            onRutinaCargada={() => setVersion((v) => v + 1)}
            onIrAEntreno={() => cambiarVista('hoy')}
          />
        )}

        {vista === 'historial' && (
          <HistorialView estado={datos.estado} esDemo={demo} />
        )}

        {vista === 'medidas' && (
          <MedidasView
            estado={datos.estado}
            esDemo={demo}
            onCambio={() => setVersion((v) => v + 1)}
          />
        )}

        {vista === 'perfil' && !demo && cuenta && (
          <PerfilView
            cuenta={cuenta}
            estado={datos.estado}
            perfil={datos.perfil}
            esDemo={false}
            onEditarPerfil={() => setEditandoPerfil(true)}
            onCerrarSesion={salir}
          />
        )}

        {vista === 'perfil' && demo && (
          <PerfilView
            cuenta={USUARIO_DEMO}
            estado={datos.estado}
            perfil={datos.perfil}
            esDemo
            onEditarPerfil={() => setEditandoPerfil(true)}
            onCerrarSesion={salir}
          />
        )}

        {vista !== 'dashboard' && vista !== 'perfil' && !enModuloF2 && !enModuloF4 && infoFutura && (
          <VistaBloqueada
            nombre={infoFutura.nombre}
            fase={infoFutura.fase}
            descripcion={infoFutura.descripcion}
            onVolver={() => cambiarVista('dashboard')}
          />
        )}

        {/* Pie de fase */}
        <div className="mt-8 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 text-center">
          <p className="text-xs text-slate-400 leading-relaxed">
            {versionApp()} · Progreso en línea: historial completo con feedback, medidas con IMC
            y gráficas, y la clave del robot IA ahora se configura también en Mi Perfil.
            GymChat y Spotify aterrizan en F5.
          </p>
        </div>
      </main>

      {/* Nav inferior (móvil-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-10 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-around">
          {NAV.map(({ vista: v, nombre, icono }) => {
            const activa = vista === v;
            const disponible = v === 'dashboard' || v === 'perfil' || v === 'hoy' || v === 'fitbot' || v === 'historial';
            return (
              <button
                key={v}
                onClick={() => cambiarVista(v)}
                data-testid={`nav-${v}`}
                className={`relative flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-xl transition-all min-w-[50px] ${
                  activa ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={activa ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icono}
                </span>
                <span className="text-[10px] font-bold leading-none">{nombre}</span>
                {!disponible && (
                  <span className="absolute -top-0.5 right-1.5 text-[8px] font-mono px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-400">
                    F6
                  </span>
                )}
                {activa && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div
          data-testid="toast"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

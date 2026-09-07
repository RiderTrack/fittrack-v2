// ═══════════════════════════════════════════════════════════
// 🚀 APP — FitTrack V2 (F1 · ACCESO)
// Arquitectura gemela de RiderTrack V2:
//   • Cerca de auth: onAuthStateChanged decide login vs shell
//   • Onboarding en el primer arranque (claves del viejo)
//   • Navegación por vista activa (activeView) — sin router
//   • Dashboard y Mi Perfil REALES; resto de vistas llega en
//     F2-F5 (placeholder con candado + descripción de fase)
//   • Tema claro/oscuro persistido (FT2_TEMA)
//   • Modo demo: app completa con datos de ejemplo, sin sesión
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, CalendarCheck, History, Settings, User,
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
import { VistaBloqueada } from './components/VistaBloqueada';
import { ESTADO_DEMO, PERFIL_DEMO, USUARIO_DEMO } from './data/demoData';

// Vistas bloqueadas: qué traerá cada fase (roadmap del plan)
const VISTAS_FUTURAS: Partial<Record<VistaApp, { fase: string; nombre: string; descripcion: string }>> = {
  hoy: { fase: 'F2 · Entreno', nombre: 'Entreno de Hoy', descripcion: 'Tu rutina del día lista para ejecutar: series, pesos y descansos con cronómetro y vibración.' },
  rutina: { fase: 'F2 · Entreno', nombre: 'Editor de Rutinas', descripcion: 'Crea y ajusta tus rutinas semanales ejercicio por ejercicio.' },
  ejercicios: { fase: 'F2 · Entreno', nombre: 'Biblioteca de Ejercicios', descripcion: 'Los 130+ ejercicios del catálogo con técnica, errores comunes, tips y variaciones.' },
  historial: { fase: 'F3 · Progreso', nombre: 'Historial', descripcion: 'Todas tus sesiones pasadas con detalle, feedback y mini-gráficos.' },
  medidas: { fase: 'F3 · Progreso', nombre: 'Medidas Corporales', descripcion: 'Peso, perímetros e IMC con fotos de progreso en Firebase Storage.' },
  fitbot: { fase: 'F4 · Extras', nombre: 'FitBot IA', descripcion: 'Tu entrenador con IA: arma la rutina según energía, sueño y dolores del día.' },
  gymchat: { fase: 'F4 · Extras', nombre: 'GymChat', descripcion: 'Chat con tus amigos del gym por código FIT- (Firestore en tiempo real).' },
  spotify: { fase: 'F4 · Extras', nombre: 'Spotify', descripcion: 'Tu música para entrenar, integrada con tu cuenta.' },
  radio: { fase: 'F4 · Extras', nombre: 'Radio Peruana', descripcion: 'Radio en vivo mientras levantas hierro.' },
  config: { fase: 'F5 · Empaquetado', nombre: 'Configuración', descripcion: 'Tema, recordatorios, API key de FitBot y respaldo/limpieza de datos.' },
};

// Nav inferior (móvil-first, centrada como el header): 2 activas + 3 de fases próximas
const NAV: { vista: VistaApp; nombre: string; icono: React.ReactNode }[] = [
  { vista: 'dashboard', nombre: 'Dashboard', icono: <LayoutDashboard className="w-5 h-5" /> },
  { vista: 'perfil', nombre: 'Mi Perfil', icono: <User className="w-5 h-5" /> },
  { vista: 'hoy', nombre: 'Entreno', icono: <CalendarCheck className="w-5 h-5" /> },
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
    if (v !== 'dashboard' && v !== 'perfil') {
      const info = VISTAS_FUTURAS[v];
      if (info) mostrarToast(`${info.nombre} llega en ${info.fase}`);
    }
  };

  // ── Cargando: mini splash ──
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl ft-pulso">
          <LogoIcon className="w-8 h-8 text-white" />
        </div>
        <p className="text-slate-400 text-sm font-mono">FitTrack V2 · F1</p>
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

  // ── Shell F1 ──
  const infoFutura = VISTAS_FUTURAS[vista];

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
            data-testid="badge-fase-1"
            className="ml-auto text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0"
          >
            F1 · ACCESO
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

        {vista !== 'dashboard' && vista !== 'perfil' && infoFutura && (
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
            {versionApp()} · Acceso, onboarding, perfil y dashboard en línea.
            Entrenos y rutinas aterrizan en F2.
          </p>
        </div>
      </main>

      {/* Nav inferior (móvil-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-10 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-around">
          {NAV.map(({ vista: v, nombre, icono }) => {
            const activa = vista === v;
            const disponible = v === 'dashboard' || v === 'perfil';
            return (
              <button
                key={v}
                onClick={() => cambiarVista(v)}
                data-testid={`nav-${v}`}
                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[64px] ${
                  activa ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={activa ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icono}
                </span>
                <span className="text-[10px] font-bold leading-none">{nombre}</span>
                {!disponible && (
                  <span className="absolute -top-0.5 right-1.5 text-[8px] font-mono px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-400">
                    {v === 'hoy' ? 'F2' : v === 'historial' ? 'F3' : 'F5'}
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

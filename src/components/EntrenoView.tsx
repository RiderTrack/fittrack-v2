// ═══════════════════════════════════════════════════════════
// 🏋️ ENTRENO DE HOY — FitTrack V2 (F2 · Entreno)
// Réplica React del view-rutina del app viejo: split del día,
// selector de modo, tarjetas por ejercicio con series peso×reps
// pre-cargadas (progresión inteligente), completar serie
// (PR + vibración + beep + descanso automático), barra de
// progreso, finalizar sesión → historial + racha + feedback.
// Escritura quirúrgica vía aplicarEstado (merge del state).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dumbbell, Timer, Check, Trophy, ChevronDown, Pencil, Save,
  SkipForward, RotateCcw, Moon, PartyPopper, Zap, BookOpen, Bot, X, History,
} from 'lucide-react';
import type {
  EstadoFitTrack, Ejercicio, FeedbackSesion, ModoEntreno, NotasEjercicio,
  PRLevantamiento, SerieEstado, SesionEntreno,
} from '../types';
import { aplicarEstado, formatearVolumen } from '../services/storageFit';
import {
  PARAMETROS_MODO, calcular1RM, calcularProgresion, descansoPorModo,
  ejerciciosDelDia, esNuevoPR, etiquetaPR, horaHHMM, hoyISO, leerModoActivo,
  splitDeHoy, ultimaVez,
} from '../services/entreno';
import { confirmarSerie, fanfarriaPR, finDescanso, finSesion, vibrar } from '../services/feedback';
import { etiquetaRutinaHoy, leerRutinaHoy, paramsItemRutina, quitarRutinaHoy } from '../services/fitbot';
import { ejerciciosDelDiaPersonal, leerRutinaPersonal, paramsEjercicioHoy } from '../services/rutinaPersonal';
import { DetalleEjercicio } from './DetalleEjercicio';

interface EntrenoViewProps {
  nombre: string;
  estado: EstadoFitTrack;
  esDemo: boolean;
  onSesionGuardada: () => void;   // App relee el state (KPIs al día)
  onIrABiblioteca: () => void;    // "agrega ejercicios" si el día está vacío
  onVolverDashboard: () => void;
  onRutinaCambiada?: () => void;  // F3: se cargó/descartó rutina del robot
  onIrAMiSemana?: () => void;    // F7: "editala en Mi Semana" si el día está vacío
}

/** Resumen que llena la pantalla post-entreno */
interface ResumenSesion {
  sesion: SesionEntreno;
  totalEjercicios: number;
  totalSeries: number;
  racha: number;
  duracionMin: number;
}

interface AlertaPR {
  name: string;
  weight: number;
  reps: number;
  rm1: number;
}

// Opciones de feedback — idénticas al viejo (L4353, L4362, L4371)
const OPCIONES_DIFICULTAD = ['Muy fácil', 'Fácil', 'Perfecto', 'Duro', 'Agotador']; // 1-5
const OPCIONES_ENERGIA = ['Agotado', 'Regular', 'Bien', 'Excelente'];                // 1-4
const OPCIONES_DOLOR = ['Sin dolor', 'Leve', 'Moderado', 'Severo'];                   // 0-3

const ETIQUETAS_MODO: Record<ModoEntreno, string> = {
  fuerza: 'Fuerza (5×3-5, 87% 1RM)',
  hipertrofia: 'Hipertrofia (4×8-12, 70% 1RM)',
  potencia: 'Potencia (3×1-3, 90-95% 1RM)',
  descarga: 'Descarga (3×12-15, 50% 1RM)',
  descanso: 'Descanso',
};

export const EntrenoView: React.FC<EntrenoViewProps> = ({
  nombre, estado, esDemo, onSesionGuardada, onIrABiblioteca, onVolverDashboard, onRutinaCambiada, onIrAMiSemana,
}) => {
  const split = useMemo(() => splitDeHoy(), []);
  const diaSemana = useMemo(() => new Date().getDay(), []); // F7
  // F7: rutina personal (si está activa define los ejercicios de hoy)
  const rutinaPersonal = useMemo(() => leerRutinaPersonal(estado), [estado]);
  const diaPersonal = rutinaPersonal?.activa ? rutinaPersonal.dias?.[diaSemana] : undefined;
  // F7 · prioridad: rutina FitBot de HOY > rutina personal > split clásico
  const ejercicios = useMemo(() => {
    if (leerRutinaHoy()) return ejerciciosDelDia(estado, split); // interna: devuelve la del FitBot
    if (rutinaPersonal?.activa) return ejerciciosDelDiaPersonal(estado, diaSemana);
    return ejerciciosDelDia(estado, split);
  }, [estado, split, rutinaPersonal, diaSemana]);
  // F3: etiqueta de la rutina activa del robot ("Pecho + Tríceps"…)
  const rutinaFitBot = useMemo(() => etiquetaRutinaHoy(), [ejercicios]);

  const [modo, setModo] = useState<ModoEntreno>(() => leerModoActivo(estado));
  const [series, setSeries] = useState<Record<string, SerieEstado[]>>(() => construirSeries(ejercicios, modo, estado));
  // Tarjetas abiertas (el viejo permitía varias expandidas a la vez)
  const [abiertas, setAbiertas] = useState<string[]>(() => (ejercicios[0] ? [ejercicios[0].id] : []));
  const [prsLocales, setPrsLocales] = useState<Record<string, PRLevantamiento>>(() => ({ ...(estado.prs ?? {}) }));
  const [notas, setNotas] = useState<NotasEjercicio>(() => ({ ...((estado.notasEjercicio as NotasEjercicio) ?? {}) }));
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [descanso, setDescanso] = useState<{ restantes: number; total: number; ejercicio: string } | null>(null);
  const [prAlerta, setPrAlerta] = useState<AlertaPR | null>(null);
  const [resultado, setResultado] = useState<ResumenSesion | null>(null);
  const [feedbackSel, setFeedbackSel] = useState<FeedbackSesion>({});
  const [feedbackGuardado, setFeedbackGuardado] = useState(false);
  const [toastLocal, setToastLocal] = useState('');
  const inicioRef = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const params = modo !== 'descanso' ? PARAMETROS_MODO[modo] : null;
  // F3: con rutina del robot activa se entrena aunque el split diga descanso
  // F7: con rutina personal, el día decide (sus días de descanso)
  const sinEntrenoHoy = rutinaPersonal?.activa ? !diaPersonal?.activo : split.target.length === 0;
  const diaDescanso = (sinEntrenoHoy || modo === 'descanso') && !rutinaFitBot;

  const totalSeries = useMemo(
    () =>
      Object.values(series as Record<string, SerieEstado[]>).reduce(
        (n, arr) => n + arr.length,
        0,
      ),
    [series],
  );
  // Nota: sin @types/react el estado de useState se infiere como any y
  // Object.values(any) devuelve unknown[] — el cast local restaura el tipo.
  const seriesCompletadas = useMemo(
    () =>
      Object.values(series as Record<string, SerieEstado[]>).reduce(
        (n, arr) => n + arr.filter((s) => s.hecha).length,
        0,
      ),
    [series],
  );
  const pct = totalSeries > 0 ? Math.round((seriesCompletadas / totalSeries) * 100) : 0;
  const empezo = seriesCompletadas > 0;
  const yaEntrenoHoy = estado.lastWorkoutDate === hoyISO();

  const avisar = (mensaje: string) => {
    setToastLocal(mensaje);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastLocal(''), 2600);
  };

  // ── Descanso: cuenta regresiva de 1s; al llegar a 0 → beeps ──
  useEffect(() => {
    if (!descanso) return;
    if (descanso.restantes <= 0) {
      finDescanso();
      vibrar([200]);
      setDescanso(null);
      return;
    }
    const t = setTimeout(() => {
      setDescanso((d) => (d ? { ...d, restantes: d.restantes - 1 } : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [descanso]);

  // ── Construir series pre-cargadas (progresión del viejo) ──
  // F3: si el ejercicio viene de la rutina del robot, usa SUS
  // series y reps (igual que renderCard del viejo: parseInt de
  // ex['Series']) con fallback a los parámetros del modo.
  // F7: ídem con la rutina personal (paramsEjercicioHoy).
  function construirSeries(
    ejerciciosDia: Ejercicio[],
    modoActivo: ModoEntreno,
    estadoActual: EstadoFitTrack,
  ): Record<string, SerieEstado[]> {
    const p = modoActivo !== 'descanso' ? PARAMETROS_MODO[modoActivo] : null;
    const out: Record<string, SerieEstado[]> = {};
    for (const ex of ejerciciosDia) {
      const esp = paramsItemRutina(ex.id) ?? paramsEjercicioHoy(estadoActual, ex.id);
      if (!p && !esp) continue; // sin modo y sin rutina: nada que construir
      const prog = calcularProgresion(ex.id, ex.name, modoActivo, estadoActual);
      const nSeries = esp?.series || p?.sets || 3;
      // '8-12' o '5 min' → primer número para el input numérico
      const repsRango = esp?.reps || p?.reps || '10';
      const reps = repsRango.match(/\d+/)?.[0] ?? '10';
      out[ex.id] = Array.from({ length: nSeries }, () => ({
        peso: String(prog.peso),
        reps,
        hecha: false,
      }));
    }
    return out;
  }

  // F3: si cambia la lista (cargaron/descartaron rutina del robot)
  // y la sesión no empezó, re-armar las series en caliente.
  useEffect(() => {
    if (empezo || resultado) return;
    setSeries(construirSeries(ejercicios, modo, estado));
    setAbiertas(ejercicios[0] ? [ejercicios[0].id] : []);
  }, [ejercicios]);

  /** F3: descartar la rutina del robot y volver al split del día */
  const descartarRutina = () => {
    quitarRutinaHoy(esDemo);
    onRutinaCambiada?.();
    avisar('Rutina del FitBot descartada — volviendo al split');
  };

  const cambiarModo = (nuevo: ModoEntreno) => {
    if (nuevo === modo) return;
    if (empezo) {
      avisar('Ya empezaste: termina o reinicia antes de cambiar el modo');
      return;
    }
    setModo(nuevo);
    setSeries(construirSeries(ejercicios, nuevo, estado));
    setAbiertas(ejercicios[0] ? [ejercicios[0].id] : []);
    if (!esDemo) {
      aplicarEstado((est) => { est.activeMode = nuevo; }); // changeWorkoutMode del viejo
    }
  };

  const reiniciarSesion = () => {
    setSeries(construirSeries(ejercicios, modo, estado));
    setAbiertas(ejercicios[0] ? [ejercicios[0].id] : []);
    setResultado(null);
    setFeedbackSel({});
    setFeedbackGuardado(false);
    inicioRef.current = null;
    setDescanso(null);
    avisar('Sesión reiniciada');
  };

  // ── Completar / desmarcar una serie (completeSet del viejo) ──
  const alternarSerie = (ex: Ejercicio, idx: number) => {
    const arr = series[ex.id] ?? [];
    const actual = arr[idx];
    if (!actual) return;
    const ahoraHecha = !actual.hecha;

    if (ahoraHecha) {
      const peso = parseFloat(actual.peso) || 0;
      const reps = parseInt(actual.reps, 10) || 0;
      if (peso <= 0 || reps <= 0) {
        avisar('Pon el peso y las reps para completar la serie');
        return;
      }
    }

    setSeries((prev) => ({
      ...prev,
      [ex.id]: (prev[ex.id] ?? []).map((s, i) => (i === idx ? { ...s, hecha: ahoraHecha } : s)),
    }));

    if (!ahoraHecha) return; // desmarcar solo resta el contador (como el viejo)

    if (!inicioRef.current) inicioRef.current = Date.now();
    confirmarSerie(); // vibración corta + beep 600 Hz

    // ── PR en vivo (checkPersonalRecord del viejo, L3504) ──
    const peso = parseFloat(actual.peso) || 0;
    const reps = parseInt(actual.reps, 10) || 0;
    const nuevoPR = esNuevoPR({ ...estado, prs: prsLocales }, ex.id, peso, reps);
    if (nuevoPR) {
      const pr: PRLevantamiento = { ...nuevoPR, name: ex.name };
      setPrsLocales((p) => ({ ...p, [ex.id]: pr }));
      if (!esDemo) {
        aplicarEstado((est) => {
          est.prs = est.prs ?? {};
          est.prs[ex.id] = pr;
        });
      }
      fanfarriaPR(); // C5-E5-G5 + vibración
      setPrAlerta({ name: ex.name, weight: peso, reps, rm1: calcular1RM(peso, reps) });
    }

    // ── Descanso automático (getDescansoEjercicio → default por modo) ──
    iniciarDescanso(descansoPorModo(modo), ex.name);

    // ── Auto-expandir el siguiente ejercicio SOLO al completar la última
    // serie del ejercicio (autoExpandNextExercise del viejo) — la tarjeta
    // actual NO se colapsa, queda marcada en verde si completó todo.
    const esUltimaSerie = idx === (series[ex.id]?.length ?? 0) - 1;
    if (esUltimaSerie) {
      const i = ejercicios.findIndex((e) => e.id === ex.id);
      const siguiente = i >= 0 ? ejercicios[i + 1] : undefined;
      if (siguiente) {
        setAbiertas((a) => (a.includes(siguiente.id) ? a : [...a, siguiente.id]));
        setTimeout(() => {
          document.getElementById(`tarjeta-${siguiente.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  };

  const iniciarDescanso = (segundos: number, ejercicio: string) => {
    setDescanso({ restantes: segundos, total: segundos, ejercicio });
  };

  // ── Nota por ejercicio (editarNotaEjercicio del viejo) ──
  const guardarNota = (nombre: string, texto: string) => {
    setNotas((prev) => {
      const nuevo = { ...prev };
      if (texto.trim()) nuevo[nombre] = texto.trim();
      else delete nuevo[nombre];
      return nuevo;
    });
    if (!esDemo) {
      aplicarEstado((est) => {
        const mapa = { ...((est.notasEjercicio as NotasEjercicio) ?? {}) };
        if (texto.trim()) mapa[nombre] = texto.trim();
        else delete mapa[nombre];
        est.notasEjercicio = mapa;
      });
    }
    avisar(texto.trim() ? 'Nota guardada' : 'Nota eliminada');
  };

  // ── Finalizar sesión (completeWorkoutSession del viejo, L4213) ──
  const finalizarSesion = () => {
    if (!params) return;

    const completados: { name: string; sets: number; weight: number; volume: number }[] = [];
    let volumenSesion = 0;
    let hayAlMenosUna = false;

    for (const ex of ejercicios) {
      const hechas = (series[ex.id] ?? []).filter((s) => s.hecha);
      if (hechas.length === 0) continue;
      let pesoMax = 0;
      let volumenEj = 0;
      for (const s of hechas) {
        const w = parseFloat(s.peso) || 0;
        const r = parseInt(s.reps, 10) || 0;
        volumenEj += w * r;
        if (w > pesoMax) pesoMax = w;
      }
      hayAlMenosUna = true;
      completados.push({ name: ex.name, sets: hechas.length, weight: pesoMax, volume: Math.round(volumenEj) });
      volumenSesion += volumenEj;
    }

    if (!hayAlMenosUna) {
      avisar('Completa al menos una serie para finalizar tu sesión');
      return;
    }

    const duracionMin = inicioRef.current
      ? Math.max(1, Math.round((Date.now() - inicioRef.current) / 60000))
      : 1;

    // Estructura EXACTA del viejo (sessionResult, L4277-4285)
    const sesion: SesionEntreno = {
      date: hoyISO(),
      time: horaHHMM(),
      routineName: rutinaPersonal?.activa && !rutinaFitBot ? (diaPersonal?.nombre ?? split.name) : split.name,
      mode: modo,
      volume: Math.round(volumenSesion),
      exercises: completados,
      feedback: null,
      duration: duracionMin,
    };

    let rachaFinal = estado.streak ?? 0;
    if (!esDemo) {
      const hoy = hoyISO();
      // La racha sube solo si hoy no se había entrenado (mismo criterio del viejo)
      rachaFinal = estado.lastWorkoutDate !== hoy ? rachaFinal + 1 : rachaFinal;
      aplicarEstado((est) => {
        est.workoutHistory = est.workoutHistory ?? [];
        est.workoutHistory.unshift({ ...sesion });
        if (est.lastWorkoutDate !== hoy) est.streak = (est.streak ?? 0) + 1;
        est.lastWorkoutDate = hoy;
        est.lastWorkoutName = split.name;
      });
      onSesionGuardada(); // App relee → dashboard con racha y volumen nuevos
    }

    setDescanso(null);
    finSesion(); // beep largo + doble vibración
    setResultado({
      sesion,
      totalEjercicios: completados.length,
      totalSeries: seriesCompletadas,
      racha: rachaFinal,
      duracionMin,
    });
  };

  // ── Feedback post-entreno (guardarFeedbackYSalir del viejo, L4411) ──
  const guardarFeedback = () => {
    if (!esDemo) {
      aplicarEstado((est) => {
        if (est.workoutHistory && est.workoutHistory.length > 0) {
          est.workoutHistory[0].feedback = { ...feedbackSel, fecha: new Date().toISOString() };
        }
      });
      onSesionGuardada();
    }
    setFeedbackGuardado(true);
    avisar('Feedback guardado');
  };

  const volverInicio = () => {
    setResultado(null);
    setFeedbackSel({});
    setFeedbackGuardado(false);
    setSeries(construirSeries(ejercicios, modo, { ...estado, prs: prsLocales }));
    setAbiertas(ejercicios[0] ? [ejercicios[0].id] : []);
    inicioRef.current = null;
    onVolverDashboard();
  };

  // ═══════════════ RENDER ═══════════════

  // Banner de descanso (fijo bajo el header, como el viejo)
  const bannerDescanso = descanso && (
    <div
      data-testid="banner-descanso"
      className="fixed top-16 inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-500/50 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold">DESCANSANDO</p>
            <p className="text-xs text-slate-400 truncate">Después de: {descanso.ejercicio}</p>
          </div>
          <div className="text-2xl font-black text-white tabular-nums leading-none w-16 text-right">
            {String(Math.floor(descanso.restantes / 60)).padStart(2, '0')}:{String(descanso.restantes % 60).padStart(2, '0')}
          </div>
          <button
            onClick={() => setDescanso(null)}
            title="Saltar descanso"
            className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all shrink-0"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000"
            style={{ width: `${(descanso.total > 0 ? ((descanso.total - descanso.restantes) / descanso.total) * 100 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );

  // Overlay de PR (pr-alert-overlay del viejo)
  const overlayPR = prAlerta && (
    <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-amber-500/50 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-4">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h3 className="text-lg font-black text-white">¡Nuevo récord!</h3>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          Has alcanzado un nuevo récord en <strong className="text-white">{prAlerta.name}</strong>:
          <br />
          <strong className="text-amber-400">{prAlerta.weight} kg</strong> × {prAlerta.reps} reps.
          <br />
          Estimado 1RM: <strong className="text-amber-400">{prAlerta.rm1.toFixed(1)} kg</strong>.
        </p>
        <button
          onClick={() => setPrAlerta(null)}
          className="mt-5 w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all"
        >
          ¡Vamos!
        </button>
      </div>
    </div>
  );

  // Toast local
  const toast = toastLocal && (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap">
      {toastLocal}
    </div>
  );

  // ── Pantalla post-entreno (mostrarPantallaFinal del viejo) ──
  if (resultado) {
    return (
      <div className="space-y-4">
        {bannerDescanso}
        {toast}

        <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/60 p-6 text-center">
          <PartyPopper className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h2 className="text-xl font-black text-white">¡Entrenamiento completado!</h2>
          <p className="text-xs text-slate-400 mt-1">
            {resultado.sesion.routineName} · {resultado.sesion.date}
          </p>
          <div className="flex justify-center gap-8 mt-5 flex-wrap">
            <div>
              <p className="text-2xl font-black text-emerald-400">{resultado.totalEjercicios}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ejercicios</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">{formatearVolumen(resultado.sesion.volume ?? 0)} kg</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Volumen total</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">{resultado.racha}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Racha</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">{resultado.duracionMin}′</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Duración</p>
            </div>
          </div>
          {esDemo && (
            <p className="mt-4 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Modo demo — esta sesión no se guarda en tus datos reales.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> ¿Cómo fue el entrenamiento?
          </h3>

          <GrupoFeedback
            titulo="Dificultad percibida"
            opciones={OPCIONES_DIFICULTAD}
            seleccionado={feedbackSel.dificultad}
            offset={1}
            onElegir={(v) => setFeedbackSel((f) => ({ ...f, dificultad: v }))}
          />
          <GrupoFeedback
            titulo="Energía al terminar"
            opciones={OPCIONES_ENERGIA}
            seleccionado={feedbackSel.energia}
            offset={1}
            onElegir={(v) => setFeedbackSel((f) => ({ ...f, energia: v }))}
          />
          <GrupoFeedback
            titulo="Dolor o molestia post-entreno"
            opciones={OPCIONES_DOLOR}
            seleccionado={feedbackSel.dolor}
            offset={0}
            onElegir={(v) => setFeedbackSel((f) => ({ ...f, dolor: v }))}
          />

          {feedbackGuardado && (
            <p className="mt-3 text-xs text-emerald-400 font-bold text-center">
              Feedback guardado — FitBot aprenderá de esto
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={guardarFeedback}
            disabled={feedbackGuardado}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg disabled:opacity-50 hover:from-emerald-400 hover:to-teal-500 transition-all"
          >
            <Save className="w-4 h-4" /> Guardar y salir
          </button>
          <button
            onClick={volverInicio}
            className="flex-1 px-5 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
          >
            Omitir
          </button>
        </div>
      </div>
    );
  }

  // ── Día de descanso (split vacío o modo descanso, L3635-3646) ──
  if (diaDescanso) {
    return (
      <div className="space-y-4">
        {toast}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-emerald-400" /> Rutina Hoy
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Hoy es día de <strong className="text-slate-200">{split.name}</strong> para {nombre}. ¡Recupérate y mantente hidratado!
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <SelectorModo modo={modo} bloqueado={false} onChange={cambiarModo} />
        </div>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 py-12 px-6 text-center">
          <Moon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-base font-black text-white">Descanso & Recuperación</h3>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Ideal para mantener el volumen muscular y recuperar el sistema nervioso central.
          </p>
          {modo !== 'descanso' && (
            <button
              onClick={() => cambiarModo('descanso')}
              className="mt-5 px-5 py-2.5 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
            >
              Cambiar a modo Descanso
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Pantalla principal de entreno ──
  return (
    <div className="space-y-4">
      {bannerDescanso}
      {overlayPR}
      {toast}

      {/* Encabezado + selector de modo (routine-header del viejo) */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              {rutinaFitBot ? (
                <>
                  <Bot className="w-5 h-5 text-emerald-400" /> FitBot: <span className="text-emerald-400">{rutinaFitBot}</span>
                </>
              ) : rutinaPersonal?.activa ? (
                <>
                  <Dumbbell className="w-5 h-5 text-emerald-400" />
                  {diaPersonal?.nombre ?? split.name}
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 align-middle">
                    MI RUTINA
                  </span>
                </>
              ) : (
                <>
                  <Dumbbell className="w-5 h-5 text-emerald-400" /> {split.name}
                </>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {rutinaFitBot ? (
                <>
                  Rutina armada por tu robot con la DB de 225 ejercicios — series y reps según cada ejercicio.{' '}
                  {!empezo && (
                    <button
                      onClick={descartarRutina}
                      data-testid="boton-quitar-rutina-fitbot"
                      className="inline-flex items-center gap-1 font-bold text-red-400 hover:text-red-300"
                    >
                      <X className="w-3 h-3" /> Volver al split del día
                    </button>
                  )}
                </>
              ) : rutinaPersonal?.activa ? (
                <>
                  Tu rutina personal — {ejercicios.length} ejercicio(s) con sus series y reps.{' '}
                  {!empezo && (
                    <button
                      onClick={() => onIrAMiSemana?.()}
                      className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      <Pencil className="w-3 h-3" /> Editar en Mi Semana
                    </button>
                  )}
                </>
              ) : params && (
                <>
                  Enfoque: <strong className="text-slate-200">{params.name}</strong> ({params.sets}×{params.reps} al {params.percentage}).{' '}
                  <em>{params.note}</em>
                </>
              )}
            </p>
          </div>
          {yaEntrenoHoy && (
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              ✓ RACHA A SALVO HOY
            </span>
          )}
        </div>
        <div className="mt-3">
          <SelectorModo modo={modo} bloqueado={empezo} onChange={cambiarModo} />
        </div>
      </div>

      {/* Barra de progreso de sesión (session-progress-bar del viejo) */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-emerald-400" data-testid="progreso-sesion">
            {pct >= 100 ? '¡Sesión completada!' : `Serie ${seriesCompletadas} de ${totalSeries}`}
          </span>
          <span className="text-xs font-mono text-slate-400">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Sin ejercicios para hoy (L3655-3657) */}
      {ejercicios.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 py-12 px-6 text-center">
          <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {rutinaPersonal?.activa
              ? `Tu rutina personal no tiene ejercicios hoy (${diaPersonal?.nombre ?? 'descanso'}). Agregá algunos en Mi Semana.`
              : `No hay ejercicios para hoy (${split.target.join(' + ') || 'descanso'}). Agrega algunos en la Biblioteca.`}
          </p>
          <button
            onClick={() => (rutinaPersonal?.activa ? onIrAMiSemana?.() : onIrABiblioteca())}
            data-testid="boton-ir-vacio"
            className="mt-4 px-5 py-2.5 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
          >
            {rutinaPersonal?.activa ? 'Ir a Mi Semana' : 'Ir a la Biblioteca'}
          </button>
        </div>
      ) : (
        /* Tarjetas de ejercicios (exercise-item del viejo) */
        ejercicios.map((ex) => (
          <TarjetaEjercicio
            key={ex.id}
            ejercicio={ex}
            series={series[ex.id] ?? []}
            expandida={abiertas.includes(ex.id)}
            nota={notas[ex.name]}
            notaAbierta={notaAbierta === ex.id}
            pr={prsLocales[ex.id]}
            ultima={ultimaVez(ex.name, estado)}
            estado={estado}
            modo={modo}
            onToggleExpandida={() => setAbiertas((a) => (a.includes(ex.id) ? a.filter((x) => x !== ex.id) : [...a, ex.id]))}
            onAlternarSerie={(idx) => alternarSerie(ex, idx)}
            onCambiarInput={(idx, campo, valor) =>
              setSeries((prev) => ({
                ...prev,
                [ex.id]: (prev[ex.id] ?? []).map((s, i) =>
                  i === idx ? (campo === 'peso' ? { ...s, peso: valor } : { ...s, reps: valor }) : s,
                ),
              }))
            }
            onToggleNota={() => setNotaAbierta((n) => (n === ex.id ? null : ex.id))}
            onGuardarNota={(texto) => guardarNota(ex.name, texto)}
          />
        ))
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={finalizarSesion}
          disabled={!empezo}
          data-testid="boton-finalizar"
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-base font-bold shadow-lg shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed hover:from-emerald-400 hover:to-teal-500 transition-all"
        >
          <Check className="w-5 h-5" /> Finalizar sesión
        </button>
        <button
          onClick={reiniciarSesion}
          title="Reiniciar sesión"
          className="w-14 flex items-center justify-center rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
      {empezo && (
        <p className="text-[11px] text-slate-500 text-center -mt-1">
          {seriesCompletadas} serie(s) completada(s) — finaliza para guardar la sesión
        </p>
      )}
    </div>
  );
};

// ═══════════════ SUBCOMPONENTES ═══════════════

/** Selector de modo (workout-mode-selector del viejo, 5 opciones) */
const SelectorModo: React.FC<{ modo: ModoEntreno; bloqueado: boolean; onChange: (m: ModoEntreno) => void }> = ({
  modo, bloqueado, onChange,
}) => {
  const modos: ModoEntreno[] = ['hipertrofia', 'fuerza', 'potencia', 'descarga', 'descanso'];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de entreno">
      {modos.map((m) => {
        const activo = modo === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            disabled={bloqueado && !activo}
            data-testid={`modo-${m}`}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              activo
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {ETIQUETAS_MODO[m]}
          </button>
        );
      })}
    </div>
  );
};

/** Grupo de botones de feedback (selFeedback del viejo) */
const GrupoFeedback: React.FC<{
  titulo: string;
  opciones: string[];
  seleccionado?: number;
  offset: number;
  onElegir: (valor: number) => void;
}> = ({ titulo, opciones, seleccionado, offset, onElegir }) => (
  <div className="mb-4 last:mb-0">
    <p className="text-xs text-slate-400 mb-2">{titulo}</p>
    <div className="flex gap-2 flex-wrap">
      {opciones.map((texto, i) => {
        const valor = i + offset;
        const activo = seleccionado === valor;
        return (
          <button
            key={texto}
            onClick={() => onElegir(valor)}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
              activo
                ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {texto}
          </button>
        );
      })}
    </div>
  </div>
);

/** Tarjeta de ejercicio con series (exercise-item del viejo) */
const TarjetaEjercicio: React.FC<{
  ejercicio: Ejercicio;
  series: SerieEstado[];
  expandida: boolean;
  nota?: string;
  notaAbierta: boolean;
  pr?: PRLevantamiento;
  ultima: { fecha: string; resumen: string } | null;
  estado: EstadoFitTrack;
  modo: ModoEntreno;
  onToggleExpandida: () => void;
  onAlternarSerie: (idx: number) => void;
  onCambiarInput: (idx: number, campo: 'peso' | 'reps', valor: string) => void;
  onToggleNota: () => void;
  onGuardarNota: (texto: string) => void;
}> = ({
  ejercicio, series, expandida, nota, notaAbierta, pr, ultima, estado, modo,
  onToggleExpandida, onAlternarSerie, onCambiarInput, onToggleNota, onGuardarNota,
}) => {
  const prog = useMemo(() => calcularProgresion(ejercicio.id, ejercicio.name, modo, estado), [ejercicio, modo, estado]);
  // F7: detalle del ejercicio (historial + gráfica) — solo lectura
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const hechas = series.filter((s) => s.hecha).length;
  const completa = hechas === series.length && series.length > 0;
  const volumen = series.reduce((v, s) => (s.hecha ? v + (parseFloat(s.peso) || 0) * (parseInt(s.reps, 10) || 0) : v), 0);
  const rm1Max = series.reduce((m, s) => {
    if (!s.hecha) return m;
    return Math.max(m, calcular1RM(parseFloat(s.peso) || 0, parseInt(s.reps, 10) || 0));
  }, 0);

  const colorProg = prog.indicador === 'subir' ? 'text-emerald-400' : prog.indicador === 'pr' ? 'text-teal-400' : 'text-slate-300';

  return (
    <div
      id={`tarjeta-${ejercicio.id}`}
      data-testid={`tarjeta-${ejercicio.id}`}
      className={`rounded-2xl border transition-all ${
        completa
          ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
          : 'border-slate-700/60 bg-slate-900/60'
      }`}
    >
      {/* Cabecera colapsable (exercise-header del viejo) */}
      <button onClick={onToggleExpandida} className="w-full text-left p-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white truncate">{ejercicio.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">PR: {etiquetaPR(pr)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-black ${colorProg} flex items-center gap-1 justify-end`}>
            {prog.indicador === 'subir' ? '▲' : prog.indicador === 'pr' ? '◆' : '→'} {prog.peso} kg
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{prog.razon || 'Peso sugerido'}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${expandida ? 'rotate-180' : ''}`} />
      </button>

      {expandida && (
        <div className="px-4 pb-4">
          {ultima && (
            <p className="text-[11px] text-slate-400 mb-2 rounded-lg bg-slate-800/60 px-3 py-2">
              Última vez ({ultima.fecha}): <strong className="text-emerald-400">{ultima.resumen}</strong>
            </p>
          )}
          {/* F7 · botón al detalle completo del ejercicio */}
          <button
            onClick={() => setDetalleAbierto(true)}
            data-testid={`ver-detalle-${ejercicio.id}`}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 py-1.5 mb-3 text-[11px] font-bold text-slate-300 hover:text-emerald-300 hover:border-emerald-500/50 transition-all"
          >
            <History className="w-3.5 h-3.5" /> Ver historial y progreso
          </button>
          {nota && !notaAbierta && (
            <p className="text-[11px] text-amber-300 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              {nota}
            </p>
          )}

          {/* Series: peso × reps + Completar (set-row del viejo) */}
          <div className="space-y-2">
            {series.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 w-6 shrink-0">S{i + 1}</span>
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={s.peso}
                    onChange={(e) => onCambiarInput(i, 'peso', e.target.value)}
                    disabled={s.hecha}
                    className="w-full min-w-0 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60 disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-500 shrink-0">kg</span>
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => onCambiarInput(i, 'reps', e.target.value)}
                    disabled={s.hecha}
                    className="w-full min-w-0 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-500/60 disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-500 shrink-0">reps</span>
                </div>
                <button
                  onClick={() => onAlternarSerie(i)}
                  data-testid={`serie-${ejercicio.id}-${i + 1}`}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                    s.hecha
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : 'border-slate-600 text-slate-300 hover:border-emerald-500/60 hover:bg-emerald-500/10'
                  }`}
                  title={s.hecha ? 'Desmarcar serie' : 'Completar serie'}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Resumen por ejercicio (exercise-summary-bar del viejo) */}
          <div className="mt-3 flex justify-between items-center text-[11px] text-slate-400 rounded-lg bg-slate-800/60 px-3 py-2">
            <span>
              Volumen: <strong className="text-white">{volumen.toFixed(0)}</strong> kg
            </span>
            <span>
              Estimado 1RM: <strong className="text-white">{rm1Max > 0 ? rm1Max.toFixed(1) : '—'}</strong> kg
            </span>
          </div>

          {/* Nota por ejercicio */}
          <div className="mt-2">
            {notaAbierta ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={nota ?? ''}
                  placeholder="Ej: usar la máquina 5, agarre cerrado…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onGuardarNota((e.target as HTMLInputElement).value);
                      onToggleNota();
                    }
                  }}
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                  autoFocus
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    onGuardarNota(input?.value ?? '');
                    onToggleNota();
                  }}
                  className="px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all"
                >
                  Guardar
                </button>
              </div>
            ) : (
              <button
                onClick={onToggleNota}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 py-2 text-[11px] font-bold text-slate-300 hover:text-white hover:border-amber-500/50 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" /> {nota ? 'Editar nota' : 'Nota'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* F7 · modal de detalle (historial + gráfica) */}
      {detalleAbierto && (
        <DetalleEjercicio
          ejercicio={ejercicio}
          estado={estado}
          pr={pr}
          onCerrar={() => setDetalleAbierto(false)}
        />
      )}
    </div>
  );
};

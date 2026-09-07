// ═══════════════════════════════════════════════════════════
// 🤖 FITBOT VIEW — FitTrack V2 (F3 · Robots)
// Los DOS robots del app viejo, juntos en una vista:
//   • Robot 1 — FitBot (el tuyo): wizard conversacional con la
//     DB de 225 ejercicios, memoria del historial, perfiles A-H
//     y generación de rutina con patrones de movimiento.
//   • Robot 2 — FitBot IA (Claude): entrenador conversacional
//     con tu API key de Anthropic + contexto real de entreno.
// Flujo del wizard (port exacto del viejo L6199-L6760):
// energía → sueño → fatiga → hombro → muñeca → modo → zona →
// cantidad → perfil+memoria → rutina → "Añadir a Entreno de Hoy".
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, Send, Trash2, Loader2, KeyRound, RefreshCw, CheckCircle2, XCircle,
  TriangleAlert, Sparkles, ArrowRight, Moon, Star, Flame, Dumbbell, ThumbsUp,
  Meh, Frown, Footprints, Stethoscope, Target, Hash, Calendar, Bandage,
  BookOpen, Circle, Smile, Heart, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  EstadoDiarioFitBot, EstadoFitTrack, MensajeChat, ModoEntreno, PerfilEntreno, RutinaFitBot,
} from '../types';
import { PARAMETROS_MODO } from '../services/entreno';
import {
  ajustarPerfilPorMemoria, evalReglas, evaluarPerfil, generarMensaje, generarRutinaMulti,
  generarRutinaRehab, guardarEstadoDiario, guardarPerfilActual, guardarRutinaHoy, itemEquipo,
  itemGrupo, itemNombre, itemReps, itemSeries, leerMemoria, mensajeMemoria,
} from '../services/fitbot';
import { FB_PERFILES } from '../data/fitbotDb';
import {
  chatClaude, construirContextoEntrenamiento, convertirRutinaJSON, guardarKeyClaude,
  leerKeyClaude, pareceRutina, type MensajeIA,
} from '../services/claude';
import { vibrar } from '../services/feedback';
import { aplicarEstado } from '../services/storageFit';

interface FitBotViewProps {
  nombre: string;
  estado: EstadoFitTrack;
  perfil: PerfilEntreno | null;
  esDemo: boolean;
  onRutinaCargada: () => void; // App relee claves → Entreno pinta la rutina
  onIrAEntreno: () => void;    // salta a la vista Hoy
}

/** Opción de los botones del wizard */
interface OpcionChat {
  texto: string;
  val: string;
  icono?: LucideIcon;
}

/** Multi-select de zonas (showMultiSelect del viejo) */
interface MultiChat {
  titulo: string;
  opciones: OpcionChat[];
  confirmVal: string;
}

/** Mensaje del chat IA (con estado de rutina ejecutable) */
interface MsgIA {
  id: number;
  de: 'bot' | 'yo';
  texto: string;
  cargando?: boolean;
  rutina?: string;       // texto crudo si parece una rutina
  convirtiendo?: boolean;
  ejecutada?: boolean;
}

/** Render mini-markdown: **negrita** + saltos de línea (estilo appendBotMessage del viejo) */
function renderLinea(linea: string): React.ReactNode {
  const trozos = linea.split(/\*\*(.+?)\*\*/g);
  return trozos.map((t, j) =>
    j % 2 === 1 ? <strong key={j} className="font-black text-white">{t}</strong> : <span key={j}>{t}</span>,
  );
}
const TextoChat: React.FC<{ texto: string }> = ({ texto }) => (
  <>
    {texto.split('\n').map((linea, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {renderLinea(linea)}
      </React.Fragment>
    ))}
  </>
);

export const FitBotView: React.FC<FitBotViewProps> = ({
  nombre, estado, perfil, esDemo, onRutinaCargada, onIrAEntreno,
}) => {
  const [pestana, setPestana] = useState<'robot' | 'ia'>('robot');

  // ═══ Estado compartido ═══
  const [toastLocal, setToastLocal] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const avisar = (mensaje: string) => {
    setToastLocal(mensaje);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastLocal(''), 2600);
  };

  // ═══ ROBOT 1 — wizard ═══
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [opciones, setOpciones] = useState<OpcionChat[] | null>(null);
  const [multi, setMulti] = useState<MultiChat | null>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [paso, setPaso] = useState('p1-energia');
  const [rutinaActual, setRutinaActual] = useState<RutinaFitBot | null>(null);
  const datosRef = useRef<EstadoDiarioFitBot>({});
  const multiTargetRef = useRef<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const limpiarTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const conRetardo = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };
  const decir = (texto: string, ms = 0) => {
    conRetardo(ms, () => setMensajes((m) => [...m, { de: 'bot', texto }]));
  };

  /** Arranca el wizard (initFitBot del viejo: saludo + memoria + paso 1) */
  const iniciarWizard = () => {
    limpiarTimers();
    setMensajes([]);
    setOpciones(null);
    setMulti(null);
    setMultiSel([]);
    setRutinaActual(null);
    datosRef.current = {};
    multiTargetRef.current = [];
    setPaso('p1-energia');

    const memoria = leerMemoria(estado.workoutHistory ?? [], estado.prs, estado.fitbot?.estadoDiario);
    decir(`¡Hola ${nombre}! Soy **FitBot**, tu entrenador personal.`, 100);
    if (memoria.ultimaSesion) {
      const s = memoria.ultimaSesion;
      const extra = mensajeMemoria(memoria);
      const texto =
        `**Última sesión:** ${s.routineName ?? 'Sesión'}\n` +
        `${s.date} · ${(s.exercises ?? []).length} ejercicios · ${(s.volume ?? 0).toLocaleString()} kg` +
        (extra.length > 0 ? '\n\n' + extra.join('\n') : '');
      decir(texto, 600);
    }
    decir('¿Cómo está tu **energía** hoy?', 800);
    conRetardo(900, () => {
      setOpciones([
        { texto: 'Muy Alta', val: 'p1-muyalta', icono: Flame },
        { texto: 'Alta', val: 'p1-alta', icono: Dumbbell },
        { texto: 'Normal', val: 'p1-normal', icono: ThumbsUp },
        { texto: 'Baja', val: 'p1-baja', icono: Meh },
        { texto: 'Muy Baja', val: 'p1-muybaja', icono: Frown },
      ]);
    });
  };

  useEffect(() => {
    iniciarWizard();
    return () => limpiarTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, opciones, multi]);

  /** Pregunta cuántos ejercicios (preguntarCantidad del viejo) */
  const preguntarCantidad = () => {
    decir('¿Cuántos **ejercicios principales** quieres hoy?', 100);
    conRetardo(200, () => {
      setOpciones([2, 3, 4, 5, 6, 7, 8].map((n) => ({
        texto: String(n), val: `cant-${n}`, icono: Hash,
      })));
    });
  };

  /** Muestra la rutina generada en el chat (generarRutinaMulti del viejo) */
  const mostrarRutina = (rutina: RutinaFitBot, estadoDiario: EstadoDiarioFitBot, analisis: ReturnType<typeof evaluarPerfil>) => {
    setRutinaActual(rutina);
    setPaso('rutina-lista');

    const msgs = generarMensaje(estadoDiario, analisis, nombre);
    msgs.forEach((tx, i) => decir(tx, 500 + i * 700));
    const delay = 500 + msgs.length * 700;

    if ((rutina.calentamiento ?? []).length > 0) {
      const mc = '**Calentamiento:**\n\n' +
        (rutina.calentamiento ?? []).map((e, i) => `${i + 1}. ${itemNombre(e)} — ${itemReps(e) || '5 min'}`).join('\n');
      decir(mc, delay);
    }

    const principales = rutina.ejerciciosCompletos ?? [];
    if (principales.length > 0) {
      const mp =
        `**Rutina principal — ${rutina.tipoRutina} (${principales.length} ejercicios):**\n\n` +
        principales.map((e, i) =>
          `${i + 1}. **${itemNombre(e)}**\n   ${itemGrupo(e) || '—'} · ${itemEquipo(e) || '—'} · ${itemSeries(e) || 4}×${itemReps(e) || '8-12'}`,
        ).join('\n\n') +
        (rutina.nota ? `\n\n💬 ${rutina.nota}` : '');
      decir(mp, delay + 700);
    }

    if ((rutina.enfriamiento ?? []).length > 0) {
      const mf = '**Enfriamiento:**\n\n' +
        (rutina.enfriamiento ?? []).map((e, i) => `${i + 1}. ${itemNombre(e)} — ${itemReps(e) || '5 min'}`).join('\n');
      decir(mf, delay + 1400);
    }

    conRetardo(delay + 2100, () => {
      setOpciones([
        { texto: 'Añadir a Entreno de Hoy', val: 'anadir-rutina', icono: CheckCircle2 },
        { texto: 'Ver recomendaciones', val: 'ver-recomendaciones', icono: Sparkles },
        { texto: 'Nueva selección', val: 'restart', icono: RefreshCw },
      ]);
    });
  };

  /** Decide según la opción elegida (handleChatDecision del viejo) */
  const decidir = (op: OpcionChat, multiVals?: string[]) => {
    vibrar([40]);
    setMensajes((m) => [...m, { de: 'yo', texto: op.texto }]);
    setOpciones(null);
    setMulti(null);
    const val = op.val;

    // RESTART
    if (val === 'restart') {
      conRetardo(300, iniciarWizard);
      return;
    }
    if (val === 'ir-entreno') {
      onIrAEntreno();
      return;
    }

    // ═══ PASO 1 — ENERGÍA ═══
    if (paso === 'p1-energia') {
      const map: Record<string, string> = { 'p1-muyalta': 'Muy Alta', 'p1-alta': 'Alta', 'p1-normal': 'Normal', 'p1-baja': 'Baja', 'p1-muybaja': 'Muy baja' };
      datosRef.current.energia = map[val] ?? 'Normal';
      setPaso('p2-sueno');
      decir('¿Cómo dormiste **anoche**?', 500);
      conRetardo(600, () => {
        setOpciones([
          { texto: 'Excelente', val: 'p2-excelente', icono: Star },
          { texto: 'Bueno', val: 'p2-bueno', icono: CheckCircle2 },
          { texto: 'Regular', val: 'p2-regular', icono: Meh },
          { texto: 'Malo', val: 'p2-malo', icono: XCircle },
        ]);
      });
      return;
    }

    // ═══ PASO 2 — SUEÑO ═══
    if (paso === 'p2-sueno') {
      const map: Record<string, string> = { 'p2-excelente': 'Excelente', 'p2-bueno': 'Bueno', 'p2-regular': 'Regular', 'p2-malo': 'Malo' };
      datosRef.current.sueno = map[val] ?? 'Bueno';
      setPaso('p3-fatiga');
      decir('¿Cuánta **fatiga muscular** sientes?', 500);
      conRetardo(600, () => {
        setOpciones([
          { texto: 'Sin fatiga', val: 'p3-0', icono: Smile },
          { texto: 'Leve', val: 'p3-3', icono: Heart },
          { texto: 'Moderada', val: 'p3-5', icono: Circle },
          { texto: 'Alta', val: 'p3-7', icono: Circle },
          { texto: 'Muy alta', val: 'p3-9', icono: Circle },
        ]);
      });
      return;
    }

    // ═══ PASO 3 — FATIGA ═══
    if (paso === 'p3-fatiga') {
      const map: Record<string, number> = { 'p3-0': 0, 'p3-3': 3, 'p3-5': 5, 'p3-7': 7, 'p3-9': 9 };
      datosRef.current.fatiga = map[val] ?? 3;
      setPaso('p4-hombro');
      decir('¿Dolor en **hombro**?', 500);
      conRetardo(600, () => {
        setOpciones([
          { texto: 'Sin dolor', val: 'p4-0', icono: CheckCircle2 },
          { texto: 'Leve', val: 'p4-3', icono: Circle },
          { texto: 'Moderado', val: 'p4-5', icono: Circle },
          { texto: 'Severo', val: 'p4-8', icono: TriangleAlert },
        ]);
      });
      return;
    }

    // ═══ PASO 4 — HOMBRO ═══
    if (paso === 'p4-hombro') {
      const map: Record<string, number> = { 'p4-0': 0, 'p4-3': 3, 'p4-5': 5, 'p4-8': 8 };
      datosRef.current.dolor_hombro = map[val] ?? 0;
      setPaso('p5-muneca');
      decir('¿Dolor en **muñeca**?', 500);
      conRetardo(600, () => {
        setOpciones([
          { texto: 'Sin dolor', val: 'p5-0', icono: CheckCircle2 },
          { texto: 'Leve', val: 'p5-3', icono: Circle },
          { texto: 'Moderado', val: 'p5-5', icono: Circle },
          { texto: 'Severo', val: 'p5-8', icono: TriangleAlert },
        ]);
      });
      return;
    }

    // ═══ PASO 5 — MUÑECA → guardar y preguntar modo ═══
    if (paso === 'p5-muneca') {
      const map: Record<string, number> = { 'p5-0': 0, 'p5-3': 3, 'p5-5': 5, 'p5-8': 8 };
      datosRef.current.dolor_muneca = map[val] ?? 0;
      guardarEstadoDiario(datosRef.current, esDemo);

      setPaso('p5b-modo');
      const modoActual = ((estado.activeMode as ModoEntreno) in PARAMETROS_MODO ? (estado.activeMode as ModoEntreno) : 'hipertrofia');
      const labelActual = PARAMETROS_MODO[modoActual]?.name ?? 'Hipertrofia';
      decir(`¿Qué modo vas hoy?\n\nActual: **${labelActual}**`, 500);
      conRetardo(600, () => {
        const opts: OpcionChat[] = (['hipertrofia', 'fuerza', 'potencia', 'descarga'] as const).map((m) => {
          const p = PARAMETROS_MODO[m];
          return { texto: `${p.name}  ${p.sets}×${p.reps} · ${p.percentage.replace(' 1RM', '')}`, val: `modo-${m}`, icono: Dumbbell };
        });
        opts.push({ texto: `Seguir con ${labelActual}`, val: 'modo-mantener', icono: CheckCircle2 });
        setOpciones(opts);
      });
      return;
    }

    // ═══ PASO 5B — MODO seleccionado ═══
    if (paso === 'p5b-modo') {
      const modoMantener = ((estado.activeMode as ModoEntreno) in PARAMETROS_MODO ? (estado.activeMode as ModoEntreno) : 'hipertrofia');
      const mapModo: Record<string, ModoEntreno> = {
        'modo-hipertrofia': 'hipertrofia',
        'modo-fuerza': 'fuerza',
        'modo-potencia': 'potencia',
        'modo-descarga': 'descarga',
        'modo-mantener': modoMantener,
      };
      const modoElegido = mapModo[val] ?? 'hipertrofia';
      if (!esDemo) aplicarEstado((est) => { est.activeMode = modoElegido; });
      const modeData = PARAMETROS_MODO[modoElegido];
      setPaso('p6-zona');
      decir(`**${modeData.name}** — ${modeData.sets}×${modeData.reps} al ${modeData.percentage}\n_${modeData.note}_`, 300);
      conRetardo(1000, () => {
        decir('¿Qué deseas entrenar hoy?', 0);
        setOpciones([
          { texto: 'Tren Superior', val: 'p6-tren-superior', icono: Dumbbell },
          { texto: 'Tren Inferior', val: 'p6-tren-inferior', icono: Footprints },
          { texto: 'Full Body', val: 'p6-full-body', icono: Dumbbell },
          { texto: 'Cardio', val: 'p6-cardio', icono: Footprints },
          { texto: 'Recuperación', val: 'p6-recuperacion', icono: Moon },
          { texto: 'Rehabilitación', val: 'p6-rehabilitacion', icono: Stethoscope },
          { texto: 'Semana Descarga', val: 'p6-descarga', icono: Moon },
          { texto: 'Personalizado', val: 'p6-custom', icono: Target },
        ]);
      });
      return;
    }

    // ═══ PASO 6 — ZONA ═══
    if (paso === 'p6-zona') {
      // SEMANA DE DESCARGA
      if (val === 'p6-descarga') {
        guardarPerfilActual('D', esDemo);
        guardarEstadoDiario(datosRef.current, esDemo);
        multiTargetRef.current = ['full-body'];
        setPaso('p7-cantidad');
        decir(
          '**Semana de Descarga activada**\n\n' +
          'Perfil D — Volumen reducido al 50%, intensidad baja.\n' +
          'El objetivo es recuperar, no destruir.\n\n' +
          '1. Intensidad: **Baja**\n2. Volumen: **50% del normal**\n3. Duración: **30-45 min**',
          400,
        );
        conRetardo(1200, preguntarCantidad);
        return;
      }

      // REHABILITACIÓN — genera directo, sin preguntar cantidad
      if (val === 'p6-rehabilitacion') {
        guardarEstadoDiario(datosRef.current, esDemo);
        setPaso('generando');
        decir(
          '**Sesión de Rehabilitación**\n\n' +
          'Ejercicios seguros y controlados.\n' +
          'Sin cargas pesadas — enfoque en movilidad y activación.\n\n' +
          '⚙️ Construyendo tu sesión...',
          500,
        );
        const estadoDiario = { ...(estado.fitbot?.estadoDiario ?? {}), ...datosRef.current };
        conRetardo(1200, () => {
          const rutina = generarRutinaRehab(estadoDiario);
          const analisis = evaluarPerfil(estadoDiario);
          mostrarRutina(rutina, estadoDiario, analisis);
        });
        return;
      }

      // PERSONALIZADO → multi-select de zonas
      if (val === 'p6-custom') {
        setPaso('p6-custom');
        decir('Elige las zonas que quieres trabajar:', 400);
        conRetardo(500, () => {
          setMulti({
            titulo: 'Puedes elegir varias',
            confirmVal: 'p6-custom-confirm',
            opciones: [
              { texto: 'Tren Superior', val: 'tren-superior', icono: Dumbbell },
              { texto: 'Tren Inferior', val: 'tren-inferior', icono: Footprints },
              { texto: 'Pecho', val: 'pecho', icono: Flame },
              { texto: 'Espalda', val: 'espalda', icono: Zap },
              { texto: 'Hombros', val: 'hombros', icono: Dumbbell },
              { texto: 'Bíceps', val: 'biceps', icono: Dumbbell },
              { texto: 'Tríceps', val: 'triceps', icono: Zap },
              { texto: 'Piernas', val: 'piernas', icono: Footprints },
              { texto: 'Core', val: 'core', icono: Sparkles },
              { texto: 'Cardio', val: 'cardio', icono: Footprints },
              { texto: 'Rehabilitación', val: 'rehabilitacion', icono: Stethoscope },
              { texto: 'Movilidad', val: 'movilidad', icono: Moon },
            ],
          });
          setMultiSel([]);
        });
        return;
      }

      // OPCIONES DIRECTAS
      const mapZona: Record<string, string[]> = {
        'p6-tren-superior': ['tren-superior'],
        'p6-tren-inferior': ['tren-inferior'],
        'p6-full-body': ['full-body'],
        'p6-cardio': ['cardio'],
        'p6-recuperacion': ['recuperacion'],
      };
      multiTargetRef.current = mapZona[val] ?? ['tren-superior'];
      setPaso('p7-cantidad');
      conRetardo(500, preguntarCantidad);
      return;
    }

    // Zona personalizada confirmada
    if (val === 'p6-custom-confirm') {
      multiTargetRef.current = (multiVals && multiVals.length > 0) ? multiVals : ['pecho'];
      setPaso('p7-cantidad');
      conRetardo(500, preguntarCantidad);
      return;
    }

    // ═══ PASO 7 — CANTIDAD → analizar y generar ═══
    if (paso === 'p7-cantidad') {
      const cantidad = parseInt(val.replace('cant-', ''), 10);
      setPaso('generando');

      const estadoDiario: EstadoDiarioFitBot = { ...(estado.fitbot?.estadoDiario ?? {}), ...datosRef.current };
      const analisis = evaluarPerfil(estadoDiario);

      // Memoria y ajuste de perfil
      const memoria = leerMemoria(estado.workoutHistory ?? [], estado.prs, estadoDiario);
      const perfilAjustado = ajustarPerfilPorMemoria(analisis.perfil, memoria);
      const perfilData = FB_PERFILES[perfilAjustado] ?? FB_PERFILES['B'];
      guardarPerfilActual(perfilAjustado, esDemo);

      decir(
        `**Perfil detectado: ${perfilAjustado} — ${perfilData.nombre}**\n\n` +
        `${analisis.razon}\n\n` +
        `1. Intensidad: **${perfilData.intensidad}**\n` +
        `2. Volumen: **${perfilData.volumen}**\n` +
        `3. Duración estimada: **${perfilData.duracion}**`,
        300,
      );

      const msgsMem = mensajeMemoria(memoria);
      msgsMem.forEach((tx, i) => decir(tx, 800 + i * 500));
      const delayBase = 800 + msgsMem.length * 500;

      decir('⚙️ Construyendo tu sesión...', delayBase + 500);
      conRetardo(delayBase + 1000, () => {
        const rutina = generarRutinaMulti(multiTargetRef.current, estadoDiario, cantidad, estado);
        mostrarRutina(rutina, estadoDiario, analisis);
      });
      return;
    }

    // ═══ AÑADIR RUTINA A ENTRENO DE HOY ═══
    if (val === 'anadir-rutina') {
      const rutina = rutinaActual;
      if (!rutina || !(rutina.ejercicios ?? []).length) {
        decir('Sin rutina guardada. Empezamos de nuevo.', 0);
        conRetardo(300, () => setOpciones([{ texto: 'Empezar de nuevo', val: 'restart', icono: RefreshCw }]));
        return;
      }
      guardarRutinaHoy(rutina, esDemo);
      onRutinaCargada();
      decir(`**¡Listo! ${rutina.ejercicios.length} ejercicios cargados en Entreno de Hoy.**\n\n¡A entrenar! 💪`, 600);
      conRetardo(700, () => {
        setOpciones([
          { texto: 'Ir a Entreno de Hoy', val: 'ir-entreno', icono: ArrowRight },
          { texto: 'Nueva sesión', val: 'restart', icono: RefreshCw },
        ]);
      });
      return;
    }

    // ═══ VER RECOMENDACIONES ═══
    if (val === 'ver-recomendaciones') {
      const estadoDiario: EstadoDiarioFitBot = { ...(estado.fitbot?.estadoDiario ?? {}), ...datosRef.current };
      const reglas = evalReglas(estadoDiario);
      if (reglas.length > 0) {
        decir('**Recomendaciones para hoy:**\n\n' + reglas.slice(0, 3).map((r) => `• ${r.rec}`).join('\n'), 100);
      } else {
        decir('Todo en orden. Puedes entrenar con normalidad hoy.', 100);
      }
      conRetardo(700, () => {
        setOpciones([
          { texto: 'Añadir a Entreno de Hoy', val: 'anadir-rutina', icono: CheckCircle2 },
          { texto: 'Nueva sesión', val: 'restart', icono: RefreshCw },
        ]);
      });
      return;
    }

    // Fallback
    decir('No entendí esa opción. ¿Empezamos de nuevo?', 100);
    conRetardo(400, () => setOpciones([{ texto: 'Empezar de nuevo', val: 'restart', icono: RefreshCw }]));
  };

  // ═══ ROBOT 2 — FitBot IA (Claude) ═══
  const BIENVENIDA_IA =
    '¡Hola! Soy tu FitBot IA 🤖\nConozco tus **225 ejercicios** y puedo armar rutinas personalizadas, ' +
    'explicar técnica o adaptar entrenamientos según cómo te sientas hoy.';
  const [mensajesIA, setMensajesIA] = useState<MsgIA[]>([{ id: 1, de: 'bot', texto: BIENVENIDA_IA }]);
  const [historialIA, setHistorialIA] = useState<MensajeIA[]>([]);
  const [inputIA, setInputIA] = useState('');
  const [cargandoIA, setCargandoIA] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [mostrarConfigKey, setMostrarConfigKey] = useState(false);
  const [tieneKey, setTieneKey] = useState(false);
  const chatIARef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const key = leerKeyClaude();
    setTieneKey(!!key);
    if (!key) setMostrarConfigKey(true);
  }, []);

  useEffect(() => {
    const el = chatIARef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajesIA, mostrarConfigKey]);

  /** Chips de sugerencia rápida (idénticos al viejo) */
  const CHIPS_IA: { texto: string; pregunta: string; clases: string; icono: LucideIcon }[] = [
    { texto: 'Rutina rápida', pregunta: 'Tengo 45 minutos, arma mi rutina de hoy para pecho y tríceps', icono: Dumbbell, clases: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    { texto: 'Lesión', pregunta: 'Me duele la rodilla, qué ejercicios de pierna puedo hacer?', icono: Bandage, clases: 'text-red-400 border-red-500/30 bg-red-500/10' },
    { texto: 'Plan semanal', pregunta: 'Quiero ganar músculo, arma mi plan de la semana', icono: Calendar, clases: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
    { texto: 'Cansado', pregunta: 'Estoy muy cansado hoy, qué entrenamiento ligero me recomiendas?', icono: Moon, clases: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
    { texto: 'Técnica', pregunta: 'Cómo hago correctamente una sentadilla?', icono: BookOpen, clases: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
  ];

  /** Envía un mensaje al robot IA (enviarFitBotIA del viejo) */
  const enviarIA = async (textoParam?: string) => {
    const texto = (textoParam ?? inputIA).trim();
    if (!texto || cargandoIA) return;
    setInputIA('');
    const idUsuario = Date.now();
    setMensajesIA((m) => [...m, { id: idUsuario, de: 'yo', texto }]);
    setMensajesIA((m) => [...m, { id: idUsuario + 1, de: 'bot', texto: 'Pensando…', cargando: true }]);
    setCargandoIA(true);

    const nuevoHistorial: MensajeIA[] = [...historialIA, { role: 'user', content: texto }];
    const contexto = construirContextoEntrenamiento(estado, perfil);
    const resp = await chatClaude(nuevoHistorial, contexto);
    setCargandoIA(false);

    if (resp.error) {
      setMensajesIA((m) => m.map((x) => (x.id === idUsuario + 1 ? { ...x, texto: `⚠️ ${resp.error}`, cargando: false } : x)));
      return;
    }
    const esRutina = pareceRutina(resp.texto);
    setMensajesIA((m) => m.map((x) => (
      x.id === idUsuario + 1
        ? { ...x, texto: resp.texto, cargando: false, rutina: esRutina ? resp.texto : undefined }
        : x
    )));
    setHistorialIA([...nuevoHistorial, { role: 'assistant', content: resp.texto }]);
  };

  /** Convierte la rutina del robot IA y la carga en Entreno de Hoy (ejecutarRutinaIA del viejo) */
  const ejecutarRutinaIA = async (msg: MsgIA) => {
    if (!msg.rutina || msg.ejecutada || msg.convirtiendo) return;
    setMensajesIA((m) => m.map((x) => (x.id === msg.id ? { ...x, convirtiendo: true } : x)));
    const { rutina, error } = await convertirRutinaJSON(msg.rutina);
    if (error || !rutina) {
      setMensajesIA((m) => m.map((x) => (x.id === msg.id ? { ...x, convirtiendo: false } : x)));
      avisar(error ?? 'No se pudo convertir la rutina');
      return;
    }
    guardarRutinaHoy(rutina, esDemo);
    onRutinaCargada();
    setMensajesIA((m) => m.map((x) => (x.id === msg.id ? { ...x, convirtiendo: false, ejecutada: true } : x)));
    avisar('Rutina cargada en Entreno de Hoy');
  };

  const limpiarChatIA = () => {
    setMensajesIA([{ id: Date.now(), de: 'bot', texto: BIENVENIDA_IA }]);
    setHistorialIA([]);
  };

  const guardarKey = () => {
    if (!keyInput.trim()) return;
    guardarKeyClaude(keyInput);
    setTieneKey(true);
    setMostrarConfigKey(false);
    setKeyInput('');
    avisar('API key guardada en tu celular');
  };

  // ═══ RENDER ═══
  const clasesPestana = (activa: boolean) =>
    `flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
      activa
        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
    }`;

  return (
    <div className="space-y-4">
      {/* Selector de robot */}
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Robots">
        <button data-testid="tab-robot-fitbot" onClick={() => setPestana('robot')} className={clasesPestana(pestana === 'robot')}>
          <span className="flex items-center gap-1.5"><Bot className="w-4 h-4" /> Robot FitBot</span>
          <span className="text-[10px] font-normal text-slate-500">El tuyo · 225 ejercicios</span>
        </button>
        <button data-testid="tab-robot-ia" onClick={() => setPestana('ia')} className={clasesPestana(pestana === 'ia')}>
          <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> FitBot IA</span>
          <span className="text-[10px] font-normal text-slate-500">Claude · entrenador personal</span>
        </button>
      </div>

      {pestana === 'robot' && (
        <div data-testid="panel-robot-fitbot" className="rounded-2xl border border-slate-700/60 bg-slate-900/60 flex flex-col h-[72vh] overflow-hidden">
          {/* Header del robot 1 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight">FitBot Alpha</p>
                <p className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">Tu robot · DB de 225</p>
              </div>
            </div>
            <button
              onClick={() => { limpiarTimers(); iniciarWizard(); }}
              title="Reiniciar conversación"
              data-testid="boton-reiniciar-fitbot"
              className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Chat del wizard */}
          <div ref={chatRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-2.5">
            {mensajes.map((m, i) => (
              <div
                key={i}
                data-testid={m.de === 'bot' ? 'burbuja-fitbot' : 'burbuja-usuario'}
                className={`max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.de === 'bot'
                    ? 'self-start rounded-2xl rounded-bl-md bg-slate-800/80 border border-slate-700 text-slate-200'
                    : 'self-end rounded-2xl rounded-br-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-50'
                }`}
              >
                <TextoChat texto={m.texto} />
              </div>
            ))}
            {mensajes.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-4">Iniciando…</p>
            )}
          </div>

          {/* Opciones / multi-select del wizard */}
          <div className="px-4 py-3 border-t border-slate-700/50 shrink-0">
            {multi && (
              <div className="mb-2">
                <p className="text-[10px] text-slate-400 text-center mb-2">{multi.titulo} — toca para activar</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {multi.opciones.map((op) => {
                    const activa = multiSel.includes(op.val);
                    return (
                      <button
                        key={op.val}
                        onClick={() => setMultiSel((s) => (activa ? s.filter((v) => v !== op.val) : [...s, op.val]))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${
                          activa
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 opacity-100'
                            : 'border-slate-600 text-slate-300 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {op.icono && <op.icono className="w-3.5 h-3.5" />} {op.texto}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => decidir({ texto: `Selección confirmada (${multiSel.length})`, val: multi.confirmVal }, multiSel)}
                  disabled={multiSel.length === 0}
                  data-testid="boton-confirmar-zonas"
                  className="mt-3 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg disabled:opacity-40 hover:from-emerald-400 hover:to-teal-500 transition-all"
                >
                  Confirmar {multiSel.length > 0 ? `(${multiSel.length} zona${multiSel.length > 1 ? 's' : ''})` : ''}
                </button>
              </div>
            )}
            {!multi && opciones && (
              <div className="flex flex-wrap gap-2 justify-center">
                {opciones.map((op) => (
                  <button
                    key={op.val}
                    onClick={() => decidir(op)}
                    data-testid={`opcion-${op.val}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-600 text-[12px] font-bold text-slate-200 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-white transition-all"
                  >
                    {op.icono && <op.icono className="w-3.5 h-3.5 text-emerald-400" />} {op.texto}
                  </button>
                ))}
              </div>
            )}
            {!multi && !opciones && (
              <p className="text-[11px] text-slate-500 text-center">FitBot está escribiendo…</p>
            )}
          </div>
        </div>
      )}

      {pestana === 'ia' && (
        <div data-testid="panel-robot-ia" className="rounded-2xl border border-slate-700/60 bg-slate-900/60 flex flex-col h-[72vh] overflow-hidden">
          {/* Header del robot 2 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight">FitBot IA</p>
                <p className="text-[10px] text-violet-400 font-bold tracking-wider uppercase">Claude · Tu entrenador personal</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setMostrarConfigKey((v) => !v)}
                title="API key"
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                  tieneKey
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                    : 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                }`}
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={limpiarChatIA}
                title="Limpiar chat"
                className="w-9 h-9 rounded-xl border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-violet-500/60 hover:bg-violet-500/10 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Config de API key (Ajustes del viejo) */}
          {mostrarConfigKey && (
            <div className="px-4 py-3 border-b border-slate-700/50 shrink-0 bg-violet-500/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-violet-400" />
                <p className="text-xs font-black text-white">FitBot IA — API Key</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarKey(); }}
                  placeholder="API Key de Anthropic (sk-ant-…)"
                  data-testid="input-api-key"
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500/60"
                />
                <button
                  onClick={guardarKey}
                  data-testid="boton-guardar-key"
                  className="px-4 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-bold shadow-lg hover:from-violet-400 hover:to-indigo-500 transition-all"
                >
                  Guardar
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">Se guarda solo en tu celular · Obtén tu key en console.anthropic.com</p>
            </div>
          )}

          {/* Chips de sugerencia rápida */}
          <div className="px-3 py-2 border-b border-slate-700/50 flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
            {CHIPS_IA.map((chip) => (
              <button
                key={chip.texto}
                onClick={() => enviarIA(chip.pregunta)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap shrink-0 ${chip.clases}`}
              >
                <chip.icono className="w-3.5 h-3.5" /> {chip.texto}
              </button>
            ))}
          </div>

          {/* Chat IA */}
          <div ref={chatIARef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-2.5">
            {mensajesIA.map((m) => (
              <React.Fragment key={m.id}>
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.de === 'yo'
                      ? 'self-end rounded-2xl rounded-br-md bg-violet-500/20 border border-violet-500/40 text-violet-50'
                      : 'self-start rounded-2xl rounded-bl-md bg-slate-800/80 border border-violet-500/25 text-slate-200'
                  } ${m.cargando ? 'animate-pulse' : ''}`}
                >
                  <TextoChat texto={m.texto} />
                </div>
                {m.rutina && (
                  <button
                    onClick={() => ejecutarRutinaIA(m)}
                    disabled={m.ejecutada || m.convirtiendo}
                    data-testid="boton-ejecutar-rutina-ia"
                    className={`self-start ml-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all ${
                      m.ejecutada
                        ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-400'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:from-violet-400 hover:to-indigo-500'
                    }`}
                  >
                    {m.ejecutada ? (
                      <><CheckCircle2 className="w-4 h-4" /> En Entreno de Hoy</>
                    ) : m.convirtiendo ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Convirtiendo…</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Ejecutar rutina hoy</>
                    )}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Input IA */}
          <div className="px-3 py-3 border-t border-slate-700/50 flex gap-2 items-end shrink-0">
            <input
              value={inputIA}
              onChange={(e) => setInputIA(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarIA(); } }}
              placeholder="Pregunta sobre tu entrenamiento…"
              data-testid="input-chat-ia"
              disabled={cargandoIA}
              className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 disabled:opacity-60"
            />
            <button
              onClick={() => enviarIA()}
              disabled={cargandoIA || !inputIA.trim()}
              data-testid="boton-enviar-ia"
              className="w-11 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg disabled:opacity-40 hover:from-violet-400 hover:to-indigo-500 transition-all shrink-0"
            >
              {cargandoIA ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Toast local */}
      {toastLocal && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap">
          {toastLocal}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 📋 TIPOS BASE — FitTrack V2 (F0)
// Las vistas corresponden a las 14 secciones del app viejo
// (auditoría: login, onboarding, dashboard, hoy, rutina,
// ejercicios, historial, medidas, fitbot, gymchat, spotify,
// radio, config). Aquí se declaran para que el shell F0 las
// muestre como el roadmap visual de las fases.
// ═══════════════════════════════════════════════════════════

export type VistaApp =
  | 'dashboard'
  | 'hoy'
  | 'rutina'
  | 'ejercicios'
  | 'historial'
  | 'medidas'
  | 'fitbot'
  | 'gymchat'
  | 'spotify'
  | 'radio'
  | 'config'
  | 'perfil';

export interface UsuarioFitTrack {
  uid: string;
  nombre: string;
  email: string;
  foto: string;
}

// ═══════════════════════════════════════════════════════════
// 💾 CLAVES DE STORAGE (regla de oro de la conversión)
// Las claves FITTRACK_* / SPOTIFY_* / GYMCHAT_* pertenecen al
// app VIEJO y SOLO se leen (nunca se renombran) para que los
// datos del usuario sobrevivan sin migración. Toda clave NUEVA
// de la v2 usa el prefijo FT2_ (cero choques).
// ═══════════════════════════════════════════════════════════

export const CLAVE_TEMA = 'FT2_TEMA';

// Inventario completo (exploración del index.html viejo, 2026-09):
// F1 escribe SOLO las que el viejo ya escribía en login/onboarding.
// Las marcadas (vestigial) las escribía el viejo pero jamás las leía.
export const CLAVES_VIEJAS = [
  'FITTRACK_USER_ID',
  'FITTRACK_USER_NAME',
  'FITTRACK_USER_EMAIL',
  'FITTRACK_USER_PHOTO',
  'FITTRACK_NOMBRE',
  'FITTRACK_ONBOARDING_OK',
  'FITTRACK_PERFIL_COMPLETO',
  'FITTRACK_ALPHA_V2_STATE',
  'FITTRACK_ANTHROPIC_KEY',
  'FITTRACK_RUTINA_HOY',
  'FITTRACK_RUTINA_FECHA',
  'FITTRACK_ULTIMA_SESION', // (vestigial)
  'FITTRACK_ULTIMA_FECHA',  // (vestigial)
  'SPOTIFY_VERIFIER',
  'SPOTIFY_TOKEN',
  'SPOTIFY_TOKEN_TIME',
  'SPOTIFY_REFRESH',        // (vestigial)
  'SPOTIFY_CODE',           // (vestigial, solo callback.html)
  'SPOTIFY_CODE_TIME',      // (vestigial, solo callback.html)
  'GYMCHAT_CODIGO',
] as const;

// ═══════════════════════════════════════════════════════════
// 📦 DATOS DEL APP VIEJO (F1 · Acceso)
// Estructuras EXACTAS de FITTRACK_ALPHA_V2_STATE y de las
// claves independientes, para LEER sin migración. Campos
// opcionales: el viejo no siempre los escribía.
// ═══════════════════════════════════════════════════════════

/** Perfil de entrenamiento del wizard viejo → FITTRACK_PERFIL_COMPLETO */
export interface PerfilEntreno {
  objetivo: string;   // 'hipertrofia' | 'fuerza' | 'potencia' | 'descarga'
  nivel: string;      // 'principiante' | 'intermedio' | 'avanzado'
  dias: number;       // 2 | 3 | 4 | 5
  equipo: string;     // 'gym-completo' | 'gym-pequeno' | 'casa' | 'peso-corporal'
  fecha: string;      // 'YYYY-MM-DD'
}

/** Sesión del historial (workoutHistory[i] del state viejo) */
export interface SesionEntreno {
  date: string;        // 'YYYY-MM-DD'
  time?: string;       // 'HH:MM' (sesiones clásicas)
  routineName?: string;
  mode?: string;       // 'hipertrofia' | 'fuerza' | ...
  volume?: number;     // kg totales
  duration?: number;
  completed?: boolean;
  timestamp?: string;  // ISO (sesiones FitBot)
  exercises?: { name: string; sets?: number; reps?: string; weight?: number; volume?: number }[];
  feedback?: { dificultad?: number; energia?: number; dolor?: number; fecha?: string } | null;
}

/** Medida corporal (measurements[i], más reciente primero) — shape exacto del saveMeasurements del viejo (L6042): imc/height/bodyfat/visceral/muscle se guardaban desde el viejo también */
export interface MedidaCorporal {
  date: string;
  weight?: number;
  height?: number;   // talla en cm (default del viejo: 187)
  chest?: number;
  waist?: number;
  arms?: number;
  thighs?: number;
  hips?: number;
  bodyfat?: number;  // grasa corporal %
  visceral?: number;  // grasa visceral
  muscle?: number;    // masa muscular %
  imc?: number;       // calculado al guardar si talla > 0 (L6059)
}

/** PR de un ejercicio (state.prs[id]) */
export interface PRLevantamiento {
  weight: number;
  reps: number;
  value?: number;    // 1RM Epley — campo "value" del viejo (L3513)
  date?: string;
  name?: string;
}

/** State completo del viejo → FITTRACK_ALPHA_V2_STATE (solo lectura en F1) */
export interface EstadoFitTrack {
  streak?: number;
  lastWorkoutDate?: string | null;
  lastWorkoutName?: string;
  workoutHistory?: SesionEntreno[];
  measurements?: MedidaCorporal[];
  prs?: Record<string, PRLevantamiento>;
  logros?: Record<string, string>;
  perfil?: PerfilEntreno | null;
  /** Robot FitBot del viejo: check-in, perfil y rutina recomendada (F3) */
  fitbot?: EstadoFitBot;
  [clave: string]: unknown;
}

/** Respuesta del onboarding F1 (2 etapas del viejo unidas) */
export interface RespuestaOnboarding {
  nombre: string;
  perfil: PerfilEntreno | null; // null = "lo configuro después"
}

// ═══════════════════════════════════════════════════════════
// 🏋️ ENTRENO (F2 · Entreno)
// Estructuras del flujo de sesión del app viejo: modos,
// biblioteca, series en ejecución y feedback post-entreno.
// ═══════════════════════════════════════════════════════════

/** Modo de entreno (state.activeMode del viejo, default 'hipertrofia'); 'descanso' = día de recuperación (L1501-1506) */
export type ModoEntreno = 'hipertrofia' | 'fuerza' | 'potencia' | 'descarga' | 'descanso';

/** Ejercicio de la biblioteca: base o custom (state.customExercises) */
export interface Ejercicio {
  id: string;
  name: string;
  category: string;
}

/** Estado de una serie en ejecución (inputs controlados) */
export interface SerieEstado {
  peso: string;
  reps: string;
  hecha: boolean;
}

/** Feedback post-entreno (workoutHistory[0].feedback del viejo, L4414-4419) */
export interface FeedbackSesion {
  dificultad?: number; // 1-5 (Muy fácil…Agotador)
  energia?: number;    // 1-4 (Agotado…Excelente)
  dolor?: number;      // 0-3 (Sin dolor…Severo)
  fecha?: string;      // ISO
}

/** Notas por ejercicio (state.notasEjercicio del viejo: {nombre: texto}) */
export type NotasEjercicio = Record<string, string>;

// ═══════════════════════════════════════════════════════════
// 🤖 FITBOT (F3 · Robots)
// Estructuras del robot propio (wizard con la DB de 225) y del
// robot IA (Claude). Se escriben en state.fitbot con el MISMO
// shape del viejo (merge quirúrgico, cero migración).
// ═══════════════════════════════════════════════════════════

/** Fila del Excel de 225 ejercicios (claves exactas del viejo) */
export interface EjercicioDB {
  ID: number;
  'Ejercicio': string;
  'Grupo Muscular': string;
  'Tipo': string;
  'Equipo': string;
  'Dificultad': string;
  'Fatiga': string;
  'Seguro Hombro': string;
  'Seguro Muñeca': string;
  'Series': number;
  'Reps': string;
  'Descanso': string;
  'Tempo': string;
  'Explicación': string;
  'Errores Comunes': string;
  'Tips': string;
  'Variaciones': string;
}

/** Ejercicio de bloque: calentamiento (W*) o rehabilitación (R*) */
export interface EjercicioBloque {
  ID: string;
  'Ejercicio': string;
  'Zona': string;
  'Tipo': string;
  'Duración': string;
  'Objetivo': string;
  'Explicación': string;
  'Errores': string;
  'Tips': string;
  'Nivel': string;
}

/** Perfiles del motor de decisión (A-H, viejo L2439) */
export type PerfilFitBot = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

/** Check-in diario del wizard (state.fitbot.estadoDiario del viejo) */
export interface EstadoDiarioFitBot {
  energia?: string;      // 'Muy Alta' … 'Muy baja'
  sueno?: string;        // 'Excelente' … 'Malo'
  fatiga?: number;       // 0-9
  dolor_hombro?: number; // 0-10
  dolor_muneca?: number; // 0-10
  dolor_rodilla?: number;// 0-10
  nombre?: string;
  _ajustePerfil?: string; // 'subir' | 'bajar' | 'mantener' (feedback)
}

/** Rutina generada por el robot (state.fitbot.rutinaRecomendada del viejo) */
export interface RutinaFitBot {
  tipoRutina: string;
  ejercicios: string[];
  ejerciciosCompletos: (EjercicioDB | EjercicioBloque)[];
  calentamiento?: (EjercicioDB | EjercicioBloque)[];
  enfriamiento?: (EjercicioDB | EjercicioBloque)[];
  volumen?: string;
  intensidad?: string;
  nota?: string;
}

/** state.fitbot completo (mismo shape que escribia el viejo) */
export interface EstadoFitBot {
  estadoDiario?: EstadoDiarioFitBot;
  perfilActual?: PerfilFitBot;
  rutinaRecomendada?: RutinaFitBot | null;
  rutinaFecha?: string;
  rutinaActivaEnPantalla?: boolean;
}

/** Mensaje de los chats de ambos robots */
export interface MensajeChat {
  de: 'bot' | 'yo';
  texto: string;
}

/** Respuesta analítica del motor (evaluarPerfil del viejo) */
export interface AnalisisFitBot {
  perfil: PerfilFitBot;
  razon: string;
  icono: string;   // nombre de icono lucide para la burbuja
  urgente: boolean;
}

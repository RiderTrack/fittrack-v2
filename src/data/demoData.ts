// ═══════════════════════════════════════════════════════════
// 🎭 DEMO DATA — FitTrack V2 (F1 · Acceso)
// Datos de EJEMPLO en memoria para el modo demo del login
// ("Explorar con datos de ejemplo"). NUNCA se escriben en las
// claves FITTRACK_* del usuario: el dashboard demo vive solo
// en memoria para poder ver la app completa sin sesión.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, PerfilEntreno } from '../types';

function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SESIONES_DEMO = [
  { date: hace(1), time: '19:10', routineName: 'Espalda + Bíceps', mode: 'hipertrofia', volume: 11430 },
  { date: hace(2), time: '18:45', routineName: 'Pecho + Tríceps', mode: 'hipertrofia', volume: 9880 },
  { date: hace(3), time: '19:30', routineName: 'Piernas', mode: 'hipertrofia', volume: 13200 },
  { date: hace(5), time: '18:20', routineName: 'Hombros + Core', mode: 'hipertrofia', volume: 8650 },
  { date: hace(6), time: '19:00', routineName: 'Full Body', mode: 'potencia', volume: 10240 },
  { date: hace(8), time: '18:55', routineName: 'Pecho + Tríceps', mode: 'hipertrofia', volume: 9620 },
  { date: hace(9), time: '19:15', routineName: 'Espalda + Bíceps', mode: 'hipertrofia', volume: 11110 },
  { date: hace(11), time: '18:40', routineName: 'Piernas', mode: 'hipertrofia', volume: 12890 },
  { date: hace(13), time: '19:25', routineName: 'Core + Cardio', mode: 'descarga', volume: 5400 },
  { date: hace(15), time: '18:30', routineName: 'Pecho + Tríceps', mode: 'hipertrofia', volume: 9410 },
  { date: hace(16), time: '19:05', routineName: 'Hombros', mode: 'hipertrofia', volume: 8130 },
  { date: hace(18), time: '18:50', routineName: 'Espalda + Bíceps', mode: 'hipertrofia', volume: 10920 },
  { date: hace(20), time: '19:35', routineName: 'Piernas', mode: 'fuerza', volume: 13750 },
  { date: hace(22), time: '18:25', routineName: 'Full Body', mode: 'hipertrofia', volume: 9980 },
  { date: hace(23), time: '19:00', routineName: 'Pecho + Tríceps', mode: 'hipertrofia', volume: 9250 },
  { date: hace(25), time: '18:35', routineName: 'Espalda + Bíceps', mode: 'hipertrofia', volume: 10760 },
  { date: hace(27), time: '19:20', routineName: 'Piernas', mode: 'hipertrofia', volume: 12440 },
  { date: hace(29), time: '18:15', routineName: 'Hombros + Core', mode: 'hipertrofia', volume: 8490 },
];

export const ESTADO_DEMO: EstadoFitTrack = {
  streak: 3,
  lastWorkoutDate: hace(1),
  lastWorkoutName: 'Espalda + Bíceps',
  workoutHistory: SESIONES_DEMO,
  measurements: [
    { date: hace(2), weight: 90.2, height: 187, chest: 113, waist: 93, arms: 41.5, thighs: 64, hips: 104, bodyfat: 17.5, visceral: 8, muscle: 44, imc: 25.8 },
    { date: hace(16), weight: 91.5, height: 187, chest: 114, waist: 94, arms: 41, thighs: 64, hips: 105, bodyfat: 18.2, visceral: 9, muscle: 43.5, imc: 26.2 },
    { date: hace(44), weight: 93, height: 187, chest: 115, waist: 95, arms: 42, thighs: 65, hips: 105, bodyfat: 19, visceral: 10, muscle: 43, imc: 26.6 },
  ],
  prs: {
    'press-banca': { weight: 100, reps: 5, date: hace(11), name: 'Press banca' },
    sentadilla: { weight: 140, reps: 3, date: hace(20), name: 'Sentadilla' },
    'peso-muerto': { weight: 160, reps: 2, date: hace(34), name: 'Peso muerto' },
    'press-militar': { weight: 60, reps: 6, date: hace(6), name: 'Press militar' },
  },
  logros: {
    'primer-entreno': hace(29),
    'racha-3': hace(1),
  },
};

export const USUARIO_DEMO = {
  uid: 'demo',
  nombre: 'Campeón (demo)',
  email: 'demo@fittrack.app',
  foto: '',
};

export const PERFIL_DEMO: PerfilEntreno = {
  objetivo: 'hipertrofia',
  nivel: 'intermedio',
  dias: 4,
  equipo: 'gym-completo',
  fecha: hace(30),
};

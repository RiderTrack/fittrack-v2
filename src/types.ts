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

export const CLAVES_VIEJAS = [
  'FITTRACK_USER_ID',
  'FITTRACK_USER_NAME',
  'FITTRACK_USER_EMAIL',
  'FITTRACK_USER_PHOTO',
  'FITTRACK_NOMBRE',
  'FITTRACK_ONBOARDING_OK',
  'FITTRACK_PERFIL_COMPLETO',
  'FITTRACK_RUTINA_HOY',
  'FITTRACK_RUTINA_FECHA',
  'FITTRACK_ULTIMA_SESION',
  'FITTRACK_ULTIMA_FECHA',
  'FITTRACK_ALPHA_V2_STATE',
  'SPOTIFY_TOKEN',
  'SPOTIFY_REFRESH',
  'SPOTIFY_CLIENT_ID',
  'GYMCHAT_CODIGO',
] as const;

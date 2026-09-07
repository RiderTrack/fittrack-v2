// ═══════════════════════════════════════════════════════════
// 👤 PERFIL — FitTrack V2 (F1 · Acceso)
// "Mi Perfil" del viejo en React: cuenta Google (foto, nombre,
// email — de las claves FITTRACK_USER_*, igual que el viejo),
// perfil de entrenamiento (FITTRACK_PERFIL_COMPLETO con el
// mismo wizard para editarlo) y el inventario de datos
// migrados del app actual. Cerrar sesión / cambiar cuenta con
// confirmación inline (como el confirm() del viejo).
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  User, Mail, Dumbbell, Database, LogOut, RefreshCw, Pencil,
  Flame, Ruler, Trophy, Medal, CheckCircle2,
} from 'lucide-react';
import type { EstadoFitTrack, PerfilEntreno, RespuestaOnboarding } from '../types';
import type { CuentaUsuario } from '../hooks/useAuth';

const ETIQUETAS = {
  objetivo: { hipertrofia: 'Ganar músculo', fuerza: 'Fuerza pura', potencia: 'Potencia', descarga: 'Retomar suave' },
  nivel: { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' },
  equipo: {
    'gym-completo': 'Gym completo',
    'gym-pequeno': 'Gym pequeño',
    'casa': 'En casa',
    'peso-corporal': 'Peso corporal',
  },
} as const;

interface PerfilViewProps {
  cuenta: CuentaUsuario;
  estado: EstadoFitTrack;
  perfil: PerfilEntreno | null;
  esDemo: boolean;
  onEditarPerfil: () => void;
  onCerrarSesion: () => void;
}

export const PerfilView: React.FC<PerfilViewProps> = ({
  cuenta, estado, perfil, esDemo, onEditarPerfil, onCerrarSesion,
}) => {
  const [confirmar, setConfirmar] = useState<null | 'logout'>(null);

  const historial = estado.workoutHistory ?? [];
  const stats = [
    { icono: <Dumbbell className="w-4 h-4" />, valor: historial.length, etiqueta: 'Sesiones', id: 'stat-sesiones' },
    { icono: <Ruler className="w-4 h-4" />, valor: estado.measurements?.length ?? 0, etiqueta: 'Medidas', id: 'stat-medidas' },
    { icono: <Trophy className="w-4 h-4" />, valor: Object.keys(estado.prs ?? {}).length, etiqueta: 'PRs', id: 'stat-prs' },
    { icono: <Medal className="w-4 h-4" />, valor: Object.keys(estado.logros ?? {}).length, etiqueta: 'Logros', id: 'stat-logros' },
    { icono: <Flame className="w-4 h-4" />, valor: typeof estado.streak === 'number' ? estado.streak : 0, etiqueta: 'Racha (días)', id: 'stat-racha' },
  ];

  const inicial = (cuenta.nombre || 'C').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-4 pb-4">
      {/* ── Cuenta Google ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
        <div className="flex items-center gap-4">
          {cuenta.foto ? (
            <img
              src={cuenta.foto}
              alt="Foto de perfil"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-600 shadow-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
              <span className="text-2xl font-black text-white">{inicial}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white leading-tight truncate" data-testid="perfil-nombre">
              {cuenta.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <p className="text-xs text-slate-400 truncate">{cuenta.email || 'Sin email'}</p>
            </div>
            {esDemo && (
              <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400">
                MODO DEMO · datos de ejemplo
              </span>
            )}
          </div>
        </div>
        {!esDemo && (
          <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
            Sesión con Google activa. La foto y el email vienen de tu cuenta (solo lectura, como en el app actual).
          </p>
        )}
      </div>

      {/* ── Perfil de entrenamiento ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Perfil de entrenamiento</span>
          </div>
          <button
            onClick={onEditarPerfil}
            data-testid="boton-editar-perfil"
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10"
          >
            <Pencil className="w-3.5 h-3.5" />
            {perfil ? 'Editar' : 'Configurar'}
          </button>
        </div>

        {perfil ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Objetivo</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {ETIQUETAS.objetivo[perfil.objetivo as keyof typeof ETIQUETAS.objetivo] ?? perfil.objetivo}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Nivel</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {ETIQUETAS.nivel[perfil.nivel as keyof typeof ETIQUETAS.nivel] ?? perfil.nivel}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Frecuencia</p>
              <p className="text-sm font-bold text-white mt-0.5">{perfil.dias} días/semana</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Equipo</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {ETIQUETAS.equipo[perfil.equipo as keyof typeof ETIQUETAS.equipo] ?? perfil.equipo}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed">
            Sin perfil configurado. Configúralo para que tus rutinas se armen solas
            (llega en F2 · Entreno).
          </p>
        )}
      </div>

      {/* ── Datos migrados del app actual ── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-bold text-white">Tus datos en este dispositivo</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {stats.map((s) => (
            <div key={s.id} data-testid={s.id} className="text-center rounded-xl bg-slate-800/60 border border-slate-700/50 px-1.5 py-3">
              <div className="inline-flex items-center justify-center text-emerald-400 mb-1.5">{s.icono}</div>
              <p className="text-lg font-black text-white leading-none">{s.valor}</p>
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">{s.etiqueta}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
          {esDemo
            ? 'En el modo demo estos números son de ejemplo. Con tu cuenta Google verás tus datos reales del FitTrack actual.'
            : 'Leídos directamente del FitTrack actual (mismas claves locales). El editor completo llega en F2/F3.'}
        </p>
      </div>

      {/* ── Sesión ── */}
      {!esDemo && (
        <div className="rounded-2xl border border-red-500/20 bg-slate-900/60 p-5">
          {confirmar === 'logout' ? (
            <div>
              <p className="text-sm font-bold text-white mb-1">¿Cerrar la sesión?</p>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Tus datos siguen guardados en este dispositivo. La próxima vez entras con tu
                misma cuenta Google y todo sigue ahí.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmar(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Quedarme
                </button>
                <button
                  onClick={onCerrarSesion}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/90 siempre-blanco text-sm font-bold hover:bg-red-600 transition-all active:scale-[0.98]"
                >
                  Sí, salir
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Sesión activa</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Puedes cambiar de cuenta o salir cuando quieras.
                </p>
              </div>
              <button
                onClick={() => setConfirmar('logout')}
                data-testid="boton-logout"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 hover:border-red-500/60 transition-all shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-slate-500">
              Cambiar de cuenta = cerrar sesión y elegir otra en el login (mismo flujo del app actual).
            </p>
            <RefreshCw className="w-3.5 h-3.5 text-slate-600 ml-auto shrink-0" />
          </div>
        </div>
      )}
    </div>
  );
};

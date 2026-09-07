// ═══════════════════════════════════════════════════════════
// ⚙️ AJUSTES — FitTrack V2 (F6)
// Puerto React de la vista "Ajustes" del viejo (view-config,
// L1779-1918) con las 6 tarjetas que sobreviven al roadmap:
//   1. Recordatorio de entrenamiento (notificación diaria real)
//   2. Mi perfil de entrenamiento (wizard del viejo)
//   3. Mi Perfil (cuenta Google)
//   4. Tema claro/oscuro (persistido FT2_TEMA)
//   5. Fotos de progreso (galería + comparador antes/ahora)
//   6. Respaldo y datos (exportar/importar JSON + reset total)
//   7. Acerca de (versión/plataforma)
// La API key de Claude ya vive en Mi Perfil (F4) — no se
// duplica aquí. El Theme Studio Alpha del viejo no se porta:
// el toggle claro/oscuro de la v2 lo reemplaza.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  AlarmClock, Pencil, User, Sun, Moon, Camera, Download, Upload,
  Trash2, Loader2, Info, CheckCircle2, XCircle, Database, X,
} from 'lucide-react';
import type { EstadoFitTrack, PerfilEntreno } from '../types';
import type { CuentaUsuario } from '../hooks/useAuth';
import { versionApp, nombrePlataforma, esAPK } from '../services/platform';
import {
  HORA_DEFAULT, activarRecordatorio, desactivarRecordatorio, leerRecordatorio,
} from '../services/recordatorio';
import {
  exportarRespaldo, parsearRespaldo, aplicarRespaldo, resetearDatosLocales,
  type RespaldoFitTrack,
} from '../services/respaldo';
import {
  agregarFoto, borrarFoto, comprimirFoto, fotosOrdenadas, parComparador,
} from '../services/fotosProgreso';
import { vibrar } from '../services/feedback';

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

interface AjustesViewProps {
  cuenta: CuentaUsuario;
  estado: EstadoFitTrack;
  perfil: PerfilEntreno | null;
  esDemo: boolean;
  temaClaro: boolean;
  onAlternarTema: () => void;
  onEditarPerfil: () => void;
  onIrPerfil: () => void;
  /** Fuerza re-lectura del state en App tras guardar fotos */
  onCambio: () => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  cuenta, estado, perfil, esDemo, temaClaro, onAlternarTema,
  onEditarPerfil, onIrPerfil, onCambio,
}) => {
  // ── Toast interno (patrón de HistorialView) ──
  const [toast, setToast] = useState('');
  const timerToast = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const avisar = (mensaje: string) => {
    setToast(mensaje);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToast(''), 2800);
  };

  // ── 1. Recordatorio (mismo flujo y textos del viejo) ──
  const rec = leerRecordatorio(estado);
  const [hora, setHora] = useState(rec.hora || HORA_DEFAULT);
  const [recActivo, setRecActivo] = useState(rec.activo);
  const [recTrabajando, setRecTrabajando] = useState(false);

  useEffect(() => {
    const r = leerRecordatorio(estado);
    setHora(r.hora || HORA_DEFAULT);
    setRecActivo(r.activo);
  }, [estado]);

  const alternarRecordatorio = async () => {
    if (recTrabajando) return;
    vibrar([30]);
    setRecTrabajando(true);
    if (recActivo) {
      await desactivarRecordatorio();
      setRecActivo(false);
      avisar('Recordatorio desactivado');
    } else {
      const r = await activarRecordatorio(hora);
      if (r.ok) {
        setRecActivo(true);
        avisar(`Recordatorio diario activado: ${hora}`);
      } else if (r.error === 'web') {
        avisar('Necesitas la nueva APK (con plugin de notificaciones) para activar esto');
      } else if (r.error === 'permiso') {
        avisar('Permiso de notificaciones denegado');
      } else if (r.error === 'hora') {
        avisar('La hora del recordatorio no es válida');
      } else {
        avisar(`Error al programar: ${r.error ?? 'desconocido'}`);
      }
    }
    setRecTrabajando(false);
    onCambio();
  };

  // ── 5. Fotos de progreso ──
  const inputFoto = useRef<HTMLInputElement | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [confirmBorrarFoto, setConfirmBorrarFoto] = useState<number | null>(null);
  const fotos = fotosOrdenadas(estado);
  const par = parComparador(estado);

  const elegirFoto = () => {
    if (subiendoFoto) return;
    inputFoto.current?.click();
  };

  const alCambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir la misma foto dos veces
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const dataUrl = await comprimirFoto(file);
      const r = agregarFoto(dataUrl);
      if (r.ok) {
        vibrar([60]);
        avisar('Foto de progreso guardada');
        onCambio();
      } else {
        avisar('Almacenamiento local casi lleno — exporta un respaldo y borra fotos viejas');
      }
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Error procesando la imagen');
    }
    setSubiendoFoto(false);
  };

  const confirmarBorrarFoto = () => {
    if (confirmBorrarFoto === null) return;
    borrarFoto(confirmBorrarFoto);
    setConfirmBorrarFoto(null);
    avisar('Foto borrada');
    onCambio();
  };

  // ── 6. Respaldo ──
  const inputRespaldo = useRef<HTMLInputElement | null>(null);
  const [exportando, setExportando] = useState(false);
  const [respaldoPendiente, setRespaldoPendiente] = useState<RespaldoFitTrack | null>(null);
  const [nRespaldo, setNRespaldo] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const alExportar = async () => {
    if (exportando) return;
    vibrar([30]);
    setExportando(true);
    const r = await exportarRespaldo();
    setExportando(false);
    if (!r.ok) {
      if (r.motivo === 'sin-datos') avisar('Sin datos para respaldar');
      else if (r.motivo === 'cancelado') avisar('Exportación cancelada');
      else avisar('No se pudo crear el respaldo');
      return;
    }
    avisar(r.compartido
      ? `Respaldo compartido (${r.nClaves} claves)`
      : `${r.archivo} generado (${r.nClaves} claves)`);
  };

  const alImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const texto = await file.text();
      const r = parsearRespaldo(texto);
      if (!r.ok || !r.doc) {
        avisar(r.error ?? 'El archivo no es un respaldo válido.');
        return;
      }
      setRespaldoPendiente(r.doc);
      setNRespaldo(r.nClaves ?? 0);
    } catch {
      avisar('No se pudo leer el archivo de respaldo');
    }
  };

  const confirmarImportar = () => {
    if (!respaldoPendiente) return;
    const n = aplicarRespaldo(respaldoPendiente);
    setRespaldoPendiente(null);
    vibrar([80]);
    avisar(`Respaldo restaurado (${n} claves). Reiniciando…`);
    setTimeout(() => window.location.reload(), 1400);
  };

  const confirmarReset = () => {
    const n = resetearDatosLocales();
    setConfirmReset(false);
    vibrar([100, 50, 100]);
    avisar('Datos borrados. Reiniciando...');
    setTimeout(() => window.location.reload(), 1000);
  };

  const inicial = (cuenta.nombre || 'C').trim().charAt(0).toUpperCase();
  const fechaRespaldo = respaldoPendiente?.fecha
    ? new Date(respaldoPendiente.fecha).toLocaleDateString('es-PE')
    : '';

  return (
    <div className="space-y-4 pb-4" data-testid="ajustes-view">
      {/* ═══ 1 · Recordatorio de entrenamiento ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-recordatorio">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlarmClock className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Recordatorio de entrenamiento</h3>
            <p className="text-[11px] text-slate-400">Notificación diaria, aunque la app esté cerrada.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value || HORA_DEFAULT)}
            disabled={recActivo || recTrabajando}
            data-testid="recordatorio-hora"
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-sm font-bold text-white focus:outline-none focus:border-amber-500/60 disabled:opacity-50"
          />
          <button
            onClick={alternarRecordatorio}
            disabled={recTrabajando}
            data-testid="recordatorio-btn"
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              recActivo
                ? 'border-red-500/40 text-red-300 bg-red-500/10 hover:bg-red-500/20'
                : 'border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
            } disabled:opacity-50`}
          >
            {recTrabajando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlarmClock className="w-3.5 h-3.5" />}
            {recActivo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
        <div
          data-testid="recordatorio-estado"
          className={`mt-3 flex items-center gap-2 text-xs font-medium ${recActivo ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          {recActivo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          {recActivo ? `Recordatorio activo todos los días a las ${hora}` : 'Te avisaremos a tu hora habitual de gym.'}
        </div>
      </div>

      {/* ═══ 2 · Mi perfil de entrenamiento ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-perfil-entreno">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Pencil className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Mi perfil de entrenamiento</h3>
            <p className="text-[11px] text-slate-400">Objetivo, nivel, días por semana y equipo.</p>
          </div>
        </div>
        {perfil ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              ETIQUETAS.objetivo[perfil.objetivo as keyof typeof ETIQUETAS.objetivo] ?? perfil.objetivo,
              ETIQUETAS.nivel[perfil.nivel as keyof typeof ETIQUETAS.nivel] ?? perfil.nivel,
              `${perfil.dias} días/semana`,
              ETIQUETAS.equipo[perfil.equipo as keyof typeof ETIQUETAS.equipo] ?? perfil.equipo,
            ].map((etiqueta) => (
              <span key={etiqueta} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                {etiqueta}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-3">Todavía no lo configuras — ajusta cómo se arman tus rutinas.</p>
        )}
        <button
          onClick={onEditarPerfil}
          data-testid="boton-configurar-perfil"
          className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
        >
          Configurar mi perfil
        </button>
      </div>

      {/* ═══ 3 · Mi Perfil (cuenta) ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-cuenta">
        <div className="flex items-center gap-3">
          {cuenta.foto ? (
            <img src={cuenta.foto} alt="Foto de perfil" referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover border border-slate-600 shadow-lg" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
              <span className="text-sm font-black text-white">{inicial}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{cuenta.nombre}</p>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <User className="w-3 h-3 shrink-0" /> {cuenta.email || 'Cuenta Google'}
            </p>
          </div>
          <button
            onClick={onIrPerfil}
            data-testid="boton-ver-perfil"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:border-emerald-500/60 hover:text-white hover:bg-emerald-500/10 transition-all shrink-0"
          >
            Ver mi perfil
          </button>
        </div>
      </div>

      {/* ═══ 4 · Tema ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-tema">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
            {temaClaro ? <Sun className="w-4.5 h-4.5 text-violet-300" /> : <Moon className="w-4.5 h-4.5 text-violet-300" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-white">Tema</h3>
            <p className="text-[11px] text-slate-400">Claro u oscuro — se recuerda en este teléfono.</p>
          </div>
          <button
            onClick={onAlternarTema}
            data-testid="ajustes-boton-tema"
            className={`relative w-12 h-7 rounded-full border transition-all shrink-0 ${
              temaClaro ? 'bg-violet-500/30 border-violet-500/50' : 'bg-slate-800 border-slate-600'
            }`}
            aria-label="Cambiar tema"
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                temaClaro ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ═══ 5 · Fotos de progreso ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-fotos">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
            <Camera className="w-4.5 h-4.5 text-sky-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-white">Fotos de progreso</h3>
            <p className="text-[11px] text-slate-400">Toma una foto mensual y compara tu evolución.</p>
          </div>
          <button
            onClick={elegirFoto}
            disabled={subiendoFoto}
            data-testid="foto-agregar-btn"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-sky-500/40 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {subiendoFoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {subiendoFoto ? 'Subiendo foto...' : '+ Foto'}
          </button>
        </div>
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={alCambiarFoto}
          className="hidden"
          data-testid="foto-input"
        />

        {/* Comparador antes/ahora (≥2 fotos, como el viejo) */}
        {par && (
          <div className="grid grid-cols-2 gap-3 mb-4" data-testid="foto-comparador">
            {(['antes', 'ahora'] as const).map((etiqueta) => {
              const foto = par[etiqueta];
              return (
                <div key={etiqueta} className="relative">
                  <img
                    src={foto.url}
                    alt={`Foto de progreso ${foto.date}`}
                    referrerPolicy="no-referrer"
                    className={`w-full max-h-[200px] object-contain rounded-xl border ${
                      etiqueta === 'ahora' ? 'border-emerald-500/70' : 'border-slate-600'
                    } bg-slate-950`}
                  />
                  <span className="block text-center text-[10px] text-slate-400 mt-1">
                    {foto.date} ({etiqueta})
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Galería (thumbs 90×120 con la fecha debajo, como el viejo) */}
        {fotos.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1" data-testid="foto-galeria">
            {fotos.map((foto, i) => (
              <div key={`${foto.date}-${i}`} className="relative shrink-0">
                <img
                  src={foto.url}
                  alt={`Foto del ${foto.date}`}
                  referrerPolicy="no-referrer"
                  className="w-[90px] h-[120px] object-cover rounded-lg border border-slate-600 bg-slate-950"
                />
                <span className="block text-center text-[9px] text-slate-500 mt-0.5">{foto.date}</span>
                <button
                  onClick={() => setConfirmBorrarFoto(i)}
                  data-testid={`foto-borrar-${i}`}
                  title="Borrar foto"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 border border-red-300/40 text-white flex items-center justify-center shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Sin fotos todavía — la primera foto de cada mes cuenta la historia.
          </p>
        )}

        {subiendoFoto && (
          <p className="mt-2 text-[11px] text-sky-300 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Guardando foto…
          </p>
        )}
      </div>

      {/* ═══ 6 · Respaldo y datos ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-respaldo">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Database className="w-4.5 h-4.5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Respaldo y datos</h3>
            <p className="text-[11px] text-slate-400">Todo tu progreso en un archivo para cambiar de celular o empezar de cero.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={alExportar}
            disabled={exportando}
            data-testid="respaldo-exportar-btn"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-teal-500/40 text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar respaldo
          </button>
          <button
            onClick={() => inputRespaldo.current?.click()}
            data-testid="respaldo-importar-btn"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:border-teal-500/60 hover:text-white hover:bg-teal-500/10 transition-all flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" /> Importar respaldo
          </button>
          <input
            ref={inputRespaldo}
            type="file"
            accept="application/json,.json"
            onChange={alImportar}
            className="hidden"
            data-testid="respaldo-importar-input"
          />
        </div>

        {/* Reset (el "borrar TODO" del viejo) */}
        <div className="mt-4 pt-4 border-t border-slate-700/60">
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            Si la app te pide el cuestionario una y otra vez, usá este botón para borrar TODO y empezar
            de cero. No afecta tu cuenta Google.
          </p>
          <button
            onClick={() => !esDemo && setConfirmReset(true)}
            disabled={esDemo}
            data-testid="respaldo-reset-btn"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Borrar TODO y reiniciar app
          </button>
          {esDemo && (
            <p className="text-[10px] text-slate-500 mt-1.5">Sal del modo demo para reiniciar de verdad.</p>
          )}
        </div>
      </div>

      {/* ═══ 7 · Acerca de ═══ */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5" data-testid="tarjeta-acerca">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Info className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-white">Acerca de</h3>
            <p className="text-[11px] text-slate-400">
              {versionApp()} · {nombrePlataforma()} · {esAPK() ? 'notificaciones activas' : 'notificaciones solo en APK'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Confirmaciones (modales inline) ═══ */}
      {confirmBorrarFoto !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              <h4 className="text-sm font-black text-white">¿Borrar esta foto?</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              La foto del {fotos[confirmBorrarFoto]?.date} se borra de este teléfono. Si la subiste en
              la app vieja, también queda en tu nube.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmBorrarFoto(null)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrarFoto}
                data-testid="foto-borrar-confirmar"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {respaldoPendiente && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Database className="w-5 h-5 text-teal-400 shrink-0" />
              <h4 className="text-sm font-black text-white">Restaurar respaldo</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Este respaldo tiene <b className="text-teal-300">{nRespaldo} claves</b>
              {fechaRespaldo ? <> del <b className="text-teal-300">{fechaRespaldo}</b></> : null}.
              Reemplazará los entrenamientos, medidas, fotos y ajustes de este teléfono.
              La app se reiniciará al terminar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRespaldoPendiente(null)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImportar}
                data-testid="respaldo-restaurar-confirmar"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-teal-500/50 text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 transition-all"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <h4 className="text-sm font-black text-white">¿Borrar TODOS los datos locales?</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Se borran entrenamientos, medidas, PRs, fotos, la clave IA y los ajustes de este
              teléfono. Tu cuenta Google y la app instalada NO se tocan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarReset}
                data-testid="reset-confirmar"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast interno */}
      {toast && (
        <div
          data-testid="toast-ajustes"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 💬 GYMCHAT VIEW — FitTrack V2 (F5 · Extras)
// Puerto del chat del app viejo (L1969-2423):
//   • Inbox con avatar de inicial, preview y badge de no leídos
//   • Conversación en burbujas (yo emerald / otro gris / rutina
//     violeta con botón "Cargar en mi Rutina Hoy")
//   • Tu código FIT-XXXXXX: copiar / compartir
//   • Unirte con el código de tu compañero (crea la sala)
//   • "● En línea" estático como el viejo (no hay presencia real)
//   • Envío de rutinas: la tuya de hoy (nuevo) o una generada
//     con FitBot IA (mismo flujo del viejo)
//   • La rutina recibida se convierte con el mismo convertidor
//     del robot IA (claude-haiku, reparación de JSON 3 pasos) y
//     aterriza en Entreno de Hoy como el viejo
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle, ArrowLeft, Send, Copy, Share2, UserPlus, Loader2,
  Dumbbell, Bot, CheckCircle2, AlertTriangle, Zap,
} from 'lucide-react';
import {
  miCodigoGym, suscribirInbox, suscribirMensajes, unirsePorCodigo,
  enviarMensaje, marcarLeido, serializarRutinaHoy, type ChatResumen, type MensajeGym,
} from '../services/gymchat';
import { generarTextoRutina, convertirRutinaJSON } from '../services/claude';
import { guardarRutinaHoy } from '../services/fitbot';

interface GymChatViewProps {
  uid: string | null;
  nombre: string;
  esDemo: boolean;
  onRutinaCargada: () => void;
  onIrAEntreno: () => void;
}

const fmtHora = (ts: number): string => {
  if (!ts) return '';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

export const GymChatView: React.FC<GymChatViewProps> = ({
  uid, nombre, esDemo, onRutinaCargada, onIrAEntreno,
}) => {
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const [chatActivo, setChatActivo] = useState<ChatResumen | null>(null);
  const [mensajes, setMensajes] = useState<MensajeGym[]>([]);
  const [texto, setTexto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null); // id del msg
  const [toast, setToast] = useState('');
  const finRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const miCodigo = useMemo(() => miCodigoGym(), []);
  const miNombre = nombre || 'Campeón';

  const avisar = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  // Inbox (la misma suscripción compartida del badge del FAB)
  useEffect(() => {
    if (!uid) return;
    return suscribirInbox(uid, (lista) => {
      setChats(lista);
      // mantener el chat activo fresco (nombre/preview)
      setChatActivo((prev) => (prev ? lista.find((c) => c.id === prev.id) ?? prev : prev));
    });
  }, [uid]);

  // Mensajes de la conversación abierta
  useEffect(() => {
    if (!uid || !chatActivo) { setMensajes([]); return; }
    marcarLeido(chatActivo.id, uid);
    return suscribirMensajes(chatActivo.id, setMensajes);
  }, [uid, chatActivo?.id]);

  // Auto-scroll al último (como el viejo: scrollTop = scrollHeight)
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes.length, chatActivo?.id]);

  // ── Acciones ──
  const unirse = async () => {
    if (!uid || uniendo) return;
    setUniendo(true);
    const res = await unirsePorCodigo(codigo, uid, miNombre);
    setUniendo(false);
    if (res.ok && res.chatId) {
      setCodigo('');
      setChatActivo({ id: res.chatId, otroUid: '', otroNombre: 'Amigo', ultimoTexto: '', ultimoEsRutina: false, ultimoTs: Date.now(), noLeidos: 0 });
      avisar('¡Conectados! Dale un minuto a que cargue la sala');
    } else {
      avisar(res.error || 'No se pudo conectar');
    }
  };

  const enviar = async () => {
    if (!uid || !chatActivo || enviando || !texto.trim()) return;
    setEnviando(true);
    const ok = await enviarMensaje(chatActivo.id, uid, miNombre, texto);
    setEnviando(false);
    if (ok) setTexto('');
    else avisar('No se pudo enviar — revisa tu conexión');
  };

  const enviarMiRutina = async () => {
    if (!uid || !chatActivo || enviando) return;
    const serializada = serializarRutinaHoy();
    if (!serializada) { avisar('No tienes rutina activa para hoy'); return; }
    setEnviando(true);
    const ok = await enviarMensaje(chatActivo.id, uid, miNombre, serializada, true);
    setEnviando(false);
    if (ok) avisar('🏋️ Rutina enviada a tu compañero');
    else avisar('No se pudo enviar la rutina');
  };

  const generarYEnviar = async () => {
    if (!uid || !chatActivo || generando) return;
    setGenerando(true);
    avisar('🤖 Generando rutina con FitBot…');
    const res = await generarTextoRutina();
    if (!res.texto) {
      setGenerando(false);
      avisar(res.error || 'Error al generar la rutina');
      return;
    }
    const ok = await enviarMensaje(chatActivo.id, uid, miNombre, res.texto, true);
    setGenerando(false);
    avisar(ok ? '🤖 Rutina enviada a tu compañero' : 'No se pudo enviar la rutina');
  };

  const cargarRutinaRecibida = async (msg: MensajeGym) => {
    if (convirtiendo) return;
    setConvirtiendo(msg.id);
    const res = await convertirRutinaJSON(msg.texto);
    setConvirtiendo(null);
    if (!res.rutina) {
      avisar(res.error || 'No se pudo convertir la rutina');
      return;
    }
    guardarRutinaHoy(res.rutina, esDemo);
    onRutinaCargada();
    onIrAEntreno();
  };

  // ── Demo / sin sesión ──
  if (!uid) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-sm text-center px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 mb-4">
            <MessageCircle className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-black text-white">GymChat</h2>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            El chat necesita tu cuenta Google para saber quién eres
            (tu código FIT- se ata a tu usuario). Sal del modo demo y
            entra con tu cuenta para chatear con tus compañeros del gym.
          </p>
        </div>
      </div>
    );
  }

  // ═══ CONVERSACIÓN ═══
  if (chatActivo) {
    return (
      <div className="space-y-3 pb-4" data-testid="gymchat-conversacion">
        {/* Header de la conversación */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800 border border-slate-700">
          <button
            onClick={() => setChatActivo(null)}
            data-testid="gymchat-volver"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-300 flex items-center justify-center hover:text-white hover:border-emerald-500/60 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 bg-gradient-to-br from-sky-500 to-sky-700">
            {(chatActivo.otroNombre || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{chatActivo.otroNombre}</p>
            <p className="text-[10px] text-emerald-400">● En línea</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-700/60 p-3 h-[46vh] overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {mensajes.length === 0 && (
            <p className="text-center text-xs text-slate-500 mt-8">
              Aún no hay mensajes — manda el primero 💪
            </p>
          )}
          {mensajes.map((m) => {
            const esMio = m.autorUid === uid;
            if (m.esRutina) {
              return (
                <div key={m.id} className={`max-w-[85%] rounded-2xl p-3 bg-violet-500/15 border border-violet-500/40 ${esMio ? 'self-end' : 'self-start'}`}>
                  <p className="text-[10px] font-bold text-violet-300 mb-1.5 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> {esMio ? 'Rutina enviada' : `Rutina de ${m.autorNombre}`}
                  </p>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-44 overflow-y-auto custom-scrollbar">{m.texto}</pre>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[9px] text-slate-500">{fmtHora(m.timestamp)}</span>
                    {!esMio && (
                      <button
                        onClick={() => cargarRutinaRecibida(m)}
                        disabled={convirtiendo !== null}
                        data-testid="cargar-rutina"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold disabled:opacity-50 transition-colors"
                      >
                        {convirtiendo === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dumbbell className="w-3 h-3" />}
                        {convirtiendo === m.id ? 'Convirtiendo…' : 'Cargar en mi Rutina Hoy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${esMio ? 'self-end bg-emerald-600 text-white' : 'self-start bg-slate-700 text-slate-100'}`}
              >
                {!esMio && <p className="text-[10px] font-bold text-slate-300 mb-0.5">{m.autorNombre}</p>}
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                <p className={`text-[9px] mt-1 text-right ${esMio ? 'text-emerald-200/70' : 'text-slate-400'}`}>{fmtHora(m.timestamp)}</p>
              </div>
            );
          })}
          <div ref={finRef} />
        </div>

        {/* Botones de rutina (como el viejo) */}
        <div className="flex gap-2">
          <button
            onClick={enviarMiRutina}
            disabled={enviando || generando}
            data-testid="enviar-mi-rutina"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-slate-200 hover:border-emerald-500/60 hover:text-white disabled:opacity-50 transition-all"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
            Mi rutina de hoy
          </button>
          <button
            onClick={generarYEnviar}
            disabled={generando || enviando}
            data-testid="generar-rutina"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/50 text-xs font-bold text-violet-300 hover:bg-violet-600/30 disabled:opacity-50 transition-all"
          >
            {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            Generar con FitBot
          </button>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
            maxLength={500}
            placeholder="Escribe a tu compañero…"
            data-testid="gymchat-input"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
          <button
            onClick={() => void enviar()}
            disabled={enviando || !texto.trim()}
            data-testid="gymchat-enviar"
            className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ═══ INBOX ═══
  return (
    <div className="space-y-4" data-testid="gymchat-inbox">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-emerald-500" />
          GymChat
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Chatea con tus amigos del gym por código FIT- · Firestore en tiempo real
        </p>
      </div>

      {/* Tu código */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/40">
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Tu código</p>
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-2xl text-white tracking-widest" data-testid="gymchat-codigo">{miCodigo}</span>
          <button
            onClick={() => {
              try { navigator.clipboard.writeText(miCodigo); avisar('Código copiado ✓'); } catch { avisar('Copia manual: ' + miCodigo); }
            }}
            title="Copiar"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-300 flex items-center justify-center hover:text-white hover:border-emerald-500/60 transition-all"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: 'Mi código GymChat', text: `Agrégame en GymChat con mi código: ${miCodigo}` });
                else { navigator.clipboard.writeText(miCodigo); avisar('Código copiado ✓'); }
              } catch { /* canceló el share */ }
            }}
            title="Compartir"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-300 flex items-center justify-center hover:text-white hover:border-emerald-500/60 transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">Dáselo a tu compañero para que te encuentre</p>
      </div>

      {/* Unirse por código */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> Unirme con el código de mi compañero
        </p>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') void unirse(); }}
            placeholder="FIT-A1B2C3"
            maxLength={12}
            data-testid="gymchat-codigo-input"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 font-mono text-sm text-white placeholder:text-slate-500 uppercase focus:outline-none focus:border-emerald-500/60"
          />
          <button
            onClick={() => void unirse()}
            disabled={uniendo || codigo.length < 6}
            data-testid="gymchat-unirse"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {uniendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Unirme
          </button>
        </div>
      </div>

      {/* Chats */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Mis chats ({chats.length})
        </p>
        {chats.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">Todavía no tienes chats.</p>
            <p className="text-xs text-slate-500 mt-1">
              Comparte tu código arriba o únete con el de tu compañero 💪
            </p>
          </div>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setChatActivo(c)}
              data-testid={`gymchat-chat-${c.id}`}
              className="w-full flex items-center gap-3 px-4 py-3 border-t border-slate-700/60 hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0 bg-gradient-to-br from-sky-500 to-sky-700">
                {(c.otroNombre || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{c.otroNombre}</p>
                <p className="text-xs text-slate-400 truncate">
                  {c.ultimoTexto || 'Sin mensajes aún'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[9px] text-slate-500">{fmtHora(c.ultimoTs)}</span>
                {c.noLeidos > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                    {c.noLeidos > 99 ? '99+' : c.noLeidos}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Ayuda */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Los mensajes viven en Firestore del proyecto del app vieja (los chats que ya
          tenías siguen aquí). Máximo 500 caracteres por mensaje, como el viejo.
          Las rutinas que te manden se cargan directo en tu Entreno de Hoy.
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/50 text-sm font-bold text-emerald-300 shadow-2xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
};

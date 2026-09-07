// ═══════════════════════════════════════════════════════════
// 💬 GYMCHAT — FitTrack V2 (F5 · Extras)
// Puerto fiel del app viejo (index.html L1969-2423):
//   • Colecciones Firestore IDÉNTICAS: gymchats/{chatId} con
//     subcolección mensajes + fittrack_usuarios/{uid} (perfil
//     público para el lookup de códigos FIT-)
//   • Misma clave GYMCHAT_CODIGO del viejo (FIT-XXXXXX base36
//     uppercase, se genera UNA vez y sobrevive la actualización)
//   • Mismo shape de documentos: sala {tipo, miembros[], nombres[],
//     creadoEn, ultimoMsg, noLeidos{}} · mensaje {texto≤500,
//     autorUid, autorNombre, timestamp, esRutina}
//   • Inbox con UN solo onSnapshot compartido (refcount): la vista
//     y el badge del FAB leen la MISMA suscripción, sin dobles reads
//   • El que INGRESA el código crea la sala (.add autogenerado),
//     igual que el viejo; rechaza el propio código y duplicados
//   • NUEVO vs viejo: también puedes enviar TU rutina de hoy tal
//     cual (el viejo solo generaba una nueva con Claude)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, setDoc, updateDoc, onSnapshot,
  query, where, orderBy, limitToLast, limit, increment, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { leerRutinaHoy } from './fitbot';
import type { RutinaFitBot } from '../types';

const CLAVE_CODIGO = 'GYMCHAT_CODIGO';

// ── Tipos ──
export interface ChatResumen {
  id: string;
  otroUid: string;
  otroNombre: string;
  ultimoTexto: string;      // preview (el viejo: '🤖 Rutina enviada' si esRutina)
  ultimoEsRutina: boolean;
  ultimoTs: number;
  noLeidos: number;
}

export interface MensajeGym {
  id: string;
  texto: string;
  autorUid: string;
  autorNombre: string;
  timestamp: number;
  esRutina: boolean;
}

// ═══════════════════════════════════════════════════════════
// 🔑 CÓDIGO FIT- (mismo formato del viejo: FIT- + 6 base36)
// ═══════════════════════════════════════════════════════════

/** Genera un código nuevo con el mismo formato del viejo */
export function generarCodigoFit(): string {
  return 'FIT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Lee el código guardado o crea uno (UNA vez, como el viejo) */
export function miCodigoGym(): string {
  try {
    let codigo = localStorage.getItem(CLAVE_CODIGO);
    if (!codigo) {
      codigo = generarCodigoFit();
      localStorage.setItem(CLAVE_CODIGO, codigo);
    }
    return codigo;
  } catch { return generarCodigoFit(); }
}

/** Publica/actualiza el perfil público para que te encuentren por código
 *  (fittrack_usuarios/{uid} — mismo merge del viejo L2086) */
export async function publicarPerfilGym(uid: string, nombre: string): Promise<void> {
  if (!db || !uid) return;
  try {
    await setDoc(
      doc(db, 'fittrack_usuarios', uid),
      { codigo: miCodigoGym(), nombre: nombre || 'Campeón', uid, updatedAt: Date.now() },
      { merge: true },
    );
  } catch (e) {
    console.warn('GymChat: no se pudo publicar el perfil:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// 📥 INBOX — una sola suscripción compartida (refcount)
// ═══════════════════════════════════════════════════════════

let _inboxUnsub: (() => void) | null = null;
let _inboxListeners = new Set<(chats: ChatResumen[]) => void>();
let _inboxUid: string | null = null;
let _chats: ChatResumen[] = [];

/** Convierte el doc de sala del viejo al resumen que pinta el inbox */
export function aResumen(chatId: string, data: any, miUid: string): ChatResumen {
  const miembros: string[] = Array.isArray(data?.miembros) ? data.miembros : [];
  const nombres: string[] = Array.isArray(data?.nombres) ? data.nombres : [];
  let otroNombre = 'Amigo';
  let otroUid = '';
  for (let i = 0; i < miembros.length; i++) {
    if (miembros[i] !== miUid) {
      otroUid = miembros[i];
      otroNombre = nombres[i] || 'Amigo';
      break;
    }
  }
  const noLeidosMap = (data?.noLeidos ?? {}) as Record<string, number>;
  const ultimo = data?.ultimoMsg;
  return {
    id: chatId,
    otroUid,
    otroNombre,
    ultimoTexto: ultimo?.esRutina ? '🤖 Rutina enviada' : String(ultimo?.texto ?? '').substring(0, 40),
    ultimoEsRutina: !!ultimo?.esRutina,
    ultimoTs: ultimo?.ts ?? data?.creadoEn ?? 0,
    noLeidos: Number(noLeidosMap[miUid] ?? 0),
  };
}

/** Se suscribe al inbox (abre el onSnapshot la primera vez; lo cierra
 *  cuando la última vista/badge se desuscribe). Devuelve unsubscribe. */
export function suscribirInbox(uid: string, cb: (chats: ChatResumen[]) => void): () => void {
  if (!db || !uid) return () => {};
  // cambio de usuario (p.ej. cambio de cuenta sin recargar)
  if (_inboxUnsub && _inboxUid !== uid) {
    _inboxUnsub();
    _inboxUnsub = null;
    _inboxUid = null;
    _chats = [];
  }
  _inboxListeners.add(cb);
  if (!_inboxUnsub) {
    _inboxUid = uid;
    _inboxUnsub = onSnapshot(
      query(collection(db, 'gymchats'), where('miembros', 'array-contains', uid)),
      (snap) => {
        // orden en cliente por ultimoMsg.ts desc (el viejo no usaba orderBy
        // — sin índice compuesto, así seguimos sin necesitarlo)
        _chats = snap.docs
          .map((d) => aResumen(d.id, d.data(), uid))
          .sort((a, b) => b.ultimoTs - a.ultimoTs);
        _inboxListeners.forEach((l) => l(_chats));
      },
      (e) => {
        console.warn('GymChat: error del inbox:', e);
        _chats = [];
        _inboxListeners.forEach((l) => l(_chats));
      },
    );
  }
  cb(_chats); // estado inmediato
  return () => {
    _inboxListeners.delete(cb);
    if (_inboxListeners.size === 0 && _inboxUnsub) {
      _inboxUnsub();
      _inboxUnsub = null;
      _inboxUid = null;
    }
  };
}

/** Total de no leídos (para el badge del FAB, cap 99 como el viejo) */
export function totalNoLeidos(chats: ChatResumen[]): number {
  return Math.min(99, chats.reduce((n, c) => n + (c.noLeidos > 0 ? c.noLeidos : 0), 0));
}

// ═══════════════════════════════════════════════════════════
// 🔗 UNIRSE POR CÓDIGO (mismo flujo del viejo L2393-2423)
// ═══════════════════════════════════════════════════════════

export interface ResultadoUnion {
  ok: boolean;
  chatId?: string;
  error?: string;
}

/** Busca al dueño del código y crea (o reusa) la sala 1-a-1 */
export async function unirsePorCodigo(codigoCrudo: string, miUid: string, miNombre: string): Promise<ResultadoUnion> {
  if (!db) return { ok: false, error: 'Sin conexión con Firestore' };
  const codigo = (codigoCrudo || '').trim().toUpperCase();
  if (!codigo || codigo.length < 6) return { ok: false, error: 'Escribe el código completo (FIT-A1B2C3)' };
  if (codigo === miCodigoGym()) return { ok: false, error: 'Ese es TU código 🤭' };

  try {
    // 1) buscar al dueño
    const snap = await getDocs(query(collection(db, 'fittrack_usuarios'), where('codigo', '==', codigo), limit(1)));
    if (snap.empty) return { ok: false, error: 'Nadie con ese código — que tu amigo abra GymChat una vez' };
    const otro = snap.docs[0].data() as { uid?: string; nombre?: string };
    const otroUid = otro?.uid ?? '';
    if (!otroUid) return { ok: false, error: 'Perfil incompleto del otro lado' };
    const otroNombre = otro?.nombre || 'Amigo';

    // 2) ¿ya tenemos sala con él? (mismo chequeo del viejo)
    const existente = _chats.find((c) => c.otroUid === otroUid);
    if (existente) return { ok: true, chatId: existente.id };

    // 3) crear la sala (el que ingresa el código crea — como el viejo)
    const ref = await addDoc(collection(db, 'gymchats'), {
      tipo: 'directo',
      miembros: [miUid, otroUid],
      nombres: [miNombre || 'Campeón', otroNombre],
      creadoEn: Date.now(),
      ultimoMsg: null,
    });
    return { ok: true, chatId: ref.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar' };
  }
}

// ═══════════════════════════════════════════════════════════
// 💬 MENSAJES (mismo shape y límites del viejo L2184-2244)
// ═══════════════════════════════════════════════════════════

/** Escucha los últimos 50 mensajes de la sala (orden asc) */
export function suscribirMensajes(chatId: string, cb: (msgs: MensajeGym[]) => void): () => void {
  if (!db || !chatId) return () => {};
  return onSnapshot(
    query(collection(db, 'gymchats', chatId, 'mensajes'), orderBy('timestamp', 'asc'), limitToLast(50)),
    (snap) => {
      const msgs: MensajeGym[] = snap.docs.map((d) => {
        const v = d.data() as any;
        return {
          id: d.id,
          texto: String(v?.texto ?? ''),
          autorUid: String(v?.autorUid ?? ''),
          autorNombre: String(v?.autorNombre ?? 'Campeón'),
          timestamp: Number(v?.timestamp ?? 0),
          esRutina: !!v?.esRutina,
        };
      });
      cb(msgs);
    },
    (e) => {
      console.warn('GymChat: error de mensajes:', e);
      cb([]);
    },
  );
}

/** Envía un mensaje (texto ≤500 como el viejo) + actualiza sala */
export async function enviarMensaje(
  chatId: string,
  miUid: string,
  miNombre: string,
  texto: string,
  esRutina = false,
): Promise<boolean> {
  if (!db) return false;
  const limpio = (texto || '').trim().substring(0, 500);
  if (!limpio) return false;
  const msg = {
    texto: limpio,
    autorUid: miUid,
    autorNombre: miNombre || 'Yo',
    timestamp: Date.now(),
    esRutina,
  };
  try {
    await addDoc(collection(db, 'gymchats', chatId, 'mensajes'), msg);
    // ultimoMsg + noLeidos del otro (misma secuencia del viejo L2280-2290)
    const refSala = doc(db, 'gymchats', chatId);
    await updateDoc(refSala, {
      ultimoMsg: { texto: esRutina ? '🤖 Rutina enviada' : limpio.substring(0, 40), esRutina, ts: msg.timestamp },
    });
    const chat = _chats.find((c) => c.id === chatId);
    const otroUid = chat?.otroUid;
    if (otroUid) {
      try { await updateDoc(refSala, { [`noLeidos.${otroUid}`]: increment(1) }); } catch { /* sin datos del otro */ }
    }
    return true;
  } catch (e) {
    console.warn('GymChat: no se pudo enviar:', e);
    return false;
  }
}

/** Al abrir la conversación: no leídos a 0 (viejo L2179-2181) */
export async function marcarLeido(chatId: string, miUid: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'gymchats', chatId), { [`noLeidos.${miUid}`]: 0 });
  } catch { /* la sala puede no existir aún */ }
}

// ═══════════════════════════════════════════════════════════
// 🏋️ RUTINAS POR CHAT (viejo L2252-2375 + NUEVO: la tuya)
// ═══════════════════════════════════════════════════════════

/** Serializa la rutina de HOY a texto legible para el chat
 *  (NUEVO: el viejo solo mandaba rutinas generadas por Claude) */
export function serializarRutinaHoy(): string | null {
  const rutina = leerRutinaHoy();
  if (!rutina) return null;
  return serializarRutina(rutina);
}

/** La rutina en texto (misma info que pinta EntrenoView, compacta) */
export function serializarRutina(r: RutinaFitBot): string {
  // Los bloques (calentamiento W*/rehab R*) traen Duración, no Series×Reps
  const fmtEj = (e: RutinaFitBot['ejerciciosCompletos'][number]): string => {
    const nombre = e['Ejercicio'];
    if ('Series' in e) {
      let s = `${nombre} — ${e.Series}×${e.Reps}`;
      const extras: string[] = [];
      if (e['Grupo Muscular']) extras.push(e['Grupo Muscular']);
      if (e['Descanso']) extras.push(`descanso ${e['Descanso']}`);
      if (extras.length) s += ` (${extras.join(' · ')})`;
      return s;
    }
    const dur = e['Duración'] || '';
    return dur ? `${nombre} — ${dur}` : nombre;
  };
  const lineas: string[] = [];
  lineas.push(`🏋️ ${r.tipoRutina || 'Rutina de entrenamiento'}`);
  if (r.nota) lineas.push(r.nota);
  if (r.calentamiento?.length) {
    lineas.push('');
    lineas.push('CALENTAMIENTO');
    r.calentamiento.forEach((e) => lineas.push(`• ${fmtEj(e)}`));
  }
  if (r.ejerciciosCompletos?.length) {
    lineas.push('');
    lineas.push('EJERCICIOS');
    r.ejerciciosCompletos.forEach((e) => lineas.push(`• ${fmtEj(e)}`));
  }
  if (r.enfriamiento?.length) {
    lineas.push('');
    lineas.push('ENFRIAMIENTO');
    r.enfriamiento.forEach((e) => lineas.push(`• ${fmtEj(e)}`));
  }
  return lineas.join('\n').substring(0, 500);
}

// ═══════════════════════════════════════════════════════════
// 🤖 ROBOT IA — FitTrack V2 (F3 · Robots)
// El segundo robot del app viejo: FitBot IA, el entrenador
// conversacional potenciado con Claude (Anthropic). Misma key
// (FITTRACK_ANTHROPIC_KEY guardada SOLO en el celular), mismos
// modelos (claude-sonnet-4-6 / claude-haiku-4-5) y mismo
// contexto real de entrenamiento que el viejo le pasaba.
// Fuente: index.html del viejo L7936-L8150 + L2200-L2340.
// ═══════════════════════════════════════════════════════════

import type { EstadoFitTrack, PerfilEntreno, RutinaFitBot } from '../types';
import { FB_EJERCICIOS_DB } from '../data/fitbotDb';

/** Clave EXACTA del viejo: la API key vive solo en el localStorage del usuario */
const CLAVE_ANTHROPIC = 'FITTRACK_ANTHROPIC_KEY';

/** Lee la API key (getFitBotKey del viejo) */
export function leerKeyClaude(): string {
  try { return window.localStorage.getItem(CLAVE_ANTHROPIC) ?? ''; } catch { return ''; }
}

/** Guarda la API key (como el Ajustes del viejo) */
export function guardarKeyClaude(key: string): void {
  try { window.localStorage.setItem(CLAVE_ANTHROPIC, key.trim()); } catch { /* sin storage */ }
}

export function borrarKeyClaude(): void {
  try { window.localStorage.removeItem(CLAVE_ANTHROPIC); } catch { /* sin storage */ }
}

/** Enmascara la clave para mostrarla segura: sk-ant-…f2aB (F4) */
export function enmascararKey(key: string): string {
  if (!key) return '';
  if (key.length <= 15) return `${key.slice(0, 5)}${'•'.repeat(6)}`;
  return `${key.slice(0, 11)}…${key.slice(-4)}`;
}

/**
 * Prueba la clave con un ping mínimo a Claude (F4 · Configuración):
 * valida 401 (clave inválida), cuota y conectividad sin gastar
 * tokens de chat (max_tokens 16, modelo haiku).
 */
export async function probarKeyClaude(key: string): Promise<{ ok: boolean; error?: string }> {
  if (!key.trim()) return { ok: false, error: 'Primero guarda una clave.' };
  const r = await llamarClaude(key, 'Responde únicamente: OK', [{ role: 'user', content: 'ping' }], 16, 'claude-haiku-4-5');
  return r.error ? { ok: false, error: r.error } : { ok: true };
}

// ═══════════════════════════════════════════════════════════
// 📊 CONTEXTO REAL (construirContextoEntrenamiento, viejo L7966)
// ═══════════════════════════════════════════════════════════

/** Resumen del historial real del usuario para darle contexto al robot IA */
export function construirContextoEntrenamiento(
  estado: EstadoFitTrack,
  perfil: PerfilEntreno | null | undefined,
): string {
  try {
    const partes: string[] = [];
    const hist = estado.workoutHistory ?? [];
    const prs = estado.prs ?? {};

    // Perfil del onboarding
    if (perfil) {
      partes.push(`- Perfil: objetivo ${perfil.objetivo ?? '?'}, nivel ${perfil.nivel ?? '?'}, ${perfil.dias ?? '?'} días/semana, entrena en ${perfil.equipo ?? '?'}. Adapta ejercicios al equipo disponible.`);
    }

    // Días desde el último entreno
    if (estado.lastWorkoutDate) {
      const [y, m, d] = estado.lastWorkoutDate.split('-').map(Number);
      const dias = y && m && d ? Math.floor((Date.now() - new Date(y, m - 1, d, 12).getTime()) / 86_400_000) : null;
      if (dias !== null) partes.push(`- Días desde el último entrenamiento: ${dias}`);
    }
    partes.push(`- Racha actual: ${estado.streak ?? 0} días`);

    // Últimas 5 sesiones
    if (hist.length > 0) {
      partes.push('- Últimas sesiones:');
      hist.slice(0, 5).forEach((s) => {
        partes.push(`  · ${s.date ?? '?'}: ${s.routineName ?? '?'} (${s.mode ?? '?'}, ${(s.exercises ?? []).length} ejercicios, ${s.volume ?? 0} kg)`);
      });
    } else {
      partes.push('- Sin sesiones registradas todavía.');
    }

    // Top PRs
    const prKeys = Object.keys(prs).slice(0, 6);
    if (prKeys.length > 0) {
      partes.push('- PRs actuales: ' + prKeys.map((k) => {
        const p = prs[k];
        return `${p.name ?? k} ${p.weight}kg×${p.reps}`;
      }).join(', '));
    }

    // Detección de estancamiento: mismo peso máximo 3+ sesiones seguidas
    const porEjercicio: Record<string, number[]> = {};
    hist.slice(0, 12).forEach((s) => {
      (s.exercises ?? []).forEach((e) => {
        if (!e.name || !e.sets || (Array.isArray(e.sets) ? e.sets.length === 0 : true)) return;
        const setsArr = Array.isArray(e.sets) ? e.sets : [];
        const maxP = Math.max(0, ...setsArr.map((x) => x.weight ?? 0));
        if (!porEjercicio[e.name]) porEjercicio[e.name] = [];
        porEjercicio[e.name].push(maxP);
      });
    });
    const estancados: string[] = [];
    Object.keys(porEjercicio).forEach((n) => {
      const pesos = porEjercicio[n];
      if (pesos.length >= 3 && pesos[0] === pesos[1] && pesos[1] === pesos[2] && pesos[0] > 0) {
        estancados.push(`${n} (${pesos[0]}kg hace 3+ sesiones)`);
      }
    });
    if (estancados.length > 0) partes.push('- ESTANCAMIENTOS detectados: ' + estancados.join(', ') + '. Sugiere estrategias para romperlos.');

    // Peso corporal reciente
    if (estado.measurements && estado.measurements.length > 0) {
      partes.push(`- Peso corporal más reciente: ${estado.measurements[0].weight ?? '?'} kg (${estado.measurements[0].date ?? '?'})`);
    }
    return partes.join('\n');
  } catch {
    return '(sin datos disponibles)';
  }
}

// ═══════════════════════════════════════════════════════════
// 💬 CHAT CON CLAUDE (enviarFitBotIA del viejo, L8045)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 🏋️ F5 — RUTINA PARA ENVIAR POR GYMCHAT (viejo L2252-2296)
// El mismo prompt y modelo del viejo: genera una rutina completa
// en texto plano y se manda como mensaje esRutina al compañero.
// ═══════════════════════════════════════════════════════════

/** Genera el TEXTO de una rutina para enviar por GymChat
 *  (gymChatEnviarRutina del viejo — claude-sonnet-4-6, 800 tokens) */
export async function generarTextoRutina(): Promise<{ texto?: string; error?: string }> {
  const key = leerKeyClaude();
  if (!key) return { error: 'Configura tu API key de Anthropic primero (Mi Perfil).' };
  return llamarClaude(
    key,
    '',
    [{ role: 'user', content: 'Genera una rutina de entrenamiento completa para hoy. Incluye: nombre de la rutina, grupos musculares, 5-6 ejercicios con series, repeticiones y descanso. Formato limpio y conciso en español.' }],
    800,
    'claude-sonnet-4-6',
  );
}

export interface MensajeIA {
  role: 'user' | 'assistant';
  content: string;
}

const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages';

export interface RespuestaClaude {
  texto: string;
  error?: string;
}

/** Llama a la API de Claude con el system prompt del robot (modelo haiku del viejo).
 *  F10: ahora es export — lo reutilizan SaludBot y el recetario IA (saludIa.ts) */
export async function llamarClaude(
  key: string,
  system: string,
  mensajes: MensajeIA[],
  maxTokens: number,
  modelo: string,
): Promise<RespuestaClaude> {
  let data: { content?: { type: string; text?: string }[]; error?: { message?: string } };
  try {
    const r = await fetch(URL_ANTHROPIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: modelo, max_tokens: maxTokens, system, messages: mensajes }),
    });
    data = await r.json();
  } catch (e) {
    return { texto: '', error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' };
  }
  if (data.error) return { texto: '', error: data.error.message ?? 'Error de la API de Anthropic (revisa tu key).' };
  let texto = '';
  (data.content ?? []).forEach((b) => { if (b.type === 'text' && b.text) texto += b.text; });
  if (!texto) return { texto: '', error: 'No pude procesar. Intenta de nuevo.' };
  return { texto };
}

/** Envía el chat del robot IA (system con la DB de 225 + contexto real del usuario) */
export async function chatClaude(
  historial: MensajeIA[],
  contextoReal: string,
): Promise<RespuestaClaude> {
  const key = leerKeyClaude();
  if (!key) return { texto: '', error: 'Configura tu API key de Anthropic primero (console.anthropic.com).' };

  // Resumen de la base de ejercicios (primeros 60, igual que el viejo)
  const ejerciciosResumen = FB_EJERCICIOS_DB.slice(0, 60)
    .map((e) => `${e['Ejercicio']} (${e['Grupo Muscular']})`).join(', ');
  const system =
    'Eres FitBot IA, entrenador personal experto en español. Tienes acceso a esta base de ejercicios: ' +
    ejerciciosResumen +
    '. Sugiere rutinas usando esos ejercicios con series, reps y descansos. Si hay lesión, adapta. ' +
    'Sé conciso, motivador y usa emojis.\n\nDATOS REALES DEL USUARIO (úsalos para personalizar tus consejos, ' +
    'detectar estancamientos y celebrar progreso):\n' + contextoReal;

  return llamarClaude(key, system, historial, 800, 'claude-haiku-4-5');
}

// ═══════════════════════════════════════════════════════════
// 🔄 CONVERTIR RUTINA DE TEXTO → JSON (ejecutarRutinaIA, L8083)
// ═══════════════════════════════════════════════════════════

/** ¿La respuesta del robot parece una rutina? (heurística del viejo) */
export function pareceRutina(texto: string): boolean {
  return /series|reps|repeticiones|ejercicio|minutos|descanso|rutina/i.test(texto);
}

interface ItemIA {
  'Ejercicio'?: string;
  'Grupo Muscular'?: string;
  'Series'?: string | number;
  'Reps'?: string;
  'Descanso'?: string;
  'Tecnica'?: string;
  [k: string]: unknown;
}

/**
 * Pide a Claude que convierta el texto de la rutina en JSON
 * estructurado (calentamiento + principales + enfriamiento) —
 * con la reparación de JSON truncado de 3 pasos del viejo.
 */
export async function convertirRutinaJSON(texto: string): Promise<{ rutina?: RutinaFitBot; error?: string }> {
  const key = leerKeyClaude();
  if (!key) return { error: 'Configura tu API key de Anthropic primero.' };

  const system = 'Convierte la rutina de entrenamiento en JSON. Responde SOLO con JSON válido, sin texto extra, ' +
    'sin markdown. Incluye TODAS las secciones que aparezcan en la rutina (calentamiento, ejercicios ' +
    'principales/auxiliares y enfriamiento/estiramientos). Si una sección no existe en el texto, devuélvela como ' +
    'array vacío. Para CADA ejercicio incluye el campo Tecnica con UNA sola frase corta (máximo 15 palabras). ' +
    'NO incluyas campos Errores ni Tips. Sé breve para que el JSON quede completo. Formato exacto: ' +
    '{"tipoRutina":"Nombre","calentamiento":[{"Ejercicio":"Nombre","Grupo Muscular":"Calentamiento","Series":"1",' +
    '"Reps":"5 min","Descanso":"30s","Tecnica":"..."}],"ejerciciosCompletos":[{"Ejercicio":"Nombre",' +
    '"Grupo Muscular":"Grupo","Series":"3","Reps":"8-12","Descanso":"60s","Tecnica":"..."}],' +
    '"enfriamiento":[{"Ejercicio":"Nombre","Grupo Muscular":"Enfriamiento","Series":"1","Reps":"30s",' +
    '"Descanso":"20s","Tecnica":"..."}]}';

  const resp = await llamarClaude(key, system, [{ role: 'user', content: 'Convierte esta rutina a JSON: ' + texto.substring(0, 5000) }], 8000, 'claude-haiku-4-5');
  if (resp.error) return { error: resp.error };

  let jsonStr = resp.texto.replace(/```json/g, '').replace(/```/g, '').trim();

  let rutina: { tipoRutina?: string; calentamiento?: ItemIA[]; ejerciciosCompletos?: ItemIA[]; enfriamiento?: ItemIA[] } | null = null;
  // Intento 1: parseo directo
  try { rutina = JSON.parse(jsonStr); } catch { /* sigue */ }
  // Intento 2: extraer el objeto más grande
  if (!rutina) {
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) { try { rutina = JSON.parse(m[0]); } catch { /* sigue */ } }
  }
  // Intento 3: REPARAR JSON truncado (recortar al último objeto completo y cerrar)
  if (!rutina && jsonStr.includes('"ejerciciosCompletos"')) {
    try {
      const corte = jsonStr.lastIndexOf('}');
      if (corte > 0) {
        let parcial = jsonStr.substring(0, corte + 1);
        const abrLlave = (parcial.match(/\{/g) ?? []).length;
        const cerLlave = (parcial.match(/\}/g) ?? []).length;
        const abrCorch = (parcial.match(/\[/g) ?? []).length;
        const cerCorch = (parcial.match(/\]/g) ?? []).length;
        for (let i = 0; i < abrCorch - cerCorch; i++) parcial += ']';
        for (let i = 0; i < abrLlave - cerLlave; i++) parcial += '}';
        rutina = JSON.parse(parcial);
      }
    } catch { /* no se pudo reparar */ }
  }

  if (!rutina || !rutina.ejerciciosCompletos || rutina.ejerciciosCompletos.length === 0) {
    return { error: 'No se pudo convertir la rutina. Pide una rutina más corta e intenta de nuevo.' };
  }

  // Normalizar cada ejercicio al formato de la DB (fallback de técnica por nombre)
  const normalizar = (lista: ItemIA[] | undefined): RutinaFitBot['ejerciciosCompletos'] =>
    (lista ?? []).map((ex) => {
      const nombre = ex['Ejercicio'] ?? 'Ejercicio';
      const enDB = FB_EJERCICIOS_DB.find((e) => e['Ejercicio'].toLowerCase() === nombre.toLowerCase());
      return {
        ID: enDB ? enDB['ID'] : -1,
        'Ejercicio': nombre,
        'Grupo Muscular': ex['Grupo Muscular'] ?? enDB?.['Grupo Muscular'] ?? '',
        'Tipo': enDB?.['Tipo'] ?? '',
        'Equipo': enDB?.['Equipo'] ?? '',
        'Dificultad': enDB?.['Dificultad'] ?? 'Media',
        'Fatiga': enDB?.['Fatiga'] ?? 'Media',
        'Seguro Hombro': enDB?.['Seguro Hombro'] ?? 'Sí',
        'Seguro Muñeca': enDB?.['Seguro Muñeca'] ?? 'Sí',
        'Series': parseInt(String(ex['Series'] ?? enDB?.['Series'] ?? 3), 10) || 3,
        'Reps': ex['Reps'] ?? enDB?.['Reps'] ?? '10-12',
        'Descanso': ex['Descanso'] ?? enDB?.['Descanso'] ?? '60s',
        'Tempo': enDB?.['Tempo'] ?? '2-0-2',
        'Explicación': ex['Tecnica'] ?? enDB?.['Explicación'] ?? 'Ejecuta con técnica controlada.',
        'Errores Comunes': enDB?.['Errores Comunes'] ?? '',
        'Tips': enDB?.['Tips'] ?? '',
        'Variaciones': enDB?.['Variaciones'] ?? '',
      };
    });

  return {
    rutina: {
      tipoRutina: rutina.tipoRutina ?? 'Rutina IA',
      ejercicios: (rutina.ejerciciosCompletos ?? []).map((e) => e['Ejercicio'] ?? ''),
      ejerciciosCompletos: normalizar(rutina.ejerciciosCompletos),
      calentamiento: normalizar(rutina.calentamiento),
      enfriamiento: normalizar(rutina.enfriamiento),
      volumen: 'Medio',
      intensidad: 'Media',
      nota: 'Generada por FitBot IA (Claude).',
    },
  };
}

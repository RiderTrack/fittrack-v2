// ═══════════════════════════════════════════════════════════
// 🤖 SALUD IA — FitTrack V2 (F10 · HealthTrack fusionado)
// El SaludBot y el recetario IA del HealthTrack viejo, con una
// REGLA DE ORO distinta: NUNCA más una API key hardcodeada (la
// que venía en el index.html viejo fue la que hizo que GitHub
// bloqueara la cuenta — el escáner de secretos la detecta).
// La clave se ingresa en Mi Perfil → Robot IA y vive SOLO en
// el teléfono (FITTRACK_ANTHROPIC_KEY), exactamente como el
// robot de entrenamiento desde F4. Se reutilizan leerKeyClaude
// y llamarClaude de services/claude.ts (misma infraestructura).
// ═══════════════════════════════════════════════════════════

import { leerKeyClaude, llamarClaude, type MensajeIA, type RespuestaClaude } from './claude';
import type { EstadoSalud } from './salud';
import { aguaDeHoy, suenoDeHoy } from './salud';
import type { RecetaParseada } from './recetas';

// ── SALUDBOT ──────────────────────────────────────────────────
// System prompt del viejo (asistente de salud y bienestar) +
// contexto REAL del usuario (agua, sueño, meds, síntomas, PA).
export function construirContextoSalud(est: EstadoSalud): string {
  const partes: string[] = [];
  const meta = est.perfil.aguaMeta || 2000;
  const ml = aguaDeHoy(est);
  partes.push(`- Hidratación de hoy: ${ml}mL de ${meta}mL objetivo`);
  const s = suenoDeHoy(est);
  partes.push(s ? `- Sueño de anoche: ${s.horas}h (${s.calidad})` : '- Sueño: sin registrar hoy');
  if (est.meds.length > 0) {
    const pend = est.meds.filter((m) => !m.tomado);
    partes.push(`- Medicamentos: ${est.meds.length} en lista, ${pend.length} pendiente(s) hoy`);
    est.meds.slice(0, 6).forEach((m) => partes.push(`  · ${m.nom}${m.dos ? ` ${m.dos}` : ''}${m.frq ? ` (${m.frq})` : ''}${m.tomado ? ' ✓tomado' : ' pendiente'}`));
  }
  const lastV = est.vitales[est.vitales.length - 1];
  if (lastV) partes.push(`- Últimos signos: PA ${lastV.sis}/${lastV.dia} mmHg${lastV.fc ? `, FC ${lastV.fc} lpm` : ''}${lastV.sat ? `, O2 ${lastV.sat}%` : ''}`);
  const sint = est.sintomas.slice(-3);
  if (sint.length > 0) {
    partes.push('- Síntomas recientes:');
    sint.forEach((x) => partes.push(`  · ${x.fecha}: ${x.nombres.join(', ')} (sev ${x.sev}/10)${x.nota ? ` — ${x.nota}` : ''}`));
  }
  if (est.perfil.alergias) partes.push(`- Alergias declaradas: ${est.perfil.alergias}`);
  return partes.join('\n');
}

const SYSTEM_SALUDBOT =
  'Eres SaludBot, asistente de salud y bienestar experto, amigable y en español. ' +
  'Ayudas con recomendaciones sobre suplementos, vitaminas, nutrición deportiva, mejora del ' +
  'sueño, hidratación y hábitos saludables. Cuando preguntan por suplementos explica: qué es, ' +
  'para qué sirve, dosis, cuándo tomarlo y precauciones. Siempre recuerda que no reemplazas ' +
  'consulta médica. Sé claro, práctico y usa emojis. Responde conciso pero completo.\n\n' +
  'DATOS REALES DEL USUARIO (úsalos para personalizar tus consejos):\n';

export async function chatSaludBot(historial: MensajeIA[], est: EstadoSalud): Promise<RespuestaClaude> {
  const key = leerKeyClaude();
  if (!key) {
    return {
      texto: '',
      error: 'Configura tu API key de Anthropic primero: Mi Perfil → Robot IA · Claude (vive solo en tu teléfono).',
    };
  }
  const system = SYSTEM_SALUDBOT + construirContextoSalud(est);
  return llamarClaude(key, system, historial, 800, 'claude-haiku-4-5');
}

/** ¿La respuesta menciona medicamentos? (heurística del viejo para ofrecer guardar) */
export function pareceMedicamento(texto: string): boolean {
  return /medicament|pastill|tomar|dosis|mg|comprimid|capsula|jarabe|cada \d|vez al|veces al|hora|dias|semana/i.test(texto);
}

// ── RECETARIO IA ──────────────────────────────────────────────
// Buscar receta con IA (prompt del viejo, ahora CON la key del
// usuario — en el viejo este fetch se había quedado sin header
// de autenticación y fallaba en silencio).
export async function buscarRecetaIA(query: string): Promise<{ receta?: RecetaParseada; error?: string }> {
  const key = leerKeyClaude();
  if (!key) {
    return { error: 'Configura tu API key de Anthropic primero: Mi Perfil → Robot IA · Claude.' };
  }
  const prompt =
    'Eres un chef nutricionista experto. Crea una receta detallada para: "' + query + '". ' +
    'Responde UNICAMENTE con JSON puro sin markdown: ' +
    '{"nombre":"nombre","categoria":"almuerzo","tiempo":30,"porciones":2,"calorias":350,' +
    '"ingredientes":["ingrediente 1"],"pasos":["paso 1"],"notas":"opcional"}';
  const r = await llamarClaude(
    key,
    'Respondes únicamente JSON de recetas válido, sin markdown ni explicaciones.',
    [{ role: 'user', content: prompt }],
    1000,
    'claude-haiku-4-5',
  );
  if (r.error) return { error: r.error };
  return { receta: extraerRecetaJSON(r.texto) };
}

/** Analiza un texto pegado y lo ordena como receta (analizarConIA del viejo) */
export async function analizarRecetaIA(texto: string): Promise<{ receta?: RecetaParseada; error?: string }> {
  const key = leerKeyClaude();
  if (!key) {
    return { error: 'Configura tu API key de Anthropic primero: Mi Perfil → Robot IA · Claude.' };
  }
  const prompt =
    'Eres un chef experto. Analiza este texto y extrae la receta de cocina, ordenándola ' +
    'profesionalmente aunque el texto venga sin formato. Responde UNICAMENTE con JSON puro ' +
    'sin backticks: {"nombre":"Nombre elegante en Title Case","categoria":"desayuno|almuerzo|cena|snack|postre",' +
    '"tiempo":30,"porciones":2,"calorias":350,"ingredientes":["cantidad + ingrediente"],"pasos":["Paso completo"],'+
    '"notas":"Tips si hay, vacío si no"}. Capitaliza correctamente, usa cantidades específicas si las ' +
    'mencionan, ordena los pasos de forma lógica, infiere datos faltantes si es razonable. Texto: ' + texto;
  const r = await llamarClaude(
    key,
    'Respondes únicamente JSON de recetas válido, sin markdown ni explicaciones.',
    [{ role: 'user', content: prompt }],
    1200,
    'claude-haiku-4-5',
  );
  if (r.error) return { error: r.error };
  return { receta: extraerRecetaJSON(r.texto) };
}

// ── Parser defensivo del JSON de receta (limpieza del viejo) ──
function extraerRecetaJSON(texto: string): RecetaParseada | undefined {
  let t = String(texto ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
  let rec: Partial<RecetaParseada> | null = null;
  try {
    rec = JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { rec = JSON.parse(m[0]); } catch { rec = null; }
    }
  }
  if (!rec || typeof rec !== 'object' || !rec.nombre) return undefined;
  return {
    nombre: String(rec.nombre).slice(0, 80),
    categoria: normalizarCategoria(String(rec.categoria ?? 'almuerzo')),
    tiempo: enteroSeguro(rec.tiempo),
    porciones: Math.max(1, enteroSeguro(rec.porciones) || 1),
    calorias: enteroSeguro(rec.calorias),
    imagen: '',
    ingredientes: Array.isArray(rec.ingredientes) ? rec.ingredientes.map(String).filter(Boolean) : [],
    pasos: Array.isArray(rec.pasos) ? rec.pasos.map(String).filter(Boolean) : [],
    notas: rec.notas ? String(rec.notas) : '',
  };
}

function normalizarCategoria(cat: string): string {
  const c = cat.toLowerCase().trim();
  if (c.includes('desayuno')) return 'desayuno';
  if (c.includes('cena')) return 'cena';
  if (c.includes('snack') || c.includes('merienda')) return 'snack';
  if (c.includes('postre')) return 'postre';
  return 'almuerzo';
}

function enteroSeguro(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

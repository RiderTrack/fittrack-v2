// ═══════════════════════════════════════════════════════════
// 🔊 FEEDBACK SENSORIAL — FitTrack V2 (F2 · Entreno)
// Réplica de triggerBeep / triggerVibration del app viejo:
// beeps con WebAudio (funciona en web y WebView Android) y
// vibración con navigator.vibrate (permiso VIBRATE ya declarado
// en el AndroidManifest del CI).
// ═══════════════════════════════════════════════════════════

let ctxAudio: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctxAudio) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
    }
    if (ctxAudio.state === 'suspended') void ctxAudio.resume();
    return ctxAudio;
  } catch {
    return null;
  }
}

/** Beep corto (mismo patrón del viejo: oscilador + gain decay) */
export function beep(frecuencia = 600, duracion = 0.1): void {
  try {
    const ctx = contexto();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duracion);
  } catch { /* sin audio */ }
}

/** Vibración con patrón (ms); silenciosa si no hay soporte */
export function vibrar(patron: number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(patron);
    }
  } catch { /* sin vibración */ }
}

/** Fanfarria de PR del viejo: C5 → E5 → G5 (L3520-3523) */
export function fanfarriaPR(): void {
  vibrar([100, 50, 100, 50, 200]);
  beep(523.25, 0.2); // C5
  setTimeout(() => beep(659.25, 0.2), 200); // E5
  setTimeout(() => beep(783.99, 0.3), 400); // G5
}

/** Confirmación de serie: vibración corta + beep 600 Hz (L4079-4080) */
export function confirmarSerie(): void {
  vibrar([50]);
  beep(600, 0.1);
}

/** Fin de sesión: beep largo + doble vibración (L4301-4302) */
export function finSesion(): void {
  beep(520, 0.4);
  vibrar([200, 100, 200]);
}

/** Fin del descanso: tres beeps ascendentes */
export function finDescanso(): void {
  beep(660, 0.15);
  setTimeout(() => beep(770, 0.15), 200);
  setTimeout(() => beep(880, 0.2), 400);
}

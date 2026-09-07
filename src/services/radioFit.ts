// ═══════════════════════════════════════════════════════════
// 📻 RADIO PERUANA — FitTrack V2 (F5 · Extras)
// Puerto del app viejo (index.html L7457-7561) con el motor de
// RiderTrack V2 (probado en producción):
//   • Las 14 emisoras del viejo (mismos streams, categorías y
//     colores: noticias / pop / romántica / variada)
//   • HLS (.m3u8) vía hls.js (carga dinámica, solo cuando se usa)
//   • Streams directos (icecast) vía <audio> nativo
//   • El viejo tenía volumen fijo 0.8 y sin favoritos → aquí
//     volumen configurable, favoritos y última emisora, con
//     claves NUEVAS FT2_ (el viejo no tenía ninguna, cero choques)
//   • Un SOLO motor global: sigue sonando al cambiar de vista
//     (la instancia vive en MediosFitProvider, no en la vista)
// ═══════════════════════════════════════════════════════════

export type CategoriaRadio = 'noticias' | 'pop' | 'romantica' | 'variada';

export interface RadioEstacion {
  id: string;
  nombre: string;
  freq: string;
  categoria: CategoriaRadio;
  color: string;
  emoji: string;
  url: string;
}

export const ETIQUETAS_CATEGORIA: Record<CategoriaRadio, string> = {
  noticias: 'NOTICIAS',
  pop: 'POP · INTERNACIONAL',
  romantica: 'ROMÁNTICA',
  variada: 'VARIADA',
};

/** Las 14 emisoras del app viejo (mismos streams y colores) */
export const RADIOS: RadioEstacion[] = [
  // ── Noticias ──
  { id: 'rpp', nombre: 'RPP Noticias', freq: '89.5 FM', categoria: 'noticias', color: '#e11d48', emoji: '📰', url: 'https://mdstrm.com/audio/5fab3416b5f9ef165cfab6e9/icecast.audio' },
  { id: 'exitosa', nombre: 'Radio Exitosa', freq: '95.5 FM', categoria: 'noticias', color: '#f97316', emoji: '📣', url: 'https://neptuno-2-audio.mediaserver.digital/79525baf-b0f5-4013-a8bd-3c5c293c6561' },
  { id: 'nacional', nombre: 'Radio Nacional', freq: '103.9 FM', categoria: 'noticias', color: '#dc2626', emoji: '🏛️', url: 'https://cdnhd.iblups.com/hls/0773874174fd4eba8bb9eff741d190dc.m3u8' },
  // ── Pop ──
  { id: 'studio92', nombre: 'Studio 92', freq: '92.5 FM', categoria: 'pop', color: '#8b5cf6', emoji: '🎵', url: 'https://mdstrm.com/audio/5fada553978fe1080e3ac5ea/icecast.audio' },
  { id: 'planeta', nombre: 'Planeta 107.7', freq: '107.7 FM', categoria: 'pop', color: '#06b6d4', emoji: '🌍', url: 'https://mdstrm.com/audio/6839e274f40e6b9832e37633/live.m3u8' },
  { id: 'oxigeno', nombre: 'Oxígeno', freq: '102.1 FM', categoria: 'pop', color: '#10b981', emoji: '🎸', url: 'https://mdstrm.com/audio/5fab0687bcd6c2389ee9480c/icecast.audio' },
  { id: 'lazona', nombre: 'La Zona', freq: '90.5 FM', categoria: 'pop', color: '#f59e0b', emoji: '🎉', url: 'https://mdstrm.com/audio/5fada54116646e098d97e6a5/icecast.audio' },
  { id: 'moda', nombre: 'Moda FM', freq: '97.3 FM', categoria: 'pop', color: '#ec4899', emoji: '🎧', url: 'https://mdstrm.com/audio/6839e1c82cc4c480fcd318dd/live.m3u8' },
  { id: 'magica', nombre: 'Radio Mágica', freq: '88.3 FM', categoria: 'pop', color: '#a855f7', emoji: '✨', url: 'https://mdstrm.com/audio/6839e28eb3fdc597ac2e2e43/live.m3u8' },
  // ── Romántica ──
  { id: 'ritmo', nombre: 'Ritmo Romántica', freq: '93.1 FM', categoria: 'romantica', color: '#f43f5e', emoji: '💌', url: 'https://mdstrm.com/audio/6839e2376607bdf6b2fcde27/icecast.audio' },
  { id: 'felicidad', nombre: 'Felicidad FM', freq: '88.9 FM', categoria: 'romantica', color: '#fb923c', emoji: '💕', url: 'https://mdstrm.com/audio/5fad731fcf097a068af3c8f7/icecast.audio' },
  // ── Variada ──
  { id: 'radiomar', nombre: 'Radiomar Plus', freq: '98.1 FM', categoria: 'variada', color: '#f97316', emoji: '💃', url: 'https://mdstrm.com/audio/6839e261d2efddf5bfbc2d3d/live.m3u8' },
  { id: 'karibena', nombre: 'La Karibeña', freq: '94.9 FM', categoria: 'variada', color: '#10b981', emoji: '🌴', url: 'https://iptv-pe-x-7-g3s-video.egostreaming.pe/karibenatv_685a-pe-a5676-584412/tracks-a1/mono.m3u8' },
  { id: 'nuevaq', nombre: 'Nueva Q FM', freq: '107.1 FM', categoria: 'variada', color: '#6366f1', emoji: '🥁', url: 'https://mdstrm.com/audio/6839e1f153fcf56d988d5943/live.m3u8' },
];

export interface RadioEstado {
  estacion: RadioEstacion | null;
  reproduciendo: boolean;
  cargando: boolean;
  error: string | null;
}

// ── Persistencia (claves NUEVAS: el viejo no tenía ninguna) ──
const KEY_FAV = 'FT2_RADIO_FAV';
const KEY_VOL = 'FT2_RADIO_VOL';
const KEY_LAST = 'FT2_RADIO_LAST';

export function leerFavoritos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_FAV) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
export function guardarFavoritos(ids: string[]): void {
  try { localStorage.setItem(KEY_FAV, JSON.stringify(ids)); } catch {}
}
export function leerVolumen(): number {
  const v = parseFloat(localStorage.getItem(KEY_VOL) || '0.8');
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.8;
}
export function guardarVolumen(v: number): void {
  try { localStorage.setItem(KEY_VOL, String(v)); } catch {}
}
export function leerUltima(): string | null {
  try { return localStorage.getItem(KEY_LAST); } catch { return null; }
}

// ── hls.js (carga dinámica — solo cuando una emisora lo necesita) ──
// Tipo mínimo del constructor (los eventos se leen de la instancia)
type HlsInstancia = { on: (ev: string, cb: (ev: any, data: any) => void) => void; loadSource: (u: string) => void; attachMedia: (a: HTMLAudioElement) => void; destroy: () => void; Events?: any };
type HlsCtor = new (config?: any) => HlsInstancia;
let _hlsCtor: HlsCtor | null = null;
let _hlsCargando: Promise<HlsCtor | null> | null = null;

async function cargarHls(): Promise<HlsCtor | null> {
  if (_hlsCtor) return _hlsCtor;
  if (_hlsCargando) return _hlsCargando;
  _hlsCargando = (async () => {
    try {
      const mod = await import('hls.js');
      _hlsCtor = (mod as any).default || (mod as any);
      return _hlsCtor;
    } catch (e) {
      console.warn('📻 No se pudo cargar hls.js:', e);
      return null;
    }
  })();
  return _hlsCargando;
}

// ═══════════════════════════════════════════════════════════
// 🎛️ MOTOR — una sola instancia global (la crea MediosFitProvider)
// ═══════════════════════════════════════════════════════════
export class RadioEngine {
  private audio: HTMLAudioElement | null = null;
  private hls: HlsInstancia | null = null;
  private _estacion: RadioEstacion | null = null;
  private _reproduciendo = false;
  private _cargando = false;
  private _error: string | null = null;

  /** Callback que el provider registra para re-renderizar la UI */
  onCambio: ((e: RadioEstado) => void) | null = null;

  get estado(): RadioEstado {
    return { estacion: this._estacion, reproduciendo: this._reproduciendo, cargando: this._cargando, error: this._error };
  }
  get estacionActual(): RadioEstacion | null { return this._estacion; }
  get reproduciendo(): boolean { return this._reproduciendo; }

  private emitir() {
    this.onCambio?.(this.estado);
  }

  private asegurarAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = 'none';
    a.volume = leerVolumen();
    a.addEventListener('playing', () => { this._reproduciendo = true; this._cargando = false; this._error = null; this.emitir(); });
    a.addEventListener('pause', () => { this._reproduciendo = false; this.emitir(); });
    a.addEventListener('waiting', () => { this._cargando = true; this.emitir(); });
    a.addEventListener('error', () => {
      this._reproduciendo = false; this._cargando = false;
      this._error = '⚠️ Esta emisora no respondió. Prueba otra.';
      this.emitir();
    });
    this.audio = a;
    return a;
  }

  /** Suena la emisora (si ya sonaba otra, la corta primero) */
  async play(estacion: RadioEstacion): Promise<void> {
    const a = this.asegurarAudio();
    this.detenerHls();

    // ¿misma emisora y ya sonando? → no reiniciar (toggle del viejo)
    if (this._estacion?.id === estacion.id && !a.paused) return;

    this._estacion = estacion;
    this._cargando = true;
    this._error = null;
    this.emitir();
    try { localStorage.setItem(KEY_LAST, estacion.id); } catch {}

    const esHls = /\.m3u8(\?|$)/i.test(estacion.url);
    if (esHls) {
      try {
        const Hls = await cargarHls();
        if (!Hls) {
          this._cargando = false;
          this._error = '⚠️ No se pudo iniciar el reproductor HLS.';
          this.emitir();
          return;
        }
        if (a.canPlayType('application/vnd.apple.mpegurl')) {
          // soporte nativo (raro en Android, pero por si acaso)
          a.src = estacion.url;
          a.play().catch(() => {});
        } else {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 0 });
          this.hls = hls;
          hls.loadSource(estacion.url);
          hls.attachMedia(a);
          const EV = (Hls as any).Events || hls.Events;
          hls.on(EV.MANIFEST_PARSED, () => { a.play().catch(() => {}); });
          hls.on(EV.ERROR, (_ev: any, data: any) => {
            if (data?.fatal) {
              this._reproduciendo = false; this._cargando = false;
              this._error = '⚠️ Esta emisora no respondió. Prueba otra.';
              this.emitir();
            }
          });
        }
      } catch (e: any) {
        // hls.js falló de forma inesperada → degradar sin crashear la app
        this.detenerHls();
        this._reproduciendo = false;
        this._cargando = false;
        this._error = '⚠️ Esta emisora no respondió. Prueba otra.';
        this.emitir();
      }
    } else {
      a.src = estacion.url;
      a.play().catch(() => {
        this._cargando = false; this._reproduciendo = false;
        this._error = '⚠️ No se pudo reproducir. Prueba otra emisora.';
        this.emitir();
      });
    }
  }

  /** Pausa sin soltar la emisora (reanudable) */
  pausar(): void {
    this.audio?.pause();
    this._reproduciendo = false;
    this.emitir();
  }

  /** Reanudar la emisora pausada */
  reanudar(): void {
    const a = this.audio;
    if (!a || !this._estacion) return;
    if (a.src || this.hls) {
      this._cargando = true;
      this.emitir();
      a.play().catch(() => {
        this._cargando = false;
        this.emitir();
      });
    } else {
      // nada cargado → última emisora escuchada
      const ultima = leerUltima();
      const est = RADIOS.find((r) => r.id === ultima) || RADIOS[0];
      this.play(est);
    }
  }

  /** Toggle play/pausa de la emisora actual */
  toggle(): void {
    if (this._reproduciendo) this.pausar();
    else this.reanudar();
  }

  /** Corta del todo (también libera HLS) — al cerrar el mini-pill */
  detener(): void {
    this.detenerHls();
    if (this.audio) {
      try { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } catch {}
    }
    this._estacion = null;
    this._reproduciendo = false;
    this._cargando = false;
    this._error = null;
    this.emitir();
  }

  private detenerHls(): void {
    if (this.hls) {
      try { this.hls.destroy(); } catch {}
      this.hls = null;
    }
  }

  setVolumen(v01: number): void {
    const v = Math.max(0, Math.min(1, v01));
    if (this.audio) this.audio.volume = v;
    guardarVolumen(v);
  }
  get volumen(): number { return this.audio ? this.audio.volume : leerVolumen(); }
}

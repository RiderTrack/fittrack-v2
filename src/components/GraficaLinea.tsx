// ═══════════════════════════════════════════════════════════
// 📉 GRÁFICA DE LÍNEA — FitTrack V2 (F4 · Progreso)
// Puerto React del _lineChartSVG del viejo (L4534): SVG puro sin
// librerías — línea + área + puntos + eje con máx 5 etiquetas.
// Misma geometría (320×120, pads idénticos) para que se vea
// igual que el app actual.
// ═══════════════════════════════════════════════════════════

import React from 'react';

const COLORES: Record<string, { linea: string; area: string; puntos: string }> = {
  emerald: { linea: 'stroke-emerald-400', area: 'fill-emerald-400/10', puntos: 'fill-emerald-400' },
  teal: { linea: 'stroke-teal-400', area: 'fill-teal-400/10', puntos: 'fill-teal-400' },
  violet: { linea: 'stroke-violet-400', area: 'fill-violet-400/10', puntos: 'fill-violet-400' },
  amber: { linea: 'stroke-amber-400', area: 'fill-amber-400/10', puntos: 'fill-amber-400' },
};

interface GraficaLineaProps {
  etiquetas: string[];
  valores: number[];
  unidad?: string;
  color?: keyof typeof COLORES;
}

/** 12345 → "12.3k" · 850 → "850" (mismo fmtV del viejo) */
function fmtV(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 10) / 10);
}

export const GraficaLinea: React.FC<GraficaLineaProps> = ({
  etiquetas, valores, unidad = '', color = 'emerald',
}) => {
  if (valores.length < 2) return null;

  const W = 320, H = 120, padL = 34, padR = 8, padT = 10, padB = 20;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = (max - min) || 1;

  const px = (i: number) => padL + (i / (valores.length - 1)) * (W - padL - padR);
  const py = (v: number) => padT + (1 - (v - min) / rango) * (H - padT - padB);

  let path = '';
  valores.forEach((v, i) => {
    path += `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`;
  });
  const area =
    `${path}L${px(valores.length - 1).toFixed(1)},${(H - padB).toFixed(1)}L${padL},${(H - padB).toFixed(1)}Z`;

  // Máximo 5 etiquetas en el eje X para no saturar (regla del viejo)
  const paso = Math.ceil(valores.length / 5);
  const c = COLORES[color];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Gráfica de ${unidad}`}>
      <text x="2" y={padT + 6} fontSize="8" className="fill-slate-500">{fmtV(max)}</text>
      <text x="2" y={H - padB} fontSize="8" className="fill-slate-500">{fmtV(min)}</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} strokeWidth="1" className="stroke-slate-600" />
      <path d={area} className={c.area} />
      <path d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c.linea} />
      {valores.map((v, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(v)} r="3" className={c.puntos} />
          {(valores.length <= 5 || i % paso === 0 || i === valores.length - 1) && (
            <text x={px(i)} y={H - 6} fontSize="8" textAnchor="middle" className="fill-slate-500">
              {etiquetas[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

import { CRATE_MAGAZINE } from '../experience/layout';

/**
 * Label paper as fractions of the placeholder's front face. The sheet sits high
 * on the face for the same reason the real magazine labels do: the crate's
 * front wall covers the bottom fifth of a standing magazine.
 */
export const ADD_LABEL_W_FRAC = 0.84;
export const ADD_LABEL_H_FRAC = 0.66;
export const ADD_LABEL_Y_FRAC = 0.6;

export const ADD_LABEL_PLANE_LONG = CRATE_MAGAZINE.height * ADD_LABEL_H_FRAC;
export const ADD_LABEL_PLANE_SHORT = CRATE_MAGAZINE.thickness * ADD_LABEL_W_FRAC;

/**
 * Drawn in reading orientation — long axis first — and stood upright by the
 * mesh, so the type runs up the face like the titles on the real magazines.
 */
const TEX_LONG = 1024;
const TEX_SHORT = Math.round(
  (TEX_LONG * ADD_LABEL_PLANE_SHORT) / ADD_LABEL_PLANE_LONG,
);

/** Kodak-carton amber: the only saturated card in a crate of black and cream. */
const CARD = '#e6ae3c';
const INK = '#1d1408';

/** Cap height of the typewriter face as a share of the font size. */
const CAP = 0.78;

/** Special Elite ships a single weight; synthetic bold blurs it when minified. */
const WEIGHT = 400;

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  ceiling: number,
  typeface: string,
): number {
  for (let size = Math.floor(ceiling); size > 12; size -= 2) {
    ctx.font = `${WEIGHT} ${size}px ${typeface}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `${WEIGHT} 12px ${typeface}`;
  return 12;
}

function drawAddBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const arm = r * 0.52;
  const bar = r * 0.2;
  ctx.fillStyle = CARD;
  ctx.fillRect(cx - arm, cy - bar / 2, arm * 2, bar);
  ctx.fillRect(cx - bar / 2, cy - arm, bar, arm * 2);
}

/**
 * The crate's one empty slot. It has to say what it is from browsing distance,
 * so the type is set to the paper rather than to a grid: "NEW" takes the whole
 * width of the card and the badge sits where nothing can occlude it.
 */
export function drawNewMagazineLabel(
  canvas: HTMLCanvasElement,
  fontsReady: boolean,
): HTMLCanvasElement {
  const w = TEX_LONG;
  const h = TEX_SHORT;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const typeface = fontsReady
    ? '"Special Elite", "Courier New", monospace'
    : '"Courier New", monospace';

  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, w, h);
  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle =
      Math.random() > 0.5 ? `rgba(255,244,214,${a})` : `rgba(96,58,14,${a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }

  const margin = Math.round(h * 0.038);
  ctx.strokeStyle = 'rgba(40, 26, 8, 0.45)';
  ctx.lineWidth = Math.max(2, Math.round(h * 0.016));
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

  const pad = Math.round(h * 0.09);
  const band = h - pad * 2;
  // The badge goes at the far end of the reading direction, i.e. the top of the
  // standing placeholder — the part of the face nothing ever covers.
  const badgeR = Math.round(band * 0.4);
  const badgeCx = w - pad - badgeR;
  drawAddBadge(ctx, badgeCx, h / 2, badgeR);

  const textW = badgeCx - badgeR - Math.round(h * 0.12) - pad;
  const gap = Math.round(band * 0.08);
  const headCap = Math.round(band * 0.56);
  const subCap = band - headCap - gap;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.letterSpacing = '0.02em';
  const headSize = fitFontSize(ctx, 'NEW', textW, headCap / CAP, typeface);
  ctx.letterSpacing = '0.04em';
  const subSize = fitFontSize(ctx, 'MAGAZINE', textW, subCap / CAP, typeface);

  const block = headSize * CAP + gap + subSize * CAP;
  const top = (h - block) / 2;

  ctx.letterSpacing = '0.02em';
  ctx.font = `${WEIGHT} ${headSize}px ${typeface}`;
  ctx.fillStyle = INK;
  ctx.fillText('NEW', pad, top + headSize * CAP);

  ctx.letterSpacing = '0.04em';
  ctx.font = `${WEIGHT} ${subSize}px ${typeface}`;
  ctx.fillStyle = 'rgba(29, 20, 8, 0.9)';
  ctx.fillText('MAGAZINE', pad, top + block);
  ctx.letterSpacing = '0em';

  return canvas;
}

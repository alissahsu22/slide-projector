import { MAGAZINE } from '../scene/magazineLayout';

/**
 * Label paper size as a fraction of the trough length / magazine inner height.
 * The sheet is short enough, and sits far enough toward the magazine's top end,
 * to clear the crate's front wall — otherwise the wall hides the first letters
 * of every title.
 */
export const LABEL_PLANE_W_FRAC = 0.75;
export const LABEL_PLANE_H_FRAC = 0.84;
/** Offset of the sheet's center from the trough center, in trough lengths. */
export const LABEL_PLANE_X_FRAC = 0.124;

/** Canvas pixels for the label, kept at the paper's aspect so glyphs never stretch. */
export const LABEL_TEX_W = 1024;
export const LABEL_TEX_H = Math.round(
  (LABEL_TEX_W * (MAGAZINE.innerHeight * LABEL_PLANE_H_FRAC)) /
    (MAGAZINE.slotCount * MAGAZINE.slotPitch * LABEL_PLANE_W_FRAC),
);

/**
 * Special Elite only ships a 400 weight, and synthetic bold thickens the
 * typewriter strokes until they merge into blobs once the label is minified.
 */
const LABEL_WEIGHT = 400;

/**
 * Largest size at or below `max` whose text fits `maxWidth`. Canvas `fillText`
 * with a maxWidth condenses glyphs horizontally instead of scaling them, which
 * smears a long title into vertical strokes, so the size is chosen up front.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  typeface: string,
): number {
  for (let size = Math.floor(max); size > min; size -= 2) {
    ctx.font = `${LABEL_WEIGHT} ${size}px ${typeface}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `${LABEL_WEIGHT} ${min}px ${typeface}`;
  return min;
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trimEnd()}…`;
}

/** Cap height and line advance of the title face, as shares of the font size. */
const TITLE_CAP = 0.78;
const TITLE_LEAD = 1.04;
const TITLE_MAX_LINES = 3;

function wrapLines(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Pick the line count that lets the title be drawn largest: a short title wins
 * on one tall line, while a long one gets more, smaller lines rather than being
 * shrunk to a smear. Falls back to `min` with the overflow clipped, since type
 * below that is unreadable from the crate anyway — the hover readout has the
 * full title.
 */
function fitTitle(
  ctx: CanvasRenderingContext2D,
  heading: string,
  maxWidth: number,
  band: number,
  min: number,
  typeface: string,
): { size: number; lines: string[] } {
  const words = heading.split(/\s+/).filter(Boolean);
  let best: { size: number; lines: string[] } | null = null;
  for (let count = 1; count <= TITLE_MAX_LINES; count++) {
    const ceiling = Math.floor(band / (TITLE_CAP + TITLE_LEAD * (count - 1)));
    for (let size = ceiling; size >= min; size -= 2) {
      ctx.font = `${LABEL_WEIGHT} ${size}px ${typeface}`;
      const lines = wrapLines(ctx, words, maxWidth);
      // `wrapLines` never breaks inside a word, so a single long word can come
      // back as one over-wide line; check the measured width too.
      if (lines.length > count) continue;
      if (lines.some((line) => ctx.measureText(line).width > maxWidth)) continue;
      if (!best || size > best.size) best = { size, lines };
      break;
    }
  }
  if (best) {
    ctx.font = `${LABEL_WEIGHT} ${best.size}px ${typeface}`;
    return best;
  }
  ctx.font = `${LABEL_WEIGHT} ${min}px ${typeface}`;
  const all = wrapLines(ctx, words, maxWidth);
  const lines = all.slice(0, TITLE_MAX_LINES);
  const last = lines.length - 1;
  const tail = lines[last] ?? heading;
  lines[last] = ellipsize(ctx, all.length > lines.length ? `${tail}…` : tail, maxWidth);
  return { size: min, lines };
}

export type MagazineLabel = {
  title: string;
  date: string;
  photoCount: number;
  /** Before webfonts land, fall back to Courier so metrics match what is drawn. */
  fontsReady: boolean;
};

/**
 * Filing-tab layout: title on one or two lines as large as it can fit, with the
 * date and photo count on a footer row. Sized so a crate magazine stays
 * readable from the shelf-browsing camera.
 */
export function drawMagazineLabel(
  canvas: HTMLCanvasElement,
  { title, date, photoCount, fontsReady }: MagazineLabel,
): HTMLCanvasElement {
  const w = LABEL_TEX_W;
  const h = LABEL_TEX_H;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Layout is expressed in fractions of the paper height so the texture can be
  // resized without redoing the type spec.
  const pad = Math.round(h * 0.079);
  const innerW = w - pad * 2;

  ctx.fillStyle = '#f7f0e2';
  ctx.fillRect(0, 0, w, h);
  const specks = Math.round((w * h) / 86);
  for (let i = 0; i < specks; i++) {
    const a = 0.012 + Math.random() * 0.024;
    ctx.fillStyle =
      Math.random() > 0.5 ? `rgba(255,250,240,${a})` : `rgba(90,60,30,${a * 0.45})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.24)';
  ctx.lineWidth = Math.max(2, Math.round(h * 0.012));
  ctx.strokeRect(6, 6, w - 12, h - 12);

  const typeface = fontsReady
    ? '"Special Elite", "Courier New", monospace'
    : '"Courier New", monospace';
  // The date is the second thing you look for after the title, so it gets real
  // size; the photo count is incidental and rides along smaller.
  const dateSize = Math.round(h * 0.2);
  const countSize = Math.round(h * 0.135);
  const metaBaseline = h - Math.round(h * 0.06);
  const ruleY = metaBaseline - dateSize - Math.round(h * 0.03);
  const titleTop = pad;
  const titleBand = ruleY - Math.round(h * 0.03) - titleTop;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#15100a';

  const heading = title.trim().toUpperCase() || 'UNTITLED';
  const { size, lines } = fitTitle(
    ctx,
    heading,
    innerW,
    titleBand,
    Math.round(h * 0.19),
    typeface,
  );
  const block = size * (TITLE_CAP + TITLE_LEAD * (lines.length - 1));
  let baseline = titleTop + (titleBand - block) * 0.5 + size * TITLE_CAP;
  for (const line of lines) {
    ctx.fillText(line, pad, baseline);
    baseline += size * TITLE_LEAD;
  }

  ctx.strokeStyle = 'rgba(90, 60, 30, 0.2)';
  ctx.lineWidth = Math.max(1, Math.round(h * 0.006));
  ctx.beginPath();
  ctx.moveTo(pad, ruleY);
  ctx.lineTo(w - pad, ruleY);
  ctx.stroke();

  const count = `${photoCount} ${photoCount === 1 ? 'PHOTO' : 'PHOTOS'}`;
  ctx.font = `${LABEL_WEIGHT} ${countSize}px ${typeface}`;
  const countW = ctx.measureText(count).width;

  const dateText = date.toUpperCase();
  const dateW = innerW - countW - dateSize * 0.5;
  const dateFitted = fitFontSize(
    ctx,
    dateText,
    dateW,
    dateSize,
    Math.round(h * 0.12),
    typeface,
  );
  ctx.font = `${LABEL_WEIGHT} ${dateFitted}px ${typeface}`;
  ctx.fillStyle = 'rgba(30, 22, 12, 0.96)';
  ctx.fillText(ellipsize(ctx, dateText, dateW), pad, metaBaseline);

  ctx.font = `${LABEL_WEIGHT} ${countSize}px ${typeface}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(62, 38, 24, 0.9)';
  ctx.fillText(count, w - pad, metaBaseline);

  return canvas;
}

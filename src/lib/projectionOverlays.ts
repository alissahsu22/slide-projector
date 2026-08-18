import * as THREE from 'three';

function canvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let roundMask: THREE.CanvasTexture | null = null;
let vignette: THREE.CanvasTexture | null = null;
let hotspot: THREE.CanvasTexture | null = null;
let grain: THREE.CanvasTexture | null = null;

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.fill();
}

/** White rounded rect, black corners — used as alphaMap (green channel). */
export function getProjectionRoundMask(): THREE.CanvasTexture {
  if (roundMask) return roundMask;
  roundMask = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    fillRoundRect(ctx, 1, 1, w - 2, h - 2, Math.min(w, h) * 0.045);
  });
  roundMask.colorSpace = THREE.NoColorSpace;
  return roundMask;
}

export function getProjectionVignette(): THREE.CanvasTexture {
  if (vignette) return vignette;
  vignette = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.18, w * 0.5, h * 0.5, w * 0.72);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(0.55, 'rgba(8, 6, 2, 0.04)');
    g.addColorStop(1, 'rgba(6, 4, 2, 0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return vignette;
}

export function getProjectionHotspot(): THREE.CanvasTexture {
  if (hotspot) return hotspot;
  hotspot = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.5, w * 0.55);
    g.addColorStop(0, 'rgba(255, 236, 196, 0.55)');
    g.addColorStop(0.35, 'rgba(255, 214, 150, 0.18)');
    g.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return hotspot;
}

export function getProjectionGrain(): THREE.CanvasTexture {
  if (grain) return grain;
  grain = canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 110 + Math.random() * 90;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 28 + Math.random() * 18;
    }
    ctx.putImageData(img, 0, 0);
  });
  grain.wrapS = THREE.RepeatWrapping;
  grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(2.4, 1.7);
  grain.colorSpace = THREE.NoColorSpace;
  return grain;
}

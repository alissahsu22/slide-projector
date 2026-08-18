/** Colored stand-in slides so the wall throw is visible without real photographs. */

import * as THREE from 'three';
import type { Photo } from '../types/collection';

const SWATCHES: Record<string, string[][]> = {
  thailand: [
    ['#6b2a18', '#c45a32'],
    ['#3d5a2a', '#8fbf4a'],
    ['#1f3d4a', '#3aa0b8'],
    ['#5a3a12', '#e0a24a'],
    ['#4a1f3a', '#c46a9a'],
    ['#2a2a2a', '#d8c4a0'],
    ['#123a32', '#2ec4a0'],
    ['#4a2208', '#e87830'],
  ],
  sf: [
    ['#1c3a52', '#3f6f88'],
    ['#3a4a28', '#8aaa5a'],
    ['#4a2a18', '#d49a62'],
    ['#2a2a48', '#7a7ad0'],
    ['#5a3a28', '#c4a078'],
    ['#204040', '#5ab4b4'],
    ['#4a1c1c', '#d06060'],
    ['#2a3840', '#90b0c0'],
  ],
  nyc: [
    ['#2a1814', '#6b2f2a'],
    ['#1a1a22', '#8a8aa0'],
    ['#3a2810', '#c4a060'],
    ['#102030', '#3a6a9a'],
    ['#301820', '#a04060'],
    ['#202018', '#b8b070'],
    ['#141414', '#d0d0d0'],
    ['#28180c', '#e09040'],
  ],
  japan: [
    ['#4a1c1c', '#c45a48'],
    ['#2a3a28', '#7a9a58'],
    ['#1c2030', '#8a90b0'],
    ['#3a2818', '#d4a060'],
    ['#301018', '#e07080'],
    ['#202028', '#9098a8'],
    ['#3a2010', '#c47838'],
    ['#181818', '#e8dcc8'],
  ],
  berlin: [
    ['#1a1a1c', '#6a6a70'],
    ['#2a2420', '#a09080'],
    ['#141820', '#4a6a8a'],
    ['#2a1c18', '#8a5040'],
    ['#202018', '#b0a070'],
    ['#101010', '#d0d0d0'],
    ['#1c2428', '#5a7888'],
    ['#281c14', '#c09060'],
  ],
  lisbon: [
    ['#4a3018', '#e0a050'],
    ['#2a4a48', '#70b8b0'],
    ['#5a2818', '#d07040'],
    ['#3a3a20', '#c4b060'],
    ['#183040', '#4a90b0'],
    ['#4a2018', '#c45838'],
    ['#204030', '#68a070'],
    ['#3a2810', '#e0b070'],
  ],
  morocco: [
    ['#5a2410', '#d46830'],
    ['#3a2018', '#c09058'],
    ['#4a1818', '#b04030'],
    ['#2a3a28', '#88a060'],
    ['#3a2810', '#e0a040'],
    ['#201818', '#a08070'],
    ['#4a3018', '#c47838'],
    ['#182028', '#5080a0'],
  ],
  iceland: [
    ['#1a2838', '#6aa0c0'],
    ['#243038', '#90b0c0'],
    ['#3a3a38', '#c0c0c0'],
    ['#102028', '#3a7088'],
    ['#2a2420', '#a09080'],
    ['#1c3030', '#70b0b0'],
    ['#283038', '#d8e0e8'],
    ['#142030', '#4a80a8'],
  ],
  kyoto: [
    ['#4a2818', '#c47850'],
    ['#2a3a24', '#88a060'],
    ['#3a1820', '#c06070'],
    ['#201818', '#d0c0a8'],
    ['#3a3018', '#d4a050'],
    ['#182028', '#5a78a0'],
    ['#4a2010', '#e07038'],
    ['#283020', '#90a070'],
  ],
  paris: [
    ['#2a3040', '#7a90b0'],
    ['#3a2820', '#c4a080'],
    ['#1a1a22', '#9090a8'],
    ['#3a2030', '#a06080'],
    ['#203028', '#70a090'],
    ['#2a2418', '#d0b070'],
    ['#182030', '#4a6a98'],
    ['#301818', '#c07060'],
  ],
  osaka: [
    ['#4a1818', '#d04030'],
    ['#2a2820', '#b0a080'],
    ['#1c2830', '#6890a8'],
    ['#3a2010', '#e09040'],
    ['#281820', '#a05060'],
    ['#203028', '#70a888'],
    ['#181818', '#d8d0c4'],
    ['#3a2818', '#c47838'],
  ],
};

const textureCache = new Map<string, THREE.CanvasTexture>();

function drawSlide(
  canvas: HTMLCanvasElement,
  bg: string,
  inner: string,
  caption: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const inset = Math.round(Math.min(width, height) * 0.1);
  ctx.fillStyle = inner;
  ctx.fillRect(inset, inset, width - inset * 2, height - inset * 2);

  const stripe = Math.round(height * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(inset, height * 0.28, width - inset * 2, stripe);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(
    inset,
    height - inset - Math.round(height * 0.16),
    width - inset * 2,
    Math.round(height * 0.16),
  );

  ctx.fillStyle = '#f7f1e4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(height * 0.09)}px "Special Elite", "Courier New", monospace`;
  ctx.fillText(caption, width / 2, height * 0.5, width * 0.8);
}

function makeRect(
  width: number,
  height: number,
  bg: string,
  inner: string,
  caption: string,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawSlide(canvas, bg, inner, caption);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function getPlaceholderTexture(photo: Photo, title?: string): THREE.CanvasTexture {
  const hit = textureCache.get(photo.id);
  if (hit) return hit;

  const folder = photo.id.split('-')[0] ?? 'thailand';
  const swatches = SWATCHES[folder] ?? SWATCHES.thailand;
  const [bg, inner] = swatches[photo.order % swatches.length] ?? ['#4a2a18', '#c45a32'];
  const width = photo.width && photo.width > 0 ? photo.width : 1200;
  const height = photo.height && photo.height > 0 ? photo.height : 800;
  const n = String(photo.order + 1).padStart(2, '0');
  const caption = `${(title ?? folder).toUpperCase()}  ${n}`;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawSlide(canvas, bg, inner, caption);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  textureCache.set(photo.id, tex);
  return tex;
}

export function placeholderPhotos(
  folder: string,
  title: string,
  count: number,
  portraits: number[] = [],
) {
  const swatches = SWATCHES[folder] ?? SWATCHES.thailand;
  return Array.from({ length: count }, (_, i) => {
    const portrait = portraits.includes(i);
    const width = portrait ? 800 : 1200;
    const height = portrait ? 1200 : 800;
    const [bg, inner] = swatches[i % swatches.length];
    const n = String(i + 1).padStart(2, '0');
    const src = makeRect(width, height, bg, inner, `${title}  ${n}`);
    return {
      id: `${folder}-${n}`,
      src,
      order: i,
      width,
      height,
    };
  });
}

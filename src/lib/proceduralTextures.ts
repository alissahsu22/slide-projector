import * as THREE from 'three';

function canvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

let wood: THREE.CanvasTexture | null = null;
let plaster: THREE.CanvasTexture | null = null;
let crateWood: THREE.CanvasTexture | null = null;

export function getWoodTexture(): THREE.CanvasTexture {
  if (wood) return wood;
  wood = canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = '#6a4630';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      const n = 0.85 + Math.sin(y * 0.11) * 0.08 + Math.sin(y * 0.03) * 0.05;
      ctx.fillStyle = `rgb(${Math.floor(118 * n)}, ${Math.floor(74 * n)}, ${Math.floor(48 * n)})`;
      ctx.fillRect(0, y, size, 1);
      if (y % 37 === 0) {
        ctx.fillStyle = 'rgba(40, 20, 10, 0.18)';
        ctx.fillRect(0, y, size, 2);
      }
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(30, 16, 8, ${0.04 + (i % 5) * 0.01})`;
      ctx.fillRect(i * 13, 0, 2, size);
    }
  });
  wood.repeat.set(6, 6);
  return wood;
}

export function getPlasterTexture(): THREE.CanvasTexture {
  if (plaster) return plaster;
  plaster = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = `rgba(180, 160, 130, ${Math.random() * 0.035})`;
      ctx.fillRect(x, y, 2, 2);
    }
  });
  plaster.repeat.set(3, 2);
  return plaster;
}

export function getCrateWoodTexture(): THREE.CanvasTexture {
  if (crateWood) return crateWood;
  crateWood = canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      const n =
        0.82 +
        Math.sin(y * 0.085) * 0.08 +
        Math.sin(y * 0.021 + 1.4) * 0.1 +
        Math.sin(y * 0.31) * 0.03;
      const r = Math.floor(78 * n);
      const g = Math.floor(48 * n);
      const b = Math.floor(28 * n);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, y, size, 1);
    }
    for (let i = 0; i < 28; i++) {
      const x = 8 + i * 18 + Math.sin(i * 1.7) * 6;
      ctx.fillStyle = `rgba(18, 8, 4, ${0.04 + (i % 4) * 0.015})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + 4, size * 0.5, x - 2, size);
      ctx.lineWidth = 1.2 + (i % 3);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
    }
    for (let y = 40; y < size; y += 56) {
      ctx.fillStyle = 'rgba(12, 6, 2, 0.28)';
      ctx.fillRect(0, y, size, 2);
      ctx.fillStyle = 'rgba(90, 62, 38, 0.12)';
      ctx.fillRect(0, y + 2, size, 1);
    }
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(20, 10, 4, ${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
    }
  });
  crateWood.repeat.set(2.4, 1.6);
  return crateWood;
}

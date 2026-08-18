import * as THREE from 'three';

/** Plastic grain + handwritten caption + red orientation dot. Window is punched out. */
export function makeMountFaceTexture(
  title: string,
  date: string,
  windowWRatio: number,
  windowHRatio: number,
  fontsReady = false,
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ece8df';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 14000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = 0.015 + Math.random() * 0.04;
      ctx.fillStyle =
        Math.random() > 0.5 ? `rgba(255,255,248,${a})` : `rgba(90,70,50,${a * 0.7})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    ctx.strokeStyle = 'rgba(40, 32, 24, 0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, size - 36, size - 36);

    const wx = (size * (1 - windowWRatio)) / 2;
    const wy = (size * (1 - windowHRatio)) / 2;
    const ww = size * windowWRatio;
    const wh = size * windowHRatio;

    ctx.fillStyle = 'rgba(20, 16, 12, 0.22)';
    ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.restore();

    ctx.strokeStyle = 'rgba(18, 14, 10, 0.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);

    ctx.fillStyle = '#c01618';
    ctx.beginPath();
    ctx.arc(size - 78, 78, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(42, 32, 22, 0.72)';
    ctx.textAlign = 'center';
    ctx.font = fontsReady
      ? '600 42px "Special Elite", "Courier New", monospace'
      : '600 42px "Courier New", monospace';
    ctx.fillText(date.toUpperCase(), size / 2, size - 58, size * 0.72);

    ctx.fillStyle = 'rgba(36, 28, 20, 0.82)';
    ctx.font = fontsReady
      ? '700 56px Caveat, "Segoe Script", cursive'
      : '700 56px "Segoe Script", cursive';
    ctx.fillText(title, size / 2, 92, size * 0.78);

    ctx.fillStyle = 'rgba(50, 40, 30, 0.38)';
    ctx.font = fontsReady
      ? '28px "Special Elite", "Courier New", monospace'
      : '28px "Courier New", monospace';
    ctx.fillText('35mm', 110, size - 58);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeFallbackFilm(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#140c08';
    ctx.fillRect(0, 0, 768, 512);
    const g = ctx.createLinearGradient(0, 0, 768, 512);
    g.addColorStop(0, color);
    g.addColorStop(1, '#1a100c');
    ctx.fillStyle = g;
    ctx.fillRect(24, 24, 720, 464);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, 768, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

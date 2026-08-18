export function makeLabelTexture(
  title: string,
  date: string,
  paper: string,
  ink: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(80, 50, 20, 0.06)';
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(20 + i * 26, 0, 2, canvas.height);
  }

  ctx.strokeStyle = 'rgba(90, 60, 30, 0.18)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = ink;
  ctx.font = '700 72px Caveat, "Segoe Script", cursive';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(canvas.width / 2, 148);
  ctx.rotate(-0.03);
  ctx.fillText(title, 0, 0, 440);
  ctx.restore();

  ctx.font = '28px "Special Elite", "Courier New", monospace';
  ctx.fillStyle = 'rgba(50, 35, 20, 0.78)';
  ctx.fillText(date.toUpperCase(), canvas.width / 2, 230);

  ctx.font = '16px "Special Elite", "Courier New", monospace';
  ctx.fillStyle = 'rgba(90, 40, 30, 0.45)';
  ctx.fillText('35mm  ·  ARCHIVE', canvas.width / 2, 272);
  return canvas;
}

// Compress a folder of source photographs into the WebP set served from
// public/photos/<id>/. Full slides stay at 1920 on the long edge; film-window
// thumbs are 320. Re-run after dropping a new tape in.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

const FULL_EDGE = 1920;
const THUMB_EDGE = 320;
const FULL_QUALITY = 72;
const THUMB_QUALITY = 70;

const srcDir = resolve(process.argv[2] ?? '');
const outDir = resolve(process.argv[3] ?? '');
const id = process.argv[4] ?? '';

if (!srcDir || !outDir || !id) {
  console.error(
    'Usage: node scripts/optimize-photos.mjs <source-folder> <out-folder> <id>',
  );
  process.exit(1);
}

function exifDate(file) {
  try {
    return execFileSync(
      'magick',
      ['identify', '-format', '%[EXIF:DateTimeOriginal]', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return '';
  }
}

function encodeWebp(input, output, edge, quality) {
  execFileSync(
    'magick',
    [
      input,
      '-auto-orient',
      '-resize',
      `${edge}x${edge}>`,
      '-strip',
      '-quality',
      String(quality),
      '-define',
      'webp:method=6',
      '-define',
      'webp:auto-filter=true',
      '-define',
      'webp:use-sharp-yuv=true',
      output,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

function identify(file) {
  const [w, h, bytes] = execFileSync(
    'magick',
    ['identify', '-format', '%w %h %b', file],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\s+/);
  return { width: Number(w), height: Number(h), bytes };
}

mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  if (name.endsWith('.webp')) rmSync(join(outDir, name));
}

const sources = readdirSync(srcDir)
  .map((name) => join(srcDir, name))
  .filter((file) => IMAGE_EXT.has(extname(file).toLowerCase()))
  .map((file) => ({ file, date: exifDate(file) || '9999', name: file.toLowerCase() }))
  .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

let fullBytes = 0;
let thumbBytes = 0;

for (let i = 0; i < sources.length; i++) {
  const n = String(i + 1).padStart(2, '0');
  const fullPath = join(outDir, `${n}.webp`);
  const thumbPath = join(outDir, `${n}.thumb.webp`);
  encodeWebp(sources[i].file, fullPath, FULL_EDGE, FULL_QUALITY);
  encodeWebp(sources[i].file, thumbPath, THUMB_EDGE, THUMB_QUALITY);
  const full = identify(fullPath);
  const thumb = identify(thumbPath);
  fullBytes += statSync(fullPath).size;
  thumbBytes += statSync(thumbPath).size;
  console.log(
    `${n}  ${full.width}x${full.height}  ${(full.bytes + '').padStart(8)}  thumb ${thumb.width}x${thumb.height}`,
  );
}

console.log(
  `\n${sources.length} photos  full ${(fullBytes / 1024 / 1024).toFixed(2)} MB  thumbs ${(thumbBytes / 1024).toFixed(0)} KB`,
);

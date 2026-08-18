// Compresses the raw models in models-src/ into the versions served from
// public/models/. Run with `npm run models` after replacing a source model.
//
// Meshopt is the compression target because drei bundles its decoder, so the
// app decodes without fetching a decoder from a CDN. Textures become WebP,
// which three's GLTFLoader reads natively via EXT_texture_webp.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'models-src');
const OUT_DIR = join(ROOT, 'public', 'models');

/**
 * Texture budgets are set by how much screen space each model can occupy. The
 * projector is the hero prop and the camera orbits right up to it; everything
 * else is room dressing seen across a dim bedroom, where 512 is
 * indistinguishable from 1024 but costs a quarter of the VRAM.
 */
const MODELS = [
  { file: 'projector.glb', textureSize: 1024 },
  { file: 'bed.glb', textureSize: 512 },
  { file: 'carpet.glb', textureSize: 512 },
  { file: 'plush_unicorn.glb', textureSize: 512 },
  { file: 'old_door.glb', textureSize: 512 },
  { file: 'curtains.glb', textureSize: 512 },
  { file: 'cartridge.glb', textureSize: 512 },
  { file: 'table.glb', textureSize: 512 },
];

/**
 * Scene code identifies parts by name — WindowCurtains matches meshes against
 * /fabric/i and Bed matches materials against /beizi/i — so every pass that
 * merges or renames meshes, nodes or materials stays off. Draw calls are in the
 * low tens here, so joining would buy little anyway.
 */
const SAFE_FLAGS = [
  '--flatten', 'false',
  '--join', 'false',
  '--instance', 'false',
  '--palette', 'false',
  '--simplify', 'false',
];

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

mkdirSync(OUT_DIR, { recursive: true });

const known = new Set(MODELS.map((m) => m.file));
const unlisted = readdirSync(SRC_DIR).filter((f) => f.endsWith('.glb') && !known.has(f));
if (unlisted.length > 0) {
  console.log(`Skipping unreferenced source models: ${unlisted.join(', ')}\n`);
}

let totalIn = 0;
let totalOut = 0;

for (const { file, textureSize } of MODELS) {
  const input = join(SRC_DIR, file);
  const output = join(OUT_DIR, file);

  execFileSync(
    'gltf-transform',
    [
      'optimize', input, output,
      '--compress', 'meshopt',
      '--meshopt-level', 'high',
      '--texture-compress', 'webp',
      '--texture-size', String(textureSize),
      ...SAFE_FLAGS,
    ],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: process.env },
  );

  const inSize = statSync(input).size;
  const outSize = statSync(output).size;
  totalIn += inSize;
  totalOut += outSize;
  const saved = ((1 - outSize / inSize) * 100).toFixed(0);
  console.log(`${file.padEnd(20)} ${mb(inSize).padStart(9)} -> ${mb(outSize).padStart(9)}  (-${saved}%)`);
}

console.log(
  `\nTotal${' '.repeat(15)} ${mb(totalIn).padStart(9)} -> ${mb(totalOut).padStart(9)}` +
    `  (-${((1 - totalOut / totalIn) * 100).toFixed(0)}%)`,
);

# Slide Projector

An interactive 3D photo viewer: pick a physical slide magazine from a crate, load it into a projector, and watch the photographs appear on the wall.

## Run

```bash
npm install
npm run dev
```

## Swap in your own photos

Edit `src/data/collections.ts`. Point each `Photo.src` at a file in `public/photos/` (or any URL). Keep `id` values stable so remembered slide positions in localStorage still match.

Each collection can hold ~50 photographs. Only a sliding window around the current slide is decoded (2 previous + 5 upcoming).

## 3D models

`models-src/` holds the raw models. `public/models/` holds the compressed versions the app actually loads, and those are generated — don't edit them by hand.

```bash
npm run models
```

This resizes textures to WebP, strips unused vertex attributes, and applies Meshopt compression, taking the set from 25 MB to 2.2 MB. Drop a replacement in `models-src/`, add it to the `MODELS` list in `scripts/optimize-models.mjs` with a texture budget, and re-run.

The pipeline deliberately leaves mesh, node and material merging off, because scene code identifies parts by name — `WindowCurtains` matches meshes against `/fabric/i` and `Bed` matches materials against `/beizi/i`.

## Sounds

Mechanical audio is synthesized. To replace it, add WAV files:

- `public/sounds/pickup.wav`
- `public/sounds/insert.wav`
- `public/sounds/advance.wav`
- `public/sounds/reverse.wav`
- `public/sounds/rewind.wav`
- `public/sounds/eject.wav`

## Upload pipeline

**Add photographs** (top right) resizes images in the browser, corrects EXIF orientation, compresses to WebP, and drops a new magazine in the crate. This is local-only; later the same `preprocessFiles()` helper can upload to Supabase Storage instead of object URLs.

Progress per collection is stored in `localStorage` under `slide-projector:progress`.

## Controls

- Hover a magazine to lift it; click to load it
- On touch: tap once to preview, tap again to load
- Prev / Next / Pause / Restart / Eject
- Keys: `←` `→`  `Space`  `Esc`  `R`

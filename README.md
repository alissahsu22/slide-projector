# Upstairs

A little room of memories. Choose a tape from the crate, play it, and step through the memories inside.

## Run

```bash
npm install
npm run dev
```

## Swap in your own photos

Built-in tapes live in `src/data/collections.ts` and their files live in `public/photos/`. Use `npm run photos -- <source-folder> public/photos/<id> <id>` to write 1920px WebP slides and 320px film-window thumbs.

Keep `id` values stable so remembered slide positions in localStorage still match. Each collection can hold ~50 photographs. Only a sliding window around the current slide is decoded (2 previous + 5 upcoming).

## 3D models

`models-src/` holds the raw models. `public/models/` holds the compressed versions the app actually loads, and those are generated — don't edit them by hand.

```bash
npm run models
```

This resizes textures to WebP, strips unused vertex attributes, and applies Meshopt compression, taking the set from about 28 MB to 2.2 MB. Drop a replacement in `models-src/`, add it to the `MODELS` list in `scripts/optimize-models.mjs` with a texture budget, and re-run.

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

The amber **Add a tape** card in the crate resizes images in the browser, corrects EXIF orientation, compresses to WebP, and drops a new tape in the crate. That tape is stored in the visitor's IndexedDB, so only they can see it.

Shipped tapes (like SF Summer) do not need a backend. Set up Supabase later if you want visitor-created tapes to persist for everyone.

Progress per collection is stored in `localStorage` under `upstairs:progress`.

## Deploy

This is a static Vite app. Vercel will detect that from the GitHub repo.

```bash
npx vercel --prod
```

Or import `alissahsu22/slide-projector` in the Vercel dashboard. No environment variables are required for the built-in tape.

The site lives at `alissahsu.com/projects/upstairs-room/`, so `vite.config.ts` sets `base` to that path. Load files from `public/` through `publicUrl()` rather than a bare `/path`, or they 404 under the subpath. The main site's `vercel.json` proxies the path here:

```json
{ "rewrites": [
  { "source": "/projects/upstairs-room", "destination": "https://upstairs-room.vercel.app/projects/upstairs-room/" },
  { "source": "/projects/upstairs-room/:path*", "destination": "https://upstairs-room.vercel.app/projects/upstairs-room/:path*" }
] }
```

Locally, the dev server is at `localhost:5173/projects/upstairs-room/`.

## Controls

The **?** key in the toolbar opens the same list in the room.

- Choose a tape: click or tap it in the crate, or `←` `→`
- Play tape: Play above the tape, double-click it, or `Enter`
- While a tape plays: `←` `→` step through memories, `Space` pauses, `R` starts over, `Esc` returns to the room
- Shelf: drag tapes between the shelf and the crate, or click/tap one to send it across; with the keyboard, `←` `→` pick a tape and `Enter` moves it
- View room: drag to turn, scroll or pinch to zoom, right-drag or two-finger drag to pan; `Esc` exits
- Reduced motion: camera flights and the shelf flight become short fades

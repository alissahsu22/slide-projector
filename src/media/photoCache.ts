import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture>>();

function configure(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function loadPhoto(src: string): Promise<THREE.Texture> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(src);
  if (pending) return pending;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      src,
      (tex) => {
        configure(tex);
        cache.set(src, tex);
        inflight.delete(src);
        resolve(tex);
      },
      undefined,
      (err) => {
        inflight.delete(src);
        reject(err);
      },
    );
  });
  inflight.set(src, promise);
  return promise;
}

export function getCachedPhoto(src: string): THREE.Texture | null {
  return cache.get(src) ?? null;
}

export function retainPhotos(keep: Set<string>): void {
  for (const [src, tex] of cache) {
    if (keep.has(src)) continue;
    tex.dispose();
    cache.delete(src);
  }
}

export function disposeAllPhotos(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
  inflight.clear();
}

import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture>>();

const bitmapLoader = new THREE.ImageBitmapLoader();
bitmapLoader.setCrossOrigin('anonymous');
bitmapLoader.setOptions({
  imageOrientation: 'flipY',
  colorSpaceConversion: 'none',
} as ImageBitmapOptions);

const textureLoader = new THREE.TextureLoader();

function configure(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function disposeTexture(tex: THREE.Texture): void {
  const image = tex.image as { close?: () => void } | undefined;
  tex.dispose();
  image?.close?.();
}

function loadViaBitmap(src: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    bitmapLoader.load(
      src,
      (bitmap) => {
        const tex = new THREE.Texture(bitmap);
        resolve(configure(tex));
      },
      undefined,
      reject,
    );
  });
}

function loadViaImage(src: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    textureLoader.load(src, (tex) => resolve(configure(tex)), undefined, reject);
  });
}

export function loadPhoto(src: string): Promise<THREE.Texture> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(src);
  if (pending) return pending;

  const promise = loadViaBitmap(src)
    .catch(() => loadViaImage(src))
    .then((tex) => {
      cache.set(src, tex);
      inflight.delete(src);
      return tex;
    })
    .catch((err: unknown) => {
      inflight.delete(src);
      throw err;
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
    disposeTexture(tex);
    cache.delete(src);
  }
}

export function disposeAllPhotos(): void {
  for (const tex of cache.values()) disposeTexture(tex);
  cache.clear();
  inflight.clear();
}

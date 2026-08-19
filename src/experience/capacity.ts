/**
 * How many magazines fit in the desk crate. The crate is framed edge to edge in
 * the catalog shot, so the number of slots it can show legibly is a function of
 * how wide the viewport is: three on a phone, ten on a desktop.
 */
export const COLLECTION_CAP = { min: 3, max: 10 } as const;

/** Viewport width at which the third slot is still the last one. */
const BASE_WIDTH = 480;
/** Extra viewport width that buys one more slot. */
const WIDTH_PER_SLOT = 120;

export function collectionCapacity(width: number): number {
  if (!Number.isFinite(width)) return COLLECTION_CAP.min;
  const slots = COLLECTION_CAP.min + Math.floor((width - BASE_WIDTH) / WIDTH_PER_SLOT);
  return Math.min(COLLECTION_CAP.max, Math.max(COLLECTION_CAP.min, slots));
}

export function viewportCapacity(): number {
  return collectionCapacity(typeof window === 'undefined' ? 1280 : window.innerWidth);
}

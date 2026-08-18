import { useEffect } from 'react';
import { loadPhoto, retainPhotos } from '../media/photoCache';
import type { Collection } from '../types/collection';

export function usePhotoWindow(
  insertedId: string | null,
  slideIndex: number,
  collections: Collection[],
): void {
  useEffect(() => {
    if (!insertedId) return;
    const col = collections.find((c) => c.id === insertedId);
    if (!col) return;

    const keep = new Set<string>();
    col.photos.forEach((p) => keep.add(p.src));
    const start = Math.max(0, slideIndex - 2);
    const end = Math.min(col.photos.length - 1, slideIndex + 5);
    for (let i = start; i <= end; i++) {
      const src = col.photos[i]?.src;
      if (!src) continue;
      void loadPhoto(src).catch(() => undefined);
    }

    const timer = window.setTimeout(() => retainPhotos(keep), 2500);
    return () => window.clearTimeout(timer);
  }, [insertedId, slideIndex, collections]);
}

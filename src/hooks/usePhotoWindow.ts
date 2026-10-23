import { useEffect } from 'react';
import { retainPhotos } from '../media/photoCache';
import { keepPhotoSrcs, preloadPhotoWindow } from '../media/photoWindow';
import type { Collection } from '../types/collection';

export function usePhotoWindow(
  insertedId: string | null,
  slideIndex: number,
  collections: Collection[],
): void {
  const photos = insertedId
    ? collections.find((c) => c.id === insertedId)?.photos
    : undefined;
  const photoKey = photos?.map((p) => `${p.src}\n${p.thumbSrc ?? ''}`).join('\0') ?? '';

  useEffect(() => {
    if (!insertedId || !photos?.length) return;

    preloadPhotoWindow(photos, slideIndex);
    const keep = keepPhotoSrcs(photos, slideIndex);
    const timer = window.setTimeout(() => retainPhotos(keep), 2500);
    return () => window.clearTimeout(timer);
    // photoKey stands in for `photos` so hover/store churn doesn't reset the window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertedId, slideIndex, photoKey]);
}

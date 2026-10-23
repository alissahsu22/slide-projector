import type { Photo } from '../types/collection';
import { loadPhoto } from './photoCache';

export const PRELOAD_BEHIND = 2;
export const PRELOAD_AHEAD = 5;

export function windowRange(
  length: number,
  index: number,
): { start: number; end: number } {
  return {
    start: Math.max(0, index - PRELOAD_BEHIND),
    end: Math.min(length - 1, index + PRELOAD_AHEAD),
  };
}

/** Full-res slides around the playhead, plus every film-window image. */
export function keepPhotoSrcs(photos: Photo[], index: number): Set<string> {
  const keep = new Set<string>();
  const { start, end } = windowRange(photos.length, index);
  for (let i = start; i <= end; i++) {
    const src = photos[i]?.src;
    if (src) keep.add(src);
  }
  for (const photo of photos) {
    const film = photo.thumbSrc ?? photo.src;
    if (film) keep.add(film);
  }
  return keep;
}

export function preloadPhotoWindow(photos: Photo[], index: number): Set<string> {
  const keep = keepPhotoSrcs(photos, index);
  const { start, end } = windowRange(photos.length, index);
  for (let i = start; i <= end; i++) {
    const src = photos[i]?.src;
    if (src) void loadPhoto(src).catch(() => undefined);
  }
  return keep;
}

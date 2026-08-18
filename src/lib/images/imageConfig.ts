export const IMAGE_CONFIG = {
  maxLongEdge: 1920,
  quality: 0.82,
  thumbnailLongEdge: 320,
  thumbnailQuality: 0.72,
  maxPhotos: 50,
  concurrency: 3,
} as const;

export const MAX_PHOTOS = IMAGE_CONFIG.maxPhotos;

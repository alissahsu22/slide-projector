export type PhotoCrop = {
  x: number;
  y: number;
  zoom: number;
};

export type Photo = {
  id: string;
  src: string;
  /** Smaller decode for magazine film windows. Falls back to `src`. */
  thumbSrc?: string;
  order: number;
  width?: number;
  height?: number;
  crop?: PhotoCrop;
};

export type Collection = {
  id: string;
  title: string;
  date: string;
  coverImage?: string;
  currentSlide: number;
  photos: Photo[];
  bodyColor: string;
  accentColor: string;
  labelTint: string;
  /** Present on user-created collections persisted in IndexedDB. */
  createdAt?: number;
};

export type ExperienceMode =
  | 'CATALOG'
  /** Shelf and crate side by side, swapping magazines between them. */
  | 'CURATING'
  | 'INSERTING'
  | 'PLAYING'
  | 'PAUSED'
  | 'CHANGING_SLIDE'
  | 'EJECTING'
  | 'SWITCHING'
  | 'REWINDING';

export const TRANSITIONAL_MODES: ReadonlySet<ExperienceMode> = new Set([
  'INSERTING',
  'EJECTING',
  'SWITCHING',
  'CHANGING_SLIDE',
  'REWINDING',
]);

export function isTransitional(mode: ExperienceMode): boolean {
  return TRANSITIONAL_MODES.has(mode);
}

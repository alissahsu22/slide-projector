/**
 * Physical dimensions for a 36-slot 35mm linear magazine.
 * Units are meters. Tweaking `slotPitch` / `slideSize` is the main way
 * to match a projector gate later.
 */
export const MAGAZINE = {
  slotCount: 36,
  slotPitch: 0.0046,
  ribThickness: 0.0008,
  ribHeight: 0.011,
  /** 5×5 cm mounted slide. */
  slideSize: 0.05,
  slideThickness: 0.0014,
  slideCorner: 0.0015,
  windowW: 0.05 * (36 / 50.8),
  windowH: 0.05 * (24 / 50.8),
  innerWidth: 0.0535,
  innerHeight: 0.0485,
  wall: 0.0028,
  floor: 0.003,
  endCap: 0.0065,
  topLip: 0.0015,
} as const;

/** Slot 0 is the −X end. Advancing one photo moves the whole magazine by −pitch. */
export function magazineRailX(slideIndex: number, scale = 1): number {
  return -Math.max(0, slideIndex) * MAGAZINE.slotPitch * scale;
}

export function magazineRailStep(scale = 1): number {
  return -MAGAZINE.slotPitch * scale;
}

export function magazineLength(slotCount: number = MAGAZINE.slotCount): number {
  return slotCount * MAGAZINE.slotPitch + MAGAZINE.endCap * 2;
}

export function magazineWidth(): number {
  return MAGAZINE.innerWidth + MAGAZINE.wall * 2;
}

export function magazineHeight(): number {
  return MAGAZINE.innerHeight + MAGAZINE.floor;
}

/** Local X of a slot center. Slot 0 is the −X end (insertion / first slide). */
export function magazineSlotX(
  index: number,
  slotCount: number = MAGAZINE.slotCount,
): number {
  return -((slotCount - 1) * MAGAZINE.slotPitch) / 2 + index * MAGAZINE.slotPitch;
}

/** How far the playing slide lifts out of the trough (meters). */
export const SLIDE_POP_HEIGHT = MAGAZINE.slideSize * 0.72;

/** Decorative slide meshes shown in the magazine — not a 1:1 photo map. */
export const DEFAULT_MAX_VISIBLE_SLIDES = 14;

/**
 * Pack occupied slides in consecutive slots from the start so they can
 * shuffle as a queue (photo index === visual index).
 */
export function occupiedMagazineSlots(
  count: number,
  slotCount: number = MAGAZINE.slotCount,
): number[] {
  const n = Math.max(0, Math.min(Math.round(count), slotCount));
  return Array.from({ length: n }, (_, i) => i);
}

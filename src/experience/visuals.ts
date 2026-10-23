import { getCatalogCam } from './layout';

/** Visual values tweened by GSAP and read in useFrame — not React state. */
export const visuals = {
  roomLight: 1,
  lamp: 0,
  beam: 0,
  projection: 0,
  flicker: 1,
  focus: 1,
  /** 1 = gate open, ~0 = mechanical blackout. */
  interrupt: 1,
  /** Extra throw brightness, including per-slide variance. */
  brightness: 1,
  settleX: 0,
  settleY: 0,
  settleRot: 0,
  settleScale: 1,
  /** 0 = sharp, 1 = brief misfocus after a slide lands. */
  blur: 0,
};

/** Optical throw after flicker + shutter interrupt. */
export function throwLevel(): number {
  return Math.max(0, visuals.flicker * visuals.interrupt);
}

/** Beam / lamp power, including the mechanical shutter. */
export function beamLevel(): number {
  return Math.max(0, visuals.beam * visuals.flicker * visuals.interrupt);
}

export const cameraRig = { ...getCatalogCam() };

/** When set, the camera tracks a cartridge instead of a fixed rig pose. */
export const cameraFollow = {
  active: false,
  id: null as string | null,
};

/**
 * 1 = the rig is an authored pose, refitted to the viewport every frame.
 * 0 = the rig is already framed for this viewport (playback) and is used as-is.
 * Tweened between the two so leaving or entering playback stays one smooth move.
 */
export const cameraFit = { amount: 1 };

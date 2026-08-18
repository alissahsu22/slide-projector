import gsap from 'gsap';
import { playRewindClacks, playSound } from '../audio/sounds';
import { visuals } from './visuals';

export type ProjectionTransitionPhase =
  | 'idle'
  | 'dimming'
  | 'blackout'
  | 'appearing'
  | 'settling';

export type ProjectionTransitionState = {
  isTransitioning: boolean;
  phase: ProjectionTransitionPhase;
};

/**
 * Mechanical slide-advance timing and amounts.
 * Durations are milliseconds. Fine-tune here without hunting through components.
 *
 * Suggested total: ~250–400ms
 *   0–dimMs              click + dim
 *   dimMs–blackoutEnd    brief gate close / flicker
 *   blackoutEnd–appearEnd new image snaps in
 *   appearEnd–settleEnd  tiny focus / alignment settle
 */
export const SLIDE_TRANSITION = {
  dimMs: 80,
  blackoutMs: 60,
  appearMs: 80,
  settleMs: 130,

  /** Projection/beam multiplier at the end of the dim phase. */
  dimAmount: 0.2,
  /** Near-black during the gate-closed moment. */
  blackoutAmount: 0.03,
  /** One-frame light leak during blackout (0 disables). */
  blackoutFlicker: 0.12,
  blackoutFlickerMs: 16,

  /** Abrupt brightness when the new slide first appears (not a dissolve). */
  appearAmount: 0.78,

  /** Extra softness on the newly landed slide (0–1). */
  settleBlur: 0.55,
  /** Extra world-unit offset while settling, before landing. */
  settleOffset: 0.01,
  /** Extra radians of rotation while settling. */
  settleRotation: 0.006,
  /** Extra uniform scale while settling (e.g. 0.01 = 1%). */
  settleScale: 0.01,
  /** Extra brightness swing while settling. */
  settleBrightnessVar: 0.07,

  /** Stable per-slide landing variance (kept after settle). */
  landOffset: 0.0045,
  landRotation: 0.0032,
  landScale: 0.004,
  landBrightnessVar: 0.035,

  /** Magazine rail move, seconds. Runs in parallel with the optical transition. */
  magazineDuration: 0.28,
};

/** Compressed magazine rewind — one rail move, not N individual photo advances. */
export const REWIND_TRANSITION = {
  minDuration: 0.52,
  maxDuration: 0.86,
  dimAmount: 0.26,
  flickerLo: 0.22,
  flickerHi: 0.62,
  clackMin: 4,
  clackMax: 8,
} as const;

export function rewindDurationSec(fromIndex: number): number {
  const t = Math.min(1, Math.max(0, fromIndex - 1) / 24);
  const { minDuration, maxDuration } = REWIND_TRANSITION;
  return minDuration + t * (maxDuration - minDuration);
}

export function rewindClackCount(fromIndex: number): number {
  const { clackMin, clackMax } = REWIND_TRANSITION;
  return Math.min(clackMax, Math.max(clackMin, 3 + Math.round(fromIndex * 0.35)));
}

export const projectionTransition: ProjectionTransitionState = {
  isTransitioning: false,
  phase: 'idle',
};

export type SlideLandPose = {
  x: number;
  y: number;
  rot: number;
  scale: number;
  brightness: number;
};

function hash01(n: number, salt: number): number {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Stable per-slide landing so each frame sits a little differently. */
export function slideLandPose(index: number): SlideLandPose {
  const { landOffset, landRotation, landScale, landBrightnessVar } = SLIDE_TRANSITION;
  return {
    x: (hash01(index, 1) - 0.5) * 2 * landOffset,
    y: (hash01(index, 2) - 0.5) * 2 * landOffset,
    rot: (hash01(index, 3) - 0.5) * 2 * landRotation,
    scale: 1 + (hash01(index, 4) - 0.5) * 2 * landScale,
    brightness: 1 + (hash01(index, 5) - 0.5) * 2 * landBrightnessVar,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function tween(vars: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const prev = vars.onComplete as (() => void) | undefined;
    gsap.to(visuals, {
      ...vars,
      onComplete: () => {
        prev?.();
        resolve();
      },
      onInterrupt: () => resolve(),
    });
  });
}

function sec(ms: number): number {
  return ms / 1000;
}

const TRANSITION_PROPS = [
  'interrupt',
  'blur',
  'brightness',
  'settleX',
  'settleY',
  'settleRot',
  'settleScale',
] as const;

export function resetProjectionTransition(): void {
  gsap.killTweensOf(visuals, TRANSITION_PROPS.join(','));
  projectionTransition.isTransitioning = false;
  projectionTransition.phase = 'idle';
  visuals.interrupt = 1;
  visuals.blur = 0;
  visuals.brightness = 1;
  visuals.settleX = 0;
  visuals.settleY = 0;
  visuals.settleRot = 0;
  visuals.settleScale = 1;
}

export function applySlideLandPose(index: number): void {
  const land = slideLandPose(index);
  visuals.settleX = land.x;
  visuals.settleY = land.y;
  visuals.settleRot = land.rot;
  visuals.settleScale = land.scale;
  visuals.brightness = land.brightness;
  visuals.blur = 0;
  visuals.interrupt = 1;
}

/** Pose only — leaves flicker/interrupt alone so a rewind can keep pulsing. */
function applySlideFramePose(index: number): void {
  const land = slideLandPose(index);
  visuals.settleX = land.x;
  visuals.settleY = land.y;
  visuals.settleRot = land.rot;
  visuals.settleScale = land.scale;
  visuals.brightness = land.brightness;
}

function applyAppearPose(index: number, direction: 1 | -1): void {
  const land = slideLandPose(index);
  const {
    settleOffset,
    settleRotation,
    settleScale,
    settleBlur,
    settleBrightnessVar,
  } = SLIDE_TRANSITION;
  const jx = (hash01(index, 8) - 0.5) * settleOffset;
  const jy = (hash01(index, 9) - 0.5) * settleOffset * 0.8;
  visuals.settleX = land.x + direction * settleOffset * 0.45 + jx;
  visuals.settleY = land.y + jy;
  visuals.settleRot = land.rot + (hash01(index, 10) - 0.5) * 2 * settleRotation;
  visuals.settleScale = land.scale + settleScale;
  visuals.blur = settleBlur;
  visuals.brightness = land.brightness * (1 - settleBrightnessVar * 0.55);
}

export async function runProjectorSlideTransition(opts: {
  direction: 1 | -1;
  nextIndex: number;
  onSwap: () => void | Promise<void>;
  onMechanical?: () => void | Promise<void>;
}): Promise<void> {
  const { direction, nextIndex, onSwap, onMechanical } = opts;
  const cfg = SLIDE_TRANSITION;

  gsap.killTweensOf(visuals, TRANSITION_PROPS.join(','));
  projectionTransition.isTransitioning = true;

  playSound(direction < 0 ? 'reverse' : 'advance', { interrupt: true });
  void Promise.resolve(onMechanical?.());

  try {
    projectionTransition.phase = 'dimming';
    await tween({
      interrupt: cfg.dimAmount,
      blur: 0.12,
      duration: sec(cfg.dimMs),
      ease: 'power2.in',
      overwrite: 'auto',
    });

    projectionTransition.phase = 'blackout';
    const blackoutJob = tween({
      interrupt: cfg.blackoutAmount,
      blur: 0.28,
      duration: sec(Math.max(12, cfg.blackoutMs - cfg.blackoutFlickerMs)),
      ease: 'none',
      overwrite: 'auto',
    });
    void Promise.resolve(onSwap());
    await blackoutJob;

    if (cfg.blackoutFlicker > 0) {
      visuals.interrupt = cfg.blackoutFlicker;
      await delay(cfg.blackoutFlickerMs);
      visuals.interrupt = cfg.blackoutAmount;
    }

    applyAppearPose(nextIndex, direction);
    visuals.interrupt = cfg.appearAmount;

    projectionTransition.phase = 'appearing';
    const land = slideLandPose(nextIndex);
    await tween({
      interrupt: 0.92,
      brightness: land.brightness * (1 - cfg.settleBrightnessVar * 0.2),
      duration: sec(cfg.appearMs),
      ease: 'none',
      overwrite: 'auto',
    });

    projectionTransition.phase = 'settling';
    await tween({
      interrupt: 1,
      blur: 0,
      brightness: land.brightness,
      settleX: land.x,
      settleY: land.y,
      settleRot: land.rot,
      settleScale: land.scale,
      duration: sec(cfg.settleMs),
      ease: 'power2.out',
      overwrite: 'auto',
    });

    applySlideLandPose(nextIndex);
  } finally {
    projectionTransition.phase = 'idle';
    projectionTransition.isTransitioning = false;
  }
}

/**
 * One compressed rewind: keep the lamp on and dim/flicker the throw. When
 * `fromIndex`/`onStep` are given the intermediate photos strobe past in
 * reverse instead of cutting straight to slide 0.
 */
export async function runProjectorRewind(opts: {
  duration: number;
  clacks: number;
  fromIndex?: number;
  onStep?: (index: number) => void;
  onSwap: () => void | Promise<void>;
  onMechanical?: () => void | Promise<void>;
}): Promise<void> {
  const duration = Math.min(
    REWIND_TRANSITION.maxDuration,
    Math.max(REWIND_TRANSITION.minDuration, opts.duration),
  );
  const clacks = Math.max(2, Math.round(opts.clacks));
  const { dimAmount, flickerLo, flickerHi } = REWIND_TRANSITION;
  const fromIndex = Math.max(0, Math.round(opts.fromIndex ?? 0));
  const stepping = Boolean(opts.onStep) && fromIndex > 0;

  gsap.killTweensOf(visuals, [...TRANSITION_PROPS, 'flicker', 'focus'].join(','));
  projectionTransition.isTransitioning = true;
  projectionTransition.phase = 'dimming';

  playRewindClacks(clacks, duration * 1000);
  const mechanical = Promise.resolve(opts.onMechanical?.());

  const dimDur = Math.min(0.14, duration * 0.2);
  const restoreDur = Math.min(0.16, duration * 0.22);
  const midDur = Math.max(0.08, duration - dimDur - restoreDur);
  const pulse = { t: 0 };
  let pulseTween: { kill: () => void } | undefined;

  try {
    await tween({
      interrupt: dimAmount,
      flicker: (flickerLo + flickerHi) * 0.5,
      focus: 0.52,
      blur: 0.2,
      duration: dimDur,
      ease: 'power2.in',
      overwrite: 'auto',
    });

    projectionTransition.phase = 'blackout';
    if (!stepping) {
      void Promise.resolve(opts.onSwap());
      applySlideLandPose(0);
    }
    visuals.interrupt = dimAmount;
    visuals.focus = 0.52;
    visuals.blur = 0.16;

    let shown = stepping ? fromIndex : 0;
    await new Promise<void>((resolve) => {
      pulseTween = gsap.to(pulse, {
        t: 1,
        duration: midDur,
        ease: 'none',
        onUpdate: () => {
          const wave = 0.5 + 0.5 * Math.sin(pulse.t * Math.PI * clacks);
          visuals.interrupt = dimAmount + wave * (flickerHi - dimAmount) * 0.55;
          visuals.flicker = flickerLo + wave * (flickerHi - flickerLo);
          if (!stepping) return;
          // Swap on the dark half of each pulse so photos appear to strobe by.
          const next = Math.max(0, Math.round(fromIndex * (1 - pulse.t)));
          if (next !== shown) {
            shown = next;
            opts.onStep?.(next);
            applySlideFramePose(next);
          }
        },
        onComplete: () => resolve(),
        onInterrupt: () => resolve(),
      });
    });

    if (stepping) {
      await Promise.resolve(opts.onSwap());
      applySlideFramePose(0);
    }

    projectionTransition.phase = 'settling';
    await Promise.all([
      mechanical,
      tween({
        interrupt: 1,
        flicker: 1,
        focus: 1,
        blur: 0,
        duration: restoreDur,
        ease: 'power2.out',
        overwrite: 'auto',
      }),
    ]);
    applySlideLandPose(0);
  } finally {
    pulseTween?.kill();
    gsap.killTweensOf(visuals, [...TRANSITION_PROPS, 'flicker', 'focus'].join(','));
    visuals.flicker = 1;
    visuals.focus = 1;
    applySlideLandPose(0);
    projectionTransition.phase = 'idle';
    projectionTransition.isTransitioning = false;
  }
}

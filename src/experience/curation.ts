import gsap from 'gsap';
import { playSound } from '../audio/sounds';
import {
  SHELF_LIBRARY_LEVELS,
  SHELF_MAGAZINE_Z,
  SHELF_POS,
  SHELF_SLOT_PITCH,
  setShelfSlotsPerRow,
} from '../scene/shelfDims';
import { getState, setState } from '../state/store';
import { isInteractionLocked } from './controller';
import { cancelDrag } from './drag';
import {
  type CameraPose,
  crateRig,
  fitPoseToAspect,
  getCatalogCam,
  restCratePose,
} from './layout';
import { tween } from './tween';
import { cameraRig } from './visuals';

/** World x of the shelved magazines' faces — everything below is framed off it. */
const SHELF_FACE_X = SHELF_POS.x + SHELF_MAGAZINE_Z;

/**
 * Square on to the shelf, looking slightly down. The two library planks fill
 * the upper half of the frame and the crate, much nearer the camera, fills the
 * lower — no scaling involved, just the perspective of a foreground prop.
 */
export function getCurationCam(): CameraPose {
  return {
    px: SHELF_FACE_X - 1.61,
    py: 1.2,
    pz: SHELF_POS.z,
    tx: SHELF_FACE_X - 0.03,
    ty: 0.8,
    tz: SHELF_POS.z,
    fov: 36,
    // The planks and the crate together fill the frame top to bottom, so a wide
    // desktop must not close the distance — it would cut both off.
    minDolly: 1,
  };
}

/**
 * The crate held out in front of the shelf, turned so its front — and the
 * labels of everything standing in it — faces the camera.
 */
export function getCurationCratePose(): {
  x: number;
  y: number;
  z: number;
  ry: number;
} {
  return {
    x: SHELF_FACE_X - 0.71,
    // Low enough that the tops of the magazines standing in it clear the lower
    // library plank on screen instead of masking the row's bottom edge.
    y: 0.73,
    z: SHELF_POS.z,
    ry: -Math.PI / 2,
  };
}

/** Fraction of the frame the row may use, so no magazine touches the edge. */
const ROW_SAFE_WIDTH = 0.88;

const _shot: CameraPose = {
  px: 0,
  py: 0,
  pz: 0,
  tx: 0,
  ty: 0,
  tz: 0,
  fov: 0,
  minDolly: 0,
};

/**
 * World width the curation shot shows across the face of the shelf. The pose is
 * refitted the same way the camera refits it, so this tracks whatever the live
 * viewport is actually framing.
 */
export function curationFrameWidth(aspect: number): number {
  const shot = fitPoseToAspect(getCurationCam(), aspect, _shot);
  const dx = shot.px - shot.tx;
  const dy = shot.py - shot.ty;
  const dz = shot.pz - shot.tz;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const halfHeight = Math.tan((shot.fov * Math.PI) / 360) * distance;
  return halfHeight * aspect * 2;
}

/**
 * Shorten the shelf row until every slot in it is inside the curation frame.
 * Returns true when the row changed.
 */
export function syncShelfRow(width: number, height: number): boolean {
  if (!width || !height) return false;
  const frame = curationFrameWidth(width / height) * ROW_SAFE_WIDTH;
  const framed = frame / SHELF_SLOT_PITCH;
  // A library too big for the framed row runs wider than the frame rather than
  // stand two magazines in the same slot.
  const needed = getState().collections.length / SHELF_LIBRARY_LEVELS.length;
  return setShelfSlotsPerRow(Math.max(framed, Math.ceil(needed)));
}

const FLIGHT = { duration: 1.05, ease: 'power2.inOut' };

/** True while the crate is in the air, in either direction. */
export function isCurationBusy(): boolean {
  return getState().curationBusy;
}

export function canEnterCuration(): boolean {
  const s = getState();
  return (
    !s.curationBusy &&
    s.mode === 'CATALOG' &&
    !s.insertedId &&
    !s.orbitInspect &&
    !s.createOpen &&
    !s.editingId &&
    !isInteractionLocked()
  );
}

export async function enterCuration(): Promise<void> {
  if (!canEnterCuration()) return;
  setState({ mode: 'CURATING', crateSelectedId: null, hoveredId: null, curationBusy: true });
  // Same cue as lifting a magazine to load it — the crate is being picked up.
  playSound('pickup');
  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(crateRig);
  await Promise.all([
    tween(cameraRig, { ...getCurationCam(), ...FLIGHT }),
    tween(crateRig, { ...getCurationCratePose(), ...FLIGHT }),
  ]);
  setState({ curationBusy: false });
}

export async function exitCuration(): Promise<void> {
  const s = getState();
  if (s.curationBusy || s.mode !== 'CURATING') return;
  cancelDrag();
  // Back to CATALOG up front so the overlay and the pointer handlers let go
  // immediately; `curationBusy` is what keeps the flight from being interrupted.
  setState({ mode: 'CATALOG', crateSelectedId: null, hoveredId: null, curationBusy: true });
  playSound('pickup');
  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(crateRig);
  await Promise.all([
    tween(cameraRig, { ...getCatalogCam(), ...FLIGHT }),
    tween(crateRig, { ...restCratePose(), ...FLIGHT }),
  ]);
  setState({ curationBusy: false });
}

export function toggleCuration(): void {
  if (getState().mode === 'CURATING') void exitCuration();
  else void enterCuration();
}

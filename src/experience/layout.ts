import {
  magazineHeight,
  magazineLength,
  magazineWidth,
} from '../scene/magazineLayout';

/** Scene layout constants — meters, world space unless noted as local. */
export const TABLE_TOP = 0.735;

/** Sketchfab GLB — model-space units before uniform scale + Y rotation. */
export const PROJECTOR_MODEL = {
  url: '/models/projector.glb',
  scale: 0.00135,
  minY: 1.99746,
  /** +90° Y turns the lens from +X toward the wall (−Z). */
  rotationY: Math.PI / 2,
  lens: { x: 164.6, y: 105.4, z: -142.7 },
  slot: { x: -40.62, y: 181.33, z: -190.19 },
};

function modelToLocal(p: { x: number; y: number; z: number }) {
  const s = PROJECTOR_MODEL.scale;
  const x = p.x * s;
  const y = (p.y - PROJECTOR_MODEL.minY) * s;
  const z = p.z * s;
  const c = Math.cos(PROJECTOR_MODEL.rotationY);
  const si = Math.sin(PROJECTOR_MODEL.rotationY);
  return {
    x: x * c + z * si,
    y,
    z: -x * si + z * c,
  };
}

const lensLocal = modelToLocal(PROJECTOR_MODEL.lens);
const slotLocal = modelToLocal(PROJECTOR_MODEL.slot);

export const PROJECTOR_LENS_LOCAL = lensLocal;
export const PROJECTOR_SLOT_LOCAL = slotLocal;

/** Place the model so the lens sits on the screen’s X axis. */
export const PROJECTOR_POS = {
  x: -lensLocal.x,
  y: TABLE_TOP,
  z: -0.1,
};

export const LENS = {
  x: PROJECTOR_POS.x + lensLocal.x,
  y: PROJECTOR_POS.y + lensLocal.y,
  z: PROJECTOR_POS.z + lensLocal.z,
};

/** 35mm slide mount — slightly oversized from 50.8mm so it reads in the crate. */
export const SLIDE = {
  size: 0.08,
  thickness: 0.0015,
  windowW: 0.08 * (36 / 50.8),
  windowH: 0.08 * (24 / 50.8),
  corner: 0.0018,
};

export const CARTRIDGE = {
  width: SLIDE.size,
  height: SLIDE.size,
  depth: SLIDE.thickness,
};

/** Magazines face the crate front (+Z). */
export const CRATE_SLIDE_Y = 0;

/** Same uniform scale in the crate and on the projector rail. */
export const MAGAZINE_DOCK_SCALE = 0.9;

/**
 * Standing magazine in the crate: length up, label on +Z.
 * Local +X (slot axis) → world +Y. No non-uniform scale.
 */
export const CRATE_MAGAZINE_RZ = Math.PI / 2;

/** AABB of a dock-scale magazine after `CRATE_MAGAZINE_RZ`. */
export const CRATE_MAGAZINE = {
  thickness: magazineHeight() * MAGAZINE_DOCK_SCALE,
  height: magazineLength() * MAGAZINE_DOCK_SCALE,
  depth: magazineWidth() * MAGAZINE_DOCK_SCALE,
};

export const CRATE = {
  wall: 0.016,
  floor: 0.012,
  frontHeight: 0.05,
  sideHeight: 0.07,
  backHeight: 0.082,
  padX: 0.008,
  padZ: 0.006,
  gap: 0.0022,
};

export const PROJECTOR_SLOT = {
  x: PROJECTOR_POS.x + slotLocal.x,
  y: PROJECTOR_POS.y + slotLocal.y + CARTRIDGE.height / 2 - 0.006,
  z: PROJECTOR_POS.z + slotLocal.z,
};

/**
 * Projector-local dock for a linear magazine in the side/rear transport rail.
 * Origin is the magazine floor-center. +X of this frame is the rail axis
 * (projector +Z / toward the operator) so a later photo advance is:
 *   magazine.position.x += magazineRailStep()
 *
 * Tune x/y/z here — debug AxesHelper is on projectorInsertionPoint.
 * x: outside the right-hand body wall, tucked into the black rail
 * y: rail floor (black base), NOT the projector top (~0.24)
 * z: chosen so slot 0 (first slide) sits at the side gate
 */
export const PROJECTOR_INSERTION_LOCAL = {
  /** Trough center of the right-hand rail (model max x ≈ 0.010). */
  x: -0.05,
  /** Floor of the blue side-guide window (y ≈ 0.10–0.16). */
  y: 0.099,
  /** Toward the operator / camera (+Z), along the side rail. */
  z: 0.055,
  rx: 0,
  /** Magazine local +X (slot axis) → projector +Z (along the side rail). */
  ry: -Math.PI / 2,
  rz: 0,
};

/** Approach from the rear along the rail, then slide in to the dock. */
export const INSERTION_APPROACH_LOCAL = { x: 0.26, y: 0, z: 0 };

/** Show AxesHelper + marker at projectorInsertionPoint for pose tuning. */
export const DEBUG_INSERTION_POINT = false;

export function syncProjectorDerived(): void {
  LENS.x = PROJECTOR_POS.x + lensLocal.x;
  LENS.y = PROJECTOR_POS.y + lensLocal.y;
  LENS.z = PROJECTOR_POS.z + lensLocal.z;
  PROJECTOR_SLOT.x = PROJECTOR_POS.x + slotLocal.x;
  PROJECTOR_SLOT.y = PROJECTOR_POS.y + slotLocal.y + CARTRIDGE.height / 2 - 0.006;
  PROJECTOR_SLOT.z = PROJECTOR_POS.z + slotLocal.z;
}

export const CRATE_POS = { x: 0.87, y: TABLE_TOP, z: 0.42 };

export const WALL_Z = -4.08;

export const SCREEN = {
  x: 0,
  y: 1.78,
  z: WALL_Z + 0.04,
  w: 2.64,
  h: 1.74,
};

export const SLOT_SPACING = CRATE_MAGAZINE.thickness + CRATE.gap;

export const MAGAZINE_CRATE = {
  wall: CRATE.wall,
  floor: CRATE.floor,
  padX: CRATE.padX,
  padZ: CRATE.padZ,
  gap: CRATE.gap,
  wallHeight: CRATE.sideHeight,
};

export const MAGAZINE_HOVER_LIFT = 0.018;

export type MagazinePose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

export function magazineCrateInner(count: number): {
  x: number;
  y: number;
  z: number;
} {
  const n = Math.max(1, count);
  return {
    x:
      n * CRATE_MAGAZINE.thickness +
      Math.max(0, n - 1) * CRATE.gap +
      CRATE.padX * 2,
    y: CRATE.sideHeight,
    z: CRATE_MAGAZINE.depth + CRATE.padZ * 2,
  };
}

export function magazineCrateOuter(count: number): {
  w: number;
  h: number;
  d: number;
} {
  const inner = magazineCrateInner(count);
  return {
    w: inner.x + MAGAZINE_CRATE.wall * 2,
    h: MAGAZINE_CRATE.floor + inner.y,
    d: inner.z + MAGAZINE_CRATE.wall * 2,
  };
}

/**
 * Rest pose for a magazine standing in the crate. The origin is the trough
 * floor-center, so `CRATE_MAGAZINE_RZ` swings the body onto −X and up: shift
 * back by half a slot to sit centered, and up by half its length to stand on
 * the crate floor.
 */
export function crateMagazineWorld(index: number, count: number): MagazinePose {
  const inner = magazineCrateInner(count);
  const x0 = -inner.x / 2 + CRATE.padX + CRATE_MAGAZINE.thickness;
  return {
    x: CRATE_POS.x + x0 + index * (CRATE_MAGAZINE.thickness + CRATE.gap),
    y: TABLE_TOP + CRATE.floor + CRATE_MAGAZINE.height / 2,
    z: CRATE_POS.z,
    rx: 0,
    ry: CRATE_SLIDE_Y,
    rz: CRATE_MAGAZINE_RZ,
  };
}

/** Locked from the orbit pose the user chose. */
export function getCatalogCam() {
  return {
    px: 0.40,
    py: 1.16,
    pz: 1.20,
    tx: 0.87,
    ty: 0.80,
    tz: 0.42,
    fov: 36,
  };
}

export const CATALOG_CAM = getCatalogCam();

/** Pulled-back three-quarter during insert — projector + side rail in frame. */
export function getInsertCam() {
  return {
    px: PROJECTOR_POS.x + 0.78,
    py: TABLE_TOP + 0.55,
    pz: PROJECTOR_POS.z + 1.12,
    tx: PROJECTOR_POS.x + 0.16,
    ty: TABLE_TOP + 0.13,
    tz: PROJECTOR_POS.z + 0.06,
    fov: 42,
  };
}

export const PLAYBACK_CAM = {
  px: 0.34,
  py: 0.92,
  pz: 0.46,
  tx: 0.0,
  ty: 1.78,
  tz: -3.05,
  fov: 42,
};

export function crateInnerWidth(count: number): number {
  return magazineCrateInner(count).x;
}

export function crateSlotWorld(index: number, count: number): MagazinePose {
  return crateMagazineWorld(index, count);
}
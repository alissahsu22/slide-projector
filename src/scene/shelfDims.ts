import {
  CRATE_MAGAZINE,
  CRATE_MAGAZINE_RZ,
  type MagazinePose,
} from '../experience/layout';
import { ROOM_FRONT_Z, ROOM_HALF_W } from './roomDims';

/**
 * Sketchfab bookshelf, measured off the loaded scene rather than the raw mesh:
 * the FBX export is Z-up, but its root node carries the correction, so three
 * gets a unit that already stands on y = 0 with its open front on −z.
 */
export const SHELF_MODEL = {
  url: '/models/book_shelf.glb',
  height: 4.378,
  halfX: 1.3777,
  /** Standing surface of each compartment, bottom to top. */
  shelfY: [0.44, 1.08, 1.68, 2.28, 2.88, 3.48],
  /** Inner faces of the side panels — the usable run of a plank. */
  innerHalfX: 1.13,
  /** Plank edges, and the back panel's outer face. */
  plankBackZ: 0.2,
  plankFrontZ: -0.38,
  backZ: 0.329,
} as const;

/** Fitted height of the unit in the room. */
export const SHELF_HEIGHT = 1.86;
export const SHELF_SCALE = SHELF_HEIGHT / SHELF_MODEL.height;

/**
 * Shelf space: +x runs along the width from the middle, +y is up from the
 * floor, and z measures out from the back panel, so the open front is at
 * negative z. `Bookshelf` seats the model in this frame and lays the magazines
 * out in it, then the root turns the whole thing to face the room.
 */
export const SHELF_LEVELS = SHELF_MODEL.shelfY.map((y) => y * SHELF_SCALE);
export const SHELF_INNER_W = SHELF_MODEL.innerHalfX * 2 * SHELF_SCALE;
export const SHELF_PLANK_Z = {
  back: (SHELF_MODEL.plankBackZ - SHELF_MODEL.backZ) * SHELF_SCALE,
  front: (SHELF_MODEL.plankFrontZ - SHELF_MODEL.backZ) * SHELF_SCALE,
};

/** The model already stands on the floor, so only its back has to be squared up. */
export const SHELF_MODEL_Z = -SHELF_MODEL.backZ * SHELF_SCALE;

/** Backed onto the right-hand wall, so the front (−z) has to swing to −x. */
export const SHELF_ROT_Y = Math.PI / 2;

const WALL_GAP = 0.02;

/**
 * The corner diagonally opposite the door: backed onto the right-hand wall
 * with its side panel run up to the front one, so it fills the corner instead
 * of floating along the wall.
 */
export const SHELF_POS = {
  x: ROOM_HALF_W - WALL_GAP,
  y: 0,
  z: ROOM_FRONT_Z - WALL_GAP - SHELF_MODEL.halfX * SHELF_SCALE,
};

/** Held off the plank's front lip so nothing overhangs the edge. */
export const SHELF_FRONT_INSET = 0.022;
export const SHELF_ROW_MARGIN = 0.014;
/** Air between neighbours in a run — they are shelved, not glued. */
export const SHELF_NEIGHBOUR_GAP = 0.0016;
export const SHELF_SLOT_PITCH = CRATE_MAGAZINE.thickness + SHELF_NEIGHBOUR_GAP;

/**
 * Planks kept clear of dressing for the real library, filled in this order.
 * Eye level first, since that is what the curation shot frames.
 */
export const SHELF_LIBRARY_LEVELS = [3, 2] as const;

/**
 * Standing on a library plank, long axis up and label out into the room.
 * The shelf root turns local −z to world −x, so the label needs the same turn.
 */
export const SHELF_MAGAZINE_RY = -Math.PI / 2;

/** Depth of a shelved magazine's centre, measured from the back panel. */
export const SHELF_MAGAZINE_Z =
  SHELF_PLANK_Z.front + SHELF_FRONT_INSET + CRATE_MAGAZINE.depth / 2;

/** Longest run a library plank can physically hold. */
export const SHELF_MAX_SLOTS_PER_ROW = Math.max(
  1,
  Math.floor((SHELF_INNER_W - SHELF_ROW_MARGIN * 2) / SHELF_SLOT_PITCH),
);

/**
 * How much of a plank the row actually uses. A phone sees a much narrower
 * slice of the shelf than a desktop, so the run is shortened to whatever the
 * curation shot can frame and centred in it — otherwise the magazines at the
 * ends of a full-width row stand outside the picture.
 */
let slotsPerRow = SHELF_MAX_SLOTS_PER_ROW;

export function shelfSlotsPerRow(): number {
  return slotsPerRow;
}

export function shelfSlotCount(): number {
  return slotsPerRow * SHELF_LIBRARY_LEVELS.length;
}

/** Returns true when the row changed, so callers can re-home the magazines. */
export function setShelfSlotsPerRow(count: number): boolean {
  const next = Math.max(1, Math.min(SHELF_MAX_SLOTS_PER_ROW, Math.floor(count)));
  if (next === slotsPerRow) return false;
  slotsPerRow = next;
  return true;
}

/**
 * Shelf space to world. The root sits at `SHELF_POS` turned a quarter turn
 * about y, which sends local +x to world −z and local +z to world +x.
 */
export function shelfLocalToWorld(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  return { x: SHELF_POS.x + z, y, z: SHELF_POS.z - x };
}

/**
 * Rest pose of the magazine filed in `slot`. Slots are permanent, so the run
 * shows a gap wherever a magazine has been taken to the desk.
 */
export function shelfSlotWorld(slot: number): MagazinePose {
  const perRow = slotsPerRow;
  const index = Math.max(0, Math.min(perRow * SHELF_LIBRARY_LEVELS.length - 1, Math.round(slot)));
  const row = Math.floor(index / perRow);
  const column = index - row * perRow;
  const level = SHELF_LEVELS[SHELF_LIBRARY_LEVELS[row]];
  // Local +x runs to world −z, which is screen left in the curation shot, so
  // counting down from the far edge fills the row left to right like the crate.
  // A standing magazine hangs its thickness off one side of its origin, so the
  // pose sits on the leading edge of the slot rather than in the middle of it.
  const runWidth = perRow * SHELF_SLOT_PITCH - SHELF_NEIGHBOUR_GAP;
  const localX =
    runWidth / 2 - CRATE_MAGAZINE.thickness - column * SHELF_SLOT_PITCH;
  const world = shelfLocalToWorld(
    localX,
    level + CRATE_MAGAZINE.height / 2,
    SHELF_MAGAZINE_Z,
  );
  return {
    ...world,
    rx: 0,
    ry: SHELF_MAGAZINE_RY,
    rz: CRATE_MAGAZINE_RZ,
  };
}

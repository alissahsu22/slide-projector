import * as THREE from 'three';
import {
  shelfSlotCount,
  shelfSlotWorld,
} from '../scene/shelfDims';
import {
  addToCollection,
  canAddToCollection,
  getState,
  removeFromCollection,
  reorderCollection,
  swapIntoCollection,
} from '../state/store';
import { crateMagazineWorld, crateSlotCount } from './layout';

/**
 * Where a dragged magazine would land. The shelf has no slot of its own: a
 * magazine always returns to the gap it left, so dropping anywhere on the shelf
 * files it back where it came from.
 */
export type DragTarget = { kind: 'crate'; slot: number } | { kind: 'shelf' } | null;

export const dragState = {
  active: false,
  id: null as string | null,
  /** True when the magazine was picked out of the crate rather than the shelf. */
  fromCollection: false,
  target: null as DragTarget,
  /** World point the magazine is held at. */
  x: 0,
  y: 0,
  z: 0,
  /** Distance from the camera it is held at, eased between the two regions. */
  hold: 0,
};

/** Screen distance, in NDC, within which a slot counts as hovered. */
const SNAP_RADIUS = 0.22;
/** The crate is the thing being curated, so it wins near-ties with the shelf. */
const CRATE_BIAS = 0.8;

let releasedAt = 0;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _point = new THREE.Vector3();
const _projected = new THREE.Vector3();

export function isDragging(id: string): boolean {
  return dragState.active && dragState.id === id;
}

/** True just after a drop, so a stray click on empty space isn't a "done". */
export function dragReleasedRecently(): boolean {
  return performance.now() - releasedAt < 250;
}

export function beginDrag(id: string, from: THREE.Vector3, camera: THREE.Camera): void {
  dragState.active = true;
  dragState.id = id;
  dragState.fromCollection = getState().collectionIds.includes(id);
  dragState.target = null;
  dragState.x = from.x;
  dragState.y = from.y;
  dragState.z = from.z;
  dragState.hold = from.distanceTo(camera.position);
}

function reset(): void {
  dragState.active = false;
  dragState.id = null;
  dragState.target = null;
}

export function cancelDrag(): void {
  if (!dragState.active) return;
  releasedAt = performance.now();
  reset();
}

/** Squared NDC distance from the pointer to a world point, aspect corrected. */
function screenDistance(
  point: THREE.Vector3,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  aspect: number,
): number {
  _projected.copy(point).project(camera);
  if (_projected.z > 1) return Infinity;
  const dx = (_projected.x - pointer.x) * aspect;
  const dy = _projected.y - pointer.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Pick the slot nearest the pointer on screen rather than in the world: the
 * crate floats between the camera and the shelf, so depth can't decide which
 * one the user means, but a cursor over the crate plainly can.
 */
function resolveTarget(
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  aspect: number,
): { target: DragTarget; distance: number } {
  const s = getState();
  const slotCount = crateSlotCount(s.capacity, s.collectionIds.length);
  // The last slot holds the "+" card, so it is not a drop target.
  const dropSlots = slotCount - 1;
  let best: DragTarget = null;
  let bestScore = SNAP_RADIUS;
  let bestDistance = dragState.hold;

  for (let slot = 0; slot < dropSlots; slot++) {
    const pose = crateMagazineWorld(slot, slotCount);
    _point.set(pose.x, pose.y, pose.z);
    const score = screenDistance(_point, camera, pointer, aspect) * CRATE_BIAS;
    if (score >= bestScore) continue;
    bestScore = score;
    best = { kind: 'crate', slot };
    bestDistance = _point.distanceTo(camera.position);
  }

  const shelfSlots = shelfSlotCount();
  for (let slot = 0; slot < shelfSlots; slot++) {
    const pose = shelfSlotWorld(slot);
    _point.set(pose.x, pose.y, pose.z);
    const score = screenDistance(_point, camera, pointer, aspect);
    if (score >= bestScore) continue;
    bestScore = score;
    best = { kind: 'shelf' };
    bestDistance = _point.distanceTo(camera.position);
  }

  return { target: best, distance: bestDistance };
}

/**
 * Hold the magazine on the pointer ray, at the depth of whatever it is hovering.
 * Easing the depth is what makes a magazine pulled off the shelf come forward
 * into the crate instead of sliding along the wall.
 */
export function trackDrag(
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  aspect: number,
  delta: number,
): void {
  if (!dragState.active) return;

  const { target, distance } = resolveTarget(camera, pointer, aspect);
  dragState.target = target;
  dragState.hold += (distance - dragState.hold) * Math.min(1, delta * 6);

  _origin.setFromMatrixPosition(camera.matrixWorld);
  _dir.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(_origin).normalize();
  _point.copy(_origin).addScaledVector(_dir, dragState.hold);
  dragState.x = _point.x;
  dragState.y = _point.y;
  dragState.z = _point.z;
}

/** Commit the drop. A full crate trades places instead of refusing the drag. */
export function endDrag(): void {
  const { active, id, target, fromCollection } = dragState;
  releasedAt = performance.now();
  reset();
  if (!active || !id) return;

  if (target?.kind === 'crate') {
    const filled = getState().collectionIds.length;
    if (fromCollection) {
      reorderCollection(id, Math.min(target.slot, filled - 1));
    } else if (canAddToCollection()) {
      addToCollection(id, Math.min(target.slot, filled));
    } else {
      swapIntoCollection(id, Math.min(target.slot, filled - 1));
    }
    return;
  }

  if (target?.kind === 'shelf' && fromCollection) removeFromCollection(id);
}

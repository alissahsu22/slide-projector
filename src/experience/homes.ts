import { shelfSlotWorld } from '../scene/shelfDims';
import type { ExperienceState } from '../state/store';
import { dragState } from './drag';
import { crateMagazineWorld, crateSlotCount, type MagazinePose } from './layout';

/**
 * Where every magazine belongs this frame. Membership decides the region — the
 * crate for the curated collection, its own permanent gap on the shelf for the
 * rest — and the magazine being dragged is left out so the row can open up
 * under the cursor.
 */
export type HomePlan = {
  slotCount: number;
  crateSlot: Map<string, number>;
};

export function buildHomePlan(s: ExperienceState): HomePlan {
  const slotCount = crateSlotCount(s.capacity, s.collectionIds.length);
  const held = dragState.active ? dragState.id : null;
  const heldIsMember = held !== null && s.collectionIds.includes(held);
  // Only open a gap when the drop would actually fit: a full crate swaps, and
  // shifting its row along would push the last magazine into the "+" slot.
  const opening =
    held !== null &&
    dragState.target?.kind === 'crate' &&
    (heldIsMember || s.collectionIds.length < s.capacity)
      ? dragState.target.slot
      : -1;

  const crateSlot = new Map<string, number>();
  let slot = 0;
  for (const id of s.collectionIds) {
    if (id === held) continue;
    if (slot === opening) slot += 1;
    crateSlot.set(id, slot);
    slot += 1;
  }

  return { slotCount, crateSlot };
}

export function writeMagazineHome(
  id: string,
  plan: HomePlan,
  s: ExperienceState,
  out: MagazinePose,
): MagazinePose {
  const slot = plan.crateSlot.get(id);
  return Object.assign(
    out,
    slot === undefined
      ? shelfSlotWorld(s.shelfSlots[id] ?? 0)
      : crateMagazineWorld(slot, plan.slotCount),
  );
}

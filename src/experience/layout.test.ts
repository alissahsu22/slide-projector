import { describe, expect, it } from 'vitest';
import { collectionCapacity, COLLECTION_CAP } from './capacity';
import {
  CRATE,
  crateSlotCount,
  crateSlotOffset,
  fitPoseToAspect,
  getCatalogCam,
  REFERENCE_ASPECT,
  SLOT_SPACING,
  type CameraPose,
} from './layout';

const distance = (p: CameraPose) => Math.hypot(p.px - p.tx, p.py - p.ty, p.pz - p.tz);

describe('fitPoseToAspect', () => {
  const authored = getCatalogCam();

  it('leaves the authored shot alone at the reference aspect', () => {
    const fitted = { ...fitPoseToAspect(authored, REFERENCE_ASPECT) };
    expect(fitted.fov).toBeCloseTo(authored.fov, 5);
    expect(distance(fitted)).toBeCloseTo(distance(authored), 5);
  });

  it('keeps looking at the same target whatever the window shape', () => {
    for (const aspect of [0.4, 0.75, 1.19, 1.8, 3.2]) {
      const fitted = fitPoseToAspect(authored, aspect);
      expect([fitted.tx, fitted.ty, fitted.tz]).toEqual([authored.tx, authored.ty, authored.tz]);
    }
  });

  it('pulls back as the window narrows', () => {
    const wide = distance({ ...fitPoseToAspect(authored, 1.19) });
    const tall = distance({ ...fitPoseToAspect(authored, 0.6) });
    expect(tall).toBeGreaterThan(wide);
  });

  it('keeps the fov inside its clamp at extreme aspects', () => {
    for (const aspect of [0.2, 0.46, 2.4, 5]) {
      const { fov } = fitPoseToAspect(authored, aspect);
      expect(fov).toBeGreaterThanOrEqual(20);
      expect(fov).toBeLessThanOrEqual(60);
    }
  });

  it('ignores a degenerate aspect', () => {
    expect(fitPoseToAspect(authored, 0)).toBe(authored);
    expect(fitPoseToAspect(authored, Number.NaN)).toBe(authored);
  });
});

describe('crate', () => {
  it('always keeps one slot for the "+" card', () => {
    expect(crateSlotCount(3, 0)).toBe(4);
    expect(crateSlotCount(3, 3)).toBe(4);
    // A window that narrowed after curating keeps its extra tapes.
    expect(crateSlotCount(3, 5)).toBe(6);
  });

  it('spaces slots evenly and centres the row in the crate', () => {
    const count = 4;
    for (let i = 1; i < count; i += 1) {
      expect(crateSlotOffset(i, count) - crateSlotOffset(i - 1, count)).toBeCloseTo(SLOT_SPACING, 9);
    }
    const first = crateSlotOffset(0, count);
    const last = crateSlotOffset(count - 1, count);
    // Offsets are slot edges, so the row is centred one slot thickness over.
    expect(first + last).toBeCloseTo(SLOT_SPACING - CRATE.gap, 9);
  });
});

describe('collectionCapacity', () => {
  it('fits three tapes on a phone and ten on a wide desktop', () => {
    expect(collectionCapacity(320)).toBe(COLLECTION_CAP.min);
    expect(collectionCapacity(600)).toBe(4);
    expect(collectionCapacity(4000)).toBe(COLLECTION_CAP.max);
    expect(collectionCapacity(Number.NaN)).toBe(COLLECTION_CAP.min);
  });
});

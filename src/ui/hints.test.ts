import { describe, expect, it } from 'vitest';
import { albumSlotCount } from './albumSlots';
import { nextHintFloats } from './guideAnchor';

describe('nextHintFloats', () => {
  it('puts the playback hint inline on phones and beside the panel on desktops', () => {
    expect(nextHintFloats(320)).toBe(false);
    expect(nextHintFloats(390)).toBe(false);
    expect(nextHintFloats(1280)).toBe(true);
    expect(nextHintFloats(1512)).toBe(true);
  });

  it('switches where a 220px hint stops fitting beside the 576px panel', () => {
    // (width - 576) / 2 - 24 >= 220  →  width >= 1064
    expect(nextHintFloats(1063)).toBe(false);
    expect(nextHintFloats(1064)).toBe(true);
  });
});

describe('albumSlotCount', () => {
  it('shows one open slot until the tape is full', () => {
    expect(albumSlotCount(0, 50)).toBe(1);
    expect(albumSlotCount(12, 50)).toBe(13);
    expect(albumSlotCount(50, 50)).toBe(50);
  });
});

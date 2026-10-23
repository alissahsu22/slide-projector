import type { GuideStep } from '../state/guide';

export type GuideAnchorBox = {
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

export type GuideRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

let box: GuideAnchorBox = null;
let avoid: GuideRect | null = null;

export function setGuideAnchor(next: GuideAnchorBox): void {
  box = next;
}

export function getGuideAnchor(): GuideAnchorBox {
  return box;
}

/** Screen rect the play note must stay off of — the PLAY / EDIT buttons. */
export function setGuideAvoid(next: GuideRect | null): void {
  avoid = next;
}

export function getGuideAvoid(): GuideRect | null {
  return avoid;
}

/** Narrowest the playback hint may be and still read as a sentence. */
export const HINT_MIN_WIDTH = 220;

/**
 * Whether the playback hint has room to float beside the controls panel. When
 * it doesn't (phones, narrow windows), the panel shows it inline instead, so
 * it never sits on the title, the keys, or the memory above.
 */
export function nextHintFloats(viewportWidth: number): boolean {
  const panel = Math.min(576, viewportWidth - 24);
  return (viewportWidth - panel) / 2 - 24 >= HINT_MIN_WIDTH;
}

/** What each hint says. The playback panel reuses the `next` line inline. */
export const GUIDE_COPY: Record<GuideStep, string> = {
  play: 'Start here. Choose a tape, then press Play.',
  next: 'The tape plays on its own. Pause or skip here.',
  shelf: 'More tapes are on the shelf.',
  view: 'Look around the room.',
  'empty-crate': 'The crate is empty. More tapes are on the shelf.',
  'empty-room': 'No tapes yet. Add a tape to start a collection of memories.',
};

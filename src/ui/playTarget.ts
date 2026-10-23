import type { GuideRect } from './guideAnchor';

let rect: GuideRect | null = null;

/** Screen rect of the selected tape's PLAY billboard, written every frame. */
export function setPlayTarget(next: GuideRect | null): void {
  rect = next;
}

export function getPlayTarget(): GuideRect | null {
  return rect;
}

/** The crate's idle timeout must not take the tape out from under the Play button. */
export function isPlayButtonFocused(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && active.hasAttribute('data-play-button');
}

import { useEffect, useRef, useState } from 'react';
import { skipGuide, useGuideProgress, useGuideStep, type GuideStep } from '../state/guide';
import { useExperience } from '../state/store';
import {
  getGuideAnchor,
  getGuideAvoid,
  GUIDE_COPY,
  HINT_MIN_WIDTH,
  nextHintFloats,
  type GuideRect,
} from './guideAnchor';
import { useCoarsePointer } from './useCoarsePointer';

/** Once a tape is chosen, the play note says the one thing left to do. */
const PLAY_CHOSEN = 'Now press Play, or hit Enter.';
/** Touch screens have no Enter key to offer. */
const PLAY_CHOSEN_TOUCH = 'Now tap Play.';

const MARGIN = 12;
const GAP = 10;

function domTarget(step: GuideStep): HTMLElement | null {
  const key =
    step === 'next'
      ? 'next'
      : step === 'shelf' || step === 'empty-crate'
        ? 'shelf'
        : step === 'view'
          ? 'view'
          : null;
  if (!key) return null;
  const el = document.querySelector(`[data-guide="${key}"]`);
  return el instanceof HTMLElement ? el : null;
}

function rectOf(selector: string): GuideRect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function overlaps(a: GuideRect, b: GuideRect, pad: number): boolean {
  return (
    a.left < b.right + pad &&
    a.right > b.left - pad &&
    a.top < b.bottom + pad &&
    a.bottom > b.top - pad
  );
}

type Box = { left: number; top: number; width: number; height: number };

function asRect(left: number, top: number, w: number, h: number): GuideRect {
  return { left, top, right: left + w, bottom: top + h };
}

/**
 * Try each side of the target in turn and take the first spot that stays on
 * screen, below the toolbar, and clear of everything in `avoid` — the target
 * itself always among them, so the note sits beside what it points at and
 * never on top of it.
 */
function bestSpot(
  target: Box,
  w: number,
  h: number,
  avoid: GuideRect[],
  floor: number,
  order: Array<'left' | 'right' | 'below' | 'above'>,
): { left: number; top: number } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const midY = target.top + target.height / 2 - h / 2;
  const midX = target.left + target.width / 2 - w / 2;
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - w - MARGIN));
  const clampY = (y: number) => Math.max(floor, Math.min(y, vh - h - MARGIN));
  const spots = {
    left: { left: target.left - w - GAP, top: clampY(midY) },
    right: { left: target.left + target.width + GAP, top: clampY(midY) },
    below: { left: clampX(midX), top: target.top + target.height + GAP },
    above: { left: clampX(midX), top: target.top - h - GAP },
  };
  for (const side of order) {
    const spot = spots[side];
    const onScreen =
      spot.left >= MARGIN &&
      spot.left + w <= vw - MARGIN &&
      spot.top >= floor &&
      spot.top + h <= vh - MARGIN;
    if (!onScreen) continue;
    const rect = asRect(spot.left, spot.top, w, h);
    if (avoid.some((block) => overlaps(rect, block, 6))) continue;
    return spot;
  }
  return null;
}

function hide(el: HTMLElement): void {
  el.style.visibility = 'hidden';
}

function place(el: HTMLElement, step: GuideStep): void {
  const vw = window.innerWidth;
  const bar = rectOf('.top-bar');
  const floor = (bar?.bottom ?? 56) + 8;

  if (step === 'next' && !nextHintFloats(vw)) {
    // The controls panel carries this note inline on narrow screens.
    hide(el);
    return;
  }

  el.style.maxWidth = `min(18rem, calc(100vw - ${MARGIN * 2}px))`;
  el.style.minWidth = `min(${HINT_MIN_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`;
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  const dom = domTarget(step);
  let spot: { left: number; top: number } | null = null;

  if (step === 'next') {
    const panel = rectOf('.playback');
    const keys = dom?.getBoundingClientRect();
    if (!panel || !keys) return hide(el);
    // Beside the panel, level with the keys it's about.
    const target = {
      left: panel.left,
      top: keys.top,
      width: panel.right - panel.left,
      height: keys.height,
    };
    spot = bestSpot(target, w, h, [panel], floor, ['left', 'right']);
  } else if (dom) {
    const r = dom.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return hide(el);
    const target = { left: r.left, top: r.top, width: r.width, height: r.height };
    // Toolbar notes hang below their key, right edges lined up, so they never
    // cover the keys beside it.
    const top = Math.max(floor, r.bottom + GAP);
    const left = Math.max(MARGIN, Math.min(r.right - w, vw - w - MARGIN));
    const below = asRect(left, top, w, h);
    spot = bar && overlaps(below, bar, 0) ? null : { left, top };
    spot ??= bestSpot(target, w, h, bar ? [bar] : [], floor, ['below', 'left']);
  } else {
    const anchor = getGuideAnchor();
    if (!anchor) return hide(el);
    const tape = asRect(anchor.left, anchor.top, anchor.width, anchor.height);
    const avoid = [tape];
    const buttons = getGuideAvoid();
    if (buttons) avoid.push(buttons);
    if (bar) avoid.push(bar);
    spot = bestSpot(anchor, w, h, avoid, floor, ['left', 'right', 'below', 'above']);
  }

  if (!spot) return hide(el);
  el.style.transform = `translate(${Math.round(spot.left)}px, ${Math.round(spot.top)}px)`;
  el.style.visibility = 'visible';
}

export function ExploreHints() {
  const step = useGuideStep();
  const chosen = useExperience((s) => Boolean(s.crateSelectedId));
  const calloutRef = useRef<HTMLDivElement>(null);
  // Escape or clicking elsewhere hides the current note. The next step still
  // gets its own, and Help can bring them all back.
  const [dismissed, setDismissed] = useState<GuideStep | null>(null);
  const shown = step && step !== dismissed ? step : null;
  const progress = useGuideProgress();
  const coarse = useCoarsePointer();

  // Progress moving on (or Help replaying the hints) brings notes back.
  useEffect(() => {
    setDismissed(null);
  }, [progress]);

  useEffect(() => {
    if (!shown) return;
    const onPointerDown = (event: PointerEvent) => {
      const el = calloutRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) return;
      // Clicking around the room is how the play step gets done (choose a
      // tape, then Play), so it must not wave the note away mid-task.
      if (shown === 'play' && event.target instanceof HTMLCanvasElement) return;
      setDismissed(shown);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // The first Escape is spent on the note, so it doesn't also leave the tape.
      event.preventDefault();
      setDismissed(shown);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    const tick = () => {
      const el = calloutRef.current;
      if (el) place(el, shown);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [shown]);

  if (!shown) return null;

  const tutorial = shown !== 'empty-room';
  const copy =
    shown === 'play' && chosen ? (coarse ? PLAY_CHOSEN_TOUCH : PLAY_CHOSEN) : GUIDE_COPY[shown];

  return (
    <div className="guide-layer">
      <div
        ref={calloutRef}
        id="explore-hint"
        className="guide-callout"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          className="guide-close"
          aria-label="Hide this hint"
          onClick={() => setDismissed(shown)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6" />
          </svg>
        </button>
        <p>{copy}</p>
        {tutorial && (
          <button type="button" className="guide-skip" onClick={() => skipGuide()}>
            Skip hints
          </button>
        )}
      </div>
    </div>
  );
}

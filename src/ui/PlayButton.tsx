import { useEffect, useRef } from 'react';
import { requestPlay } from '../experience/controller';
import { getCollection, useExperience } from '../state/store';
import { isTransitional } from '../types/collection';
import { getPlayTarget } from './playTarget';
import { focusRoom } from './roomFocus';
import { useWebGLFailed } from './sceneStatus';

/**
 * The PLAY billboard as a real button, for the keyboard and screen readers.
 * It lies over the billboard so its focus ring rings the key you can see, and
 * lets the pointer through so clicks and taps still land on the room.
 */
export function PlayButton() {
  const id = useExperience((s) => s.crateSelectedId);
  const available = useExperience(
    (s) =>
      Boolean(s.crateSelectedId) &&
      s.collectionIds.includes(s.crateSelectedId ?? '') &&
      s.deletingId !== s.crateSelectedId &&
      s.arrivingId !== s.crateSelectedId &&
      s.mode !== 'CURATING' &&
      !isTransitional(s.mode) &&
      !s.createOpen &&
      !s.editingId,
  );
  const webglFailed = useWebGLFailed();
  const collection = getCollection(id);
  if (!available || webglFailed || !collection) return null;
  return <PlayKey id={collection.id} title={collection.title} />;
}

function PlayKey({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const el = ref.current;
      const rect = getPlayTarget();
      if (el) {
        if (rect) {
          el.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
          el.style.width = `${Math.round(rect.right - rect.left)}px`;
          el.style.height = `${Math.round(rect.bottom - rect.top)}px`;
          el.removeAttribute('data-offscreen');
        } else {
          el.setAttribute('data-offscreen', '');
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Playing, deselecting or a flight starting takes this button away; don't
  // strand keyboard focus on <body> when it goes.
  useEffect(
    () => () => {
      if (focused.current) window.requestAnimationFrame(focusRoom);
    },
    [],
  );

  return (
    <button
      ref={ref}
      type="button"
      className="play-button"
      data-play-button=""
      data-offscreen=""
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={(event) => {
        // Removal blurs with no relatedTarget; only a real move elsewhere counts.
        if (event.relatedTarget) focused.current = false;
      }}
      onClick={() => requestPlay(id)}
    >
      <span className="sr-only">Play {title}</span>
    </button>
  );
}

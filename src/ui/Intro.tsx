import { useRef } from 'react';
import { startMusic } from '../audio/music';
import { unlockAudio } from '../audio/sounds';
import { setEntered, useExperience } from '../state/store';
import { focusRoom } from './roomFocus';
import { useDialogFocus } from './useDialogFocus';

/**
 * Compact opening. The name engraved on the crate is optional and is not
 * asked for here — the room can be explored without it.
 */
export function Intro() {
  const entered = useExperience((s) => s.entered);
  const cardRef = useRef<HTMLDivElement>(null);
  useDialogFocus(!entered, cardRef);

  if (entered) return null;

  return (
    <div className="intro">
      <div
        ref={cardRef}
        className="intro-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
      >
        <p className="intro-eyebrow">A room inside my head</p>
        <h1 className="intro-title" id="intro-title">
          Come on in.
        </h1>
        <p className="intro-lead">
          Every tape holds memories. Pick one and play it back.
        </p>
        <button
          type="button"
          className="album-prompt is-primary intro-enter"
          data-autofocus
          onClick={() => {
            unlockAudio();
            startMusic();
            setEntered();
            // Land on the room, not the toolbar, so the arrows and Enter
            // work at once. Help stays one Tab away.
            window.requestAnimationFrame(focusRoom);
          }}
        >
          Step inside
        </button>
        <p className="intro-hint" aria-hidden="true">
          or press enter
        </p>
      </div>
    </div>
  );
}

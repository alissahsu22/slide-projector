import { useEffect, useRef } from 'react';
import { pauseAutoplay, resumeAutoplay } from '../experience/controller';
import { setAboutOpen, useAboutOpen } from './aboutState';
import { useDialogFocus } from './useDialogFocus';

export function AboutRoom() {
  const open = useAboutOpen();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

  useEffect(() => {
    if (!open) return;
    pauseAutoplay();
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAboutOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      resumeAutoplay();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="about-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAboutOpen(false);
      }}
    >
      <div
        ref={panelRef}
        className="about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <div className="about-bar">
          <h2 className="about-title" id="about-title">
            About this room
          </h2>
          <button
            type="button"
            className="album-prompt"
            data-autofocus
            onClick={() => setAboutOpen(false)}
          >
            <span className="album-key is-wide">Esc</span>
            Back
          </button>
        </div>
        <div className="about-body album-page">
          <p>This is a little room inside my head.</p>
          <p>
            I made it as a place to collect the people, places, and moments I want to
            remember. Each tape holds a few of those memories, ready to revisit.
          </p>
          <p>Pick any tape and stay a while. There’s no wrong place to start.</p>
          <p className="about-sign">— Alissa</p>
          <p className="about-credit">Made by Alissa Hsu</p>
        </div>
      </div>
    </div>
  );
}

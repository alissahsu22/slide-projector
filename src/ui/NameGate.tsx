import { useRef, useState } from 'react';
import { startMusic } from '../audio/music';
import { unlockAudio } from '../audio/sounds';
import { VIEWER_NAME_MAX } from '../state/persistence';
import { setViewerName, useExperience } from '../state/store';

/**
 * Asks the visitor for a first name before the room opens, and uses that first
 * touch of the keyboard as the gesture that lets the record start playing —
 * autoplay policies block a cold start with no interaction behind it.
 */
export function NameGate() {
  const viewerName = useExperience((s) => s.viewerName);
  const [name, setName] = useState('');
  const started = useRef(false);

  if (viewerName) return null;

  const begin = () => {
    if (started.current) return;
    started.current = true;
    unlockAudio();
    startMusic();
  };

  return (
    <div className="name-gate">
      <form
        className="name-gate-card"
        onSubmit={(event) => {
          event.preventDefault();
          begin();
          setViewerName(name);
        }}
      >
        <h1 className="name-gate-title">&quot;Who Is There?&quot;</h1>
        <div className="name-gate-row">
          <input
            type="text"
            value={name}
            maxLength={VIEWER_NAME_MAX}
            placeholder="First name"
            aria-label="First name"
            autoComplete="given-name"
            onFocus={begin}
            onPointerDown={begin}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="name-gate-submit" disabled={!name.trim()}>
            Enter
          </button>
        </div>
      </form>
    </div>
  );
}

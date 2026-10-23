import {
  changeSlide,
  requestEject,
  restartCollection,
  togglePause,
} from '../experience/controller';
import { useEffect, useState } from 'react';
import { skipGuide, useGuideStep } from '../state/guide';
import { GUIDE_COPY, nextHintFloats } from './guideAnchor';
import { focusRoom } from './roomFocus';

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}
import { getCollection, useExperience } from '../state/store';

type TransportKind = 'previous' | 'next' | 'pause' | 'play';

function TransportIcon({ kind }: { kind: TransportKind }) {
  const bars: Record<TransportKind, Array<[number, number, number, number]>> = {
    previous: [
      [2, 2, 2, 12],
      [6, 7, 2, 2],
      [8, 6, 2, 4],
      [10, 4, 2, 8],
      [12, 2, 2, 12],
    ],
    next: [
      [2, 2, 2, 12],
      [4, 4, 2, 8],
      [6, 6, 2, 4],
      [8, 7, 2, 2],
      [12, 2, 2, 12],
    ],
    pause: [
      [3, 2, 3, 12],
      [10, 2, 3, 12],
    ],
    play: [
      [4, 2, 2, 12],
      [6, 4, 2, 8],
      [8, 6, 2, 4],
      [10, 7, 2, 2],
    ],
  };

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {bars[kind].map(([x, y, width, height], index) => (
        <rect key={index} x={x} y={y} width={width} height={height} />
      ))}
    </svg>
  );
}

/**
 * The date, minus any word the title already says: "SF Summer" with
 * "Summer 2026" reads "2026", not "Summer" twice.
 */
function dateBesideTitle(title: string, date: string | undefined): string {
  if (!date) return '';
  const said = new Set(title.toLowerCase().split(/\s+/));
  return date
    .split(/\s+/)
    .filter((word) => !said.has(word.toLowerCase()))
    .join(' ');
}

export function PlaybackControls() {
  const mode = useExperience((s) => s.mode);
  const insertedId = useExperience((s) => s.insertedId);
  const slideIndex = useExperience((s) => s.slideIndex);
  const isPlaying = useExperience((s) => s.isPlaying);
  const photoReady = useExperience((s) => s.photoReady);
  const photoError = useExperience((s) => s.photoError);
  const guideStep = useGuideStep();
  const viewportWidth = useViewportWidth();
  const collection = getCollection(insertedId);

  const visible =
    !!insertedId &&
    (mode === 'PLAYING' ||
      mode === 'PAUSED' ||
      mode === 'CHANGING_SLIDE' ||
      mode === 'REWINDING');

  if (!visible || !collection) return null;
  const inlineHint = guideStep === 'next' && !nextHintFloats(viewportWidth);

  const total = collection.photos.length;
  const date = dateBesideTitle(collection.title, collection.date);
  const current = slideIndex + 1;
  const busy = mode === 'CHANGING_SLIDE' || mode === 'REWINDING';
  const atStart = slideIndex <= 0;
  const atEnd = slideIndex >= total - 1;
  const ended = atEnd && !isPlaying;
  const hintNext = guideStep === 'next';

  return (
    <div className={`playback ${busy ? 'is-busy' : ''}`} role="region" aria-label="Tape controls">
      <div className="playback-heading">
        <div className="playback-titles">
          <span className="playback-title">{collection.title}</span>
          {date && <span className="playback-date">{date}</span>}
        </div>
        <span className="playback-counter" aria-live="polite">
          <span className="sr-only">Memory </span>
          {current}
          <span className="playback-counter-total">
            <span aria-hidden="true"> / </span>
            <span className="sr-only"> of </span>
            {total}
          </span>
        </span>
      </div>
      <div className="playback-progress" aria-hidden="true">
        <span style={{ width: `${(current / total) * 100}%` }} />
      </div>
      {photoError ? (
        <p className="playback-note is-error">This memory couldn’t load.</p>
      ) : (
        !photoReady && <p className="playback-note">Loading this memory…</p>
      )}
      {inlineHint && (
        <div className="playback-hint" id="explore-hint" role="status">
          <p>{GUIDE_COPY.next}</p>
          <button type="button" className="guide-skip" onClick={() => skipGuide()}>
            Skip hints
          </button>
        </div>
      )}
      <div className="playback-buttons">
        <div className="playback-transport" data-guide={hintNext ? 'next' : undefined}>
          <button
            type="button"
            className={`is-icon${hintNext && !atStart ? ' guide-target' : ''}`}
            aria-label="Previous"
            aria-describedby={hintNext ? 'explore-hint' : undefined}
            disabled={busy || atStart}
            onClick={() => void changeSlide(-1)}
          >
            <TransportIcon kind="previous" />
          </button>
          {!ended && (
            <button
              type="button"
              className="is-icon"
              aria-label={isPlaying ? 'Pause' : 'Resume'}
              disabled={busy || (atEnd && !isPlaying)}
              onClick={() => togglePause()}
            >
              <TransportIcon kind={isPlaying ? 'pause' : 'play'} />
            </button>
          )}
          {!ended && (
            <button
              type="button"
              className={`is-icon${hintNext ? ' guide-target' : ''}`}
              aria-label="Next"
              aria-describedby={hintNext ? 'explore-hint' : undefined}
              disabled={busy || atEnd}
              onClick={() => void changeSlide(1)}
            >
              <TransportIcon kind="next" />
            </button>
          )}
        </div>
        <div className="playback-actions">
          {ended && !atStart && (
            <button type="button" disabled={busy} onClick={() => void restartCollection({ play: true })}>
              Play again
            </button>
          )}
          <button
            type="button"
            className={ended ? 'is-primary' : 'eject'}
            disabled={busy}
            onClick={() => {
              // The panel is about to unmount; keep keyboard focus in the room.
              focusRoom();
              void requestEject();
            }}
          >
            {ended ? 'Choose another tape' : 'Back to the room'}
          </button>
        </div>
      </div>
    </div>
  );
}

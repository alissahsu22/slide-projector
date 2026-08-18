import { useState } from 'react';
import {
  changeSlide,
  requestEject,
  restartCollection,
  togglePause,
} from '../experience/controller';
import { getCollection, useExperience } from '../state/store';

export function PlaybackControls() {
  const [collapsed, setCollapsed] = useState(false);
  const mode = useExperience((s) => s.mode);
  const insertedId = useExperience((s) => s.insertedId);
  const slideIndex = useExperience((s) => s.slideIndex);
  const isPlaying = useExperience((s) => s.isPlaying);
  const photoReady = useExperience((s) => s.photoReady);
  const collection = getCollection(insertedId);

  const visible =
    !!insertedId &&
    (mode === 'PLAYING' ||
      mode === 'PAUSED' ||
      mode === 'CHANGING_SLIDE' ||
      mode === 'REWINDING');

  if (!visible || !collection) return null;

  const total = collection.photos.length;
  const current = slideIndex + 1;
  const busy = mode === 'CHANGING_SLIDE' || mode === 'REWINDING';
  const atStart = slideIndex <= 0;
  const atEnd = slideIndex >= total - 1;

  return (
    <div
      className={`playback ${busy ? 'is-busy' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      role="region"
      aria-label="Projector controls"
    >
      <button
        type="button"
        className="playback-toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show projector controls' : 'Hide projector controls'}
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? '▲' : '▼'}
      </button>
      <div className="playback-meta">
        <span className="playback-title">{collection.title}</span>
        <span className="playback-date">{collection.date}</span>
        {collapsed && (
          <span className="playback-mini-counter">
            {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="playback-body">
        <div className="playback-counter">
          {String(current).padStart(2, '0')}
          <span> / </span>
          {String(total).padStart(2, '0')}
          {!photoReady && <em className="playback-wait"> focusing</em>}
        </div>
        <div className="playback-buttons">
          <button
            type="button"
            disabled={busy || atStart}
            onClick={() => void changeSlide(-1)}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={busy || (atEnd && !isPlaying)}
            onClick={() => togglePause()}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            disabled={busy || atEnd}
            onClick={() => void changeSlide(1)}
          >
            Next
          </button>
          <button
            type="button"
            disabled={busy || atStart}
            onClick={() => void restartCollection()}
          >
            Restart
          </button>
          <button
            type="button"
            className="eject"
            disabled={busy}
            onClick={() => void requestEject()}
          >
            Eject
          </button>
        </div>
      </div>
    </div>
  );
}

import { useSyncExternalStore } from 'react';
import { isMusicMuted, subscribeMusic, toggleMusic } from '../audio/music';
import { canEnterCuration, enterCuration, exitCuration } from '../experience/curation';
import { getCollection, toggleOrbitInspect, useExperience } from '../state/store';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path className="speaker-body" d="M1 6h4v4H1zm4 0l4-3v10L5 10z" />
      {muted ? (
        <path className="speaker-mark" d="M11 6l4 4M15 6l-4 4" />
      ) : (
        <path className="speaker-mark" d="M11 6v4M13.5 4v8" />
      )}
    </svg>
  );
}

export function Overlay() {
  const musicMuted = useSyncExternalStore(subscribeMusic, isMusicMuted, () => false);
  const mode = useExperience((s) => s.mode);
  const insertedId = useExperience((s) => s.insertedId);
  const selectedCollectionId = useExperience((s) => s.selectedCollectionId);
  const orbitInspect = useExperience((s) => s.orbitInspect);
  const hoveredId = useExperience((s) => s.hoveredId);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const capacity = useExperience((s) => s.capacity);
  const kept = useExperience((s) => s.collectionIds.length);
  const dialogOpen = useExperience((s) => s.createOpen || Boolean(s.editingId));
  // Read so the Shelf button re-enables the moment the crate finishes flying back.
  useExperience((s) => s.curationBusy);
  const curating = mode === 'CURATING';
  const inCatalog = mode === 'CATALOG' && !insertedId && !selectedCollectionId;

  const hoveredCollection = getCollection(hoveredId);
  const selectedCollection = getCollection(crateSelectedId);
  // Hover takes priority; fall back to pinned selection for the info line.
  const readoutCollection = hoveredCollection ?? selectedCollection;
  const showCatalogHint = inCatalog && !readoutCollection && !orbitInspect;
  const full = kept >= capacity;

  return (
    <>
      <button
        type="button"
        className={`music-toggle ${musicMuted ? '' : 'is-on'}`}
        aria-pressed={!musicMuted}
        aria-label={musicMuted ? 'Turn music on' : 'Turn music off'}
        title={musicMuted ? 'Turn music on' : 'Turn music off'}
        onClick={() => toggleMusic()}
      >
        <SpeakerIcon muted={musicMuted} />
      </button>
      <div className="bottom-bar">
        <button
          type="button"
          className={`orbit-toggle ${orbitInspect ? 'is-on' : ''}`}
          onClick={() => toggleOrbitInspect()}
        >
          {orbitInspect ? 'Exit view' : 'View room'}
        </button>
        {/* The shelf stands in the corner, out of the catalog frame, so curating
            needs a way in that doesn't depend on being able to click it. */}
        {!curating && !orbitInspect && (
          <button
            type="button"
            className="shelf-toggle"
            disabled={dialogOpen || !canEnterCuration()}
            onClick={() => void enterCuration()}
          >
            Shelf
          </button>
        )}
        {curating && (
          <button type="button" className="curation-done" onClick={() => void exitCuration()}>
            Done
          </button>
        )}
      </div>
      {orbitInspect && (
        <p className="status">Drag to look around · scroll to zoom · right-drag to pan</p>
      )}
      {showCatalogHint && (
        <p className="hint">
          Select a tape. + to create a new roll · Shelf to curate
        </p>
      )}
      {curating && (
        <div className="curation">
          <div className="curation-count">
            <span className="curation-kept">{kept}</span>
            <span className="curation-cap">/ {capacity} on the desk</span>
          </div>
          <p className="curation-hint">
            {full
              ? 'Desk is full — drop one onto a magazine to trade places'
              : 'Drag magazines between the shelf and the crate'}
          </p>
        </div>
      )}
      {inCatalog && !orbitInspect && readoutCollection && (
        <div className="magazine-readout">
          <span className="magazine-readout-title">{readoutCollection.title}</span>
          <span className="magazine-readout-meta">
            {readoutCollection.date} · {readoutCollection.photos.length}{' '}
            {readoutCollection.photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>
      )}
      {!orbitInspect && mode === 'INSERTING' && <p className="status">Inserting magazine…</p>}
      {!orbitInspect && mode === 'SWITCHING' && <p className="status">Changing magazines…</p>}
    </>
  );
}

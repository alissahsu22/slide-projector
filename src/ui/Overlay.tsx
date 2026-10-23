import { useEffect, useSyncExternalStore } from 'react';
import { SOUND_ENABLED } from '../audio/enabled';
import { isMusicMuted, subscribeMusic, toggleMusic } from '../audio/music';
import { setEffectsMuted } from '../audio/sounds';
import { enterCuration, exitCuration } from '../experience/curation';
import { markViewed, useGuideStep } from '../state/guide';
import { getCollection, toggleOrbitInspect, useExperience } from '../state/store';
import type { Collection } from '../types/collection';
import { setAboutOpen, setHelpOpen, useAboutOpen } from './aboutState';
import { useWebGLFailed } from './sceneStatus';
import { useCoarsePointer } from './useCoarsePointer';

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

/* 8x8 pixel glyphs drawn as rects so they stay crisp next to Pixelify. */
function EyeIcon() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="4" height="1" />
      <rect x="1" y="3" width="1" height="2" />
      <rect x="6" y="3" width="1" height="2" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="2" y="5" width="4" height="1" />
    </svg>
  );
}

function ShelfIcon() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="1" height="3" />
      <rect x="3" y="2" width="1" height="2" />
      <rect x="5" y="1" width="2" height="3" />
      <rect x="0" y="4" width="8" height="1" />
      <rect x="1" y="5" width="1" height="2" />
      <rect x="6" y="5" width="1" height="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="1" height="1" />
      <rect x="2" y="2" width="1" height="1" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="5" y="2" width="1" height="1" />
      <rect x="6" y="1" width="1" height="1" />
      <rect x="2" y="5" width="1" height="1" />
      <rect x="1" y="6" width="1" height="1" />
      <rect x="5" y="5" width="1" height="1" />
      <rect x="6" y="6" width="1" height="1" />
    </svg>
  );
}

/** One line for the shelf: what the selected tape will do, or how moving works. */
function curationHint(opts: {
  selected: Collection | undefined;
  selectedInCrate: boolean;
  full: boolean;
  shelved: number;
  coarse: boolean;
}): string {
  const { selected, selectedInCrate, full, shelved, coarse } = opts;
  if (selected) {
    if (selectedInCrate) return `${selected.title}: press Enter to put it on the shelf.`;
    if (full) return `The crate is full. Move a tape out before bringing ${selected.title} over.`;
    return `${selected.title}: press Enter to put it in the crate.`;
  }
  const press = coarse ? 'tap' : 'click';
  if (shelved === 0) return `Every tape is in the crate. Drag one to the shelf, or ${press} it, to store it.`;
  if (full) return 'The crate is full. Drop a tape onto another to trade places.';
  return `Drag tapes between the shelf and the crate, or ${press} one to send it across.`;
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
  const crateIds = useExperience((s) => s.collectionIds);
  const kept = crateIds.length;
  const libraryCount = useExperience((s) => s.collections.length);
  const dialogOpen = useExperience((s) => s.createOpen || Boolean(s.editingId));
  const curationBusy = useExperience((s) => s.curationBusy);
  const aboutOpen = useAboutOpen();
  const guideStep = useGuideStep();
  const webglFailed = useWebGLFailed();
  const curating = mode === 'CURATING';
  const inCatalog = mode === 'CATALOG' && !insertedId && !selectedCollectionId;

  useEffect(() => {
    setEffectsMuted(isMusicMuted());
  }, []);

  const hoveredCollection = getCollection(hoveredId);
  const selectedCollection = getCollection(crateSelectedId);
  const readoutCollection = hoveredCollection ?? selectedCollection;
  const full = kept >= capacity;
  const coarse = useCoarsePointer();
  const curationCopy = curationHint({
    selected: curating ? getCollection(crateSelectedId) : undefined,
    selectedInCrate: Boolean(crateSelectedId && crateIds.includes(crateSelectedId)),
    full,
    shelved: libraryCount - kept,
    coarse,
  });
  const shelfHint = guideStep === 'shelf' || guideStep === 'empty-crate';
  const viewHint = guideStep === 'view';

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-utility">
          <button
            type="button"
            className="hud-link help-toggle"
            aria-label="How to explore"
            aria-haspopup="dialog"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="hud-link"
            aria-expanded={aboutOpen}
            onClick={() => setAboutOpen(true)}
          >
            About
          </button>
          {SOUND_ENABLED && (
            <button
              type="button"
              className={`hud-link music-toggle ${musicMuted ? '' : 'is-on'}`}
              aria-pressed={!musicMuted}
              aria-label={musicMuted ? 'Turn sound on' : 'Turn sound off'}
              onClick={() => {
                toggleMusic();
                setEffectsMuted(isMusicMuted());
              }}
            >
              <SpeakerIcon muted={musicMuted} />
            </button>
          )}
        </div>
        {!webglFailed && (
          <div className="top-bar-actions">
            <button
              type="button"
              className={`hud-action orbit-toggle ${orbitInspect ? 'is-on' : ''} ${viewHint ? 'guide-target' : ''}`}
              data-guide="view"
              aria-describedby={viewHint ? 'explore-hint' : undefined}
              onClick={() => {
                if (!orbitInspect) markViewed();
                toggleOrbitInspect();
              }}
            >
              {orbitInspect ? <CloseIcon /> : <EyeIcon />}
              <span>{orbitInspect ? 'Exit view' : 'View room'}</span>
            </button>
            {!curating && !orbitInspect && (
              <button
                type="button"
                className={`hud-action shelf-toggle ${shelfHint ? 'guide-target' : ''}`}
                data-guide="shelf"
                aria-describedby={shelfHint ? 'explore-hint' : undefined}
                disabled={
                  dialogOpen ||
                  curationBusy ||
                  mode !== 'CATALOG' ||
                  Boolean(insertedId)
                }
                onClick={() => void enterCuration()}
              >
                <ShelfIcon />
                <span>Open shelf</span>
              </button>
            )}
            {curating && (
              <button
                type="button"
                className="hud-action curation-done"
                onClick={() => void exitCuration()}
              >
                <CloseIcon />
                <span>Done</span>
              </button>
            )}
          </div>
        )}
      </div>
      {!webglFailed && orbitInspect && (
        <p className="status hud-note hint-readable">
          {coarse
            ? 'Drag to look around. Pinch to zoom, two-finger drag to pan.'
            : 'Drag to look around. Scroll to zoom, right-drag to pan.'}
        </p>
      )}
      {!webglFailed && inCatalog && !orbitInspect && libraryCount === 0 && guideStep !== 'empty-room' && (
        <p className="hint hud-note hint-readable">No tapes yet. Add a tape from the crate to make the first one.</p>
      )}
      {!webglFailed && inCatalog && !orbitInspect && libraryCount > 0 && kept === 0 && guideStep !== 'empty-crate' && (
        <p className="hint hud-note hint-readable">The crate is empty. Open the shelf to bring tapes over.</p>
      )}
      {curating && (
        <div className="curation hud-note" aria-live="polite">
          <div className="curation-count">
            <span className="curation-kept">{kept}</span>
            <span className="curation-cap">/ {capacity} in the crate</span>
          </div>
          <p className="curation-hint hint-readable">{curationCopy}</p>
        </div>
      )}
      {inCatalog && !orbitInspect && readoutCollection && !guideStep && (
        <p className="magazine-readout hud-note hint-readable" aria-live="polite">
          {readoutCollection.id === crateSelectedId ? (
            <>
              Press Play to start <span className="readout-title">{readoutCollection.title}</span>.
            </>
          ) : (
            <>
              <span className="readout-title">{readoutCollection.title}</span>. {coarse ? 'Tap' : 'Click'}{' '}
              to choose it.
            </>
          )}
        </p>
      )}
      {!webglFailed && inCatalog && !orbitInspect && kept > 0 && !readoutCollection && !guideStep && (
        <p className="hint hud-note hint-readable">
          {coarse ? 'Tap' : 'Click'} a tape in the crate to choose it.
        </p>
      )}
      {!orbitInspect && mode === 'INSERTING' && <p className="status hud-note">Putting the tape in…</p>}
      {!orbitInspect && mode === 'SWITCHING' && <p className="status hud-note">Switching tapes…</p>}
    </>
  );
}

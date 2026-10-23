import { useProgress } from '@react-three/drei';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  changeSlide,
  requestEject,
  requestInsert,
  restartCollection,
  togglePause,
} from './experience/controller';
import { usePhotoWindow } from './hooks/usePhotoWindow';
import { Experience } from './scene/Experience';
import { viewportCapacity } from './experience/capacity';
import { exitCuration, syncShelfRow } from './experience/curation';
import { moveTape } from './experience/drag';
import { playableTapeId } from './state/guide';
import {
  getState,
  mergePersistedCollections,
  setCapacity,
  setCrateSelected,
  toggleOrbitInspect,
  useExperience,
} from './state/store';
import { loadPersistedCollections } from './storage/collectionService';
import { AboutRoom } from './ui/AboutRoom';
import { ExploreHints } from './ui/ExploreHints';
import { Intro } from './ui/Intro';
import { isPanelOpen } from './ui/aboutState';
import { HelpPanel } from './ui/HelpPanel';
import { focusRoom, ROOM_ID } from './ui/roomFocus';
import { PlaybackControls } from './ui/PlaybackControls';
import { Overlay } from './ui/Overlay';
import { isWebGLFailed, setSceneLoading } from './ui/sceneStatus';
import { preloadSoundFiles, unlockAudio } from './audio/sounds';
import { startMusic } from './audio/music';

// Both dialogs already no-op (return null) while closed, so deferring their
// chunk out of the initial bundle costs nothing visible — it just keeps the
// upload/edit image-processing code off the critical path for first paint.
const CreateMagazineModal = lazy(() =>
  import('./ui/CreateMagazineModal').then((m) => ({ default: m.CreateMagazineModal })),
);
const EditMagazineModal = lazy(() =>
  import('./ui/EditMagazineModal').then((m) => ({ default: m.EditMagazineModal })),
);

const CRATE_IDLE_MS = 5000;

/**
 * Drei's Loader follows every DefaultLoadingManager batch, so the bar comes
 * back when nested models or textures start after the first wave. It also sits
 * at z-index 1000 and keeps intercepting clicks for 300ms after it fades —
 * which is why the name field looked loaded, then dead, then loading again.
 * Show it once, and never over the intro gate.
 */
function SceneLoader() {
  const gated = useExperience((s) => !s.entered);
  const { active, progress } = useProgress();
  const returning = useRef(Boolean(getState().entered));
  const finished = useRef(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (gated || finished.current) {
      setShow(false);
      return;
    }
    if (active) {
      setShow(true);
      return;
    }
    if (show) {
      const hide = window.setTimeout(() => {
        finished.current = true;
        setShow(false);
      }, 300);
      return () => window.clearTimeout(hide);
    }
    // First visit already loaded behind the name gate — don't wait for a
    // second asset wave. Returning visits need a beat for the canvas to start.
    if (!returning.current) {
      finished.current = true;
      return;
    }
    const settle = window.setTimeout(() => {
      finished.current = true;
    }, 800);
    return () => window.clearTimeout(settle);
  }, [active, gated, show]);

  useEffect(() => {
    setSceneLoading(!gated && show);
    return () => setSceneLoading(false);
  }, [gated, show]);

  if (gated || !show) return null;
  return (
    <div className="scene-loader" role="status" aria-live="polite">
      <p>Opening the room</p>
      <p className="scene-loader-pct">{Math.round(progress)}%</p>
    </div>
  );
}

/** Typing belongs to the field, never to the room. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'file', 'color'].includes(
    target.type,
  );
}

/**
 * Enter and Space already press a focused button or link, so the room must not
 * act on them too — otherwise one keypress would press the button and also
 * play a tape or toggle pause.
 */
function isNativeActivation(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' && event.key !== ' ') return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a[href], [role="button"], summary'));
}

/** On the shelf the arrows walk every tape: the crate's first, then the shelf's. */
function curationOrder(): string[] {
  const s = getState();
  const crate = s.collectionIds.filter((id) => s.collections.some((c) => c.id === id));
  const shelf = s.collections.map((c) => c.id).filter((id) => !crate.includes(id));
  return [...crate, ...shelf];
}

function cycleCrate(direction: 1 | -1): void {
  const s = getState();
  const ids =
    s.mode === 'CURATING'
      ? curationOrder()
      : s.collectionIds.filter((id) => s.collections.some((c) => c.id === id));
  if (!ids.length) return;
  const current = s.crateSelectedId ? ids.indexOf(s.crateSelectedId) : -1;
  const next =
    current < 0
      ? direction > 0
        ? 0
        : ids.length - 1
      : (current + direction + ids.length) % ids.length;
  const id = ids[next];
  if (id) setCrateSelected(id);
}

export default function App() {
  const insertedId = useExperience((s) => s.insertedId);
  const slideIndex = useExperience((s) => s.slideIndex);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const collections = useExperience((s) => s.collections);
  const createOpen = useExperience((s) => s.createOpen);
  const entered = useExperience((s) => s.entered);
  usePhotoWindow(insertedId, slideIndex, collections);

  useEffect(() => {
    void loadPersistedCollections(getState().progress)
      .then(mergePersistedCollections)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void preloadSoundFiles();
  }, []);

  // Wider viewport, more slots in the crate. Shrinking only stops the user
  // adding more — it never turns a curated magazine back out onto the shelf.
  // The shelf row is fitted to the viewport too, so a phone files its
  // magazines into the narrower slice of shelf the curation shot can frame.
  useEffect(() => {
    let timer = 0;
    const fit = () => {
      setCapacity(viewportCapacity());
      syncShelfRow(window.innerWidth, window.innerHeight);
    };
    fit();
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    };
    window.addEventListener('resize', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', sync);
    };
  }, []);

  // Magazines restored from IndexedDB arrive after the first fit, and they all
  // need a slot of their own.
  useEffect(() => {
    syncShelfRow(window.innerWidth, window.innerHeight);
  }, [collections.length]);

  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!crateSelectedId) return;

    let timer = window.setTimeout(() => setCrateSelected(null), CRATE_IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCrateSelected(null), CRATE_IDLE_MS);
    };
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, [crateSelectedId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const state = getState();
      if (!state.entered || isPanelOpen() || isWebGLFailed()) return;
      if (state.createOpen || state.editingId) return;
      if (isTextEntry(event.target) || isNativeActivation(event)) return;
      const { mode, insertedId, orbitInspect } = state;
      const inRoom = mode === 'CATALOG' && !insertedId && !orbitInspect;
      if (mode === 'CURATING' && !orbitInspect) {
        if (state.curationBusy) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          cycleCrate(event.key === 'ArrowRight' ? 1 : -1);
        } else if (event.key === 'Enter' && state.crateSelectedId) {
          event.preventDefault();
          moveTape(state.crateSelectedId);
        } else if (event.key === 'Escape') {
          void exitCuration();
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (inRoom) cycleCrate(1);
        else void changeSlide(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (inRoom) cycleCrate(-1);
        else void changeSlide(-1);
      } else if (event.key === 'Enter' && inRoom) {
        const id = state.crateSelectedId ?? playableTapeId();
        if (!id) return;
        event.preventDefault();
        void requestInsert(id);
      } else if (event.key === ' ') {
        event.preventDefault();
        togglePause();
      } else if (event.key === 'Escape') {
        if (orbitInspect) toggleOrbitInspect();
        else if (insertedId) {
          // The controls are about to unmount; don't strand focus on <body>.
          if (document.activeElement?.closest('.playback')) focusRoom();
          void requestEject();
        }
        else if (state.crateSelectedId) setCrateSelected(null);
      } else if ((event.key === 'r' || event.key === 'R') && mode !== 'CATALOG') {
        void restartCollection();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <div
        id={ROOM_ID}
        className="room-region"
        role="group"
        tabIndex={entered ? 0 : -1}
        aria-label="The room"
        aria-describedby="room-keys"
      >
        <Experience />
        <p id="room-keys" className="sr-only">
          Left and right arrows choose a tape. Enter plays it. While a tape plays, the
          arrows step through its memories, Space pauses, R starts it over, and Escape
          brings you back to the room.
        </p>
      </div>
      <SceneLoader />
      {entered && (
        <>
          <Overlay />
          <PlaybackControls />
          <ExploreHints />
          <AboutRoom />
          <HelpPanel />
        </>
      )}
      <Intro />
      <Suspense fallback={null}>
        <CreateMagazineModal open={createOpen} />
        <EditMagazineModal />
      </Suspense>
    </div>
  );
}

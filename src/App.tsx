import { Loader } from '@react-three/drei';
import { lazy, Suspense, useEffect } from 'react';
import {
  changeSlide,
  requestEject,
  restartCollection,
  togglePause,
} from './experience/controller';
import { usePhotoWindow } from './hooks/usePhotoWindow';
import { Experience } from './scene/Experience';
import { viewportCapacity } from './experience/capacity';
import { exitCuration, syncShelfRow } from './experience/curation';
import {
  getState,
  mergePersistedCollections,
  setCapacity,
  setCrateSelected,
  useExperience,
} from './state/store';
import { loadPersistedCollections } from './storage/collectionService';
import { PlaybackControls } from './ui/PlaybackControls';
import { NameGate } from './ui/NameGate';
import { Overlay } from './ui/Overlay';
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

function isFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export default function App() {
  const insertedId = useExperience((s) => s.insertedId);
  const slideIndex = useExperience((s) => s.slideIndex);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const collections = useExperience((s) => s.collections);
  const createOpen = useExperience((s) => s.createOpen);
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
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', bump);
    };
  }, [crateSelectedId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (getState().createOpen || getState().editingId || isFormField(event.target)) return;
      const { mode } = getState();
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void changeSlide(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void changeSlide(-1);
      } else if (event.key === ' ') {
        event.preventDefault();
        togglePause();
      } else if (event.key === 'Escape') {
        if (mode === 'CURATING') void exitCuration();
        else void requestEject();
      } else if ((event.key === 'r' || event.key === 'R') && mode !== 'CATALOG') {
        void restartCollection();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Experience />
      <Loader />
      <Overlay />
      <PlaybackControls />
      <NameGate />
      <Suspense fallback={null}>
        <CreateMagazineModal open={createOpen} />
        <EditMagazineModal />
      </Suspense>
    </div>
  );
}

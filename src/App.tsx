import { useEffect } from 'react';
import {
  changeSlide,
  requestEject,
  restartCollection,
  togglePause,
} from './experience/controller';
import { usePhotoWindow } from './hooks/usePhotoWindow';
import { Experience } from './scene/Experience';
import { getState, mergePersistedCollections, setCrateSelected, useExperience } from './state/store';
import { loadPersistedCollections } from './storage/collectionService';
import { PlaybackControls } from './ui/PlaybackControls';
import { CreateMagazineModal } from './ui/CreateMagazineModal';
import { EditMagazineModal } from './ui/EditMagazineModal';
import { Overlay } from './ui/Overlay';
import { unlockAudio } from './audio/sounds';

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
    const unlock = () => unlockAudio();
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
        void requestEject();
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
      <Overlay />
      <PlaybackControls />
      <CreateMagazineModal open={createOpen} />
      <EditMagazineModal />
    </div>
  );
}

import { useSyncExternalStore } from 'react';
import { isPanelOpen, usePanelOpen } from '../ui/aboutState';
import { isSceneLoading, isWebGLFailed, useSceneLoading, useWebGLFailed } from '../ui/sceneStatus';
import type { ExperienceMode } from '../types/collection';
import { getState, useExperience } from './store';

const KEY = 'upstairs:guide';

export const ADD_TARGET = '__add__';

export type GuideStep = 'play' | 'next' | 'shelf' | 'view' | 'empty-crate' | 'empty-room';

type GuideProgress = {
  skipped: boolean;
  played: boolean;
  advanced: boolean;
  shelved: boolean;
  viewed: boolean;
};

const EMPTY: GuideProgress = {
  skipped: false,
  played: false,
  advanced: false,
  shelved: false,
  viewed: false,
};

function loadProgress(): GuideProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<GuideProgress>;
    return {
      skipped: Boolean(parsed.skipped),
      played: Boolean(parsed.played),
      advanced: Boolean(parsed.advanced),
      shelved: Boolean(parsed.shelved),
      viewed: Boolean(parsed.viewed),
    };
  } catch {
    return { ...EMPTY };
  }
}

let progress = loadProgress();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function save(next: GuideProgress): void {
  progress = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The hints still work for this visit.
  }
  emit();
}

export function useGuideProgress(): GuideProgress {
  return useSyncExternalStore(subscribe, () => progress, () => EMPTY);
}

export function markPlayed(): void {
  if (progress.played) return;
  save({ ...progress, played: true });
}

export function markAdvanced(): void {
  if (progress.advanced) return;
  save({ ...progress, advanced: true });
}

export function markShelved(): void {
  if (progress.shelved) return;
  save({ ...progress, shelved: true });
}

export function markViewed(): void {
  if (progress.viewed) return;
  save({ ...progress, viewed: true });
}

export function skipGuide(): void {
  if (progress.skipped) return;
  save({ ...progress, skipped: true });
}

/** Start the hints over. Steps the visitor is already in the middle of stay skipped. */
export function replayGuide(): void {
  const s = getState();
  const viewing =
    Boolean(s.insertedId) &&
    (s.mode === 'PLAYING' ||
      s.mode === 'PAUSED' ||
      s.mode === 'CHANGING_SLIDE' ||
      s.mode === 'REWINDING');
  save({
    skipped: false,
    played: viewing,
    advanced: false,
    shelved: s.mode === 'CURATING',
    viewed: s.orbitInspect,
  });
}

type GuideInput = {
  entered: boolean;
  mode: ExperienceMode;
  insertedId: string | null;
  slideIndex: number;
  orbit: boolean;
  dialog: boolean;
  busy: boolean;
  crateCount: number;
  libraryCount: number;
  photoCount: number;
  about: boolean;
  loading: boolean;
  failed: boolean;
};

function guideInput(): GuideInput {
  const s = getState();
  const col = s.insertedId ? s.collections.find((c) => c.id === s.insertedId) : undefined;
  return {
    entered: s.entered,
    mode: s.mode,
    insertedId: s.insertedId,
    slideIndex: s.slideIndex,
    orbit: s.orbitInspect,
    dialog: s.createOpen || Boolean(s.editingId),
    busy: s.curationBusy,
    crateCount: s.collectionIds.length,
    libraryCount: s.collections.length,
    photoCount: col?.photos.length ?? 0,
    about: isPanelOpen(),
    loading: isSceneLoading(),
    failed: isWebGLFailed(),
  };
}

export function readGuideStep(): GuideStep | null {
  const input = guideInput();
  if (
    !input.entered ||
    input.dialog ||
    input.orbit ||
    input.busy ||
    input.about ||
    input.loading ||
    input.failed ||
    progress.skipped
  ) {
    return null;
  }

  const viewing =
    input.mode === 'PLAYING' ||
    input.mode === 'PAUSED' ||
    input.mode === 'CHANGING_SLIDE' ||
    input.mode === 'REWINDING';

  if (viewing && input.insertedId) {
    const hasNext =
      input.photoCount > 1 &&
      !progress.advanced &&
      input.slideIndex < input.photoCount - 1;
    return hasNext ? 'next' : null;
  }

  if (input.mode !== 'CATALOG') return null;
  if (input.libraryCount === 0) return 'empty-room';
  if (input.crateCount === 0) {
    if (!progress.shelved) return 'empty-crate';
    return progress.viewed ? null : 'view';
  }
  if (!progress.played) return 'play';
  if (!progress.shelved) return 'shelf';
  if (!progress.viewed) return 'view';
  return null;
}

function guideKey(s: ReturnType<typeof getState>): string {
  const col = s.insertedId ? s.collections.find((c) => c.id === s.insertedId) : undefined;
  return [
    s.entered,
    s.mode,
    s.insertedId,
    s.slideIndex,
    s.orbitInspect,
    s.createOpen,
    s.editingId,
    s.curationBusy,
    s.collectionIds.length,
    s.collections.length,
    col?.photos.length ?? 0,
  ].join('|');
}

export function useGuideStep(): GuideStep | null {
  useExperience(guideKey);
  useGuideProgress();
  usePanelOpen();
  useSceneLoading();
  useWebGLFailed();
  return readGuideStep();
}

/** The crate tape the play hint should attach to — the one nearest the middle. */
export function playableTapeId(): string | null {
  const ids = getState().collectionIds;
  if (!ids.length) return null;
  return ids[Math.floor((ids.length - 1) / 2)] ?? null;
}

export function useGuideTargetId(): string | null {
  const step = useGuideStep();
  const tapeId = useExperience(playableTapeId);
  if (step === 'play') return tapeId;
  if (step === 'empty-room') return ADD_TARGET;
  return null;
}

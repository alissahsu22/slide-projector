import { useSyncExternalStore } from 'react';
import { MOCK_COLLECTIONS } from '../data/collections';
import { persistUserSlide } from '../storage/collectionService';
import type { Collection, ExperienceMode } from '../types/collection';
import { loadProgress, saveProgress } from './persistence';

export type ExperienceState = {
  mode: ExperienceMode;
  collections: Collection[];
  hoveredId: string | null;
  previewedId: string | null;
  insertedId: string | null;
  selectedCollectionId: string | null;
  slideIndex: number;
  isPlaying: boolean;
  photoReady: boolean;
  progress: Record<string, number>;
  createOpen: boolean;
  arrivingId: string | null;
  editingId: string | null;
  deletingId: string | null;
  crateSelectedId: string | null;
  /** Temporary inspect mode: free orbit around the room. */
  orbitInspect: boolean;
};

const progress = loadProgress();

let state: ExperienceState = {
  mode: 'CATALOG',
  collections: MOCK_COLLECTIONS.map((c) => ({
    ...c,
    currentSlide: progress[c.id] ?? 0,
  })),
  hoveredId: null,
  previewedId: null,
  insertedId: null,
  selectedCollectionId: null,
  slideIndex: 0,
  isPlaying: false,
  photoReady: false,
  progress,
  createOpen: false,
  arrivingId: null,
  editingId: null,
  deletingId: null,
  crateSelectedId: null,
  orbitInspect: false,
};

const listeners = new Set<() => void>();

export function getState(): ExperienceState {
  return state;
}

export function setState(
  partial: Partial<ExperienceState> | ((s: ExperienceState) => Partial<ExperienceState>),
): void {
  const next = typeof partial === 'function' ? partial(state) : partial;
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExperience<T>(selector: (s: ExperienceState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function getCollection(id: string | null): Collection | undefined {
  if (!id) return undefined;
  return state.collections.find((c) => c.id === id);
}

export function rememberedSlide(id: string): number {
  const col = getCollection(id);
  if (!col) return 0;
  const stored = state.progress[id];
  const max = Math.max(0, col.photos.length - 1);
  const value = stored ?? col.currentSlide ?? 0;
  return Math.min(max, Math.max(0, value));
}

export function persistSlide(id: string, index: number): void {
  const progressMap = { ...state.progress, [id]: index };
  state = { ...state, progress: progressMap };
  saveProgress(id, index);
  const col = getCollection(id);
  if (col?.createdAt) persistUserSlide(id, index);
  listeners.forEach((listener) => listener());
}

export function addCollection(collection: Collection): void {
  setState((s) => ({
    collections: s.collections.some((c) => c.id === collection.id)
      ? s.collections
      : [...s.collections, collection],
  }));
}

export function addArrivingCollection(collection: Collection): void {
  setState((s) => ({
    collections: s.collections.some((c) => c.id === collection.id)
      ? s.collections
      : [...s.collections, collection],
    arrivingId: collection.id,
  }));
}

export function clearArriving(id: string): void {
  setState((s) => (s.arrivingId === id ? { arrivingId: null } : {}));
}

export function setCreateOpen(open: boolean): void {
  setState({ createOpen: open });
}

export function toggleOrbitInspect(): void {
  setState((s) => ({ orbitInspect: !s.orbitInspect }));
}

export function mergePersistedCollections(collections: Collection[]): void {
  if (!collections.length) return;
  setState((s) => {
    const ids = new Set(s.collections.map((c) => c.id));
    const extra = collections.filter((c) => !ids.has(c.id));
    if (!extra.length) return {};
    return { collections: [...s.collections, ...extra] };
  });
}

export function setEditingId(id: string | null): void {
  setState({ editingId: id });
}

export function setCrateSelected(id: string | null): void {
  setState({ crateSelectedId: id });
}

export function updateCollectionInStore(collection: Collection): void {
  setState((s) => {
    const newSlide =
      s.insertedId === collection.id
        ? Math.min(s.slideIndex, Math.max(0, collection.photos.length - 1))
        : s.slideIndex;
    return {
      collections: s.collections.map((c) => (c.id === collection.id ? collection : c)),
      slideIndex: newSlide,
    };
  });
}

export function startDeleting(id: string): void {
  setState({ deletingId: id });
}

export function finishDeleting(id: string): void {
  setState((s) => ({
    deletingId: s.deletingId === id ? null : s.deletingId,
    collections: s.collections.filter((c) => c.id !== id),
    insertedId: s.insertedId === id ? null : s.insertedId,
    hoveredId: s.hoveredId === id ? null : s.hoveredId,
    previewedId: s.previewedId === id ? null : s.previewedId,
    crateSelectedId: s.crateSelectedId === id ? null : s.crateSelectedId,
    slideIndex: s.insertedId === id ? 0 : s.slideIndex,
    photoReady: s.insertedId === id ? false : s.photoReady,
  }));
}

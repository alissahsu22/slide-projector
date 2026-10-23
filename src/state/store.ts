import { useSyncExternalStore } from 'react';
import { BUILTIN_COLLECTIONS } from '../data/collections';
import { viewportCapacity } from '../experience/capacity';
import { persistUserSlide } from '../storage/collectionService';
import type { Collection, ExperienceMode } from '../types/collection';
import {
  loadCuration,
  loadEntered,
  loadProgress,
  loadViewerName,
  saveCuration,
  saveEntered,
  saveProgress,
  saveViewerName,
  VIEWER_NAME_MAX,
} from './persistence';

export type ExperienceState = {
  mode: ExperienceMode;
  /** The whole library. Everything not in `collectionIds` stands on the shelf. */
  collections: Collection[];
  /** The curated desk collection, in crate order. Never longer than needed. */
  collectionIds: string[];
  /** Permanent shelf slot per magazine, so the desk ones leave gaps behind. */
  shelfSlots: Record<string, number>;
  /** How many magazines the desk crate accepts at the current viewport width. */
  capacity: number;
  hoveredId: string | null;
  previewedId: string | null;
  insertedId: string | null;
  selectedCollectionId: string | null;
  slideIndex: number;
  isPlaying: boolean;
  photoReady: boolean;
  /** The current memory's file failed, so the wall is showing a stand-in. */
  photoError: boolean;
  progress: Record<string, number>;
  createOpen: boolean;
  arrivingId: string | null;
  editingId: string | null;
  deletingId: string | null;
  crateSelectedId: string | null;
  /** Temporary inspect mode: free orbit around the room. */
  orbitInspect: boolean;
  /** True while the crate flies to or from the shelf. */
  curationBusy: boolean;
  /** Optional name engraved on the crate. Not required to enter the room. */
  viewerName: string | null;
  /** False until the visitor leaves the introduction. */
  entered: boolean;
};

const progress = loadProgress();

/**
 * Give every magazine a shelf slot, lowest free slot first. Slots already
 * assigned are kept so a magazine always returns to the same gap.
 */
function assignShelfSlots(
  collections: Collection[],
  existing: Record<string, number>,
): Record<string, number> {
  const next = { ...existing };
  const taken = new Set(Object.values(next));
  let cursor = 0;
  for (const collection of collections) {
    if (typeof next[collection.id] === 'number') continue;
    while (taken.has(cursor)) cursor += 1;
    next[collection.id] = cursor;
    taken.add(cursor);
  }
  return next;
}

const seedCapacity = viewportCapacity();
const stored = loadCuration();
const seedCollections = BUILTIN_COLLECTIONS.map((c) => ({
  ...c,
  currentSlide: progress[c.id] ?? 0,
}));

/**
 * Membership the user saved, including magazines still coming out of IndexedDB.
 * `collectionIds` in state only ever holds ids that resolve to a collection, so
 * the crate never shows a hole for a magazine that has not loaded yet.
 *
 * If localStorage still names deleted mock tapes, start with the built-in
 * magazines so the crate is not empty on a library refresh.
 */
function initialDesiredIds(): string[] {
  const seedIds = seedCollections.slice(0, seedCapacity).map((c) => c.id);
  const seedSet = new Set(seedCollections.map((c) => c.id));
  if (!stored) return seedIds;
  const hasBuiltin = stored.collectionIds.some((id) => seedSet.has(id));
  if (hasBuiltin) return stored.collectionIds;
  const userIds = stored.collectionIds.filter((id) => !seedSet.has(id));
  return [...seedIds, ...userIds];
}

let desiredIds: string[] = initialDesiredIds();

let state: ExperienceState = {
  mode: 'CATALOG',
  collections: seedCollections,
  collectionIds: desiredIds.filter((id) => seedCollections.some((c) => c.id === id)),
  shelfSlots: assignShelfSlots(seedCollections, stored?.shelfSlots ?? {}),
  capacity: seedCapacity,
  hoveredId: null,
  previewedId: null,
  insertedId: null,
  selectedCollectionId: null,
  slideIndex: 0,
  isPlaying: false,
  photoReady: false,
  photoError: false,
  progress,
  createOpen: false,
  arrivingId: null,
  editingId: null,
  deletingId: null,
  crateSelectedId: null,
  orbitInspect: false,
  curationBusy: false,
  viewerName: loadViewerName(),
  entered: loadEntered(),
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

/** Write membership through to storage; `desiredIds` keeps unloaded ids alive. */
function commitCuration(collectionIds: string[], shelfSlots = state.shelfSlots): void {
  const known = new Set(collectionIds);
  desiredIds = [
    ...collectionIds,
    // Ids the user curated on another visit that have not resolved yet.
    ...desiredIds.filter((id) => !known.has(id) && !state.collections.some((c) => c.id === id)),
  ];
  setState({ collectionIds, shelfSlots });
  saveCuration({ collectionIds: desiredIds, shelfSlots });
}

export function deskCollections(s: ExperienceState = state): Collection[] {
  const byId = new Map(s.collections.map((c) => [c.id, c] as const));
  return s.collectionIds
    .map((id) => byId.get(id))
    .filter((c): c is Collection => Boolean(c));
}

export function shelfCollections(s: ExperienceState = state): Collection[] {
  const desk = new Set(s.collectionIds);
  return s.collections.filter((c) => !desk.has(c.id));
}

export function isInCollection(id: string, s: ExperienceState = state): boolean {
  return s.collectionIds.includes(id);
}

export function canAddToCollection(s: ExperienceState = state): boolean {
  return s.collectionIds.length < s.capacity;
}

export function setCapacity(capacity: number): void {
  if (state.capacity === capacity) return;
  setState({ capacity });
}

/**
 * Put a magazine in the crate at `slot`. No-op when the crate is full — the
 * caller swaps instead, so a full collection is never a dead end.
 */
export function addToCollection(id: string, slot?: number): void {
  if (isInCollection(id)) {
    if (slot !== undefined) reorderCollection(id, slot);
    return;
  }
  if (!canAddToCollection()) return;
  const next = [...state.collectionIds];
  const at = slot === undefined ? next.length : Math.max(0, Math.min(next.length, slot));
  next.splice(at, 0, id);
  commitCuration(next);
}

export function removeFromCollection(id: string): void {
  if (!isInCollection(id)) return;
  commitCuration(state.collectionIds.filter((cid) => cid !== id));
}

/** Trade the magazine standing in `slot` for `incomingId`, which goes to its shelf gap. */
export function swapIntoCollection(incomingId: string, slot: number): void {
  const next = [...state.collectionIds];
  if (slot < 0 || slot >= next.length) {
    addToCollection(incomingId, slot);
    return;
  }
  const outgoing = next[slot];
  if (outgoing === incomingId) return;
  const existing = next.indexOf(incomingId);
  if (existing >= 0) next.splice(existing, 1);
  next[next.indexOf(outgoing)] = incomingId;
  commitCuration(next);
}

export function reorderCollection(id: string, slot: number): void {
  const from = state.collectionIds.indexOf(id);
  if (from < 0) return;
  const next = [...state.collectionIds];
  next.splice(from, 1);
  const at = Math.max(0, Math.min(next.length, slot));
  if (at === from) return;
  next.splice(at, 0, id);
  commitCuration(next);
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

/** A brand new magazine joins the desk if there is room, otherwise the shelf. */
function fileNewCollection(collection: Collection, arriving: boolean): void {
  if (state.collections.some((c) => c.id === collection.id)) {
    if (arriving) setState({ arrivingId: collection.id });
    return;
  }
  const collections = [...state.collections, collection];
  setState(arriving ? { collections, arrivingId: collection.id } : { collections });
  const shelfSlots = assignShelfSlots(collections, state.shelfSlots);
  const collectionIds = canAddToCollection()
    ? [...state.collectionIds, collection.id]
    : state.collectionIds;
  commitCuration(collectionIds, shelfSlots);
}

export function addCollection(collection: Collection): void {
  fileNewCollection(collection, false);
}

export function addArrivingCollection(collection: Collection): void {
  fileNewCollection(collection, true);
}

export function clearArriving(id: string): void {
  setState((s) => (s.arrivingId === id ? { arrivingId: null } : {}));
}

export function setCreateOpen(open: boolean): void {
  setState({ createOpen: open });
}

export function setEntered(): void {
  if (state.entered) return;
  setState({ entered: true });
  saveEntered();
}

export function setViewerName(name: string): void {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, VIEWER_NAME_MAX);
  if (!trimmed) return;
  setState({ viewerName: trimmed });
  saveViewerName(trimmed);
}

export function toggleOrbitInspect(): void {
  setState((s) => ({ orbitInspect: !s.orbitInspect }));
}

export function mergePersistedCollections(collections: Collection[]): void {
  if (!collections.length) return;
  const ids = new Set(state.collections.map((c) => c.id));
  const extra = collections.filter((c) => !ids.has(c.id));
  if (!extra.length) return;
  const merged = [...state.collections, ...extra];
  setState({ collections: merged });
  // Now that these have loaded, restore the membership saved for them.
  const resolved = new Set(merged.map((c) => c.id));
  commitCuration(
    desiredIds.filter((id) => resolved.has(id)),
    assignShelfSlots(merged, state.shelfSlots),
  );
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
    photoError: s.insertedId === id ? false : s.photoError,
  }));
  const shelfSlots = { ...state.shelfSlots };
  delete shelfSlots[id];
  desiredIds = desiredIds.filter((cid) => cid !== id);
  commitCuration(
    state.collectionIds.filter((cid) => cid !== id),
    shelfSlots,
  );
}

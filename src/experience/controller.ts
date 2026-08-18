import gsap from 'gsap';
import { playSound } from '../audio/sounds';
import { loadPhoto, retainPhotos } from '../media/photoCache';
import {
  getCollection,
  getState,
  persistSlide,
  rememberedSlide,
  setState,
} from '../state/store';
import {
  CRATE_MAGAZINE_RZ,
  CRATE_SLIDE_Y,
  getCatalogCam,
  MAGAZINE_DOCK_SCALE,
  PLAYBACK_CAM,
} from './layout';
import {
  getInsertionApproachWorld,
  getInsertionWorldAtLocal,
  getInsertionWorldQuaternion,
  sceneApi,
} from './sceneApi';
import {
  applySlideLandPose,
  resetProjectionTransition,
  rewindClackCount,
  rewindDurationSec,
  runProjectorRewind,
  runProjectorSlideTransition,
  SLIDE_TRANSITION,
} from './slideTransition';
import { cameraFollow, cameraRig, visuals } from './visuals';
import { magazineRailX } from '../scene/magazineLayout';
import * as THREE from 'three';
import type { Object3D } from 'three';

const AUTOPLAY_MS = 3500;
const PRELOAD_BEHIND = 2;
const PRELOAD_AHEAD = 5;

let sequenceLock = false;
let slideLock = false;
let autoplayTimer: ReturnType<typeof setTimeout> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function tween(target: object, vars: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const prev = vars.onComplete as (() => void) | undefined;
    const prevInterrupt = vars.onInterrupt as (() => void) | undefined;
    gsap.to(target, {
      ...vars,
      onComplete: () => {
        prev?.();
        resolve();
      },
      onInterrupt: () => {
        prevInterrupt?.();
        resolve();
      },
    });
  });
}

const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion();

function tweenQuaternion(
  obj: Object3D,
  target: THREE.Quaternion,
  duration: number,
  ease = 'power2.inOut',
): Promise<void> {
  _q0.copy(obj.quaternion);
  _q1.copy(target);
  const proxy = { t: 0 };
  return tween(proxy, {
    t: 1,
    duration,
    ease,
    onUpdate: () => {
      obj.quaternion.slerpQuaternions(_q0, _q1, proxy.t);
    },
    onComplete: () => {
      obj.quaternion.copy(_q1);
      obj.rotation.setFromQuaternion(_q1);
    },
  });
}

function sceneRoot(obj: Object3D): Object3D | null {
  let o: Object3D | null = obj;
  while (o && o.type !== 'Scene') o = o.parent;
  return o;
}

function dockedGroup(id: string) {
  return sceneApi.magazines.get(id)?.group ?? sceneApi.cartridges.get(id)?.group;
}

function isOnInsertionRail(obj: Object3D): boolean {
  return obj.parent === sceneApi.insertionPoint;
}

function dockMagazineAtIndex(
  id: string,
  slideIndex: number,
  animate: boolean,
  duration = 0.32,
  ease = 'power2.inOut',
): Promise<void> {
  const group = dockedGroup(id);
  if (!group || !isOnInsertionRail(group)) return Promise.resolve();
  const x = magazineRailX(slideIndex, MAGAZINE_DOCK_SCALE);
  gsap.killTweensOf(group.position);
  if (!animate) {
    group.position.x = x;
    return Promise.resolve();
  }
  return tween(group.position, {
    x,
    duration,
    ease,
    overwrite: 'auto',
    onComplete: () => {
      group.position.x = x;
    },
  });
}

function seatOnInsertionRail(group: Object3D, slideIndex: number): void {
  const dock = sceneApi.insertionPoint;
  if (!dock) return;
  dock.attach(group);
  group.scale.setScalar(MAGAZINE_DOCK_SCALE);
  group.rotation.set(0, 0, 0);
  group.position.set(magazineRailX(slideIndex, MAGAZINE_DOCK_SCALE), 0, 0);
  group.userData.onInsertionRail = true;
}

function crateRestQuaternion(home: {
  rx?: number;
  ry?: number;
  rz?: number;
}): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      home.rx ?? 0,
      home.ry ?? CRATE_SLIDE_Y,
      home.rz ?? CRATE_MAGAZINE_RZ,
      'XYZ',
    ),
  );
}

function releaseFromInsertionRail(group: Object3D): void {
  group.userData.onInsertionRail = false;
  const scene = sceneRoot(group);
  if (scene) scene.attach(group);
  group.scale.setScalar(MAGAZINE_DOCK_SCALE);
}

async function ejectOffRail(group: Object3D): Promise<void> {
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.rotation);
  gsap.killTweensOf(group.scale);
  releaseFromInsertionRail(group);

  const out = getInsertionApproachWorld();
  await tween(group.position, {
    y: group.position.y + 0.045,
    duration: 0.38,
    ease: 'power2.out',
  });
  if (out) {
    await tween(group.position, {
      x: out.x,
      y: out.y + 0.04,
      z: out.z,
      duration: 0.85,
      ease: 'power2.inOut',
    });
  } else {
    await tween(group.position, {
      y: group.position.y + 0.08,
      duration: 0.55,
      ease: 'power2.out',
    });
  }
}

async function returnToCrate(
  group: Object3D,
  home: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number },
): Promise<void> {
  group.scale.setScalar(MAGAZINE_DOCK_SCALE);
  await Promise.all([
    tween(group.position, {
      x: home.x,
      y: home.y + 0.07,
      z: home.z,
      duration: 1.2,
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, crateRestQuaternion(home), 1.15, 'power2.inOut'),
  ]);

  await tween(group.position, {
    x: home.x,
    y: home.y,
    z: home.z,
    duration: 0.42,
    ease: 'power2.inOut',
  });
}

async function liftFromCrate(group: Object3D): Promise<boolean> {
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.rotation);
  gsap.killTweensOf(group.scale);
  group.scale.setScalar(MAGAZINE_DOCK_SCALE);

  const approach = getInsertionApproachWorld();
  const orient = getInsertionWorldQuaternion();
  if (!approach || !orient) return false;

  // Clear the crate walls before turning, so the swing happens in open air.
  await tween(group.position, {
    y: group.position.y + 0.11,
    duration: 0.45,
    ease: 'power2.out',
  });

  await Promise.all([
    tween(group.position, {
      x: approach.x,
      y: approach.y + 0.05,
      z: approach.z,
      duration: 1.35,
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, orient, 1.35, 'power2.inOut'),
  ]);
  return true;
}

function followMagazine(id: string): void {
  gsap.killTweensOf(cameraRig);
  cameraFollow.id = id;
  cameraFollow.active = true;
}

function stopFollowingMagazine(): void {
  cameraFollow.active = false;
  cameraFollow.id = null;
}

async function insertOntoRail(group: Object3D, slideIndex: number): Promise<boolean> {
  const seated = getInsertionWorldAtLocal(
    magazineRailX(slideIndex, MAGAZINE_DOCK_SCALE),
    0,
    0,
  );
  const orient = getInsertionWorldQuaternion();
  if (!seated || !orient) return false;

  await Promise.all([
    tween(group.position, {
      x: seated.x,
      y: seated.y + 0.045,
      z: seated.z,
      duration: 0.85,
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, orient, 0.7, 'power2.inOut'),
  ]);
  await tween(group.position, {
    x: seated.x,
    y: seated.y,
    z: seated.z,
    duration: 0.38,
    ease: 'power2.in',
  });

  playSound('insert');
  seatOnInsertionRail(group, slideIndex);
  return true;
}

function killProjection(): void {
  gsap.killTweensOf(visuals);
  visuals.lamp = 0;
  visuals.beam = 0;
  visuals.projection = 0;
  resetProjectionTransition();
}

const AFTER_CLICK_PAUSE_MS = 220;

async function clickCamera(): Promise<void> {
  const py = cameraRig.py;
  const pz = cameraRig.pz;
  await tween(cameraRig, {
    py: py + 0.012,
    pz: pz - 0.008,
    duration: 0.05,
    ease: 'power2.out',
  });
  await tween(cameraRig, {
    py,
    pz,
    duration: 0.16,
    ease: 'power2.out',
  });
}

async function settlePlaybackCamera(): Promise<void> {
  gsap.killTweensOf(cameraRig);
  await tween(cameraRig, {
    ...PLAYBACK_CAM,
    duration: 0.9,
    ease: 'power2.inOut',
  });
}

async function dimRoomThenProject(): Promise<void> {
  playSound('switch');
  await tween(visuals, { roomLight: 0.05, duration: 0.95, ease: 'power1.inOut' });
  await delay(520);
  await startProjectionAfterSeat();
}

async function startProjectionAfterSeat(): Promise<void> {
  await delay(AFTER_CLICK_PAUSE_MS);

  playSound('advance');
  void clickCamera();
  void joltMechanism(1);

  visuals.flicker = 0.18;
  visuals.focus = 0.4;
  applySlideLandPose(getState().slideIndex);
  visuals.interrupt = 0.72;
  visuals.blur = 0.4;
  void tween(visuals, { lamp: 1, duration: 0.14, ease: 'power2.out' });
  void tween(visuals, { beam: 1, duration: 0.16, ease: 'power2.out' });
  await tween(visuals, { projection: 1, duration: 0.08, ease: 'none' });
  await tween(visuals, {
    flicker: 1,
    focus: 1,
    interrupt: 1,
    blur: 0,
    duration: 0.18,
    ease: 'power1.out',
  });
}

function clearAutoplay(): void {
  if (autoplayTimer !== null) {
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

function currentCollection() {
  return getCollection(getState().insertedId);
}

function preloadWindow(collectionId: string, index: number): Set<string> {
  const col = getCollection(collectionId);
  const keep = new Set<string>();
  if (!col) return keep;
  for (const photo of col.photos) {
    if (photo.src) keep.add(photo.src);
  }
  const start = Math.max(0, index - PRELOAD_BEHIND);
  const end = Math.min(col.photos.length - 1, index + PRELOAD_AHEAD);
  for (let i = start; i <= end; i++) {
    const src = col.photos[i]?.src;
    if (!src) continue;
    void loadPhoto(src).catch(() => undefined);
  }
  return keep;
}

export function scheduleAutoplay(): void {
  clearAutoplay();
  const { mode, isPlaying, insertedId, slideIndex } = getState();
  if (!isPlaying || mode !== 'PLAYING' || !insertedId) return;
  const col = getCollection(insertedId);
  if (!col) return;
  if (slideIndex >= col.photos.length - 1) {
    setState({ isPlaying: false, mode: 'PAUSED' });
    return;
  }
  autoplayTimer = setTimeout(() => {
    void changeSlide(1);
  }, AUTOPLAY_MS);
}

export async function enterPlaybackMode(): Promise<void> {
  await Promise.all([
    tween(cameraRig, { ...PLAYBACK_CAM, duration: 1.35, ease: 'power2.inOut' }),
    tween(visuals, { roomLight: 0.05, duration: 0.85, ease: 'power1.inOut' }),
    tween(visuals, { lamp: 1, duration: 0.7, delay: 0.12, ease: 'power1.out' }),
    tween(visuals, { beam: 1, duration: 0.65, delay: 0.22, ease: 'power1.out' }),
  ]);
}

export async function returnToCatalogMode(): Promise<void> {
  await Promise.all([
    tween(visuals, { projection: 0, flicker: 1, focus: 1, duration: 0.22 }),
    tween(visuals, { beam: 0, duration: 0.28 }),
    tween(visuals, { lamp: 0, duration: 0.4 }),
    tween(visuals, { roomLight: 1, duration: 0.9, ease: 'power1.inOut' }),
    tween(cameraRig, { ...getCatalogCam(), duration: 1.25, ease: 'power2.inOut' }),
  ]);
}

async function joltMechanism(direction: number): Promise<void> {
  const lever = sceneApi.lever;
  const inserted = getState().insertedId;
  const handle = inserted ? sceneApi.cartridges.get(inserted) : undefined;

  const jobs: Promise<void>[] = [];
  if (lever) {
    jobs.push(
      tween(lever.rotation, {
        z: direction >= 0 ? 0.62 : -0.5,
        duration: 0.08,
        ease: 'power2.out',
      }).then(() =>
        tween(lever.rotation, { z: 0, duration: 0.16, ease: 'power2.inOut' }),
      ),
    );
  }
  if (handle && !isOnInsertionRail(handle.group)) {
    const y = handle.group.position.y;
    jobs.push(
      tween(handle.group.position, {
        y: y - 0.012,
        duration: 0.07,
        ease: 'power2.in',
      }).then(() =>
        tween(handle.group.position, {
          y,
          duration: 0.12,
          ease: 'power2.out',
        }),
      ),
    );
  }
  const magId = getState().selectedCollectionId ?? getState().insertedId;
  const slides =
    (magId ? sceneApi.magazines.get(magId)?.slides : undefined) ??
    (magId ? sceneApi.cartridges.get(magId)?.slides : undefined);
  const currentSlide = slides?.[getState().slideIndex];
  if (currentSlide) {
    const restY =
      typeof currentSlide.userData.restY === 'number'
        ? currentSlide.userData.restY
        : currentSlide.position.y;
    jobs.push(
      tween(currentSlide.position, {
        y: restY + 0.006,
        duration: 0.08,
        ease: 'power2.out',
        overwrite: 'auto',
      }).then(() =>
        tween(currentSlide.position, {
          y: restY,
          duration: 0.14,
          ease: 'power2.inOut',
          overwrite: 'auto',
        }),
      ),
    );
  }
  const projector = sceneApi.projector;
  if (projector) {
    const z = projector.position.z;
    jobs.push(
      tween(projector.position, {
        z: z - 0.01 * (direction >= 0 ? 1 : -1),
        duration: 0.07,
        ease: 'power2.in',
      }).then(() =>
        tween(projector.position, { z, duration: 0.16, ease: 'power2.out' }),
      ),
    );
  }
  await Promise.all(jobs);
}

async function waitForCurrentPhoto(id: string, index: number): Promise<void> {
  const col = getCollection(id);
  const src = col?.photos[index]?.src;
  if (!src) {
    setState({ photoReady: false });
    return;
  }
  setState({ photoReady: false });
  try {
    await loadPhoto(src);
  } catch {
    // Placeholder texture on the screen still shows if the file fails.
  }
  setState({ photoReady: true });
}

async function insertCartridge(id: string): Promise<void> {
  const handle = sceneApi.cartridges.get(id);
  if (!handle) return;

  const slideIndex = rememberedSlide(id);
  killProjection();
  setState({
    mode: 'INSERTING',
    hoveredId: null,
    previewedId: null,
    crateSelectedId: null,
    insertedId: id,
    slideIndex,
    isPlaying: false,
    photoReady: false,
  });
  preloadWindow(id, slideIndex);
  void waitForCurrentPhoto(id, slideIndex);

  const { group } = handle;
  followMagazine(id);
  playSound('pickup');

  const lifted = await liftFromCrate(group);
  if (!lifted) {
    stopFollowingMagazine();
    await returnToCrate(group, handle.home);
    setState({
      mode: 'CATALOG',
      insertedId: null,
      slideIndex: 0,
      photoReady: false,
    });
    return;
  }

  await delay(420);
  const seated = await insertOntoRail(group, slideIndex);
  if (!seated) {
    stopFollowingMagazine();
    await returnToCrate(group, handle.home);
    setState({
      mode: 'CATALOG',
      insertedId: null,
      slideIndex: 0,
      photoReady: false,
    });
    return;
  }

  stopFollowingMagazine();
  persistSlide(id, slideIndex);

  await delay(480);
  await settlePlaybackCamera();
  await dimRoomThenProject();
  setState({ mode: 'PLAYING', isPlaying: true });
  scheduleAutoplay();
}

async function ejectCartridge(opts?: { dimOnly?: boolean }): Promise<void> {
  const { insertedId } = getState();
  if (!insertedId) return;
  const handle = sceneApi.cartridges.get(insertedId);
  clearAutoplay();
  persistSlide(insertedId, getState().slideIndex);
  setState({
    mode: 'EJECTING',
    isPlaying: false,
    hoveredId: null,
    photoReady: false,
  });

  gsap.killTweensOf(cameraRig);
  cameraFollow.active = false;

  await Promise.all([
    tween(visuals, { projection: 0, duration: 0.22 }),
    tween(visuals, { beam: 0, duration: 0.28 }),
    tween(visuals, { lamp: 0, duration: 0.36 }),
  ]);
  visuals.flicker = 1;
  visuals.interrupt = 1;
  resetProjectionTransition();

  if (opts?.dimOnly) {
    await tween(visuals, { roomLight: 0.05, duration: 0.4, ease: 'power1.out' });
    if (handle) {
      releaseFromInsertionRail(handle.group);
      await returnToCrate(handle.group, handle.home);
    }
    setState({ insertedId: null, slideIndex: 0, photoReady: false });
    retainPhotos(new Set());
    return;
  }

  await delay(520);

  await tween(visuals, { roomLight: 1, duration: 0.95, ease: 'power1.inOut' });
  await delay(480);

  playSound('eject');
  if (handle) {
    cameraFollow.id = insertedId;
    cameraFollow.active = true;
    await ejectOffRail(handle.group);
    await delay(420);
    await returnToCrate(handle.group, handle.home);
    cameraFollow.active = false;
    cameraFollow.id = null;
  }

  setState({ insertedId: null, slideIndex: 0, photoReady: false });
  retainPhotos(new Set());
  await tween(cameraRig, { ...getCatalogCam(), duration: 0.9, ease: 'power2.inOut' });
  setState({ mode: 'CATALOG', isPlaying: false });
}

async function switchCartridge(nextId: string): Promise<void> {
  setState({ mode: 'SWITCHING' });
  await ejectCartridge({ dimOnly: true });
  setState({ mode: 'SWITCHING' });
  await insertCartridge(nextId);
}

export async function requestInsert(id: string): Promise<void> {
  const { mode, insertedId } = getState();
  if (sequenceLock || slideLock) return;
  if (insertedId === id) return;
  if (mode === 'CHANGING_SLIDE' || mode === 'REWINDING') return;

  sequenceLock = true;
  try {
    if (insertedId) await switchCartridge(id);
    else await insertCartridge(id);
  } finally {
    sequenceLock = false;
  }
}

export async function requestEject(): Promise<void> {
  const { insertedId, selectedCollectionId, mode } = getState();
  if ((!insertedId && !selectedCollectionId) || sequenceLock) return;
  if (mode === 'CHANGING_SLIDE' || mode === 'REWINDING') return;
  sequenceLock = true;
  try {
    if (sceneApi.magazines.has(selectedCollectionId ?? insertedId ?? '')) {
      await ejectMagazine();
    } else {
      await ejectCartridge();
    }
  } finally {
    sequenceLock = false;
  }
}

export async function changeSlide(direction: number): Promise<void> {
  const { insertedId, slideIndex, mode } = getState();
  if (!insertedId || slideLock || sequenceLock) return;
  if (mode !== 'PLAYING' && mode !== 'PAUSED') return;

  const col = getCollection(insertedId);
  if (!col) return;
  const step: 1 | -1 = direction < 0 ? -1 : 1;
  const next = slideIndex + step;
  if (next < 0 || next >= col.photos.length) return;

  slideLock = true;
  clearAutoplay();
  setState({ mode: 'CHANGING_SLIDE' });

  const nextSrc = col.photos[next]?.src;
  if (nextSrc) void loadPhoto(nextSrc).catch(() => undefined);

  try {
    const magId = getState().selectedCollectionId ?? insertedId;
    await runProjectorSlideTransition({
      direction: step,
      nextIndex: next,
      onMechanical: () => {
        void joltMechanism(step);
        void dockMagazineAtIndex(magId, next, true, SLIDE_TRANSITION.magazineDuration);
      },
      onSwap: () => {
        setState({ slideIndex: next, photoReady: false });
        persistSlide(insertedId, next);
        const keep = preloadWindow(insertedId, next);
        retainPhotos(keep);
        void waitForCurrentPhoto(insertedId, next);
      },
    });

    const atEnd = next >= col.photos.length - 1;
    const shouldPlay = !atEnd && getState().isPlaying;
    setState({
      mode: atEnd || !shouldPlay ? 'PAUSED' : 'PLAYING',
      isPlaying: shouldPlay,
    });
    if (shouldPlay) scheduleAutoplay();
  } finally {
    slideLock = false;
    const { mode: currentMode } = getState();
    if (currentMode === 'CHANGING_SLIDE') {
      setState({ mode: 'PAUSED', isPlaying: false });
    }
  }
}

export function togglePause(): void {
  const { mode, insertedId } = getState();
  if (!insertedId || sequenceLock || slideLock) return;
  if (mode !== 'PLAYING' && mode !== 'PAUSED') return;

  if (mode === 'PLAYING') {
    clearAutoplay();
    setState({ mode: 'PAUSED', isPlaying: false });
    return;
  }

  const col = currentCollection();
  if (!col) return;
  if (getState().slideIndex >= col.photos.length - 1) return;
  setState({ mode: 'PLAYING', isPlaying: true });
  scheduleAutoplay();
}

export async function restartCollection(): Promise<void> {
  const { insertedId, slideIndex, mode, isPlaying } = getState();
  if (!insertedId || sequenceLock || slideLock) return;
  if (mode !== 'PLAYING' && mode !== 'PAUSED') return;
  if (slideIndex <= 0) return;

  const wasPlaying = isPlaying;
  slideLock = true;
  clearAutoplay();
  setState({ mode: 'REWINDING', isPlaying: false });

  const magId = getState().selectedCollectionId ?? insertedId;
  const duration = rewindDurationSec(slideIndex);
  const clacks = rewindClackCount(slideIndex);
  const photos = getCollection(insertedId)?.photos ?? [];
  // Every frame the rewind strobes through has to be decoded up front,
  // otherwise the flash falls back to the placeholder card.
  for (let i = 0; i <= slideIndex && i < photos.length; i++) {
    const src = photos[i]?.src;
    if (src) void loadPhoto(src).catch(() => undefined);
  }

  try {
    await runProjectorRewind({
      duration,
      clacks,
      fromIndex: slideIndex,
      onStep: (index) => setState({ slideIndex: index }),
      onMechanical: () =>
        dockMagazineAtIndex(magId, 0, true, duration, 'power1.inOut'),
      onSwap: () => {
        setState({ slideIndex: 0, photoReady: false });
        persistSlide(insertedId, 0);
        void waitForCurrentPhoto(insertedId, 0);
      },
    });

    dockMagazineAtIndex(magId, 0, false);
    retainPhotos(preloadWindow(insertedId, 0));

    if (getState().mode !== 'REWINDING') return;

    if (wasPlaying) {
      setState({ mode: 'PLAYING', isPlaying: true });
      scheduleAutoplay();
    } else {
      setState({ mode: 'PAUSED', isPlaying: false });
    }
  } finally {
    slideLock = false;
    if (getState().mode === 'REWINDING') {
      setState({ mode: 'PAUSED', isPlaying: false });
    }
  }
}

export function setHovered(id: string | null): void {
  const { mode, insertedId, selectedCollectionId } = getState();
  if (id && (sequenceLock || insertedId === id || selectedCollectionId === id)) return;
  if (id && selectedCollectionId) return;
  if (id && mode !== 'CATALOG' && mode !== 'PLAYING' && mode !== 'PAUSED') return;
  setState({ hoveredId: id });
}

export function setPreviewed(id: string | null): void {
  setState({ previewedId: id });
}

export function isInteractionLocked(): boolean {
  const { mode } = getState();
  return (
    sequenceLock ||
    slideLock ||
    mode === 'INSERTING' ||
    mode === 'EJECTING' ||
    mode === 'SWITCHING'
  );
}

export function isMagazineSelectionLocked(): boolean {
  const { mode } = getState();
  return sequenceLock || mode === 'INSERTING' || isInteractionLocked();
}

async function insertMagazine(id: string): Promise<boolean> {
  const handle = sceneApi.magazines.get(id);
  if (!handle) return false;

  const { group } = handle;
  playSound('pickup');
  followMagazine(id);

  const lifted = await liftFromCrate(group);
  if (!lifted) {
    stopFollowingMagazine();
    await returnToCrate(group, handle.home);
    return false;
  }
  await delay(420);
  const seated = await insertOntoRail(group, getState().slideIndex);
  if (!seated) {
    stopFollowingMagazine();
    await returnToCrate(group, handle.home);
    return false;
  }
  stopFollowingMagazine();
  return true;
}

async function ejectMagazine(): Promise<void> {
  const { selectedCollectionId, insertedId } = getState();
  const id = selectedCollectionId ?? insertedId;
  if (!id) return;
  const handle = sceneApi.magazines.get(id);
  clearAutoplay();
  persistSlide(id, getState().slideIndex);
  setState({
    mode: 'EJECTING',
    isPlaying: false,
    hoveredId: null,
    photoReady: false,
  });

  gsap.killTweensOf(cameraRig);
  cameraFollow.active = false;
  await Promise.all([
    tween(visuals, { projection: 0, duration: 0.22 }),
    tween(visuals, { beam: 0, duration: 0.28 }),
    tween(visuals, { lamp: 0, duration: 0.36 }),
  ]);
  visuals.flicker = 1;
  visuals.interrupt = 1;
  resetProjectionTransition();

  await delay(520);
  await tween(visuals, { roomLight: 1, duration: 0.95, ease: 'power1.inOut' });
  await delay(480);

  playSound('eject');
  if (handle) {
    cameraFollow.id = id;
    cameraFollow.active = true;
    await ejectOffRail(handle.group);
    await delay(420);
    await returnToCrate(handle.group, handle.home);
    cameraFollow.active = false;
    cameraFollow.id = null;
    void dockMagazineAtIndex(id, 0, false);
  }

  setState({
    insertedId: null,
    selectedCollectionId: null,
    slideIndex: 0,
    photoReady: false,
  });
  retainPhotos(new Set());

  await tween(cameraRig, { ...getCatalogCam(), duration: 0.9, ease: 'power2.inOut' });
  setState({ mode: 'CATALOG', isPlaying: false });
}

export async function requestSelectMagazine(id: string): Promise<void> {
  if (sequenceLock) return;
  if (!sceneApi.magazines.has(id)) return;
  const { selectedCollectionId, insertedId } = getState();
  if (selectedCollectionId === id || insertedId === id) return;

  sequenceLock = true;
  try {
    if (selectedCollectionId || insertedId) {
      setState({ mode: 'SWITCHING' });
      await ejectMagazine();
      setState({ mode: 'SWITCHING' });
    }

    const slideIndex = rememberedSlide(id);
    killProjection();
    setState({
      mode: 'INSERTING',
      selectedCollectionId: id,
      insertedId: id,
      hoveredId: null,
      previewedId: null,
      slideIndex,
      isPlaying: false,
      photoReady: false,
    });
    preloadWindow(id, slideIndex);
    void waitForCurrentPhoto(id, slideIndex);

    gsap.killTweensOf(cameraRig);
    const ok = await insertMagazine(id);
    if (!ok) {
      setState({
        mode: 'CATALOG',
        selectedCollectionId: null,
        insertedId: null,
      });
      return;
    }

    await dockMagazineAtIndex(id, slideIndex, false);
    persistSlide(id, slideIndex);
    await delay(480);
    await settlePlaybackCamera();
    await dimRoomThenProject();
    setState({ mode: 'PLAYING', isPlaying: true });
    scheduleAutoplay();
  } finally {
    sequenceLock = false;
  }
}

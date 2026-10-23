import gsap from 'gsap';
import { playSound } from '../audio/sounds';
import { loadPhoto, retainPhotos } from '../media/photoCache';
import { preloadPhotoWindow } from '../media/photoWindow';
import { markAdvanced, markPlayed } from '../state/guide';
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
import { tween } from './tween';
import { cameraFit, cameraFollow, cameraRig, visuals } from './visuals';
import { getPlaybackCam } from './playbackFrame';
import { prefersReducedMotion } from '../lib/motion';
import { coverRoom, revealRoom } from '../ui/veil';
import { magazineRailX } from '../scene/magazineLayout';
import * as THREE from 'three';
import type { Object3D } from 'three';

const AUTOPLAY_MS = 3500;

/**
 * One knob for how unhurried the tape feels going in and coming out. 1 is the
 * brisk baseline; raise it to slow every step of the sequence evenly.
 */
const TAPE_PACE = 1.3;

function pace(seconds: number): number {
  return seconds * TAPE_PACE;
}

let sequenceLock = false;
let slideLock = false;
let autoplayTimer: ReturnType<typeof setTimeout> | null = null;

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
  return sceneApi.cartridges.get(id)?.group;
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
    duration: pace(0.2),
    ease: 'power2.out',
  });
  if (out) {
    await tween(group.position, {
      x: out.x,
      y: out.y + 0.04,
      z: out.z,
      duration: pace(0.5),
      ease: 'power2.inOut',
    });
  } else {
    await tween(group.position, {
      y: group.position.y + 0.08,
      duration: pace(0.35),
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
      duration: pace(0.65),
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, crateRestQuaternion(home), pace(0.6), 'power2.inOut'),
  ]);

  await tween(group.position, {
    x: home.x,
    y: home.y,
    z: home.z,
    duration: pace(0.2),
    ease: 'power2.inOut',
  });
}

/** Put a tape straight back in its crate slot, for cuts that skip the flight. */
function snapToCrate(
  group: Object3D,
  home: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number },
): void {
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.rotation);
  gsap.killTweensOf(group.scale);
  if (isOnInsertionRail(group)) releaseFromInsertionRail(group);
  group.scale.setScalar(MAGAZINE_DOCK_SCALE);
  group.position.set(home.x, home.y, home.z);
  group.quaternion.copy(crateRestQuaternion(home));
  group.rotation.setFromQuaternion(group.quaternion);
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
    duration: pace(0.24),
    ease: 'power2.out',
  });

  await Promise.all([
    tween(group.position, {
      x: approach.x,
      y: approach.y + 0.05,
      z: approach.z,
      duration: pace(0.75),
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, orient, pace(0.75), 'power2.inOut'),
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
      duration: pace(0.45),
      ease: 'power2.inOut',
    }),
    tweenQuaternion(group, orient, pace(0.4), 'power2.inOut'),
  ]);
  await tween(group.position, {
    x: seated.x,
    y: seated.y,
    z: seated.z,
    duration: pace(0.18),
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

/** The camera's small kick as the slide gate fires. Skipped for reduced motion. */
async function clickCamera(): Promise<void> {
  if (prefersReducedMotion()) return;
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

/** Fly to the playback shot while the room dims around the projector. */
async function settleIntoPlayback(): Promise<void> {
  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(cameraFit);
  playSound('switch');
  const { innerWidth: w, innerHeight: h } = window;
  await Promise.all([
    tween(cameraRig, { ...getPlaybackCam(w, h), duration: pace(0.8), ease: 'power2.inOut' }),
    tween(cameraFit, { amount: 0, duration: pace(0.8), ease: 'power2.inOut' }),
    tween(visuals, { roomLight: 0.05, duration: pace(0.7), ease: 'power1.inOut' }),
  ]);
}

async function startProjectionAfterSeat(): Promise<void> {
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

/** Reduced motion: the projector is simply on, framed, and lit. */
function cutToPlayback(): void {
  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(cameraFit);
  gsap.killTweensOf(visuals);
  Object.assign(cameraRig, getPlaybackCam(window.innerWidth, window.innerHeight));
  cameraFit.amount = 0;
  applySlideLandPose(getState().slideIndex);
  Object.assign(visuals, {
    roomLight: 0.05,
    lamp: 1,
    beam: 1,
    projection: 1,
    flicker: 1,
    focus: 1,
    interrupt: 1,
    blur: 0,
  });
}

/** Reduced motion: lights up, projector off, camera back at the desk. */
function cutToCatalog(): void {
  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(cameraFit);
  killProjection();
  visuals.roomLight = 1;
  visuals.flicker = 1;
  visuals.interrupt = 1;
  Object.assign(cameraRig, getCatalogCam());
  cameraFit.amount = 1;
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
  if (!col) return new Set();
  return preloadPhotoWindow(col.photos, index);
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
    void changeSlide(1, 'auto');
  }, AUTOPLAY_MS);
}

/** Hold the autoplay timer without moving the current memory. */
export function pauseAutoplay(): void {
  clearAutoplay();
}

export function resumeAutoplay(): void {
  if (getState().isPlaying && getState().mode === 'PLAYING') scheduleAutoplay();
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
  const slides = magId ? sceneApi.cartridges.get(magId)?.slides : undefined;
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
    setState({ photoReady: false, photoError: true });
    return;
  }
  setState({ photoReady: false, photoError: false });
  try {
    await loadPhoto(src);
    setState({ photoReady: true, photoError: false });
  } catch {
    // The wall keeps its stand-in card; the controls say the file failed.
    setState({ photoReady: true, photoError: true });
  }
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
    photoError: false,
  });
  preloadWindow(id, slideIndex);
  void waitForCurrentPhoto(id, slideIndex);

  const { group } = handle;
  playSound('pickup');

  if (prefersReducedMotion()) {
    await coverRoom();
    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.rotation);
    seatOnInsertionRail(group, slideIndex);
    persistSlide(id, slideIndex);
    cutToPlayback();
    await revealRoom();
    beginPlayback();
    return;
  }

  followMagazine(id);
  const lifted = await liftFromCrate(group);
  const seated = lifted && (await insertOntoRail(group, slideIndex));
  stopFollowingMagazine();
  if (!seated) {
    await returnToCrate(group, handle.home);
    setState({
      mode: 'CATALOG',
      insertedId: null,
      slideIndex: 0,
      photoReady: false,
      photoError: false,
    });
    return;
  }

  persistSlide(id, slideIndex);
  await settleIntoPlayback();
  await startProjectionAfterSeat();
  beginPlayback();
}

function beginPlayback(): void {
  setState({ mode: 'PLAYING', isPlaying: true });
  markPlayed();
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
    photoError: false,
  });

  gsap.killTweensOf(cameraRig);
  gsap.killTweensOf(cameraFit);
  cameraFollow.active = false;
  playSound('switch');

  if (prefersReducedMotion()) {
    await coverRoom();
    if (handle) snapToCrate(handle.group, handle.home);
    finishEject();
    if (opts?.dimOnly) {
      // The next tape goes straight in; keep the dim, framed playback look.
      visuals.roomLight = 0.05;
      killProjection();
    } else {
      cutToCatalog();
      setState({ mode: 'CATALOG', isPlaying: false });
    }
    await revealRoom();
    return;
  }

  await Promise.all([
    tween(visuals, { projection: 0, duration: pace(0.2) }),
    tween(visuals, { beam: 0, duration: pace(0.24) }),
    tween(visuals, { lamp: 0, duration: pace(0.3) }),
  ]);
  visuals.flicker = 1;
  visuals.interrupt = 1;
  resetProjectionTransition();

  if (opts?.dimOnly) {
    if (handle) {
      releaseFromInsertionRail(handle.group);
      await returnToCrate(handle.group, handle.home);
    }
    finishEject();
    return;
  }

  // Lights come up while the tape leaves the rail, and the camera heads home
  // while it drops back into the crate — one continuous move, not four.
  playSound('eject');
  const lights = tween(visuals, { roomLight: 1, duration: pace(0.6), ease: 'power1.inOut' });
  if (handle) {
    cameraFollow.id = insertedId;
    cameraFollow.active = true;
    await ejectOffRail(handle.group);
    cameraFollow.active = false;
    cameraFollow.id = null;
    await Promise.all([
      returnToCrate(handle.group, handle.home),
      tween(cameraRig, { ...getCatalogCam(), duration: pace(0.85), ease: 'power2.inOut' }),
      tween(cameraFit, { amount: 1, duration: pace(0.85), ease: 'power2.inOut' }),
      lights,
    ]);
  } else {
    await Promise.all([
      tween(cameraRig, { ...getCatalogCam(), duration: pace(0.85), ease: 'power2.inOut' }),
      tween(cameraFit, { amount: 1, duration: pace(0.85), ease: 'power2.inOut' }),
      lights,
    ]);
  }

  finishEject();
  setState({ mode: 'CATALOG', isPlaying: false });
}

function finishEject(): void {
  setState({ insertedId: null, slideIndex: 0, photoReady: false, photoError: false });
  retainPhotos(new Set());
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
    await ejectCartridge();
  } finally {
    sequenceLock = false;
  }
}

export async function changeSlide(
  direction: number,
  cause: 'user' | 'auto' = 'user',
): Promise<void> {
  const { insertedId, slideIndex, mode } = getState();
  if (!insertedId || slideLock || sequenceLock) return;
  if (mode !== 'PLAYING' && mode !== 'PAUSED') return;

  const col = getCollection(insertedId);
  if (!col) return;
  const step: 1 | -1 = direction < 0 ? -1 : 1;
  const next = slideIndex + step;
  if (next < 0 || next >= col.photos.length) return;
  if (cause === 'user' && step === 1) markAdvanced();

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
        setState({ slideIndex: next, photoReady: false, photoError: false });
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

export async function restartCollection(opts?: { play?: boolean }): Promise<void> {
  const { insertedId, slideIndex, mode, isPlaying } = getState();
  if (!insertedId || sequenceLock || slideLock) return;
  if (mode !== 'PLAYING' && mode !== 'PAUSED') return;
  if (slideIndex <= 0) return;

  const wasPlaying = opts?.play ? true : isPlaying;
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
        setState({ slideIndex: 0, photoReady: false, photoError: false });
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

import { useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  isInteractionLocked,
  setHovered,
} from '../experience/controller';
import { isCurationBusy } from '../experience/curation';
import { beginDrag, dragState, isDragging } from '../experience/drag';
import { buildHomePlan, writeMagazineHome } from '../experience/homes';
import {
  MAGAZINE_DOCK_SCALE,
  MAGAZINE_HOVER_LIFT,
  type MagazinePose,
} from '../experience/layout';
import {
  registerCartridge,
  sceneApi,
  unregisterCartridge,
} from '../experience/sceneApi';
import { clearArriving, finishDeleting, getState, setCrateSelected, useExperience } from '../state/store';
import type { Collection } from '../types/collection';
import { isTransitional } from '../types/collection';
import { MAGAZINE, magazineHeight, magazineLength, magazineWidth } from './magazineLayout';
import { MagazineActions } from './MagazineActions';
import { SlideMagazine } from './SlideMagazine';

type Props = {
  collection: Collection;
};

/** How much of the gap to the home pose is closed per second, roughly. */
const SETTLE_RATE = 10;
const DRAG_RATE = 18;
/** Long moves bow upward, so a magazine crossing the room lifts on the way. */
const ARC_PER_METER = 0.35;
const MAX_ARC = 0.05;

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _world = new THREE.Vector3();

export function Cartridge({ collection }: Props) {
  const group = useRef<THREE.Group>(null);
  const [localHover, setLocalHover] = useState(false);
  const hoveredId = useExperience((s) => s.hoveredId);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const insertedId = useExperience((s) => s.insertedId);
  const mode = useExperience((s) => s.mode);
  const slideIndex = useExperience((s) => s.slideIndex);
  const arrivingId = useExperience((s) => s.arrivingId);
  const deletingId = useExperience((s) => s.deletingId);
  const inCollection = useExperience((s) => s.collectionIds.includes(collection.id));
  const isDeleting = deletingId === collection.id;
  const slidesRef = useRef<(THREE.Group | null)[]>([]);
  const startHome = useMemo<MagazinePose>(() => {
    const s = getState();
    return writeMagazineHome(collection.id, buildHomePlan(s), s, {
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    });
    // Only the mount pose; the frame sync owns it from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.id]);
  const inserting = insertedId === collection.id;
  const arriving = arrivingId === collection.id;
  const curating = mode === 'CURATING';
  const [fillCount, setFillCount] = useState(arriving ? 0 : collection.photos.length);
  const raisedIndex =
    inserting &&
    (mode === 'PLAYING' ||
      mode === 'PAUSED' ||
      mode === 'CHANGING_SLIDE' ||
      mode === 'REWINDING')
      ? slideIndex
      : -1;

  /** Only crate magazines can be loaded; the shelf is browsed, not played. */
  const playable = inCollection && !curating;
  const grabbable = curating && !arriving && !isDeleting;
  /**
   * A shelved magazine outside curating is scenery: it lets pointer events
   * through so the shelf behind it takes the hover and the click.
   */
  const interactive = (playable || grabbable) && !arriving && !isDeleting;

  const lifted =
    interactive &&
    insertedId !== collection.id &&
    (localHover || hoveredId === collection.id || crateSelectedId === collection.id) &&
    !isTransitional(mode);

  useCursor(
    localHover && interactive && insertedId !== collection.id && !isTransitional(mode),
    grabbable ? 'grab' : 'pointer',
  );

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    registerCartridge(collection.id, g, startHome);
    const handle = sceneApi.cartridges.get(collection.id);
    const home = handle?.home ?? startHome;
    if (getState().insertedId !== collection.id && !g.userData.onInsertionRail) {
      g.scale.setScalar(MAGAZINE_DOCK_SCALE);
      if (getState().arrivingId === collection.id) {
        g.userData.arriving = true;
        g.position.set(home.x, home.y + 0.04, home.z);
        g.rotation.set(home.rx, home.ry, home.rz);
        g.scale.setScalar(MAGAZINE_DOCK_SCALE * 0.22);
      } else {
        g.position.set(home.x, home.y, home.z);
        g.rotation.set(home.rx, home.ry, home.rz);
      }
    }
    return () => unregisterCartridge(collection.id, g);
  }, [collection.id, startHome]);

  useLayoutEffect(() => {
    const handle = sceneApi.cartridges.get(collection.id);
    if (handle) handle.slides = slidesRef.current;
  }, [collection.id, inserting, arriving]);

  useEffect(() => {
    if (!arriving) {
      setFillCount(collection.photos.length);
      return;
    }
    setFillCount(0);
    const target = collection.photos.length;
    const step = Math.max(1, Math.ceil(target / 10));
    let n = 0;
    const id = window.setInterval(() => {
      n = Math.min(target, n + step);
      setFillCount(n);
      if (n >= target) window.clearInterval(id);
    }, 90);
    return () => window.clearInterval(id);
  }, [arriving, collection.photos.length]);

  useEffect(() => {
    if (!arriving) return;
    const g = group.current;
    const handle = sceneApi.cartridges.get(collection.id);
    if (!g || !handle) return;
    g.userData.arriving = true;
    const tl = gsap.timeline({
      onComplete: () => {
        g.userData.arriving = false;
        g.scale.setScalar(MAGAZINE_DOCK_SCALE);
        clearArriving(collection.id);
      },
    });
    tl.to(
      g.scale,
      {
        x: MAGAZINE_DOCK_SCALE,
        y: MAGAZINE_DOCK_SCALE,
        z: MAGAZINE_DOCK_SCALE,
        duration: 0.9,
        ease: 'power2.out',
      },
      0,
    );
    tl.to(
      g.position,
      { y: handle.home.y, duration: 1.15, ease: 'power2.out' },
      0,
    );
    return () => {
      tl.kill();
    };
  }, [arriving, collection.id]);

  useEffect(() => {
    if (!isDeleting) return;
    const g = group.current;
    if (!g) {
      finishDeleting(collection.id);
      return;
    }
    gsap.killTweensOf(g.position);
    gsap.killTweensOf(g.scale);
    gsap.killTweensOf(g.rotation);
    const tl = gsap.timeline({
      onComplete: () => finishDeleting(collection.id),
    });
    tl.to(g.position, { y: g.position.y + 0.14, duration: 0.55, ease: 'power2.in' }, 0);
    tl.to(
      g.scale,
      { x: 0.001, y: 0.001, z: 0.001, duration: 0.55, ease: 'power2.in' },
      0,
    );
    return () => {
      tl.kill();
    };
  }, [isDeleting, collection.id]);

  /**
   * One pose to chase, wherever it is. Curating only changes which slot counts
   * as home, so the shelf-to-crate journey is the same interpolation as the
   * hover lift — no separate transition to sequence.
   */
  useFrame((_, delta) => {
    const g = group.current;
    const handle = sceneApi.cartridges.get(collection.id);
    if (!g || !handle) return;
    if (g.userData.onInsertionRail) {
      const dock = sceneApi.insertionPoint;
      if (dock && g.parent !== dock) {
        dock.attach(g);
        g.scale.setScalar(MAGAZINE_DOCK_SCALE);
        g.rotation.set(0, 0, 0);
      }
      return;
    }
    if (getState().insertedId === collection.id) return;
    if (isTransitional(getState().mode)) return;

    const settle = Math.min(1, delta * SETTLE_RATE);

    if (isDragging(collection.id)) {
      const grab = Math.min(1, delta * DRAG_RATE);
      g.position.x += (dragState.x - g.position.x) * grab;
      g.position.y += (dragState.y - g.position.y) * grab;
      g.position.z += (dragState.z - g.position.z) * grab;
      _euler.set(handle.home.rx, handle.home.ry, handle.home.rz);
      g.quaternion.slerp(_quat.setFromEuler(_euler), settle);
      return;
    }

    // While the crate is in the air its contents are held, not chased: a soft
    // follow would let them trail out of the trough on the way across the room.
    if (isCurationBusy() && !g.userData.arriving && !isDeleting) {
      g.position.set(handle.home.x, handle.home.y, handle.home.z);
      _euler.set(handle.home.rx, handle.home.ry, handle.home.rz);
      g.quaternion.setFromEuler(_euler);
      return;
    }

    g.position.x += (handle.home.x - g.position.x) * settle;
    g.position.z += (handle.home.z - g.position.z) * settle;
    if (g.userData.arriving || isDeleting) return;

    const travel = Math.hypot(
      handle.home.x - g.position.x,
      handle.home.z - g.position.z,
    );
    const arc = Math.min(MAX_ARC, travel * ARC_PER_METER);
    const lift = lifted ? MAGAZINE_HOVER_LIFT : 0;
    g.position.y += (handle.home.y + lift + arc - g.position.y) * settle;
    _euler.set(
      handle.home.rx,
      handle.home.ry,
      handle.home.rz + (lifted ? -0.05 : 0),
    );
    g.quaternion.slerp(_quat.setFromEuler(_euler), settle);
  });

  function onPointerDown(event: ThreeEvent<PointerEvent>) {
    if (!interactive) return;
    event.stopPropagation();
    // Checked live rather than off the render: the flight ending does not
    // re-render, so a memoised flag would leave the magazines stuck.
    if (!grabbable || isCurationBusy()) return;
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(_world);
    beginDrag(collection.id, _world, event.camera);
  }

  const trayW = magazineLength();
  const trayH = magazineHeight();
  const trayD = magazineWidth();

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        if (getState().insertedId === collection.id || isTransitional(getState().mode)) return;
        setLocalHover(true);
        if (playable) setHovered(collection.id);
      }}
      onPointerOut={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setLocalHover(false);
        if (getState().hoveredId === collection.id) setHovered(null);
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        if (!playable) return;
        e.stopPropagation();
        if (isDeleting || isInteractionLocked()) return;
        if (getState().insertedId === collection.id) return;
        setCrateSelected(collection.id);
      }}
    >
      <mesh position={[0, trayH / 2, 0]}>
        <boxGeometry args={[trayW, trayH, trayD]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <SlideMagazine
        title={collection.title}
        date={collection.date}
        photoCount={arriving ? fillCount : collection.photos.length}
        maxVisibleSlides={
          // Shelved magazines are read by their labels, so they skip the slide
          // instances entirely — the library is far larger than the crate.
          !inCollection
            ? 0
            : arriving
              ? fillCount
              : Math.min(collection.photos.length, MAGAZINE.slotCount)
        }
        photos={collection.photos}
        raisedIndex={raisedIndex}
        slidesRef={slidesRef}
        active={inserting || arriving}
      />
      <MagazineActions
        collection={collection}
        trayW={trayW}
        trayH={trayH}
        selected={
          crateSelectedId === collection.id && !isDeleting && !arriving
        }
      />
    </group>
  );
}

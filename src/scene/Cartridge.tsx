import { useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  isInteractionLocked,
  setHovered,
} from '../experience/controller';
import {
  crateSlotWorld,
  MAGAZINE_DOCK_SCALE,
  MAGAZINE_HOVER_LIFT,
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
  index: number;
  count: number;
};

export function Cartridge({ collection, index, count }: Props) {
  const group = useRef<THREE.Group>(null);
  const [localHover, setLocalHover] = useState(false);
  const hoveredId = useExperience((s) => s.hoveredId);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const insertedId = useExperience((s) => s.insertedId);
  const mode = useExperience((s) => s.mode);
  const slideIndex = useExperience((s) => s.slideIndex);
  const arrivingId = useExperience((s) => s.arrivingId);
  const deletingId = useExperience((s) => s.deletingId);
  const isDeleting = deletingId === collection.id;
  const slidesRef = useRef<(THREE.Group | null)[]>([]);
  const startHome = useMemo(() => crateSlotWorld(index, count), [index, count]);
  const inserting = insertedId === collection.id;
  const arriving = arrivingId === collection.id;
  const [fillCount, setFillCount] = useState(arriving ? 0 : collection.photos.length);
  const raisedIndex =
    inserting &&
    (mode === 'PLAYING' ||
      mode === 'PAUSED' ||
      mode === 'CHANGING_SLIDE' ||
      mode === 'REWINDING')
      ? slideIndex
      : -1;

  const lifted =
    !arriving &&
    !isDeleting &&
    insertedId !== collection.id &&
    (localHover || hoveredId === collection.id || crateSelectedId === collection.id) &&
    !isTransitional(mode);

  useCursor(
    localHover && !arriving && !isDeleting && insertedId !== collection.id && !isTransitional(mode),
    'pointer',
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

  useEffect(() => {
    const g = group.current;
    const handle = sceneApi.cartridges.get(collection.id);
    if (!g || !handle) return;
    if (g.userData.arriving) return;
    if (getState().insertedId === collection.id || g.userData.onInsertionRail) return;
    gsap.to(g.position, {
      y: handle.home.y + (lifted ? MAGAZINE_HOVER_LIFT : 0),
      duration: 0.38,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    gsap.to(g.rotation, {
      x: handle.home.rx,
      y: handle.home.ry,
      z: handle.home.rz + (lifted ? -0.05 : 0),
      duration: 0.38,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [lifted, collection.id]);

  useFrame(() => {
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
    g.position.x = THREE.MathUtils.lerp(g.position.x, handle.home.x, 0.16);
    g.position.z = THREE.MathUtils.lerp(g.position.z, handle.home.z, 0.16);
    if (g.userData.arriving) return;
  });

  const trayW = magazineLength();
  const trayH = magazineHeight();
  const trayD = magazineWidth();

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (arriving || getState().insertedId === collection.id || isTransitional(getState().mode)) return;
        setLocalHover(true);
        setHovered(collection.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setLocalHover(false);
        if (getState().hoveredId === collection.id) setHovered(null);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (arriving || isDeleting || isInteractionLocked()) return;
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
          arriving
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

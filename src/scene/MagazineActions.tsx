import { Billboard, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { requestPlay } from '../experience/controller';
import { setCrateSelected, setEditingId } from '../state/store';
import type { Collection } from '../types/collection';

const BTN_W = 0.092;
const BTN_H = 0.028;
const BTN_GAP = 0.008;
/** World-up clearance from the magazine’s top edge to the bottom of the buttons. */
const POP_ABOVE = 0.03;
const TUCK_INTO = 0.014;
/** Sit the bar above the pivot so it grows up, not down over the spines. */
const BAR_LIFT = BTN_H / 2;
/**
 * The hit area reaches down into the gap above the tape, so a click just under
 * the key still presses it instead of missing everything and deselecting. It
 * stops short of the tape (POP_ABOVE) and doesn't widen into the EDIT key.
 */
const HIT_REACH_DOWN = BTN_H * 0.6;
/**
 * However small the camera draws the key, its hit area stays at least this tall
 * on screen (over the 44px touch guideline), with a little to spare above the
 * face. Anything still missing grows upward, away from the tape and EDIT.
 */
const MIN_HIT_PX = 48;
const HIT_PAD_UP_PX = 6;

const _top = new THREE.Vector3();
const _bottom = new THREE.Vector3();

function drawActionFace(
  label: string,
  fontsReady: boolean,
  hover: boolean,
): HTMLCanvasElement {
  const w = 512;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = hover ? '#a87b3c' : '#000000';
  ctx.fillRect(0, 0, w, h);

  const typeface = fontsReady
    ? '"Pixelify Sans", ui-monospace, monospace'
    : 'ui-monospace, monospace';
  ctx.fillStyle = hover ? '#0a0806' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '0.06em';
  ctx.font = `400 72px ${typeface}`;
  ctx.fillText(label, w / 2, h / 2 + 10);
  ctx.letterSpacing = '0em';
  return canvas;
}

function makeActionTexture(
  label: string,
  fontsReady: boolean,
  hover: boolean,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(drawActionFace(label, fontsReady, hover));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

type ActionButtonProps = {
  label: string;
  idle: THREE.CanvasTexture;
  hoverTex: THREE.CanvasTexture;
  position: [number, number, number];
  onPress: () => void;
};

function ActionButton({ label, idle, hoverTex, position, onPress }: ActionButtonProps) {
  const [hover, setHover] = useState(false);
  const hoverOk = useRef(false);
  const face = useRef<THREE.Mesh>(null);
  const hit = useRef<THREE.Mesh>(null);
  useCursor(hover, 'pointer');
  const texture = hover ? hoverTex : idle;

  useEffect(() => {
    hoverOk.current = false;
    const id = window.setTimeout(() => {
      hoverOk.current = true;
    }, 480);
    return () => window.clearTimeout(id);
  }, []);

  useFrame(({ camera, size }) => {
    const f = face.current;
    const h = hit.current;
    if (!f || !h) return;
    f.updateWorldMatrix(true, false);
    _top.set(0, BTN_H / 2, 0).applyMatrix4(f.matrixWorld).project(camera);
    _bottom.set(0, -BTN_H / 2, 0).applyMatrix4(f.matrixWorld).project(camera);
    const facePx = Math.abs(_top.y - _bottom.y) * 0.5 * size.height;
    if (!(facePx > 0.5)) return;
    const unitsPerPx = BTN_H / facePx;
    const up = Math.max(
      HIT_PAD_UP_PX * unitsPerPx,
      MIN_HIT_PX * unitsPerPx - BTN_H - HIT_REACH_DOWN,
    );
    h.scale.set(BTN_W, BTN_H + HIT_REACH_DOWN + up, 1);
    h.position.y = (up - HIT_REACH_DOWN) / 2;
  });

  return (
    <group
      userData={{ action: label }}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (hoverOk.current) setHover(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHover(false);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      {/* Transparent so it joins the pass the screen's layers draw in, and a high
          renderOrder puts it last there. No depth test, so nothing can hide it.
          The hit mesh below covers it and takes the pointer alone, so the two
          never trade hover back and forth. */}
      <mesh ref={face} renderOrder={1000} raycast={() => null}>
        <planeGeometry args={[BTN_W, BTN_H]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={THREE.DoubleSide}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* After the face, which GuideAnchor measures as the first mesh. Sized
          each frame from a unit plane. */}
      <mesh
        ref={hit}
        position={[0, -HIT_REACH_DOWN / 2, 0]}
        scale={[BTN_W, BTN_H + HIT_REACH_DOWN, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
    </group>
  );
}

type Props = {
  collection: Collection;
  trayW: number;
  trayH: number;
  selected: boolean;
};

export function MagazineActions({ collection, trayW, trayH, selected }: Props) {
  const root = useRef<THREE.Group>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [mounted, setMounted] = useState(selected);
  const [fontsReady, setFontsReady] = useState(false);
  const showEdit = Boolean(collection.createdAt);

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const loadIdle = useMemo(
    () => makeActionTexture('PLAY', fontsReady, false),
    [fontsReady],
  );
  const loadHover = useMemo(
    () => makeActionTexture('PLAY', fontsReady, true),
    [fontsReady],
  );
  const editIdle = useMemo(
    () => makeActionTexture('EDIT', fontsReady, false),
    [fontsReady],
  );
  const editHover = useMemo(
    () => makeActionTexture('EDIT', fontsReady, true),
    [fontsReady],
  );
  useEffect(
    () => () => {
      loadIdle.dispose();
      loadHover.dispose();
      editIdle.dispose();
      editHover.dispose();
    },
    [loadIdle, loadHover, editIdle, editHover],
  );

  useLayoutEffect(() => {
    if (selected) setMounted(true);
  }, [selected]);

  useLayoutEffect(() => {
    const g = root.current;
    if (!g || !mounted) return;

    const tuckedX = trayW / 2 - TUCK_INTO;
    const poppedX = trayW / 2 + POP_ABOVE;
    g.position.y = trayH / 2;
    g.position.z = 0;
    gsap.killTweensOf(g.position);
    gsap.killTweensOf(g.scale);

    if (selected) {
      g.position.x = tuckedX;
      g.scale.setScalar(0.18);
      const tl = gsap.timeline();
      tl.to(
        g.position,
        { x: poppedX, duration: 0.42, ease: 'back.out(1.7)' },
        0,
      );
      tl.to(
        g.scale,
        { x: 1, y: 1, z: 1, duration: 0.42, ease: 'back.out(1.8)' },
        0,
      );
      return () => {
        tl.kill();
      };
    }

    const tl = gsap.timeline({
      onComplete: () => {
        if (!selectedRef.current) setMounted(false);
      },
    });
    tl.to(
      g.position,
      { x: tuckedX, duration: 0.22, ease: 'power2.in' },
      0,
    );
    tl.to(
      g.scale,
      { x: 0.12, y: 0.12, z: 0.12, duration: 0.22, ease: 'power2.in' },
      0,
    );
    return () => {
      tl.kill();
    };
  }, [selected, mounted, trayW, trayH]);

  if (!mounted) return null;

  const loadX = showEdit ? -(BTN_W + BTN_GAP) / 2 : 0;
  const editX = (BTN_W + BTN_GAP) / 2;

  return (
    <group
      ref={root}
      position={[trayW / 2 - TUCK_INTO, trayH / 2, 0]}
      scale={0.18}
    >
      <Billboard follow>
        <ActionButton
          label="PLAY"
          idle={loadIdle}
          hoverTex={loadHover}
          position={[loadX, BAR_LIFT, 0]}
          onPress={() => requestPlay(collection.id)}
        />
        {showEdit && (
          <ActionButton
            label="EDIT"
            idle={editIdle}
            hoverTex={editHover}
            position={[editX, BAR_LIFT, 0]}
            onPress={() => {
              setCrateSelected(null);
              setEditingId(collection.id);
            }}
          />
        )}
      </Billboard>
    </group>
  );
}

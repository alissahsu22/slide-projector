import { Billboard, useCursor } from '@react-three/drei';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { requestInsert } from '../experience/controller';
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
  useCursor(hover, 'pointer');
  const texture = hover ? hoverTex : idle;

  useEffect(() => {
    hoverOk.current = false;
    const id = window.setTimeout(() => {
      hoverOk.current = true;
    }, 480);
    return () => window.clearTimeout(id);
  }, []);

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
      <mesh>
        <planeGeometry args={[BTN_W, BTN_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
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
    () => makeActionTexture('LOAD', fontsReady, false),
    [fontsReady],
  );
  const loadHover = useMemo(
    () => makeActionTexture('LOAD', fontsReady, true),
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
          label="LOAD"
          idle={loadIdle}
          hoverTex={loadHover}
          position={[loadX, BAR_LIFT, 0]}
          onPress={() => void requestInsert(collection.id)}
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

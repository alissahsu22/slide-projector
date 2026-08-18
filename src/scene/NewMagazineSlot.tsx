import { useCursor } from '@react-three/drei';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { isMagazineSelectionLocked } from '../experience/controller';
import {
  CRATE,
  CRATE_MAGAZINE,
  MAGAZINE_HOVER_LIFT,
  magazineCrateInner,
} from '../experience/layout';
import { getState, setCreateOpen, useExperience } from '../state/store';

/**
 * Label paper as fractions of the placeholder's front face. The sheet sits high
 * on the face for the same reason the real magazine labels do: the crate's
 * front wall covers the bottom fifth of a standing magazine.
 */
const LABEL_W_FRAC = 0.84;
const LABEL_H_FRAC = 0.66;
const LABEL_Y_FRAC = 0.6;

const LABEL_PLANE_LONG = CRATE_MAGAZINE.height * LABEL_H_FRAC;
const LABEL_PLANE_SHORT = CRATE_MAGAZINE.thickness * LABEL_W_FRAC;

/**
 * Drawn in reading orientation — long axis first — and stood upright by the
 * mesh, so the type runs up the face like the titles on the real magazines.
 */
const TEX_LONG = 1024;
const TEX_SHORT = Math.round((TEX_LONG * LABEL_PLANE_SHORT) / LABEL_PLANE_LONG);

/** Kodak-carton amber: the only saturated card in a crate of black and cream. */
const CARD = '#e6ae3c';
const INK = '#1d1408';

/** Cap height of the typewriter face as a share of the font size. */
const CAP = 0.78;

/** Special Elite ships a single weight; synthetic bold blurs it when minified. */
const WEIGHT = 400;

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  ceiling: number,
  typeface: string,
): number {
  for (let size = Math.floor(ceiling); size > 12; size -= 2) {
    ctx.font = `${WEIGHT} ${size}px ${typeface}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `${WEIGHT} 12px ${typeface}`;
  return 12;
}

function drawAddBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const arm = r * 0.52;
  const bar = r * 0.2;
  ctx.fillStyle = CARD;
  ctx.fillRect(cx - arm, cy - bar / 2, arm * 2, bar);
  ctx.fillRect(cx - bar / 2, cy - arm, bar, arm * 2);
}

function drawAddLabel(
  canvas: HTMLCanvasElement,
  fontsReady: boolean,
): HTMLCanvasElement {
  const w = TEX_LONG;
  const h = TEX_SHORT;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const typeface = fontsReady
    ? '"Special Elite", "Courier New", monospace'
    : '"Courier New", monospace';

  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, w, h);
  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle =
      Math.random() > 0.5 ? `rgba(255,244,214,${a})` : `rgba(96,58,14,${a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }

  const margin = Math.round(h * 0.038);
  ctx.strokeStyle = 'rgba(40, 26, 8, 0.45)';
  ctx.lineWidth = Math.max(2, Math.round(h * 0.016));
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

  const pad = Math.round(h * 0.09);
  const band = h - pad * 2;
  // Badge lives at the far end of the reading direction, i.e. the top of the
  // standing placeholder — the part of the face nothing ever covers.
  const badgeR = Math.round(band * 0.42);
  const badgeCx = w - pad - badgeR;
  drawAddBadge(ctx, badgeCx, h / 2, badgeR);

  const textW = badgeCx - badgeR - Math.round(h * 0.16) - pad;
  const gap = Math.round(band * 0.1);
  const headCap = Math.round(band * 0.54);
  const subCap = band - headCap - gap;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;

  ctx.letterSpacing = '0.02em';
  const headSize = fitFontSize(ctx, 'NEW', textW, headCap / CAP, typeface);
  ctx.letterSpacing = '0.06em';
  const subSize = fitFontSize(ctx, 'MAGAZINE', textW, subCap / CAP, typeface);

  const block = headSize * CAP + gap + subSize * CAP;
  const top = (h - block) / 2;

  ctx.letterSpacing = '0.02em';
  ctx.font = `${WEIGHT} ${headSize}px ${typeface}`;
  ctx.fillText('NEW', pad, top + headSize * CAP);

  ctx.letterSpacing = '0.06em';
  ctx.font = `${WEIGHT} ${subSize}px ${typeface}`;
  ctx.fillStyle = 'rgba(29, 20, 8, 0.88)';
  ctx.fillText('MAGAZINE', pad, top + block);
  ctx.letterSpacing = '0em';

  return canvas;
}

function makeAddLabel(fontsReady: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(
    drawAddLabel(document.createElement('canvas'), fontsReady),
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function NewMagazineSlot() {
  const group = useRef<THREE.Group>(null);
  const count = useExperience((s) => s.collections.length);
  const mode = useExperience((s) => s.mode);
  const createOpen = useExperience((s) => s.createOpen);
  const [hover, setHover] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);
  const label = useMemo(() => makeAddLabel(fontsReady), [fontsReady]);
  useEffect(() => () => label.dispose(), [label]);

  const slotCount = count + 1;
  const inner = magazineCrateInner(slotCount);
  const index = count;
  const x0 = -inner.x / 2 + CRATE.padX + CRATE_MAGAZINE.thickness / 2;
  const x = x0 + index * (CRATE_MAGAZINE.thickness + CRATE.gap);
  const { thickness: t, height: h, depth: d } = CRATE_MAGAZINE;
  const live = mode === 'CATALOG' && !createOpen && !isMagazineSelectionLocked();
  const lit = hover && live;
  useCursor(lit, 'pointer');

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.x = x;
    g.position.z = 0;
    if (typeof g.userData.restY !== 'number') {
      g.position.y = CRATE.floor;
      g.userData.restY = CRATE.floor;
    }
  }, [x]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    gsap.to(g.position, {
      y: CRATE.floor + (lit ? MAGAZINE_HOVER_LIFT : 0),
      duration: 0.38,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    gsap.to(g.rotation, {
      z: lit ? -0.05 : 0,
      duration: 0.38,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    return () => {
      gsap.killTweensOf(g.position);
      gsap.killTweensOf(g.rotation);
    };
  }, [lit]);

  return (
    <group
      ref={group}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHover(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHover(false);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (getState().mode !== 'CATALOG' || getState().createOpen) return;
        if (isMagazineSelectionLocked()) return;
        setCreateOpen(true);
      }}
    >
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial
          color={hover ? '#2a2420' : '#1c1916'}
          roughness={0.86}
          metalness={0.06}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[t * 0.55, h * 0.78, d * 0.72]} />
        <meshStandardMaterial color="#0c0b0a" roughness={0.95} metalness={0} />
      </mesh>
      <mesh
        position={[0, h * LABEL_Y_FRAC, d / 2 + 0.0002]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <planeGeometry args={[LABEL_PLANE_LONG, LABEL_PLANE_SHORT]} />
        <meshStandardMaterial
          map={label}
          roughness={0.9}
          metalness={0}
          // The crate sits in a dim room; a touch of self-light keeps the card
          // readable there and turns hover into a visible response.
          emissiveMap={label}
          emissive="#ffffff"
          emissiveIntensity={lit ? 0.42 : 0.22}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

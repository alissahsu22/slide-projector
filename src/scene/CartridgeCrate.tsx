import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CRATE,
  crateRig,
  crateSlotCount,
  magazineCrateInner,
  magazineCrateOuter,
} from '../experience/layout';
import { sceneApi } from '../experience/sceneApi';
import { getCrateWoodTexture } from '../lib/proceduralTextures';
import { setCrateSelected, useExperience } from '../state/store';
import { NewMagazineSlot } from './NewMagazineSlot';

function makeFrontWall(width: number, height: number, thickness: number) {
  const hw = width / 2;
  const cut = width * 0.34;
  const dip = height * 0.46;
  const r = Math.min(0.02, dip * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, height);
  s.lineTo(cut, height);
  s.lineTo(cut, height - dip + r);
  s.absarc(cut - r, height - dip + r, r, 0, -Math.PI / 2, true);
  s.lineTo(-cut + r, height - dip);
  s.absarc(-cut + r, height - dip + r, r, -Math.PI / 2, -Math.PI, true);
  s.lineTo(-cut, height);
  s.lineTo(-hw, height);
  s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 10,
  });
  geom.translate(0, 0, -thickness / 2);
  return geom;
}

function makeSideWall(
  depth: number,
  frontH: number,
  backH: number,
  thickness: number,
) {
  const zf = -depth / 2;
  const zb = depth / 2;
  const s = new THREE.Shape();
  s.moveTo(zb, 0);
  s.lineTo(zf, 0);
  s.lineTo(zf, frontH);
  s.bezierCurveTo(zf * 0.25, frontH + 0.006, zb * 0.2, backH, zb, backH);
  s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geom.rotateY(Math.PI / 2);
  geom.translate(0, 0, 0);
  geom.translate(thickness / 2, 0, 0);
  return geom;
}

const STAMP_W = 512;
const STAMP_H = 160;
const STAMP_INK = 384;

function makeStamp(viewerName: string | null, fontsReady: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = STAMP_W;
  canvas.height = STAMP_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f0e6d2';
    ctx.fillRect(0, 0, STAMP_W, STAMP_H);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(90,60,30,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * STAMP_W, Math.random() * STAMP_H, 2, 1);
    }
    ctx.fillStyle = '#16120e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.16em';
    const text = viewerName ? `FOR ${viewerName.toUpperCase()}` : 'MEMORIES';
    // Long names would run off the brass plate, so pull the size back until
    // the whole line fits inside the engraved area.
    // Typed in the same face as the tape labels, so the plate reads as part of the set.
    const typeface = fontsReady
      ? '"Special Elite", "Courier New", monospace'
      : '"Courier New", monospace';
    let size = 72;
    do {
      ctx.font = `400 ${size}px ${typeface}`;
      if (ctx.measureText(text).width <= STAMP_INK) break;
      size -= 2;
    } while (size > 26);
    ctx.fillText(text, STAMP_W / 2, 84);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Wood({
  map,
  color,
}: {
  map: THREE.Texture;
  color: string;
}) {
  return (
    <meshStandardMaterial
      map={map}
      color={color}
      roughness={0.64}
      metalness={0.06}
    />
  );
}

export function CartridgeCrate() {
  const capacity = useExperience((s) => s.capacity);
  const filled = useExperience((s) => s.collectionIds.length);
  const viewerName = useExperience((s) => s.viewerName);
  const count = crateSlotCount(capacity, filled);
  const root = useRef<THREE.Group>(null);

  const wood = useMemo(() => getCrateWoodTexture(), []);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    // Ask for the face by name: the plate can draw before any DOM text has
    // pulled Special Elite in, and fonts.ready alone would resolve without it.
    void document.fonts.load('72px "Special Elite"').then(() => setFontsReady(true));
  }, []);
  const stamp = useMemo(() => makeStamp(viewerName, fontsReady), [viewerName, fontsReady]);
  const inner = magazineCrateInner(count);
  const outer = magazineCrateOuter(count);
  const w = outer.w;
  const d = outer.d;
  const t = CRATE.wall;
  const frontH = CRATE.frontHeight;
  const backH = CRATE.backHeight;

  const frontGeom = useMemo(() => makeFrontWall(w, frontH, t), [w, frontH, t]);
  const sideGeom = useMemo(
    () => makeSideWall(d, frontH + 0.008, backH, t),
    [d, frontH, backH, t],
  );
  useLayoutEffect(
    () => () => {
      frontGeom.dispose();
      sideGeom.dispose();
    },
    [frontGeom, sideGeom],
  );
  useLayoutEffect(() => () => stamp.dispose(), [stamp]);

  useLayoutEffect(() => {
    sceneApi.crate = root.current;
    return () => {
      if (sceneApi.crate === root.current) sceneApi.crate = null;
    };
  }, []);

  // The rig is tweened outside React while curating, so read it every frame.
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    g.position.set(crateRig.x, crateRig.y, crateRig.z);
    g.rotation.y = crateRig.ry;
  }, -3);

  const tooth = 0.011;
  const corners: [number, number][] = [
    [-w / 2, d / 2],
    [w / 2, d / 2],
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
  ];

  const plateW = 0.078;
  const plateH = 0.024;

  return (
    <group
      ref={root}
      position={[crateRig.x, crateRig.y, crateRig.z]}
      rotation={[0, crateRig.ry, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        setCrateSelected(null);
      }}
    >
      <mesh position={[0, CRATE.floor / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, CRATE.floor, d]} />
        <Wood map={wood} color="#c4a078" />
      </mesh>
      <mesh position={[0, CRATE.floor + 0.0004, 0]} receiveShadow>
        <boxGeometry args={[inner.x, 0.0008, inner.z]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} />
      </mesh>

      <mesh
        geometry={frontGeom}
        position={[0, 0, d / 2 - t / 2]}
        castShadow
        receiveShadow
      >
        <Wood map={wood} color="#d4b08a" />
      </mesh>
      <mesh position={[0, backH / 2, -d / 2 + t / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, backH, t]} />
        <Wood map={wood} color="#a87850" />
      </mesh>
      <mesh
        geometry={sideGeom}
        position={[-w / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <Wood map={wood} color="#b88858" />
      </mesh>
      <mesh
        geometry={sideGeom}
        position={[w / 2 - t, 0, 0]}
        castShadow
        receiveShadow
      >
        <Wood map={wood} color="#b88858" />
      </mesh>

      {corners.flatMap(([cx, cz], ci) => {
        const isFront = cz > 0;
        const n = Math.floor((isFront ? frontH : backH) / tooth);
        return Array.from({ length: n }, (_, i) => {
          const y = tooth * (i + 0.5);
          const alongFront = i % 2 === 0;
          const isLeft = cx < 0;
          const sx = alongFront ? t + 0.001 : 0.007;
          const sz = alongFront ? 0.007 : t + 0.001;
          const ox = isLeft ? (alongFront ? t * 0.15 : 0) : alongFront ? -t * 0.15 : 0;
          const oz = isFront ? (alongFront ? 0 : -t * 0.15) : alongFront ? 0 : t * 0.15;
          return (
            <mesh
              key={`${ci}-${i}`}
              position={[cx + ox, y, cz + oz]}
              castShadow
            >
              <boxGeometry args={[sx, tooth * 0.92, sz]} />
              <Wood map={wood} color={i % 2 ? '#a07048' : '#c09060'} />
            </mesh>
          );
        });
      })}

      <group position={[0, frontH * 0.42, d / 2 + 0.0006]}>
        <mesh>
          <planeGeometry args={[plateW, plateH]} />
          <meshStandardMaterial
            color="#c4a05a"
            metalness={0.72}
            roughness={0.32}
          />
        </mesh>
        <mesh position={[0, 0, 0.00015]}>
          <planeGeometry args={[plateW - 0.006, plateH - 0.006]} />
          <meshStandardMaterial
            color="#8a6a38"
            metalness={0.55}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0, 0.00035]}>
          <planeGeometry args={[plateW - 0.012, plateH - 0.01]} />
          <meshStandardMaterial map={stamp} roughness={0.88} />
        </mesh>
        {(
          [
            [-plateW / 2 + 0.004, plateH / 2 - 0.0035],
            [plateW / 2 - 0.004, plateH / 2 - 0.0035],
            [-plateW / 2 + 0.004, -plateH / 2 + 0.0035],
            [plateW / 2 - 0.004, -plateH / 2 + 0.0035],
          ] as [number, number][]
        ).map(([x, y]) => (
          <mesh key={`${x}:${y}`} position={[x, y, 0.0005]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0011, 0.0011, 0.0014, 8]} />
            <meshStandardMaterial
              color="#d4b878"
              metalness={0.8}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>
      <NewMagazineSlot />
    </group>
  );
}

import { useFrame } from '@react-three/fiber';
import { type ReactNode, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { MeshStandardMaterial } from 'three';
import { WALL_Z } from '../experience/layout';
import { visuals } from '../experience/visuals';
import { setCrateSelected } from '../state/store';
import { Bed } from './Bed';
import { Carpet } from './Carpet';
import { CeilingLight } from './CeilingLight';
import { Door, DoorVoid } from './Door';
import { DOOR } from './doorDims';
import { PlushUnicorn } from './PlushUnicorn';
import {
  ROOM_D,
  ROOM_FRONT_Z,
  ROOM_H,
  ROOM_HALF_W,
  ROOM_MID_Z,
  ROOM_W,
} from './roomDims';
import { Table } from './Table';
import { WindowCurtains } from './WindowCurtains';
import { WINDOW_H, WINDOW_W } from './windowDims';

const WALLPAPER_TILE = 1.5;

function makeWallpaper(width: number, height: number): THREE.Texture {
  const tex = new THREE.TextureLoader().load('/wallpaper.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Square tiles: rounding either axis to a whole number would stretch the
  // pattern and make it disagree with the neighbouring wall at the corner.
  tex.repeat.set(width / WALLPAPER_TILE, height / WALLPAPER_TILE);
  tex.anisotropy = 8;
  return tex;
}

/** Width of one ceiling mural tile in metres; height follows the image aspect. */
const CEILING_TILE = 4.4;

function makeCeilingPaper(width: number, depth: number): THREE.Texture {
  const tex = new THREE.TextureLoader().load('/ceiling.jpg', (loaded) => {
    const image = loaded.image as { width: number; height: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    loaded.repeat.set(width / CEILING_TILE, depth / (CEILING_TILE / aspect));
    loaded.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function Room() {
  const ceilingPaper = useMemo(() => makeCeilingPaper(ROOM_W, ROOM_D), []);
  const backPaper = useMemo(() => makeWallpaper(ROOM_W, ROOM_H), []);
  const frontPaper = useMemo(() => makeWallpaper(ROOM_W, ROOM_H), []);
  const sidePaper = useMemo(() => makeWallpaper(ROOM_D, ROOM_H), []);

  return (
    <group
      onPointerDown={(event) => {
        event.stopPropagation();
        setCrateSelected(null);
      }}
    >
      <Carpet />

      <Ceiling map={ceilingPaper} />
      <CeilingLight />

      <BackWall map={backPaper} />

      <mesh
        position={[-ROOM_HALF_W, ROOM_H / 2, ROOM_MID_Z]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={sidePaper} roughness={0.94} color="#ffffff" />
      </mesh>

      <mesh
        position={[ROOM_HALF_W, ROOM_H / 2, ROOM_MID_Z]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={sidePaper} roughness={0.94} color="#f6f6f6" />
      </mesh>

      {/* Faces into the room, so it only shows when orbiting past the back wall. */}
      <mesh position={[0, ROOM_H / 2, ROOM_FRONT_Z]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial map={frontPaper} roughness={0.94} color="#f2f2f2" />
      </mesh>

      <WithWall axis="z" side={1} at={WALL_Z}>
        <Outlet />
        <Suspense fallback={null}>
          <Door />
        </Suspense>
        <DoorVoid />
      </WithWall>

      <WithWall axis="x" side={1} at={-ROOM_HALF_W}>
        <WindowPane />
        <Suspense fallback={null}>
          <WindowCurtains />
        </Suspense>
      </WithWall>

      <Table />
      <Bed />
      <Suspense fallback={null}>
        <PlushUnicorn />
      </Suspense>
    </group>
  );
}

/** Crops the photo to the pane's aspect instead of stretching it. */
function coverFit(tex: THREE.Texture, aspect: number): void {
  const image = tex.image as { width: number; height: number } | undefined;
  if (!image?.width || !image?.height) return;
  const source = image.width / image.height;
  if (source > aspect) {
    tex.repeat.set(aspect / source, 1);
  } else {
    tex.repeat.set(1, source / aspect);
  }
  tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
  tex.needsUpdate = true;
}

/**
 * Back wall with a doorway cut so the opening reads as a void.
 */
function BackWall({ map }: { map: THREE.Texture }) {
  const geometry = useMemo(() => {
    const hw = ROOM_HALF_W;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, ROOM_H);
    shape.lineTo(-hw, ROOM_H);
    shape.closePath();

    const x0 = DOOR.x - DOOR.holeW / 2;
    const x1 = DOOR.x + DOOR.holeW / 2;
    const hole = new THREE.Path();
    hole.moveTo(x0, 0);
    hole.lineTo(x0, DOOR.holeH);
    hole.lineTo(x1, DOOR.holeH);
    hole.lineTo(x1, 0);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    geo.computeVertexNormals();
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + hw) / ROOM_W, pos.getY(i) / ROOM_H);
    }
    uv.needsUpdate = true;
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0, WALL_Z]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.94} color="#ffffff" side={THREE.FrontSide} />
    </mesh>
  );
}

/**
 * The ceiling faces down, so the hemisphere light hands it the dark ground
 * tone and the panel misses it. A faint emissive keeps the mural readable
 * without flattening the overhead pool.
 */
function Ceiling({ map }: { map: THREE.Texture }) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = visuals.roomLight * 0.012;
  });
  return (
    <mesh
      position={[0, ROOM_H, ROOM_MID_Z]}
      rotation={[Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[ROOM_W, ROOM_D]} />
      <meshStandardMaterial
        ref={mat}
        map={map}
        emissiveMap={map}
        emissive="#ffffff"
        emissiveIntensity={0}
        roughness={1}
        color="#ffffff"
      />
    </mesh>
  );
}

/**
 * Wall planes are single sided, so they vanish when the camera moves outside
 * the room. Anything mounted on a wall has to disappear with it, otherwise
 * trim and window frames hang in mid air in the orbit view.
 */
function WithWall({
  axis,
  side,
  at,
  children,
}: {
  axis: 'x' | 'z';
  /** Which side of the plane the wall's visible face points toward. */
  side: 1 | -1;
  at: number;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const pos = axis === 'x' ? camera.position.x : camera.position.z;
    group.current.visible = (pos - at) * side > 0;
  });
  return <group ref={group}>{children}</group>;
}

function WindowPane() {
  const view = useMemo(() => {
    const tex = new THREE.TextureLoader().load('/window.jpg', (loaded) =>
      coverFit(loaded, WINDOW_W / WINDOW_H),
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);

  return (
    <group position={[-ROOM_HALF_W + 0.02, ROOM_H / 2, ROOM_MID_Z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[WINDOW_W, WINDOW_H]} />
        <meshBasicMaterial map={view} />
      </mesh>
      <WindowFrame />
    </group>
  );
}

function WindowFrame() {
  const bar = 0.045;
  const depth = 0.05;
  const half = { w: WINDOW_W / 2, h: WINDOW_H / 2 };
  const parts: Array<[number, number, number, number]> = [
    [0, half.h, WINDOW_W + bar, bar],
    [0, -half.h, WINDOW_W + bar, bar],
    [-half.w, 0, bar, WINDOW_H + bar],
    [half.w, 0, bar, WINDOW_H + bar],
    [0, 0, bar * 0.6, WINDOW_H],
    [0, 0, WINDOW_W, bar * 0.6],
  ];
  return (
    <group position={[0, 0, 0.012]}>
      {parts.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[w, h, depth]} />
          <meshStandardMaterial color="#e6ded0" roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Outlet() {
  return (
    <group position={[1.98, 0.38, WALL_Z + 0.02]}>
      <mesh>
        <boxGeometry args={[0.07, 0.11, 0.012]} />
        <meshStandardMaterial color="#c4b8a8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.018, 0.008]}>
        <boxGeometry args={[0.018, 0.012, 0.004]} />
        <meshStandardMaterial color="#6a645c" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.018, 0.008]}>
        <boxGeometry args={[0.018, 0.012, 0.004]} />
        <meshStandardMaterial color="#6a645c" roughness={0.5} />
      </mesh>
    </group>
  );
}

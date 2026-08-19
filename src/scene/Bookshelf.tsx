import { useCursor, useGLTF } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { canEnterCuration, enterCuration } from '../experience/curation';
import { CRATE_MAGAZINE } from '../experience/layout';
import {
  SHELF_FRONT_INSET,
  SHELF_INNER_W,
  SHELF_LEVELS,
  SHELF_LIBRARY_LEVELS,
  SHELF_MODEL,
  SHELF_MODEL_Z,
  SHELF_NEIGHBOUR_GAP,
  SHELF_PLANK_Z,
  SHELF_POS,
  SHELF_ROT_Y,
  SHELF_ROW_MARGIN,
  SHELF_SCALE,
} from './shelfDims';

useGLTF.preload(SHELF_MODEL.url);

/** Painted to match the bed frame; the model ships in dark varnished wood. */
const PAINT = new THREE.Color('#e9e3d9');

/** Moulded shell of a magazine, and the paper stuck to its spine. */
const SHELL_TONES = ['#1a1917', '#232019', '#2f2a24', '#3b342c', '#141312'];
const LABEL_TONES = [
  '#e7dbc6',
  '#d8c7a2',
  '#c6b393',
  '#cdb9a8',
  '#bcc0ad',
  '#c2b6c8',
  '#d6b98f',
];

const RUN_GAP = { min: 0.017, max: 0.046 };
/** Ceiling on how far the last magazine of a run flops into the gap. */
const MAX_LEAN = 0.19;

type MagazineSlot = {
  x: number;
  y: number;
  z: number;
  ry: number;
  rz: number;
  shell: number;
  label: number;
};

/** Same shelf on every load: this is noise, not randomness. */
function makeNoise(seed: number): () => number {
  let step = seed;
  return () => {
    step += 1;
    const v = Math.sin(step * 127.1 + seed * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
}

/**
 * Fills each plank with runs of magazines in one livery, broken by gaps and
 * the odd pile laid on its side. Rows trail off before the right-hand panel so
 * the shelf reads as a collection in progress, not a wall of product.
 *
 * The planks in `SHELF_LIBRARY_LEVELS` are left empty: those hold the real
 * magazines, and dressing behind them would fill in the gaps curating leaves.
 */
function buildRows(): MagazineSlot[] {
  const noise = makeNoise(11);
  const { thickness, height, depth } = CRATE_MAGAZINE;
  const pitch = thickness + SHELF_NEIGHBOUR_GAP;
  const z = SHELF_PLANK_Z.front + SHELF_FRONT_INSET + depth / 2;
  const slots: MagazineSlot[] = [];
  const library = new Set<number>(SHELF_LIBRARY_LEVELS);

  for (const [levelIndex, level] of SHELF_LEVELS.entries()) {
    if (library.has(levelIndex)) continue;
    const from = -SHELF_INNER_W / 2 + SHELF_ROW_MARGIN;
    const to = SHELF_INNER_W / 2 - SHELF_ROW_MARGIN;
    const filled = from + (to - from) * (0.55 + noise() * 0.45);
    let x = from;

    while (x < filled) {
      const shell = Math.floor(noise() * SHELL_TONES.length);
      const label = Math.floor(noise() * LABEL_TONES.length);
      const gap = RUN_GAP.min + noise() * (RUN_GAP.max - RUN_GAP.min);

      if (noise() < 0.22 && x + height < filled) {
        const count = 2 + Math.floor(noise() * 3);
        for (let i = 0; i < count; i++) {
          slots.push({
            x: x + height / 2 + (noise() - 0.5) * 0.007,
            y: level + thickness * (i + 0.5),
            z: z + (noise() - 0.5) * 0.009,
            ry: (noise() - 0.5) * 0.06,
            rz: Math.PI / 2,
            shell,
            label,
          });
        }
        x += height + gap;
        continue;
      }

      const count = 3 + Math.floor(noise() * 6);
      // Only the magazine at the open end of a run can lean, and only as far
      // as the gap beside it leaves room for.
      const lean = noise() < 0.5 ? Math.min(MAX_LEAN, (gap * 0.7) / height) : 0;
      for (let i = 0; i < count && x + pitch < to; i++) {
        const tilt = i === count - 1 ? lean : 0;
        slots.push({
          x: x + thickness / 2 + (height / 2) * Math.sin(tilt),
          // Tilted about its own centre, so the low corner has to be lifted
          // back onto the plank.
          y: level + (height / 2) * Math.cos(tilt) + (thickness / 2) * Math.sin(tilt),
          z,
          ry: (noise() - 0.5) * 0.02,
          rz: -tilt,
          shell,
          label,
        });
        x += pitch;
      }
      x += gap;
    }
  }

  return slots;
}

/**
 * Dressing, not collections: a hundred real magazines would each want a canvas
 * label and a slide instance, so these are two instanced meshes wearing the
 * crate magazine's silhouette.
 */
function ShelvedMagazines() {
  const slots = useMemo(buildRows, []);
  const shells = useRef<THREE.InstancedMesh>(null);
  const labels = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const { thickness, height, depth } = CRATE_MAGAZINE;
    return {
      shell: new THREE.BoxGeometry(thickness, height, depth),
      label: new THREE.PlaneGeometry(thickness * 0.74, height * 0.46),
    };
  }, []);

  useEffect(
    () => () => {
      geometry.shell.dispose();
      geometry.label.dispose();
    },
    [geometry],
  );

  useLayoutEffect(() => {
    const shell = shells.current;
    const label = labels.current;
    if (!shell || !label) return;

    const body = new THREE.Object3D();
    const print = new THREE.Object3D();
    print.position.set(0, CRATE_MAGAZINE.height * 0.06, -CRATE_MAGAZINE.depth / 2 - 0.0006);
    print.rotation.y = Math.PI;
    print.updateMatrix();
    const matrix = new THREE.Matrix4();
    const tone = new THREE.Color();

    slots.forEach((slot, i) => {
      body.position.set(slot.x, slot.y, slot.z);
      body.rotation.set(0, slot.ry, slot.rz);
      body.updateMatrix();
      shell.setMatrixAt(i, body.matrix);
      label.setMatrixAt(i, matrix.multiplyMatrices(body.matrix, print.matrix));
      shell.setColorAt(i, tone.set(SHELL_TONES[slot.shell]));
      label.setColorAt(i, tone.set(LABEL_TONES[slot.label]));
    });

    shell.instanceMatrix.needsUpdate = true;
    label.instanceMatrix.needsUpdate = true;
    if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
    if (label.instanceColor) label.instanceColor.needsUpdate = true;
    shell.computeBoundingSphere();
    label.computeBoundingSphere();
  }, [slots]);

  return (
    <>
      <instancedMesh
        ref={shells}
        args={[geometry.shell, undefined, slots.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#ffffff" roughness={0.8} metalness={0.08} />
      </instancedMesh>
      <instancedMesh ref={labels} args={[geometry.label, undefined, slots.length]}>
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.9}
          metalness={0}
          emissive="#ffffff"
          emissiveIntensity={0.04}
        />
      </instancedMesh>
    </>
  );
}

export function Bookshelf() {
  const { scene } = useGLTF(SHELF_MODEL.url);
  const model = useMemo(() => scene.clone(true), [scene]);
  const [hover, setHover] = useState(false);
  const inviting = hover && canEnterCuration();
  useCursor(inviting, 'pointer');

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const painted = materials.map((mat) => {
        if (!mat || !('color' in mat)) return mat;
        const std = (mat as THREE.MeshStandardMaterial).clone();
        std.color.copy(PAINT);
        // The normal map stays so the grain still catches the light. The colour
        // and gloss maps are the varnish, and paint covers both.
        std.map = null;
        std.roughnessMap = null;
        std.metalnessMap = null;
        std.roughness = 0.62;
        std.metalness = 0;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? painted : painted[0];
    });
  }, [model]);

  return (
    <group
      position={[SHELF_POS.x, SHELF_POS.y, SHELF_POS.z]}
      rotation={[0, SHELF_ROT_Y, 0]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHover(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHover(false);
      }}
      onClick={(event) => {
        event.stopPropagation();
        void enterCuration();
      }}
    >
      <group position={[0, 0, SHELF_MODEL_Z]} scale={SHELF_SCALE}>
        <primitive object={model} />
      </group>
      <ShelvedMagazines />
    </group>
  );
}

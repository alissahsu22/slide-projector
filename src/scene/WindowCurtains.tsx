import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_H, ROOM_HALF_W, ROOM_MID_Z } from './roomDims';
import { WINDOW_H, WINDOW_W } from './windowDims';

const CURTAIN_URL = '/models/curtains.glb';
/** Rod a little wider than the pane so the panels cover the frame. */
const WIDTH_EXTRA = 0.35;
/** How far the rod sits above the top of the glass. */
const ROD_ABOVE = 0.1;
/** How far the hem hangs past the sill. */
const SILL_OVERHANG = 0.08;
/** Gap from the wall plane to the back of the curtains; must clear the window frame. */
const FROM_WALL = 0.06;
/** Flattens the folds so the panels hug the wall instead of bulging into the room. */
const DEPTH_SQUASH = 0.45;
const FABRIC_PINK = new THREE.Color('#e8a8bc');

useGLTF.preload(CURTAIN_URL);

export function WindowCurtains() {
  const { scene } = useGLTF(CURTAIN_URL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const fabric = /fabric/i.test(mesh.name);
      for (const mat of materials) {
        if (!mat || !('roughness' in mat)) continue;
        const std = mat as THREE.MeshStandardMaterial;
        std.roughness = Math.max(0.88, std.roughness);
        std.metalness = 0;
        if (fabric && 'color' in std) std.color.copy(FABRIC_PINK);
      }
    });
  }, [model]);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;

    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(1);
    model.position.set(0, 0, 0);
    group.updateMatrixWorld(true);

    const raw = new THREE.Box3().setFromObject(model);
    const size = raw.getSize(new THREE.Vector3());
    const sx = (WINDOW_W + WIDTH_EXTRA) / (size.x || 1);
    const sy = (WINDOW_H + ROD_ABOVE + SILL_OVERHANG) / (size.y || 1);
    group.scale.set(sx, sy, sx * DEPTH_SQUASH);
    // Same yaw as the window: fabric faces into the room, rod along the wall.
    group.rotation.y = Math.PI / 2;

    group.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(group);
    group.position.set(
      -ROOM_HALF_W + FROM_WALL - fitted.min.x,
      ROOM_H / 2 + WINDOW_H / 2 + ROD_ABOVE - fitted.max.y,
      ROOM_MID_Z - (fitted.min.z + fitted.max.z) / 2,
    );
  }, [model]);

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

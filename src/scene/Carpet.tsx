import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_D, ROOM_HALF_W, ROOM_MID_Z, ROOM_W } from './roomDims';
import { publicUrl } from '../lib/publicUrl';

const CARPET_URL = publicUrl('models/carpet.glb');
/** Olive moss sampled from the reference — lifted a little so the grey pile doesn't crush. */
const CARPET_GREEN = new THREE.Color('#5c6828');

useGLTF.preload(CARPET_URL);

export function Carpet() {
  const { scene } = useGLTF(CARPET_URL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = materials.map((mat) => {
        if (!mat || !('color' in mat)) return mat;
        const std = (mat as THREE.MeshStandardMaterial).clone();
        std.color.copy(CARPET_GREEN);
        std.roughness = 0.97;
        std.metalness = 0;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
  }, [model]);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;

    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.rotation.set(0, 0, 0);
    model.position.set(0, 0, 0);
    group.updateMatrixWorld(true);

    const raw = new THREE.Box3().setFromObject(model);
    const size = raw.getSize(new THREE.Vector3());
    const sx = size.x || 1;
    const sz = size.z || 1;
    group.scale.set(ROOM_W / sx, 1, ROOM_D / sz);

    group.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(group);
    group.position.set(
      -ROOM_HALF_W - fitted.min.x,
      -fitted.min.y,
      ROOM_MID_Z - (fitted.min.z + fitted.max.z) / 2,
    );
  }, [model]);

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

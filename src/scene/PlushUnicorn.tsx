import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { publicUrl } from '../lib/publicUrl';

const PLUSH_URL = publicUrl('models/plush_unicorn.glb');
/** Sitting height in metres — a chunky floor toy, not a life-size horse. */
const PLUSH_HEIGHT = 0.5;
/** On the carpet, just right of the table, facing back into the room. y is lift off the floor. */
const PLUSH_POS = { x: 1.92, y: -0.05, z: -2.85 };
const PLUSH_ROT = { x:-1.4, y: Math.PI * 1.0, z: 0.8 };

useGLTF.preload(PLUSH_URL);

export function PlushUnicorn() {
  const { scene } = useGLTF(PLUSH_URL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if (!mat || !('roughness' in mat)) continue;
        const std = mat as THREE.MeshStandardMaterial;
        std.roughness = Math.max(0.82, std.roughness);
        std.metalness = 0;
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
    const scale = PLUSH_HEIGHT / (size.y || 1);
    group.scale.setScalar(scale);
    group.rotation.set(PLUSH_ROT.x, PLUSH_ROT.y, PLUSH_ROT.z);

    group.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(group);
    group.position.set(
      PLUSH_POS.x - (fitted.min.x + fitted.max.x) / 2,
      -fitted.min.y + PLUSH_POS.y,
      PLUSH_POS.z - (fitted.min.z + fitted.max.z) / 2,
    );
  }, [model]);

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

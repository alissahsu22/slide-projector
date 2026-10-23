import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DOOR } from './doorDims';

useGLTF.preload(DOOR.url);

export function Door() {
  const { scene } = useGLTF(DOOR.url);
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
        std.roughness = Math.max(0.62, std.roughness);
        std.metalness = Math.min(0.12, std.metalness);
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
    group.scale.setScalar(DOOR.height / (size.y || 1));

    group.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(group);
    // Most of the model's depth sits in +Z, so the frame is near min.z.
    // Tuck that face into the wall; the open leaf swings into the room.
    group.position.set(
      DOOR.x - (fitted.min.x + fitted.max.x) / 2,
      -fitted.min.y,
      DOOR.z - fitted.min.z - 0.012,
    );
  }, [model]);

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

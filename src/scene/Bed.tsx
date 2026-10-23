import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WALL_Z } from '../experience/layout';
import { ROOM_HALF_W } from './roomDims';
import { publicUrl } from '../lib/publicUrl';

const BED_URL = publicUrl('models/bed.glb');
/** Long side of the bed in world metres; the model is fitted to this. */
const BED_LENGTH = 2.55;
/** Gap kept between the bed and the walls it backs onto. */
const WALL_GAP = 0.06;
/** Painted-white frame; bedding meshes (`beizi`) keep their own materials. */
const FRAME_WHITE = new THREE.Color('#f5f2ee');

useGLTF.preload(BED_URL);

export function Bed() {
  const { scene } = useGLTF(BED_URL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const bedding = materials.some((mat) => mat && /beizi/i.test(mat.name));
      if (bedding) return;
      const next = materials.map((mat) => {
        if (!mat || !('color' in mat)) return mat;
        const std = (mat as THREE.MeshStandardMaterial).clone();
        std.color.copy(FRAME_WHITE);
        std.map = null;
        std.roughness = 0.52;
        std.metalness = 0.02;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
  }, [model]);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;

    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    model.position.set(0, 0, 0);
    group.updateMatrixWorld(true);

    const raw = new THREE.Box3().setFromObject(model);
    const size = raw.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z) || 1;
    const scale = BED_LENGTH / longest;
    group.scale.setScalar(scale);
    // Run the bed's long side along z so the head ends up against the back wall.
    group.rotation.y = size.x > size.z ? Math.PI / 2 : 0;

    // Re-measure after scaling, then seat the bed on the floor and tuck its
    // bounding box into the back-left corner.
    group.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(group);
    group.position.set(
      -ROOM_HALF_W + WALL_GAP - fitted.min.x,
      -fitted.min.y,
      WALL_Z + WALL_GAP - fitted.min.z,
    );
  }, [model]);

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

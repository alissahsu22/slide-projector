import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { LENS, SCREEN } from '../experience/layout';
import { beamLevel } from '../experience/visuals';

const up = new THREE.Vector3(0, 1, 0);
const start = new THREE.Vector3();
const end = new THREE.Vector3();
const dir = new THREE.Vector3();
const mid = new THREE.Vector3();
const quat = new THREE.Quaternion();

export function ProjectionBeam() {
  const group = useRef<THREE.Group>(null);
  const outer = useRef<THREE.MeshBasicMaterial>(null);
  const inner = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const opacity = Math.max(0, beamLevel());
    if (outer.current) {
      outer.current.opacity = 0.22 * opacity;
      outer.current.visible = opacity > 0.04;
    }
    if (inner.current) {
      inner.current.opacity = 0.16 * opacity;
      inner.current.visible = opacity > 0.04;
    }

    const g = group.current;
    if (!g) return;
    start.set(LENS.x, LENS.y, LENS.z);
    end.set(SCREEN.x, SCREEN.y, SCREEN.z);
    dir.copy(end).sub(start);
    const length = Math.max(dir.length(), 0.001);
    mid.copy(start).lerp(end, 0.5);
    quat.setFromUnitVectors(up, dir.normalize());
    g.position.copy(mid);
    g.quaternion.copy(quat);
    g.scale.set(1, length, 1);
  });

  return (
    <group ref={group}>
      <mesh>
        <cylinderGeometry args={[1.7, 0.028, 1, 32, 1, true]} />
        <meshBasicMaterial
          ref={outer}
          color="#ffd9a0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[1.15, 0.016, 1, 32, 1, true]} />
        <meshBasicMaterial
          ref={inner}
          color="#fff1cc"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

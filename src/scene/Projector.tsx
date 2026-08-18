import { Clone, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  DEBUG_INSERTION_POINT,
  PROJECTOR_INSERTION_LOCAL,
  PROJECTOR_LENS_LOCAL,
  PROJECTOR_MODEL,
  PROJECTOR_POS,
} from '../experience/layout';
import { sceneApi } from '../experience/sceneApi';
import { visuals } from '../experience/visuals';

useGLTF.preload(PROJECTOR_MODEL.url);

export function Projector() {
  const { scene } = useGLTF(PROJECTOR_MODEL.url);
  const root = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.Mesh>(null);
  const lens = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const led = useRef<THREE.Mesh>(null);
  const insertionPoint = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if ('envMapIntensity' in mat) {
          (mat as THREE.MeshStandardMaterial).envMapIntensity = 0.22;
        }
        if ('roughness' in mat) {
          const std = mat as THREE.MeshStandardMaterial;
          std.roughness = Math.min(1, Math.max(0.55, std.roughness || 0.72));
          if (!std.userData.darkened && 'color' in std) {
            std.color.lerp(new THREE.Color('#161310'), 0.28);
            std.userData.darkened = true;
          }
        }
      }
    });
  }, [scene]);

  useLayoutEffect(() => {
    sceneApi.projector = root.current;
    sceneApi.lever = lever.current;
    sceneApi.lamp = lamp.current;
    sceneApi.lens = lens.current;
    sceneApi.insertionPoint = insertionPoint.current;
    return () => {
      if (sceneApi.projector === root.current) sceneApi.projector = null;
      if (sceneApi.lever === lever.current) sceneApi.lever = null;
      if (sceneApi.lamp === lamp.current) sceneApi.lamp = null;
      if (sceneApi.lens === lens.current) sceneApi.lens = null;
      if (sceneApi.insertionPoint === insertionPoint.current) {
        sceneApi.insertionPoint = null;
      }
    };
  }, []);

  useFrame(() => {
    const lampMat = lamp.current?.material as THREE.MeshStandardMaterial | undefined;
    const lensMat = lens.current?.material as THREE.MeshBasicMaterial | undefined;
    const haloMat = halo.current?.material as THREE.MeshBasicMaterial | undefined;
    const ledMat = led.current?.material as THREE.MeshStandardMaterial | undefined;
    const glow = visuals.lamp * visuals.flicker;
    if (lampMat) lampMat.emissiveIntensity = 0.08 + glow * 4.2;
    if (lensMat) lensMat.opacity = 0.02 + glow * 0.82;
    if (haloMat) haloMat.opacity = glow * 0.18;
    if (ledMat) ledMat.emissiveIntensity = 0.35 + glow * 1.8;
  });

  const s = PROJECTOR_MODEL.scale;

  return (
    <group ref={root} position={[PROJECTOR_POS.x, PROJECTOR_POS.y, PROJECTOR_POS.z]}>
      <group
        rotation={[0, PROJECTOR_MODEL.rotationY, 0]}
        scale={s}
        position={[0, -PROJECTOR_MODEL.minY * s, 0]}
      >
        <Clone object={scene} />
      </group>

      <mesh
        ref={lens}
        position={[PROJECTOR_LENS_LOCAL.x, PROJECTOR_LENS_LOCAL.y, PROJECTOR_LENS_LOCAL.z]}
        rotation={[0, Math.PI, 0]}
      >
        <circleGeometry args={[0.032, 24]} />
        <meshBasicMaterial
          color="#ffd890"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={halo}
        position={[PROJECTOR_LENS_LOCAL.x, PROJECTOR_LENS_LOCAL.y, PROJECTOR_LENS_LOCAL.z - 0.004]}
        rotation={[0, Math.PI, 0]}
      >
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial
          color="#ffb45a"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={led}
        position={[
          PROJECTOR_LENS_LOCAL.x + 0.055,
          PROJECTOR_LENS_LOCAL.y - 0.042,
          PROJECTOR_LENS_LOCAL.z + 0.018,
        ]}
      >
        <sphereGeometry args={[0.006, 10, 10]} />
        <meshStandardMaterial
          color="#ff1a12"
          emissive="#ff1a12"
          emissiveIntensity={0.35}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={lamp}
        position={[
          PROJECTOR_LENS_LOCAL.x,
          PROJECTOR_LENS_LOCAL.y,
          PROJECTOR_LENS_LOCAL.z + 0.01,
        ]}
        visible={false}
      >
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color="#ffbf70"
          emissive="#ffbf70"
          emissiveIntensity={0.15}
          toneMapped={false}
        />
      </mesh>

      <group
        ref={insertionPoint}
        name="projectorInsertionPoint"
        position={[
          PROJECTOR_INSERTION_LOCAL.x,
          PROJECTOR_INSERTION_LOCAL.y,
          PROJECTOR_INSERTION_LOCAL.z,
        ]}
        rotation={[
          PROJECTOR_INSERTION_LOCAL.rx,
          PROJECTOR_INSERTION_LOCAL.ry,
          PROJECTOR_INSERTION_LOCAL.rz,
        ]}
      >
        {DEBUG_INSERTION_POINT && (
          <>
            <axesHelper args={[0.14]} />
            <mesh>
              <sphereGeometry args={[0.006, 12, 12]} />
              <meshBasicMaterial color="#39ff88" depthTest={false} />
            </mesh>
            <mesh position={[0.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.008, 0.028, 8]} />
              <meshBasicMaterial color="#ff4d4d" depthTest={false} />
            </mesh>
          </>
        )}
      </group>

      <group ref={lever} />
    </group>
  );
}

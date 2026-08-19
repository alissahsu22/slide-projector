import { SpotLight as VolumetricSpot } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { LENS, SCREEN } from '../experience/layout';
import { throwLevel, visuals } from '../experience/visuals';
import { getState } from '../state/store';

const LIVE = new Set(['PLAYING', 'PAUSED', 'CHANGING_SLIDE', 'REWINDING', 'INSERTING']);

export function ProjectorLamp() {
  const root = useRef<THREE.Group>(null);
  const target = useRef<THREE.Object3D>(null);

  useFrame(() => {
    const { insertedId, mode } = getState();
    const on =
      insertedId && LIVE.has(mode)
        ? visuals.lamp * Math.max(0.05, throwLevel())
        : 0;

    const light = root.current?.getObjectByProperty('isSpotLight', true) as
      | THREE.SpotLight
      | undefined;
    if (!light) return;

    // The volumetric cone is a fragment-heavy shader on a 128x64-segment
    // mesh; hiding the light entirely (rather than just fading opacity to 0)
    // drops it from the draw list and skips its shadow map, which matters
    // since the projector is off most of the time in catalog mode.
    light.visible = on > 0.0005;

    light.position.set(LENS.x, LENS.y, LENS.z);
    light.intensity = on * 22;

    const vol = light.children.find((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    const mat = vol?.material as THREE.ShaderMaterial | undefined;
    if (mat?.uniforms?.opacity) {
      mat.uniforms.opacity.value = on * 0.28;
    }

    if (target.current) {
      target.current.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
      light.target = target.current;
      light.target.updateMatrixWorld();
    }
  });

  return (
    <group ref={root}>
      <VolumetricSpot
        position={[LENS.x, LENS.y, LENS.z]}
        color="#f2ddc4"
        intensity={0}
        distance={7.2}
        angle={0.32}
        penumbra={0.8}
        decay={1.7}
        attenuation={5.4}
        anglePower={3.2}
        radiusTop={0.018}
        radiusBottom={1.62}
        opacity={0}
        volumetric
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.02}
      />
      <object3D ref={target} position={[SCREEN.x, SCREEN.y, SCREEN.z]} />
    </group>
  );
}

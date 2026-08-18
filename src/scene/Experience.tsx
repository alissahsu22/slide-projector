import { ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { CATALOG_CAM, TABLE_TOP } from '../experience/layout';
import { setCrateSelected } from '../state/store';
import { CameraController } from './CameraController';
import { CartridgeCrate } from './CartridgeCrate';
import { Cartridges } from './Cartridges';
import { LightingController } from './LightingController';
import { ProjectionScreen } from './ProjectionScreen';
import { Projector } from './Projector';
import { Room } from './Room';

export function Experience() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.6]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        powerPreference: 'high-performance',
      }}
      camera={{
        position: [CATALOG_CAM.px, CATALOG_CAM.py, CATALOG_CAM.pz],
        fov: CATALOG_CAM.fov,
        near: 0.05,
        far: 50,
      }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(CATALOG_CAM.tx, CATALOG_CAM.ty, CATALOG_CAM.tz);
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      onPointerMissed={() => setCrateSelected(null)}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 16, 32]} />
      <CameraController />
      <LightingController />
      <Room />
      <Suspense fallback={null}>
        <Projector />
        <Cartridges />
        <CartridgeCrate />
      </Suspense>
      <ProjectionScreen />
      <ContactShadows
        position={[0.25, TABLE_TOP + 0.001, 0.12]}
        opacity={0.34}
        scale={4.2}
        blur={3.4}
        far={0.8}
        resolution={256}
        color="#2a1608"
      />
    </Canvas>
  );
}

import { ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { exitCuration } from '../experience/curation';
import { dragReleasedRecently } from '../experience/drag';
import { CATALOG_CAM, fitPoseToAspect, TABLE_TOP } from '../experience/layout';
import { getState, setCrateSelected } from '../state/store';
import { CameraController } from './CameraController';
import { CartridgeCrate } from './CartridgeCrate';
import { Cartridges } from './Cartridges';
import { DragController } from './DragController';
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
      onCreated={({ camera, gl, size }) => {
        const pose = fitPoseToAspect(CATALOG_CAM, size.width / size.height);
        camera.position.set(pose.px, pose.py, pose.pz);
        camera.lookAt(pose.tx, pose.ty, pose.tz);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = pose.fov;
          camera.updateProjectionMatrix();
        }
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      onPointerMissed={() => {
        if (getState().mode === 'CURATING') {
          // A drop that lands on nothing is a cancelled drag, not a request to
          // put the crate back on the desk.
          if (!dragReleasedRecently()) void exitCuration();
          return;
        }
        setCrateSelected(null);
      }}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 16, 32]} />
      <CameraController />
      <DragController />
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
        resolution={128}
        smooth={false}
        color="#2a1608"
      />
    </Canvas>
  );
}

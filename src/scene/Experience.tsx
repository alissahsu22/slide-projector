import { ContactShadows } from '@react-three/drei';
import { Canvas, events as pointerEvents } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import * as THREE from 'three';
import { exitCuration } from '../experience/curation';
import { dragReleasedRecently } from '../experience/drag';
import { CATALOG_CAM, fitPoseToAspect, TABLE_TOP } from '../experience/layout';
import { getState, setCrateSelected } from '../state/store';
import { ExperienceFrame } from '../ui/SceneFallback';
import { canUseWebGL, markWebGLFailed } from '../ui/sceneStatus';
import { CameraController } from './CameraController';
import { CartridgeCrate } from './CartridgeCrate';
import { Cartridges } from './Cartridges';
import { DragController } from './DragController';
import { GuideAnchor, PlayAnchor } from './GuideAnchor';
import { LightingController } from './LightingController';
import { ProjectionScreen } from './ProjectionScreen';
import { Projector } from './Projector';
import { Room } from './Room';
import { VoidMist } from './VoidMist';

function isActionButton(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (o.userData?.action) return true;
  }
  return false;
}

/** PLAY / EDIT render on top of the room, so they also take the pointer first. */
function actionButtonsFirst(hits: THREE.Intersection[]): THREE.Intersection[] {
  const buttons = hits.filter((hit) => isActionButton(hit.object));
  if (!buttons.length) return hits;
  return [...buttons, ...hits.filter((hit) => !isActionButton(hit.object))];
}

export function Experience() {
  const [failed, setFailed] = useState(() => {
    const bad = !canUseWebGL();
    if (bad) markWebGLFailed();
    return bad;
  });

  return (
    <ExperienceFrame
      failed={failed}
      onFail={() => {
        markWebGLFailed();
        setFailed(true);
      }}
    >
    <Canvas
      shadows="soft"
      events={(store) => ({ ...pointerEvents(store), filter: actionButtonsFirst })}
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
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          markWebGLFailed();
          setFailed(true);
        });
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
      <color attach="background" args={['#0b0908']} />
      <fog attach="fog" args={['#0b0908', 16, 32]} />
      <CameraController />
      <GuideAnchor />
      <PlayAnchor />
      <DragController />
      <LightingController />
      <Room />
      <VoidMist />
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
    </ExperienceFrame>
  );
}

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitPoseToAspect, getCatalogCam, type CameraPose } from '../experience/layout';
import { sceneApi } from '../experience/sceneApi';
import { cameraFollow, cameraRig } from '../experience/visuals';
import { getState, useExperience } from '../state/store';

const FOLLOW = {
  ox: 0.12,
  oy: 0.07,
  oz: 0.14,
  posLag: 0.11,
  lookLag: 0.16,
};

const _followPos = new Vector3();

/** Pulled-back three-quarter so the full room fits in frame. */
const ORBIT_OVERVIEW: CameraPose = {
  px: 4.6,
  py: 2.95,
  pz: 5.8,
  tx: 0.15,
  ty: 1.15,
  tz: -0.7,
  fov: 55,
  minDolly: 0,
};

export function CameraController() {
  const { camera, size } = useThree();
  const lastFov = useRef(cameraRig.fov);
  const orbitInspect = useExperience((s) => s.orbitInspect);

  function applyPose(pose: CameraPose, aspect: number) {
    const fitted = fitPoseToAspect(pose, aspect);
    camera.position.set(fitted.px, fitted.py, fitted.pz);
    camera.lookAt(fitted.tx, fitted.ty, fitted.tz);
    if (camera instanceof PerspectiveCamera && Math.abs(fitted.fov - lastFov.current) > 0.01) {
      camera.fov = fitted.fov;
      camera.updateProjectionMatrix();
      lastFov.current = fitted.fov;
    }
  }

  useLayoutEffect(() => {
    const pose = getCatalogCam();
    Object.assign(cameraRig, pose);
    applyPose(pose, size.width / size.height);
  }, [camera]);

  useLayoutEffect(() => {
    if (!orbitInspect) return;
    applyPose(ORBIT_OVERVIEW, size.width / size.height);
  }, [orbitInspect, camera]);

  useFrame((state) => {
    if (getState().orbitInspect) return;

    if (cameraFollow.active && cameraFollow.id) {
      const handle = sceneApi.cartridges.get(cameraFollow.id);
      if (handle) {
        handle.group.getWorldPosition(_followPos);
        cameraRig.px += (_followPos.x + FOLLOW.ox - cameraRig.px) * FOLLOW.posLag;
        cameraRig.py += (_followPos.y + FOLLOW.oy - cameraRig.py) * FOLLOW.posLag;
        cameraRig.pz += (_followPos.z + FOLLOW.oz - cameraRig.pz) * FOLLOW.posLag;
        cameraRig.tx += (_followPos.x - cameraRig.tx) * FOLLOW.lookLag;
        cameraRig.ty += (_followPos.y + 0.02 - cameraRig.ty) * FOLLOW.lookLag;
        cameraRig.tz += (_followPos.z - cameraRig.tz) * FOLLOW.lookLag;
      }
    }

    applyPose(cameraRig, state.size.width / state.size.height);
  }, -2);

  if (!orbitInspect) return null;

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={[ORBIT_OVERVIEW.tx, ORBIT_OVERVIEW.ty, ORBIT_OVERVIEW.tz]}
      minDistance={0.6}
      maxDistance={16}
      maxPolarAngle={Math.PI / 2 - 0.04}
    />
  );
}

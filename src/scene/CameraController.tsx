import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { getCatalogCam } from '../experience/layout';
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
const ORBIT_OVERVIEW = {
  px: 4.6,
  py: 2.95,
  pz: 5.8,
  tx: 0.15,
  ty: 1.15,
  tz: -0.7,
  fov: 55,
};

export function CameraController() {
  const { camera } = useThree();
  const lastFov = useRef(cameraRig.fov);
  const orbitInspect = useExperience((s) => s.orbitInspect);

  useLayoutEffect(() => {
    const pose = getCatalogCam();
    Object.assign(cameraRig, pose);
    camera.position.set(pose.px, pose.py, pose.pz);
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      lastFov.current = pose.fov;
    }
  }, [camera]);

  useLayoutEffect(() => {
    if (!orbitInspect) return;
    camera.position.set(ORBIT_OVERVIEW.px, ORBIT_OVERVIEW.py, ORBIT_OVERVIEW.pz);
    camera.lookAt(ORBIT_OVERVIEW.tx, ORBIT_OVERVIEW.ty, ORBIT_OVERVIEW.tz);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = ORBIT_OVERVIEW.fov;
      camera.updateProjectionMatrix();
      lastFov.current = ORBIT_OVERVIEW.fov;
    }
  }, [orbitInspect, camera]);

  useFrame(() => {
    if (getState().orbitInspect) return;

    if (cameraFollow.active && cameraFollow.id) {
      const handle =
        sceneApi.cartridges.get(cameraFollow.id) ??
        sceneApi.magazines.get(cameraFollow.id);
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

    camera.position.set(cameraRig.px, cameraRig.py, cameraRig.pz);
    camera.lookAt(cameraRig.tx, cameraRig.ty, cameraRig.tz);
    if (camera instanceof PerspectiveCamera && Math.abs(cameraRig.fov - lastFov.current) > 0.01) {
      camera.fov = cameraRig.fov;
      camera.updateProjectionMatrix();
      lastFov.current = cameraRig.fov;
    }
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

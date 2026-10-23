import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitPoseToAspect, getCatalogCam, type CameraPose } from '../experience/layout';
import { sceneApi } from '../experience/sceneApi';
import { getPlaybackCam } from '../experience/playbackFrame';
import { cameraFit, cameraFollow, cameraRig } from '../experience/visuals';
import { prefersReducedMotion } from '../lib/motion';
import type { ExperienceMode } from '../types/collection';
import gsap from 'gsap';
import { getState, useExperience } from '../state/store';

const FOLLOW = {
  ox: 0.12,
  oy: 0.07,
  oz: 0.14,
  posLag: 0.11,
  lookLag: 0.16,
};

const _followPos = new Vector3();
const _blend: CameraPose = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 40, minDolly: 0 };
const _goal: CameraPose = { ..._blend };

/** Mix the raw rig with its viewport-fitted version. `fit` 1 = fully fitted. */
function blendFit(raw: CameraPose, fitted: CameraPose, fit: number): CameraPose {
  if (fit >= 1) return fitted;
  const t = Math.max(0, fit);
  _blend.px = raw.px + (fitted.px - raw.px) * t;
  _blend.py = raw.py + (fitted.py - raw.py) * t;
  _blend.pz = raw.pz + (fitted.pz - raw.pz) * t;
  _blend.tx = raw.tx + (fitted.tx - raw.tx) * t;
  _blend.ty = raw.ty + (fitted.ty - raw.ty) * t;
  _blend.tz = raw.tz + (fitted.tz - raw.tz) * t;
  _blend.fov = raw.fov + (fitted.fov - raw.fov) * t;
  return _blend;
}

function isPlaybackFramed(mode: ExperienceMode): boolean {
  return (
    mode === 'PLAYING' || mode === 'PAUSED' || mode === 'CHANGING_SLIDE' || mode === 'REWINDING'
  );
}

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

  function applyPose(pose: CameraPose, aspect: number, fit = 1) {
    const fitted = blendFit(pose, fitPoseToAspect(pose, aspect), fit);
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

  useFrame((state, delta) => {
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

    // Playback keeps the memory framed as the window resizes or the next
    // memory has a different shape. Flights own the rig while they run.
    if (
      isPlaybackFramed(getState().mode) &&
      !cameraFollow.active &&
      !gsap.isTweening(cameraRig) &&
      !gsap.isTweening(cameraFit)
    ) {
      const goal = getPlaybackCam(state.size.width, state.size.height, _goal);
      const k = prefersReducedMotion() ? 1 : 1 - Math.exp(-delta * 4);
      cameraRig.px += (goal.px - cameraRig.px) * k;
      cameraRig.py += (goal.py - cameraRig.py) * k;
      cameraRig.pz += (goal.pz - cameraRig.pz) * k;
      cameraRig.tx += (goal.tx - cameraRig.tx) * k;
      cameraRig.ty += (goal.ty - cameraRig.ty) * k;
      cameraRig.tz += (goal.tz - cameraRig.tz) * k;
      cameraRig.fov += (goal.fov - cameraRig.fov) * k;
    }

    applyPose(cameraRig, state.size.width / state.size.height, cameraFit.amount);
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

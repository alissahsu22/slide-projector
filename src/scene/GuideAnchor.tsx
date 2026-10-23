import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { sceneApi } from '../experience/sceneApi';
import { readGuideStep } from '../state/guide';
import { getState } from '../state/store';
import { setGuideAnchor, setGuideAvoid, type GuideRect } from '../ui/guideAnchor';

const _corner = new THREE.Vector3();
const _button = new THREE.Vector3();

type GuideSize = { w: number; h: number; d: number };

/** Screen rect of the PLAY / EDIT billboards parented to this tape. */
function actionScreenRect(
  root: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
  height: number,
): GuideRect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;

  root.traverse((child) => {
    const action = child.userData?.action;
    if (action !== 'PLAY' && action !== 'EDIT') return;
    const mesh = child.children.find((item): item is THREE.Mesh => (item as THREE.Mesh).isMesh);
    if (!mesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return;
    mesh.updateWorldMatrix(true, false);
    let faceLeft = Infinity;
    let faceTop = Infinity;
    let faceRight = -Infinity;
    let faceBottom = -Infinity;
    let behind = false;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        _button.set(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera);
        if (_button.z > 1) behind = true;
        const sx = (_button.x * 0.5 + 0.5) * width;
        const sy = (-_button.y * 0.5 + 0.5) * height;
        faceLeft = Math.min(faceLeft, sx);
        faceTop = Math.min(faceTop, sy);
        faceRight = Math.max(faceRight, sx);
        faceBottom = Math.max(faceBottom, sy);
      }
    }
    if (behind) return;
    left = Math.min(left, faceLeft);
    top = Math.min(top, faceTop);
    right = Math.max(right, faceRight);
    bottom = Math.max(bottom, faceBottom);
    found = true;
  });

  if (!found || right - left < 2 || bottom - top < 2) return null;
  return { left, top, right, bottom };
}

/** Projects the hinted object's box into screen pixels for the HTML callout. */
export function GuideAnchor() {
  useEffect(
    () => () => {
      setGuideAnchor(null);
      setGuideAvoid(null);
    },
    [],
  );

  useFrame(({ camera, size }) => {
    const step = readGuideStep();
    let object: THREE.Object3D | null = null;
    if (step === 'play') {
      const ids = getState().collectionIds;
      const id = ids[Math.floor((ids.length - 1) / 2)];
      object = id ? (sceneApi.cartridges.get(id)?.group ?? null) : null;
    } else if (step === 'empty-room') {
      object = sceneApi.addSlot;
    }

    if ((step !== 'play' && step !== 'empty-room') || !object) {
      setGuideAnchor(null);
      setGuideAvoid(null);
      return;
    }

    const bounds = object.userData.guideSize as GuideSize | undefined;
    if (!bounds) {
      setGuideAnchor(null);
      setGuideAvoid(null);
      return;
    }

    object.updateWorldMatrix(true, false);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let behind = false;
    for (const x of [-bounds.w / 2, bounds.w / 2]) {
      for (const y of [0, bounds.h]) {
        for (const z of [-bounds.d / 2, bounds.d / 2]) {
          _corner.set(x, y, z);
          object.localToWorld(_corner);
          _corner.project(camera);
          if (_corner.z > 1) behind = true;
          const sx = (_corner.x * 0.5 + 0.5) * size.width;
          const sy = (-_corner.y * 0.5 + 0.5) * size.height;
          minX = Math.min(minX, sx);
          minY = Math.min(minY, sy);
          maxX = Math.max(maxX, sx);
          maxY = Math.max(maxY, sy);
        }
      }
    }

    const onScreen =
      !behind && maxX > -40 && maxY > -40 && minX < size.width + 40 && minY < size.height + 40;
    setGuideAnchor(
      onScreen
        ? { left: minX, top: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
        : null,
    );
    setGuideAvoid(step === 'play' ? actionScreenRect(object, camera, size.width, size.height) : null);
  });

  return null;
}

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SCREEN } from '../experience/layout';
import { throwLevel, visuals } from '../experience/visuals';
import { getPlaceholderTexture } from '../lib/placeholderPhotos';
import {
  getProjectionGrain,
  getProjectionHotspot,
  getProjectionRoundMask,
  getProjectionVignette,
} from '../lib/projectionOverlays';
import { getCachedPhoto, loadPhoto } from '../media/photoCache';
import { useExperience } from '../state/store';

const PHOTO_W = 1.86;
const PHOTO_H = 1.24;

function applyMap(
  mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | null,
  tex: THREE.Texture | null,
) {
  if (!mat) return;
  mat.map = tex;
  if ('emissiveMap' in mat) mat.emissiveMap = tex;
  mat.needsUpdate = true;
}

export function ProjectionScreen() {
  const insertedId = useExperience((s) => s.insertedId);
  const mode = useExperience((s) => s.mode);
  const title = useExperience((s) => {
    if (!s.insertedId) return undefined;
    return s.collections.find((c) => c.id === s.insertedId)?.title;
  });
  const photo = useExperience((s) => {
    if (!s.insertedId) return null;
    const col = s.collections.find((c) => c.id === s.insertedId);
    return col?.photos[s.slideIndex] ?? null;
  });

  const group = useRef<THREE.Group>(null);
  const ghostMesh = useRef<THREE.Mesh>(null);
  const photoMat = useRef<THREE.MeshStandardMaterial>(null);
  const ghostMat = useRef<THREE.MeshBasicMaterial>(null);
  const hotspotMat = useRef<THREE.MeshBasicMaterial>(null);
  const vignetteMat = useRef<THREE.MeshBasicMaterial>(null);
  const grainMat = useRef<THREE.MeshBasicMaterial>(null);

  const fallback = useMemo(
    () => (photo ? getPlaceholderTexture(photo, title) : null),
    [photo, title],
  );
  const roundMask = useMemo(() => getProjectionRoundMask(), []);
  const vignette = useMemo(() => getProjectionVignette(), []);
  const hotspot = useMemo(() => getProjectionHotspot(), []);
  const grain = useMemo(() => getProjectionGrain(), []);

  useLayoutEffect(() => {
    const tex = (photo ? getCachedPhoto(photo.src) : null) ?? fallback;
    applyMap(photoMat.current, tex);
    applyMap(ghostMat.current, tex);
    if (!photo) return;
    let live = true;
    void loadPhoto(photo.src)
      .then((loaded) => {
        if (!live) return;
        applyMap(photoMat.current, loaded);
        applyMap(ghostMat.current, loaded);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [photo, fallback]);

  useFrame(() => {
    const live = Boolean(
      insertedId &&
        photo &&
        mode !== 'CATALOG' &&
        mode !== 'EJECTING' &&
        mode !== 'SWITCHING',
    );
    const throwAmt = live ? visuals.projection * throwLevel() : 0;
    const brightness = visuals.brightness;
    const softness = Math.max(visuals.blur, (1 - visuals.focus) * 0.85);
    const on = throwAmt > 0.035;

    const g = group.current;
    if (g) {
      g.position.set(
        SCREEN.x + visuals.settleX,
        SCREEN.y + visuals.settleY,
        SCREEN.z + 0.05,
      );
      g.rotation.set(0, 0, visuals.settleRot);
      const s = visuals.settleScale;
      g.scale.set(s, s, 1);
      g.visible = on;
    }

    if (photoMat.current) {
      photoMat.current.emissiveIntensity = (0.22 + visuals.lamp * 0.55) * throwAmt * brightness;
      photoMat.current.visible = on;
    }
    if (ghostMesh.current) {
      const s = 1 + softness * 0.018;
      ghostMesh.current.scale.set(s, s, 1);
    }
    if (ghostMat.current) {
      ghostMat.current.opacity = softness * 0.22 * throwAmt * brightness;
      ghostMat.current.visible = on && softness > 0.04;
    }
    if (hotspotMat.current) {
      hotspotMat.current.opacity = 0.14 * throwAmt * brightness;
      hotspotMat.current.visible = on;
    }
    if (vignetteMat.current) {
      vignetteMat.current.opacity = 0.85 * Math.min(1, throwAmt * 1.4);
      vignetteMat.current.visible = on;
    }
    if (grainMat.current) {
      grainMat.current.opacity = 0.045 * throwAmt;
      grainMat.current.visible = on;
    }
  });

  if (!photo || !fallback) return null;

  return (
    <group ref={group} position={[SCREEN.x, SCREEN.y, SCREEN.z + 0.05]}>
      <mesh ref={ghostMesh} position={[0, 0, -0.001]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial
          ref={ghostMat}
          map={fallback}
          alphaMap={roundMask}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          visible={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshStandardMaterial
          ref={photoMat}
          map={fallback}
          emissiveMap={fallback}
          alphaMap={roundMask}
          alphaTest={0.12}
          emissive="#fff4dc"
          emissiveIntensity={0}
          color="#fff6ea"
          roughness={0.82}
          metalness={0}
          toneMapped={false}
          visible={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial
          ref={hotspotMat}
          map={hotspot}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          visible={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial
          ref={vignetteMat}
          map={vignette}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          visible={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial
          ref={grainMat}
          map={grain}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          visible={false}
        />
      </mesh>
    </group>
  );
}

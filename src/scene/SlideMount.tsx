import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CARTRIDGE, SLIDE } from '../experience/layout';
import { makeFallbackFilm, makeMountFaceTexture } from '../lib/slideTextures';
import { loadPhoto } from '../media/photoCache';

let sharedMount: THREE.ExtrudeGeometry | null = null;

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function getMountGeometry(): THREE.ExtrudeGeometry {
  if (sharedMount) return sharedMount;
  const { size, thickness, windowW, windowH, corner } = SLIDE;
  const shape = roundedRect(size, size, corner);
  const hole = new THREE.Path();
  const hw = windowW / 2;
  const hh = windowH / 2;
  hole.moveTo(-hw, -hh);
  hole.lineTo(-hw, hh);
  hole.lineTo(hw, hh);
  hole.lineTo(hw, -hh);
  hole.lineTo(-hw, -hh);
  shape.holes.push(hole);
  sharedMount = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 8,
  });
  sharedMount.center();
  return sharedMount;
}

type Props = {
  title: string;
  date: string;
  coverSrc?: string;
  accentColor: string;
  tint: string;
};

export function SlideMount({ title, date, coverSrc, accentColor, tint }: Props) {
  const mountGeom = useMemo(() => getMountGeometry(), []);
  const { width: w, height: h, depth: d } = CARTRIDGE;
  const { windowW, windowH } = SLIDE;

  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const face = useMemo(() => {
    return makeMountFaceTexture(title, date, windowW / w, windowH / h, fontsReady);
  }, [title, date, windowW, windowH, w, h, fontsReady]);

  useEffect(() => () => face.dispose(), [face]);

  const [film, setFilm] = useState<THREE.Texture>(() => makeFallbackFilm(accentColor));

  useEffect(() => {
    const nextFallback = makeFallbackFilm(accentColor);
    setFilm(nextFallback);
    if (!coverSrc) {
      return () => nextFallback.dispose();
    }
    let cancelled = false;
    void loadPhoto(coverSrc)
      .then((tex) => {
        if (!cancelled) setFilm(tex);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      nextFallback.dispose();
    };
  }, [coverSrc, accentColor]);

  const plastic = useMemo(() => {
    const c = new THREE.Color('#ebe6dc');
    c.lerp(new THREE.Color(tint), 0.1);
    return c;
  }, [tint]);

  const faceZ = d / 2 + 0.00012;
  const filmZ = d / 2 + 0.00028;

  return (
    <group>
      <mesh geometry={mountGeom} castShadow receiveShadow>
        <meshStandardMaterial color={plastic} roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0, faceZ]} renderOrder={1}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={face}
          transparent
          alphaTest={0.08}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      <mesh position={[0, 0, filmZ - 0.0002]}>
        <planeGeometry args={[windowW + 0.0022, windowH + 0.0022]} />
        <meshStandardMaterial color="#14110e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, filmZ]} renderOrder={2}>
        <planeGeometry args={[windowW, windowH]} />
        <meshStandardMaterial
          map={film}
          color="#f3e4d0"
          roughness={0.22}
          metalness={0.06}
          emissive="#ffffff"
          emissiveMap={film}
          emissiveIntensity={0.14}
        />
      </mesh>
      <mesh position={[0, 0, -filmZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[windowW, windowH]} />
        <meshStandardMaterial map={film} color="#9a8a78" roughness={0.45} />
      </mesh>
    </group>
  );
}

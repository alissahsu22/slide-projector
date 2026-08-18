import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { visuals } from '../experience/visuals';
import { CEILING_PANEL, ROOM_H } from './roomDims';

RectAreaLightUniformsLib.init();

const SIZE = CEILING_PANEL.size;
const FRAME = 0.042;
const WELL = SIZE - FRAME * 2;
const DROP = 0.02;
const RECT_INTENSITY = 32;
const PANEL_COLOR = '#ffd08a';
const FRAME_COLOR = '#e8d6b8';

function makeHaloTexture(): THREE.CanvasTexture {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const nx = (x / (s - 1)) * 2 - 1;
        const ny = (y / (s - 1)) * 2 - 1;
        const dx = Math.max(Math.abs(nx) - 0.22, 0) / 0.78;
        const dy = Math.max(Math.abs(ny) - 0.22, 0) / 0.78;
        const d = Math.hypot(dx, dy);
        const a = Math.exp(-d * d * 3.8);
        const i = (y * s + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 208;
        img.data[i + 2] = 130;
        img.data[i + 3] = Math.floor(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function CeilingLight() {
  const halo = useMemo(makeHaloTexture, []);
  const diffuser = useRef<MeshStandardMaterial>(null);
  const haloMat = useRef<MeshBasicMaterial>(null);
  const rect = useRef<THREE.RectAreaLight>(null);
  const fixture = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const on = visuals.roomLight;
    if (diffuser.current) diffuser.current.emissiveIntensity = 2.6 * on;
    if (haloMat.current) haloMat.current.opacity = 0.82 * on;
    if (rect.current) rect.current.intensity = RECT_INTENSITY * on;
    // Ceiling is single-sided and faces the room, so a top-down orbit looks
    // through it. Hide the fixture so the square frame doesn't float in view.
    if (fixture.current) fixture.current.visible = camera.position.y < ROOM_H;
  });

  const y = ROOM_H - DROP / 2;
  const half = SIZE / 2 - FRAME / 2;

  return (
    <group position={[CEILING_PANEL.x, 0, CEILING_PANEL.z]}>
      <group ref={fixture}>
      <mesh position={[0, ROOM_H - 0.003, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[SIZE * 3.4, SIZE * 3.4]} />
        <meshBasicMaterial
          ref={haloMat}
          map={halo}
          color={PANEL_COLOR}
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {([-1, 1] as const).map((side) => (
        <mesh key={`x${side}`} position={[side * half, y, 0]}>
          <boxGeometry args={[FRAME, DROP, SIZE]} />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.72} metalness={0.06} />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh key={`z${side}`} position={[0, y, side * half]}>
          <boxGeometry args={[WELL, DROP, FRAME]} />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.72} metalness={0.06} />
        </mesh>
      ))}

      <mesh position={[0, ROOM_H - DROP + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WELL, WELL]} />
        <meshStandardMaterial
          ref={diffuser}
          color="#fff1d0"
          emissive={PANEL_COLOR}
          emissiveIntensity={2.6}
          roughness={0.45}
          toneMapped={false}
        />
      </mesh>
      </group>

      <rectAreaLight
        ref={rect}
        width={WELL}
        height={WELL}
        color={PANEL_COLOR}
        intensity={RECT_INTENSITY}
        position={[0, ROOM_H - DROP, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

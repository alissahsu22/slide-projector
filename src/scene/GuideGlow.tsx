import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import { prefersReducedMotion } from '../lib/motion';

type Props = {
  width: number;
  height: number;
  depth: number;
};

const DEEP = new THREE.Color('#e8890c');
const BRIGHT = new THREE.Color('#ffc44a');

const VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform float uPulse;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float facing = abs(dot(normalize(vNormal), viewDir));
  float fresnel = pow(1.0 - facing, 2.6);
  float rim = smoothstep(0.28, 0.9, fresnel);
  float alpha = rim * (0.4 + 0.6 * uPulse);
  vec3 gold = mix(vec3(1.0, 0.48, 0.05), vec3(1.0, 0.74, 0.18), uPulse);
  gl_FragColor = vec4(gold * (0.85 + 0.7 * rim), alpha);
}
`;

type GlowLine = ComponentRef<typeof Edges>;

/** Gold rim on a tape or the add-a-tape card. It pulses, and it does not take clicks. */
export function GuideGlow({ width, height, depth }: Props) {
  const line = useRef<GlowLine>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uPulse: { value: 0.65 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const wave = prefersReducedMotion()
      ? 0.72
      : (Math.sin(clock.elapsedTime * ((Math.PI * 2) / 1.6)) + 1) / 2;
    material.uniforms.uPulse.value = wave;
    const mat = line.current?.material;
    if (!mat) return;
    mat.color.copy(DEEP).lerp(BRIGHT, wave);
    mat.opacity = 0.32 + 0.68 * wave;
  });

  return (
    <group position={[0, height / 2, 0]}>
      <mesh raycast={() => null} renderOrder={1}>
        <boxGeometry args={[width * 1.04, height * 1.06, depth * 1.08]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh raycast={() => null}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        <Edges
          ref={line}
          lineWidth={3.5}
          color="#ffb020"
          toneMapped={false}
          transparent
          opacity={1}
        />
      </mesh>
    </group>
  );
}

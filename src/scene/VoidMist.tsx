import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WALL_Z } from '../experience/layout';
import { visuals } from '../experience/visuals';
import { getState } from '../state/store';
import { DOOR } from './doorDims';
import { CEILING_PANEL, ROOM_D, ROOM_FRONT_Z, ROOM_H, ROOM_HALF_W, ROOM_MID_Z, ROOM_W } from './roomDims';

/**
 * The shell is a cutaway in an empty clear color. A short raymarch through the
 * volume around it turns that black into a dark, warm mist — denser at the
 * floor and in the doorway, gone inside the room so the interior lighting
 * stays as authored. Depth test keeps the fog behind real surfaces.
 */
const MIST_PAD = 8.5;
const BOX_Y0 = -1.4;
const BOX_Y1 = ROOM_H + 3.4;

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uPresence;
uniform vec2 uRoom;
uniform vec2 uHalf;
uniform float uFrontZ;
uniform float uWallZ;
uniform float uRoomH;
uniform vec3 uDoor;
uniform vec3 uPanel;

varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec4 sampleMist(vec3 p) {
  vec2 q = p.xz - uRoom;
  vec2 dd = abs(q) - uHalf;
  float dist = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);

  bool inRoom = dist < 0.04 && p.y > 0.03 && p.y < uRoomH - 0.04;
  if (inRoom) return vec4(0.0);

  float n = noise(p.xz * 0.13 + vec2(uTime * 0.022, p.y * 0.31));
  n += 0.55 * noise(p.xz * 0.34 - vec2(uTime * 0.015, uTime * 0.01) + p.y * 0.12);
  // Banks and gaps, so it reads as mist rather than a flat wash.
  float wisp = mix(0.08, 1.45, smoothstep(0.38, 0.78, n));

  // Hug the shell. A few metres out the void is black again.
  // The bank reaches farther along the floor than it does up the walls.
  float low = 1.0 - smoothstep(0.0, 2.2, p.y);
  float reach = mix(2.15, 3.5, low);
  float radial = smoothstep(-0.08, 0.18, dist) * (1.0 - smoothstep(reach * 0.28, reach, dist));
  float aboveRoof = smoothstep(uRoomH - 0.02, uRoomH + 0.35, p.y)
    * (1.0 - smoothstep(uRoomH + 0.4, uRoomH + 1.55, p.y));
  float under = smoothstep(-0.9, 0.12, p.y);

  float into = uWallZ - p.z;
  float shaft = smoothstep(0.7, 0.16, abs(p.x - uDoor.x));
  shaft *= 1.0 - smoothstep(uDoor.y * 0.4, uDoor.y + 0.35, p.y);
  shaft *= smoothstep(-0.02, 0.18, p.y);
  shaft *= smoothstep(-0.15, 0.35, into);
  shaft *= 1.0 - smoothstep(0.8, 4.2, into);

  // The floor carries the mist. A much thinner veil stays up the walls so
  // the cutout softens without filling the void.
  float mask = radial * under * mix(0.22, 1.0, low) * wisp;
  mask = max(mask, aboveRoof * 0.18 * mix(0.5, 1.0, wisp));
  mask = max(mask, shaft * mix(0.65, 1.05, n));

  float close = 1.0 - smoothstep(0.0, 2.4, max(dist, 0.0));
  vec3 col = mix(vec3(0.025, 0.02, 0.018), vec3(0.4, 0.23, 0.1), close * mix(0.3, 1.0, low));

  float spill = exp(-max(p.z - uFrontZ, 0.0) * 0.7);
  spill *= exp(-p.x * p.x * 0.14);
  spill *= 1.0 - smoothstep(0.05, 1.3, p.y);
  col += vec3(0.28, 0.16, 0.06) * spill * close;

  float doorGlow = exp(-length(vec3((p.x - uDoor.x) * 1.2, (p.y - 1.0) * 0.8, (p.z - uDoor.z) * 0.5)));
  col += vec3(0.32, 0.18, 0.07) * doorGlow * smoothstep(-0.05, 0.4, into);

  float lamp = exp(-length(p - uPanel) * 0.85);
  col += vec3(0.34, 0.2, 0.08) * lamp * smoothstep(0.0, 0.4, dist);

  // Extinction per metre — a haze around the shell, not a wall of fog.
  float ext = mask * 0.32 * uPresence;
  return vec4(col, ext);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float maxT = max(length(vWorld - ro), 0.001);
  const float STEPS = 24.0;
  float stepLen = maxT / STEPS;
  float t = hash(gl_FragCoord.xy) * stepLen;

  vec3 accum = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 24; i++) {
    if (t >= maxT || alpha > 0.92) break;
    vec4 s = sampleMist(ro + rd * t);
    if (s.a > 0.0005) {
      float a = 1.0 - exp(-s.a * stepLen);
      accum += (1.0 - alpha) * a * s.rgb;
      alpha += (1.0 - alpha) * a;
    }
    t += stepLen;
  }

  vec3 col = alpha > 0.001 ? accum / alpha : vec3(0.0);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function VoidMist() {
  const shaft = useRef<THREE.PointLight>(null);
  const spill = useRef<THREE.PointLight>(null);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      toneMapped: true,
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 1 },
        uRoom: { value: new THREE.Vector2(0, ROOM_MID_Z) },
        uHalf: { value: new THREE.Vector2(ROOM_HALF_W, ROOM_D / 2) },
        uFrontZ: { value: ROOM_FRONT_Z },
        uWallZ: { value: WALL_Z },
        uRoomH: { value: ROOM_H },
        uDoor: { value: new THREE.Vector3(DOOR.x, DOOR.holeH, DOOR.z) },
        uPanel: { value: new THREE.Vector3(CEILING_PANEL.x, ROOM_H, CEILING_PANEL.z) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    return mat;
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const room = visuals.roomLight;
    const orbit = getState().orbitInspect ? 1 : 0.82;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPresence.value = orbit * (0.7 + room * 0.3);
    if (shaft.current) shaft.current.intensity = room * 0.7;
    if (spill.current) spill.current.intensity = room * 0.22;
  });

  return (
    <group>
      <mesh
        material={material}
        position={[0, (BOX_Y0 + BOX_Y1) / 2, ROOM_MID_Z]}
        raycast={() => null}
      >
        <boxGeometry args={[ROOM_W + MIST_PAD * 2, BOX_Y1 - BOX_Y0, ROOM_D + MIST_PAD * 2]} />
      </mesh>

      {/* Just behind the jamb — short range so it kisses the frame and dies
          before the screen. */}
      <pointLight
        ref={shaft}
        position={[DOOR.x, 1.05, DOOR.z - 0.42]}
        color="#ffc088"
        intensity={0.7}
        distance={0.9}
        decay={2}
      />

      {/* Warm pool on the void side of the open front. */}
      <pointLight
        ref={spill}
        position={[0.1, 0.28, ROOM_FRONT_Z + 1.05]}
        color="#ffc890"
        intensity={0.22}
        distance={1.15}
        decay={2}
      />
    </group>
  );
}

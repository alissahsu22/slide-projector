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
uniform float uDoorW;
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

  float n = noise(p.xz * 0.11 + vec2(uTime * 0.03, -uTime * 0.02 + p.y * 0.22));
  n += 0.55 * noise(p.xz * 0.3 - vec2(uTime * 0.012, uTime * 0.018) + p.y * 0.1);
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

  // Doorway plume: tight in the hole, blooming and sinking as it leaves.
  float into = uWallZ - p.z;
  float travel = clamp(into / 5.2, 0.0, 1.0);
  float halfSpread = mix(uDoorW * 0.62, 1.45, travel);
  float shaft = 1.0 - smoothstep(halfSpread * 0.35, halfSpread, abs(p.x - uDoor.x));
  float ySpread = mix(uDoor.y, 0.62, travel);
  shaft *= 1.0 - smoothstep(ySpread * 0.32, ySpread, p.y);
  shaft *= smoothstep(-0.04, 0.14, p.y);
  shaft *= smoothstep(-0.12, 0.22, into);
  shaft *= 1.0 - smoothstep(1.3, 6.0, into);

  // Front of the shell is a cutaway from outside. Fog leaves that mouth,
  // stays low, and dies a few metres out so the void stays black.
  float frontDist = p.z - uFrontZ;
  float frontPlume = smoothstep(-0.15, 0.28, frontDist);
  frontPlume *= 1.0 - smoothstep(0.55, 4.8, frontDist);
  float frontHeight = mix(2.05, 0.38, smoothstep(0.0, 3.8, max(frontDist, 0.0)));
  frontPlume *= 1.0 - smoothstep(frontHeight * 0.22, frontHeight, p.y);
  float side = abs(p.x) / (uHalf.x + 0.95);
  frontPlume *= 1.0 - smoothstep(0.78, 1.2, side);
  frontPlume *= smoothstep(-0.04, 0.1, p.y);
  float jamb = smoothstep(0.2, 0.92, abs(p.x) / uHalf.x);
  frontPlume *= mix(0.28, 1.0, max(jamb, low));

  float doorPlume = shaft * mix(1.2, 0.28, smoothstep(0.2, 5.0, into));

  float skirt = radial * under * mix(0.35, 1.15, low) * wisp;
  skirt = max(skirt, aboveRoof * 0.14 * wisp);
  float frontBody = frontPlume * mix(0.65, 1.05, wisp);
  float doorBody = doorPlume * mix(0.8, 1.2, n);

  // Warm at the mouth, nearly black a few metres out.
  float close = 1.0 - smoothstep(0.0, 3.4, max(dist, 0.0));
  vec3 col = mix(vec3(0.004, 0.003, 0.005), vec3(0.32, 0.17, 0.07), close * mix(0.35, 1.0, low));
  col += vec3(0.07, 0.04, 0.015) * frontPlume;
  col += vec3(0.06, 0.03, 0.012) * doorPlume;

  float spill = exp(-max(frontDist, 0.0) * 0.55);
  spill *= exp(-p.x * p.x * 0.08);
  spill *= 1.0 - smoothstep(0.05, 1.6, p.y);
  col += vec3(0.07, 0.04, 0.015) * spill;

  float doorGlow = exp(-length(vec3((p.x - uDoor.x) * 1.05, (p.y - 1.0) * 0.7, (p.z - uDoor.z) * 0.35)));
  col += vec3(0.08, 0.045, 0.018) * doorGlow * smoothstep(-0.05, 0.35, into);

  float lamp = exp(-length(p - uPanel) * 0.85);
  col += vec3(0.2, 0.12, 0.05) * lamp * smoothstep(0.0, 0.4, dist);

  // Skirt stays the light pool around the shell. Plumes are denser at the
  // mouth and still thin enough that a few metres of them don't go opaque.
  float ext = (skirt * 0.34 + frontBody * 0.2 + doorBody * 0.11) * uPresence;
  return vec4(col, ext);
}

vec3 safeInv(vec3 rd) {
  return vec3(
    abs(rd.x) > 1e-5 ? 1.0 / rd.x : 1e5,
    abs(rd.y) > 1e-5 ? 1.0 / rd.y : 1e5,
    abs(rd.z) > 1e-5 ? 1.0 / rd.z : 1e5
  );
}

bool doorHole(vec3 p) {
  return abs(p.x - uDoor.x) < uDoorW * 0.5
    && p.y > -0.02 && p.y < uDoor.y
    && abs(p.z - uWallZ) < 0.28;
}

// Walls facing the camera stop the march. The cutaway front (and a side wall
// seen from outside) do not, so fog in front of the opening still draws.
bool isSolidHit(vec3 hit, vec3 ro) {
  if (doorHole(hit)) return false;
  bool solid = false;
  if (abs(hit.z - uFrontZ) < 0.08) solid = solid || (ro.z < uFrontZ - 0.02);
  if (abs(hit.x - uHalf.x) < 0.08) solid = solid || (ro.x < uHalf.x - 0.02);
  if (abs(hit.x + uHalf.x) < 0.08) solid = solid || (ro.x > -uHalf.x + 0.02);
  if (abs(hit.y - uRoomH) < 0.08) solid = solid || (ro.y < uRoomH - 0.02);
  if (hit.y < 0.08) solid = solid || (ro.y > 0.08);
  if (abs(hit.z - uWallZ) < 0.08) solid = true;
  return solid;
}

float solidDistance(vec3 ro, vec3 rd) {
  vec3 bmin = vec3(-uHalf.x, 0.0, uWallZ);
  vec3 bmax = vec3(uHalf.x, uRoomH, uFrontZ);
  vec3 inv = safeInv(rd);
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tsm = min(t0, t1);
  vec3 tbg = max(t0, t1);
  float tN = max(max(tsm.x, tsm.y), tsm.z);
  float tF = min(min(tbg.x, tbg.y), tbg.z);
  if (tF < 0.0 || tN > tF) return 1e9;

  float tHit = 1e9;
  if (tN > 0.02 && tN < 80.0 && isSolidHit(ro + rd * tN, ro)) tHit = tN;
  if (tF > 0.02 && tF < 80.0 && isSolidHit(ro + rd * tF, ro)) tHit = min(tHit, tF);
  return tHit;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float maxT = max(length(vWorld - ro), 0.001);
  // Stop at the first wall the camera can actually see. Fog between the
  // camera and that wall — the plume leaving an opening — still composites.
  float tEnd = min(maxT, solidDistance(ro, rd));
  const float STEPS = 24.0;
  float stepLen = maxT / STEPS;
  float t = hash(gl_FragCoord.xy) * stepLen;

  vec3 accum = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 24; i++) {
    if (t >= tEnd || alpha > 0.92) break;
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
      // The box's back face is behind the room, so a depth test would throw
      // away fog that is actually in front of the walls. The march stops at
      // the shell instead.
      depthTest: false,
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
        uDoorW: { value: DOOR.holeW },
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
    material.uniforms.uPresence.value = orbit * (0.88 + room * 0.12);
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

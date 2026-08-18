import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { CRATE_POS, LENS, SCREEN, TABLE_TOP } from '../experience/layout';
import { throwLevel, visuals } from '../experience/visuals';
import { getState } from '../state/store';
import { ProjectorLamp } from './ProjectorLamp';
import { CEILING_PANEL, ROOM_H } from './roomDims';

// ─── Tuning constants — edit these to adjust the feel ────────────────────────
// Target feel: dim liminal bedroom — warm orange tungsten, soft ceiling pool,
// corners in shadow. Dust motes only — no milky distance fog.

// Ambient — enough that black magazine labels stay readable up close
const AMB_COLOR = '#f0c090';
const AMB_CATALOG = 0.2;
const AMB_PLAYBACK = 0.01;

// Hemisphere — warm top-down, dusty amber ground bounce
const HEMI_SKY = '#f2d2a8';
const HEMI_GROUND = '#6a4820';
const HEMI_CATALOG = 0.24;
const HEMI_PLAYBACK = 0.012;

// Ceiling panel spot — warm yellow-orange pool; the room's only catalog shadows
const CEIL_COLOR = '#ffc878';
const CEIL_CATALOG = 2.15;
const CEIL_PLAYBACK = 0.06;

// Camera-side fill — magazines face +Z, so the overhead panel leaves the
// printed spines in their own shadow. This lifts the crate without flattening
// the rest of the room.
const TABLE_FILL_COLOR = '#ffc890';
const TABLE_FILL_CATALOG = 0.72;
const TABLE_FILL_PLAYBACK = 0.02;

// Projector lens point — warm amber, important but not room-dominating in playback
const LAMP_COLOR = '#ffc060';
const LAMP_SCALE = 1.15;

// Red LED indicator on projector body
const LED_COLOR = '#ff1e12';
const LED_IDLE = 0.04;

// Screen content bounce onto nearby ceiling surfaces
const SCREEN_BOUNCE_COLOR = '#e8d8c0';
const SCREEN_BOUNCE_SCALE = 0.52;

// Warm floor/wall spill beneath the projected wall — playback only
const TABLE_SPILL_COLOR = '#f2ca88';
const TABLE_SPILL_SCALE = 0.32;

// Fog — kept far so the room stays crisp; only a hint in playback for the beam
const FOG_CATALOG = new THREE.Color('#000000');
const FOG_PLAYBACK = new THREE.Color('#000000');
const FOG_MIX = new THREE.Color();
const FOG_NEAR_CATALOG = 16;
const FOG_FAR_CATALOG = 32;
const FOG_NEAR_PLAYBACK = 7;
const FOG_FAR_PLAYBACK = 18;
const FOG_NEAR_ORBIT = 22;
const FOG_FAR_ORBIT = 48;
const VOID = new THREE.Color('#000000');

// Tone mapping — catalog bright enough to read spines, darker in playback
const TM_BASE = 0.5;
const TM_ROOM = 0.5; // catalog (roomLight=1): 1.00

// ─────────────────────────────────────────────────────────────────────────────

export function LightingController() {
  const { scene, gl } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ceil = useRef<THREE.SpotLight>(null);
  const ceilTarget = useRef<THREE.Object3D>(null);
  const tableFill = useRef<THREE.PointLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const led = useRef<THREE.PointLight>(null);
  const screenBounce = useRef<THREE.PointLight>(null);
  const tableSpill = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const { orbitInspect } = getState();
    const room = visuals.roomLight;
    const glow = visuals.lamp * throwLevel();

    gl.toneMappingExposure = TM_BASE + room * TM_ROOM;

    FOG_MIX.lerpColors(FOG_PLAYBACK, FOG_CATALOG, room);
    scene.background = VOID;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(FOG_MIX);
      if (orbitInspect) {
        scene.fog.near = FOG_NEAR_ORBIT;
        scene.fog.far = FOG_FAR_ORBIT;
      } else {
        scene.fog.near = THREE.MathUtils.lerp(FOG_NEAR_PLAYBACK, FOG_NEAR_CATALOG, room);
        scene.fog.far = THREE.MathUtils.lerp(FOG_FAR_PLAYBACK, FOG_FAR_CATALOG, room);
      }
    }

    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(HEMI_PLAYBACK, HEMI_CATALOG, room);
    }

    if (ceil.current) {
      ceil.current.intensity = THREE.MathUtils.lerp(CEIL_PLAYBACK, CEIL_CATALOG, room);
      ceil.current.position.set(CEILING_PANEL.x, ROOM_H - 0.08, CEILING_PANEL.z);
      if (ceilTarget.current) {
        ceilTarget.current.position.set(CEILING_PANEL.x, 0, CEILING_PANEL.z);
        ceil.current.target = ceilTarget.current;
        ceil.current.target.updateMatrixWorld();
      }
    }

    if (tableFill.current) {
      tableFill.current.intensity = THREE.MathUtils.lerp(
        TABLE_FILL_PLAYBACK,
        TABLE_FILL_CATALOG,
        room,
      );
    }

    if (amb.current) {
      amb.current.intensity = THREE.MathUtils.lerp(AMB_PLAYBACK, AMB_CATALOG, room);
    }

    if (lamp.current) {
      lamp.current.intensity = glow * LAMP_SCALE;
      lamp.current.position.set(LENS.x, LENS.y - 0.02, LENS.z + 0.04);
    }

    if (led.current) {
      led.current.intensity = LED_IDLE + glow * 0.22;
      led.current.position.set(LENS.x + 0.07, LENS.y - 0.05, LENS.z + 0.04);
    }

    if (screenBounce.current) {
      screenBounce.current.intensity = visuals.projection * throwLevel() * SCREEN_BOUNCE_SCALE;
    }

    if (tableSpill.current) {
      tableSpill.current.intensity = glow * TABLE_SPILL_SCALE;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[HEMI_SKY, HEMI_GROUND, HEMI_CATALOG]} />

      <spotLight
        ref={ceil}
        position={[CEILING_PANEL.x, ROOM_H - 0.08, CEILING_PANEL.z]}
        color={CEIL_COLOR}
        intensity={CEIL_CATALOG}
        distance={9}
        angle={0.9}
        penumbra={0.92}
        decay={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.04}
        shadow-camera-near={0.35}
        shadow-camera-far={8}
      />
      <object3D ref={ceilTarget} position={[CEILING_PANEL.x, 0, CEILING_PANEL.z]} />

      <pointLight
        ref={tableFill}
        position={[CRATE_POS.x, TABLE_TOP + 0.48, CRATE_POS.z + 0.62]}
        color={TABLE_FILL_COLOR}
        intensity={TABLE_FILL_CATALOG}
        distance={2.6}
        decay={1.7}
      />

      <pointLight
        ref={lamp}
        position={[LENS.x, LENS.y, LENS.z]}
        color={LAMP_COLOR}
        intensity={0}
        distance={0.85}
        decay={2}
      />

      <pointLight
        ref={led}
        position={[LENS.x + 0.07, LENS.y - 0.05, LENS.z + 0.04]}
        color={LED_COLOR}
        intensity={LED_IDLE}
        distance={0.55}
        decay={2}
      />

      <pointLight
        ref={screenBounce}
        position={[SCREEN.x, SCREEN.y + 0.95, SCREEN.z + 0.7]}
        color={SCREEN_BOUNCE_COLOR}
        intensity={0}
        distance={2.8}
        decay={2}
      />

      <pointLight
        ref={tableSpill}
        position={[0.4, 0.4, SCREEN.z + 1.8]}
        color={TABLE_SPILL_COLOR}
        intensity={0}
        distance={4.5}
        decay={1.6}
      />

      <ambientLight ref={amb} color={AMB_COLOR} intensity={AMB_CATALOG} />

      <ProjectorLamp />
    </>
  );
}

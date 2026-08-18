import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { visuals } from '../experience/visuals';
import {
  drawMagazineLabel,
  LABEL_PLANE_H_FRAC,
  LABEL_PLANE_W_FRAC,
  LABEL_PLANE_X_FRAC,
} from '../lib/magazineLabel';
import { getPlaceholderTexture } from '../lib/placeholderPhotos';
import { loadPhoto } from '../media/photoCache';
import type { Photo } from '../types/collection';
import {
  DEFAULT_MAX_VISIBLE_SLIDES,
  MAGAZINE,
  magazineHeight,
  magazineSlotX,
  magazineWidth,
  occupiedMagazineSlots,
  SLIDE_POP_HEIGHT,
} from './magazineLayout';

const PLASTIC = '#171614';
const PLASTIC_INNER = '#0e0d0c';

const LABEL_BACKING_Z = 0.0002;
const LABEL_BACKING_THICKNESS = 0.0004;
const LABEL_TILT = -0.01;
/** Clearance over the backing card's front face, larger than the tilt's dip. */
const LABEL_PRINT_Z = LABEL_BACKING_Z + LABEL_BACKING_THICKNESS + 0.0004;

export type SlideMagazineProps = {
  title: string;
  date: string;
  /** Real photo count for the collection. Used on the label and by playback. */
  photoCount: number;
  /**
   * Max decorative slide meshes to render inside the magazine.
   * Playback still uses the full `photoCount` / photo array.
   */
  maxVisibleSlides?: number;
  /** Total physical slots. Defaults to 36. */
  slotCount?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  /** Occupied-slot groups, in slot order. Animate these to lift a slide. */
  slidesRef?: { current: (THREE.Group | null)[] };
  /** Photos for film windows. Index matches occupied slot order. */
  photos?: Photo[];
  /** Visual index of the slide that should sit popped out of the trough. */
  raisedIndex?: number;
  /**
   * Only the magazine in the projector needs photo film and per-frame slide
   * syncing. Idle magazines in the crate show bare mounts, which keeps a dozen
   * of them off the texture budget and out of the frame loop.
   */
  active?: boolean;
};

function hash01(i: number, salt: number): number {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function slotJitter(i: number) {
  return {
    x: (hash01(i, 1) - 0.5) * 0.00022,
    y: hash01(i, 2) * 0.0004,
    z: (hash01(i, 3) - 0.5) * 0.0005,
    rx: (hash01(i, 4) - 0.5) * 0.016,
    ry: (hash01(i, 5) - 0.5) * 0.02,
    rz: (hash01(i, 6) - 0.5) * 0.014,
  };
}

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

function makeFrameGeometry(): THREE.ExtrudeGeometry {
  const { slideSize: size, slideThickness: depth, windowW, windowH, slideCorner } =
    MAGAZINE;
  const shape = roundedRect(size, size, slideCorner);
  const hole = new THREE.Path();
  const hw = windowW / 2;
  const hh = windowH / 2;
  hole.moveTo(-hw, -hh);
  hole.lineTo(-hw, hh);
  hole.lineTo(hw, hh);
  hole.lineTo(hw, -hh);
  hole.lineTo(-hw, -hh);
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geom.rotateY(Math.PI / 2);
  geom.center();
  return geom;
}

function makeArrowGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.0052, 0);
  s.lineTo(-0.0032, 0.0036);
  s.lineTo(-0.0032, 0.0013);
  s.lineTo(-0.0064, 0.0013);
  s.lineTo(-0.0064, -0.0013);
  s.lineTo(-0.0032, -0.0013);
  s.lineTo(-0.0032, -0.0036);
  s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.0007,
    bevelEnabled: false,
  });
  geom.center();
  return geom;
}

function makeLabelTexture(
  title: string,
  date: string,
  photoCount: number,
  fontsReady: boolean,
): THREE.CanvasTexture {
  const canvas = drawMagazineLabel(document.createElement('canvas'), {
    title,
    date,
    photoCount,
    fontsReady,
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeCapMarkTexture(slotCount: number, fontsReady: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(232, 220, 196, 0.92)';
    ctx.font = fontsReady
      ? '700 54px "Special Elite", "Courier New", monospace'
      : '700 54px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(slotCount), 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const _color = new THREE.Color();

function MagazineFilm({
  photo,
  title,
  active,
  geometry,
}: {
  photo: Photo;
  title: string;
  active: boolean;
  geometry: THREE.PlaneGeometry;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const fallback = useMemo(
    () => getPlaceholderTexture(photo, title),
    [photo, title],
  );
  const [map, setMap] = useState<THREE.Texture>(fallback);

  useEffect(() => {
    setMap(fallback);
    let live = true;
    void loadPhoto(photo.src)
      .then((tex) => {
        if (live) setMap(tex);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [photo, fallback]);

  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const lamp = visuals.lamp * Math.max(0.25, visuals.flicker);
    if (active) {
      m.color.setRGB(1, 0.95 + lamp * 0.05, 0.88 + lamp * 0.08);
    } else {
      m.color.setRGB(0.62, 0.56, 0.5);
    }
  });

  return (
    <mesh
      geometry={geometry}
      rotation={[0, Math.PI / 2, 0]}
      renderOrder={2}
      frustumCulled={false}
    >
      <meshBasicMaterial
        ref={mat}
        map={map}
        color={active ? '#fff4dc' : '#9e9084'}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export const SlideMagazine = forwardRef<THREE.Group, SlideMagazineProps>(
  function SlideMagazine(
    {
      title,
      date,
      photoCount,
      maxVisibleSlides = DEFAULT_MAX_VISIBLE_SLIDES,
      slotCount = MAGAZINE.slotCount,
      position,
      rotation,
      scale,
      slidesRef,
      photos: photoList,
      raisedIndex = -1,
      active = false,
    },
    ref,
  ) {
    const slots = Math.max(1, Math.round(slotCount));
    const photos = Math.max(0, Math.round(photoCount));
    const visibleSlideCount = Math.min(photos, maxVisibleSlides, slots);
    const occupiedSlots = useMemo(
      () => occupiedMagazineSlots(visibleSlideCount, slots),
      [visibleSlideCount, slots],
    );
    const trough = slots * MAGAZINE.slotPitch;
    const width = magazineWidth();
    const height = magazineHeight();
    const slideY = MAGAZINE.floor + MAGAZINE.slideSize / 2;

    const frameGeom = useMemo(() => makeFrameGeometry(), []);
    const windowGeom = useMemo(
      () =>
        new THREE.BoxGeometry(
          MAGAZINE.slideThickness * 0.45,
          MAGAZINE.windowH,
          MAGAZINE.windowW,
        ),
      [],
    );
    const filmGeom = useMemo(
      () => new THREE.PlaneGeometry(MAGAZINE.windowW, MAGAZINE.windowH),
      [],
    );
    const ribGeom = useMemo(
      () =>
        new THREE.BoxGeometry(
          MAGAZINE.ribThickness,
          MAGAZINE.ribHeight,
          MAGAZINE.innerWidth - MAGAZINE.topLip * 2,
        ),
      [],
    );
    const arrowGeom = useMemo(() => makeArrowGeometry(), []);

    useEffect(
      () => () => {
        frameGeom.dispose();
        windowGeom.dispose();
        filmGeom.dispose();
        ribGeom.dispose();
        arrowGeom.dispose();
      },
      [frameGeom, windowGeom, filmGeom, ribGeom, arrowGeom],
    );

    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
      void document.fonts.ready.then(() => setFontsReady(true));
    }, []);

    const labelMap = useMemo(
      () => makeLabelTexture(title, date, photos, fontsReady),
      [title, date, photos, fontsReady],
    );
    const capMap = useMemo(
      () => makeCapMarkTexture(slots, fontsReady),
      [slots, fontsReady],
    );
    useEffect(() => () => labelMap.dispose(), [labelMap]);
    useEffect(() => () => capMap.dispose(), [capMap]);

    const framesRef = useRef<THREE.InstancedMesh>(null);
    const windowsRef = useRef<THREE.InstancedMesh>(null);
    const ribsRef = useRef<THREE.InstancedMesh>(null);
    const slideGroups = useRef<(THREE.Group | null)[]>([]);

    const jitters = useMemo(
      () => occupiedSlots.map((slot) => slotJitter(slot)),
      [occupiedSlots],
    );

    const ribCount = Math.max(0, slots - 1);
    useLayoutEffect(() => {
      const ribs = ribsRef.current;
      if (!ribs || ribCount === 0) return;
      const dummy = new THREE.Object3D();
      const y = MAGAZINE.floor + MAGAZINE.innerHeight - MAGAZINE.ribHeight / 2;
      for (let i = 0; i < ribCount; i++) {
        dummy.position.set(magazineSlotX(i, slots) + MAGAZINE.slotPitch / 2, y, 0);
        dummy.updateMatrix();
        ribs.setMatrixAt(i, dummy.matrix);
      }
      ribs.instanceMatrix.needsUpdate = true;
      ribs.computeBoundingSphere();
    }, [ribCount, slots]);

    useLayoutEffect(() => {
      if (slidesRef) slidesRef.current = slideGroups.current.slice(0, visibleSlideCount);
    }, [slidesRef, visibleSlideCount]);

    useLayoutEffect(() => {
      const groups = slideGroups.current;
      for (let i = 0; i < visibleSlideCount; i++) {
        const g = groups[i];
        if (!g) continue;
        const restY =
          typeof g.userData.restY === 'number'
            ? g.userData.restY
            : g.position.y;
        g.userData.restY = restY;
        const pop = i === raisedIndex;
        gsap.to(g.position, {
          y: restY + (pop ? SLIDE_POP_HEIGHT : 0),
          duration: pop ? 0.34 : 0.2,
          ease: pop ? 'back.out(1.55)' : 'power2.in',
          overwrite: 'auto',
        });
      }
      return () => {
        for (let i = 0; i < visibleSlideCount; i++) {
          const g = groups[i];
          if (g) gsap.killTweensOf(g.position);
        }
      };
    }, [raisedIndex, visibleSlideCount]);

    const syncSlideInstances = useCallback(
      (fitBounds: boolean) => {
        const frames = framesRef.current;
        const windows = windowsRef.current;
        if (!frames || visibleSlideCount === 0) return;
        for (let i = 0; i < visibleSlideCount; i++) {
          const g = slideGroups.current[i];
          if (!g) continue;
          g.updateMatrix();
          frames.setMatrixAt(i, g.matrix);
          windows?.setMatrixAt(i, g.matrix);
        }
        frames.instanceMatrix.needsUpdate = true;
        if (windows) windows.instanceMatrix.needsUpdate = true;
        if (fitBounds) {
          frames.computeBoundingSphere();
          windows?.computeBoundingSphere();
        }
      },
      [visibleSlideCount],
    );

    useLayoutEffect(() => {
      syncSlideInstances(true);
    }, [syncSlideInstances]);

    useFrame(() => {
      if (!active) return;
      syncSlideInstances(false);
    });

    useLayoutEffect(() => {
      const frames = framesRef.current;
      if (!frames || visibleSlideCount === 0) return;
      for (let i = 0; i < visibleSlideCount; i++) {
        const t = hash01(occupiedSlots[i] ?? i, 8) * 0.045;
        _color.setRGB(0.905 - t, 0.87 - t * 0.85, 0.808 - t * 0.65);
        frames.setColorAt(i, _color);
      }
      if (frames.instanceColor) frames.instanceColor.needsUpdate = true;
    }, [visibleSlideCount, occupiedSlots]);

    const labelY = MAGAZINE.floor + MAGAZINE.innerHeight * 0.44;
    const wallY = MAGAZINE.floor + MAGAZINE.innerHeight / 2;
    const sideZ = MAGAZINE.innerWidth / 2 + MAGAZINE.wall / 2;
    const capX = trough / 2 + MAGAZINE.endCap / 2;

    return (
      <group
        ref={ref}
        name="SlideMagazine"
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <group name="MagazineBody">
          <mesh position={[0, MAGAZINE.floor / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[trough, MAGAZINE.floor, width]} />
            <meshStandardMaterial
              color={PLASTIC}
              roughness={0.78}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, wallY, sideZ]} castShadow receiveShadow>
            <boxGeometry args={[trough, MAGAZINE.innerHeight, MAGAZINE.wall]} />
            <meshStandardMaterial
              color={PLASTIC}
              roughness={0.8}
              metalness={0.08}
            />
          </mesh>
          <mesh position={[0, wallY, -sideZ]} castShadow receiveShadow>
            <boxGeometry args={[trough, MAGAZINE.innerHeight, MAGAZINE.wall]} />
            <meshStandardMaterial
              color="#141312"
              roughness={0.82}
              metalness={0.08}
            />
          </mesh>
          <mesh
            position={[0, MAGAZINE.floor + 0.0002, 0]}
            receiveShadow
          >
            <boxGeometry
              args={[trough - 0.0004, 0.0004, MAGAZINE.innerWidth - 0.0004]}
            />
            <meshStandardMaterial
              color={PLASTIC_INNER}
              roughness={0.92}
              metalness={0}
            />
          </mesh>
        </group>

        <group name="SlotRails">
          <mesh
            position={[
              0,
              height - MAGAZINE.topLip / 2,
              MAGAZINE.innerWidth / 2 - MAGAZINE.topLip / 2,
            ]}
          >
            <boxGeometry args={[trough, MAGAZINE.topLip, MAGAZINE.topLip]} />
            <meshStandardMaterial
              color="#1c1a18"
              roughness={0.74}
              metalness={0.12}
            />
          </mesh>
          <mesh
            position={[
              0,
              height - MAGAZINE.topLip / 2,
              -(MAGAZINE.innerWidth / 2 - MAGAZINE.topLip / 2),
            ]}
          >
            <boxGeometry args={[trough, MAGAZINE.topLip, MAGAZINE.topLip]} />
            <meshStandardMaterial
              color="#1c1a18"
              roughness={0.74}
              metalness={0.12}
            />
          </mesh>
          {ribCount > 0 && (
            <instancedMesh
              ref={ribsRef}
              args={[ribGeom, undefined, ribCount]}
              frustumCulled={false}
            >
              <meshStandardMaterial
                color="#121110"
                roughness={0.76}
                metalness={0.1}
              />
            </instancedMesh>
          )}
        </group>

        <group
          name="Label"
          position={[trough * LABEL_PLANE_X_FRAC, labelY, width / 2]}
        >
          <mesh position={[0, 0, LABEL_BACKING_Z + LABEL_BACKING_THICKNESS / 2]}>
            <boxGeometry
              args={[
                trough * LABEL_PLANE_W_FRAC,
                MAGAZINE.innerHeight * (LABEL_PLANE_H_FRAC + 0.04),
                LABEL_BACKING_THICKNESS,
              ]}
            />
            <meshStandardMaterial color="#e8dcc8" roughness={0.92} metalness={0} />
          </mesh>
          {/* Printed sheet clears the backing card by more than the tilt can dip,
              otherwise the cream card slices through the type. */}
          <mesh position={[0, 0, LABEL_PRINT_Z]} rotation={[LABEL_TILT, 0, 0]}>
            <planeGeometry
              args={[
                trough * LABEL_PLANE_W_FRAC,
                MAGAZINE.innerHeight * LABEL_PLANE_H_FRAC,
              ]}
            />
            <meshStandardMaterial
              map={labelMap}
              roughness={0.86}
              metalness={0}
              emissiveMap={labelMap}
              emissive="#ffffff"
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>

        <group name="EndCap" position={[-capX, height / 2, 0]}>
          <RoundedBox
            args={[MAGAZINE.endCap, height + 0.0006, width + 0.0008]}
            radius={0.0011}
            smoothness={2}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#151413"
              roughness={0.72}
              metalness={0.14}
            />
          </RoundedBox>
          <mesh
            geometry={arrowGeom}
            position={[0, height / 2 + 0.00035, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
          >
            <meshStandardMaterial
              color="#d8cbb4"
              roughness={0.55}
              metalness={0.08}
            />
          </mesh>
          <mesh
            position={[-MAGAZINE.endCap / 2 - 0.0002, -0.006, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.018, 0.018]} />
            <meshStandardMaterial
              map={capMap}
              transparent
              depthWrite={false}
              roughness={0.7}
            />
          </mesh>
        </group>

        <RoundedBox
          args={[MAGAZINE.endCap, height + 0.0006, width + 0.0008]}
          radius={0.0011}
          smoothness={2}
          position={[capX, height / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#151413"
            roughness={0.72}
            metalness={0.14}
          />
        </RoundedBox>

        <group name="Slides">
          {visibleSlideCount > 0 && (
            <>
              <instancedMesh
                ref={framesRef}
                args={[frameGeom, undefined, visibleSlideCount]}
                frustumCulled={false}
                castShadow={active}
                receiveShadow={active}
              >
                <meshStandardMaterial
                  color="#ffffff"
                  roughness={0.88}
                  metalness={0.02}
                />
              </instancedMesh>
              <instancedMesh
                ref={windowsRef}
                args={[windowGeom, undefined, visibleSlideCount]}
                frustumCulled={false}
              >
                <meshStandardMaterial
                  color="#14110e"
                  roughness={0.55}
                  metalness={0.04}
                />
              </instancedMesh>
            </>
          )}
          {occupiedSlots.map((slot, i) => {
            const j = jitters[i] ?? slotJitter(slot);
            const restY = slideY + j.y;
            const photo = photoList?.[i];
            return (
              <group
                key={slot}
                name={`Slide ${i + 1}`}
                ref={(el) => {
                  slideGroups.current[i] = el;
                  if (el) el.userData.restY = restY;
                }}
                position={[magazineSlotX(slot, slots) + j.x, restY, j.z]}
                rotation={[j.rx, j.ry, j.rz]}
                userData={{ slotIndex: slot, visualIndex: i, restY }}
              >
                {active && photo && (
                  <group position={[MAGAZINE.slideThickness * 0.42, 0, 0]}>
                    <MagazineFilm
                      photo={photo}
                      title={title}
                      active={i === raisedIndex}
                      geometry={filmGeom}
                    />
                  </group>
                )}
              </group>
            );
          })}
        </group>
      </group>
    );
  },
);

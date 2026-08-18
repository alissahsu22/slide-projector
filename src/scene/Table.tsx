import { TABLE_TOP } from '../experience/layout';

/**
 * Off-white rather than near-white paint. The top faces straight up into the
 * ceiling panel and the hemisphere sky tint, so at #f5f2ee it reflected almost
 * everything it caught and read as a lit panel against the dark carpet.
 */
const TOP_COLOR = '#d2ccc0';
const APRON_COLOR = '#c9c4b9';
const LEG_COLOR = '#cdc8bd';

export function Table() {
  const topY = TABLE_TOP - 0.02;
  const top = { w: 2.05, d: 0.95, t: 0.045 };
  const leg = { w: 0.055, h: topY, d: 0.055 };
  const inset = 0.08;
  const legs: [number, number][] = [
    [-top.w / 2 + inset, -top.d / 2 + inset],
    [top.w / 2 - inset, -top.d / 2 + inset],
    [-top.w / 2 + inset, top.d / 2 - inset],
    [top.w / 2 - inset, top.d / 2 - inset],
  ];

  return (
    <group position={[0.28, 0, 0.12]}>
      <mesh position={[0, topY, 0]} receiveShadow castShadow>
        <boxGeometry args={[top.w, top.t, top.d]} />
        <meshStandardMaterial color={TOP_COLOR} roughness={0.52} metalness={0.04} />
      </mesh>
      <mesh position={[0, topY - 0.03, 0]}>
        <boxGeometry args={[top.w - 0.06, 0.03, top.d - 0.06]} />
        <meshStandardMaterial color={APRON_COLOR} roughness={0.62} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, leg.h / 2, z]}>
          <boxGeometry args={[leg.w, leg.h, leg.d]} />
          <meshStandardMaterial color={LEG_COLOR} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

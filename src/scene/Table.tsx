import { TABLE_TOP } from '../experience/layout';

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
        <meshStandardMaterial color="#f5f2ee" roughness={0.52} metalness={0.04} />
      </mesh>
      <mesh position={[0, topY - 0.03, 0]}>
        <boxGeometry args={[top.w - 0.06, 0.03, top.d - 0.06]} />
        <meshStandardMaterial color="#ebe7e1" roughness={0.62} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, leg.h / 2, z]}>
          <boxGeometry args={[leg.w, leg.h, leg.d]} />
          <meshStandardMaterial color="#f0ece6" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

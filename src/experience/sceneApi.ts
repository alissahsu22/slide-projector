import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import {
  CRATE_POS,
  crateRig,
  INSERTION_APPROACH_LOCAL,
  type MagazinePose,
  PROJECTOR_POS,
  syncProjectorDerived,
} from './layout';

export type CartridgeHandle = {
  group: Group;
  home: MagazinePose;
  loose: boolean;
  slides: (Group | null)[];
};

const memory = new Map<string, { home: CartridgeHandle['home']; loose: boolean }>();

export const sceneApi = {
  cartridges: new Map<string, CartridgeHandle>(),
  projector: null as Group | null,
  crate: null as Group | null,
  /** The "add a tape" card in the crate, used to anchor an empty-room hint. */
  addSlot: null as Group | null,
  insertionPoint: null as Group | null,
  lever: null as Group | null,
  lamp: null as Mesh | null,
  lens: null as Mesh | null,
};

export function registerCartridge(
  id: string,
  group: Group,
  home: MagazinePose,
): void {
  const remembered = memory.get(id);
  const useHome = remembered?.loose
    ? { ...home, x: remembered.home.x, y: remembered.home.y, z: remembered.home.z }
    : home;
  sceneApi.cartridges.set(id, {
    group,
    home: { ...useHome },
    loose: remembered?.loose ?? false,
    slides: [],
  });
}

export function unregisterCartridge(id: string, group: Group): void {
  const current = sceneApi.cartridges.get(id);
  if (current?.group === group) {
    memory.set(id, { home: { ...current.home }, loose: current.loose });
    sceneApi.cartridges.delete(id);
  }
}

export function moveProjector(x: number, z: number): void {
  PROJECTOR_POS.x = x;
  PROJECTOR_POS.z = z;
  syncProjectorDerived();
  if (sceneApi.projector) {
    sceneApi.projector.position.x = x;
    sceneApi.projector.position.z = z;
  }
}

/** Reseat the crate on the desk. Slot homes follow `crateRig` on their own. */
export function moveCrate(x: number, z: number): void {
  CRATE_POS.x = x;
  CRATE_POS.z = z;
  crateRig.x = x;
  crateRig.z = z;
}

export function moveCartridge(id: string, x: number, z: number, lift = 0): void {
  const handle = sceneApi.cartridges.get(id);
  if (!handle) return;
  handle.loose = true;
  handle.home.x = x;
  handle.home.z = z;
  handle.group.position.x = x;
  handle.group.position.y = handle.home.y + lift;
  handle.group.position.z = z;
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _approach = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();

export function getInsertionWorldPose(): {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
} | null {
  const g = sceneApi.insertionPoint;
  if (!g) return null;
  g.updateWorldMatrix(true, false);
  g.matrixWorld.decompose(_pos, _quat, _scale);
  _euler.setFromQuaternion(_quat, 'XYZ');
  return {
    x: _pos.x,
    y: _pos.y,
    z: _pos.z,
    rx: _euler.x,
    ry: _euler.y,
    rz: _euler.z,
  };
}

export function getInsertionWorldQuaternion(): THREE.Quaternion | null {
  const g = sceneApi.insertionPoint;
  if (!g) return null;
  g.updateWorldMatrix(true, false);
  g.getWorldQuaternion(_worldQuat);
  return _worldQuat.clone();
}

export function getInsertionWorldAtLocal(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } | null {
  const g = sceneApi.insertionPoint;
  if (!g) return null;
  g.updateWorldMatrix(true, false);
  _approach.set(x, y, z);
  g.localToWorld(_approach);
  return { x: _approach.x, y: _approach.y, z: _approach.z };
}

export function getInsertionApproachWorld(): { x: number; y: number; z: number } | null {
  return getInsertionWorldAtLocal(
    INSERTION_APPROACH_LOCAL.x,
    INSERTION_APPROACH_LOCAL.y,
    INSERTION_APPROACH_LOCAL.z,
  );
}

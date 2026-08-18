import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { getState } from '../state/store';
import {
  CRATE_POS,
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

export type MagazineHandle = {
  group: Group;
  home: MagazinePose;
  slides: (Group | null)[];
};

const memory = new Map<string, { home: CartridgeHandle['home']; loose: boolean }>();
const magazineMemory = new Map<string, MagazinePose>();

export const sceneApi = {
  cartridges: new Map<string, CartridgeHandle>(),
  magazines: new Map<string, MagazineHandle>(),
  projector: null as Group | null,
  crate: null as Group | null,
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

export function registerMagazine(id: string, group: Group, home: MagazinePose): void {
  const remembered = magazineMemory.get(id);
  const useHome = remembered ?? home;
  sceneApi.magazines.set(id, { group, home: { ...useHome }, slides: [] });
}

export function unregisterMagazine(id: string, group: Group): void {
  const current = sceneApi.magazines.get(id);
  if (current?.group === group) {
    magazineMemory.set(id, { ...current.home });
    sceneApi.magazines.delete(id);
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

export function moveCrate(x: number, z: number): void {
  const dx = x - CRATE_POS.x;
  const dz = z - CRATE_POS.z;
  CRATE_POS.x = x;
  CRATE_POS.z = z;
  if (sceneApi.crate) {
    sceneApi.crate.position.x = x;
    sceneApi.crate.position.z = z;
  }
  const inserted = getState().insertedId;
  for (const [id, handle] of sceneApi.cartridges) {
    if (id === inserted || handle.loose) continue;
    handle.home.x += dx;
    handle.home.z += dz;
    handle.group.position.x += dx;
    handle.group.position.z += dz;
  }
  const selected = getState().selectedCollectionId;
  for (const [id, handle] of sceneApi.magazines) {
    handle.home.x += dx;
    handle.home.z += dz;
    if (id === selected) continue;
    handle.group.position.x += dx;
    handle.group.position.z += dz;
  }
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

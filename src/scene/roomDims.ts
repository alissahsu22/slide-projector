import { WALL_Z } from '../experience/layout';

/** Single source of truth for the room shell so every surface shares its edges. */
export const ROOM_HALF_W = 2.25;
export const ROOM_FRONT_Z = 1.5;
export const ROOM_H = 2.6;
export const ROOM_W = ROOM_HALF_W * 2;
export const ROOM_D = ROOM_FRONT_Z - WALL_Z;
export const ROOM_MID_Z = (ROOM_FRONT_Z + WALL_Z) / 2;

/** Recessed square ceiling panel — the room's fluorescent key light. */
export const CEILING_PANEL = {
  x: 0.04,
  z: ROOM_MID_Z + 0.35,
  size: 0.68,
};

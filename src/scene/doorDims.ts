import { WALL_Z } from '../experience/layout';
import { publicUrl } from '../lib/publicUrl';

/** Open doorway on the back wall, right of center — leads into the void. */
export const DOOR = {
  url: publicUrl('models/old_door.glb'),
  /** World X of the opening center. */
  x: 1.95,
  /** Fitted height in metres, leaving a transom of wallpaper above. */
  height: 2.14,
  /** Inner opening the wall is cut to; the frame overlaps the cut. */
  holeW: 0.86,
  holeH: 2.05,
  z: WALL_Z,
};

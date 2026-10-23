import { getState } from '../state/store';
import { SCREEN, type CameraPose } from './layout';

/** The box every projected memory is fitted inside on the wall, in meters. */
export const PROJECTED_PHOTO = { w: 1.86, h: 1.24 };

/** World size of a memory on the wall: its own aspect, fitted inside the box. */
export function projectedPhotoSize(width?: number, height?: number): { w: number; h: number } {
  const aspect =
    width && height && width > 0 && height > 0
      ? width / height
      : PROJECTED_PHOTO.w / PROJECTED_PHOTO.h;
  let w = PROJECTED_PHOTO.w;
  let h = w / aspect;
  if (h > PROJECTED_PHOTO.h) {
    h = PROJECTED_PHOTO.h;
    w = h * aspect;
  }
  return { w, h };
}

/**
 * Seen from just behind and below the projector's line, so the memory reads
 * as thrown onto the wall rather than pasted on the screen. A unit vector from
 * the memory toward the camera.
 */
const VIEW_DIR = (() => {
  const v = { x: 0.07, y: -0.15, z: 1 };
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
})();

/** How much of the clear area the memory fills — the rest is room and glow. */
const FILL = { h: 0.86, w: 0.92 };
/** Preferred lens; the distance gives way first, then the lens. */
const PREFERRED_FOV = 32;
/**
 * Never closer than this, and never back past the projector: from behind it,
 * its body blocks the memory on short, wide screens.
 */
const DISTANCE = { min: 1.6, max: 3.55 };
const FOV = { min: 12, max: 72 };
/** The controls panel before it has mounted, plus its bottom margin. */
const PANEL_ESTIMATE_PX = 168;
const CLEARANCE_PX = 14;

/**
 * Pixel band the memory may occupy: under the toolbar and over the controls
 * panel, so neither ever covers it.
 */
function clearBand(viewH: number): { top: number; bottom: number } {
  const bar = document.querySelector('.top-bar');
  const panel = document.querySelector('.playback');
  const top = (bar instanceof HTMLElement ? bar.getBoundingClientRect().bottom : 64) + CLEARANCE_PX;
  const panelTop =
    panel instanceof HTMLElement ? panel.getBoundingClientRect().top : viewH - PANEL_ESTIMATE_PX;
  const bottom = Math.max(top + viewH * 0.3, panelTop - CLEARANCE_PX);
  return { top, bottom };
}

const _pose: CameraPose = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 40, minDolly: 0 };

/**
 * A playback pose framed for this viewport and this memory. It is already
 * fitted, so the camera must apply it as-is (see `cameraFit`).
 */
export function getPlaybackCam(
  viewW: number,
  viewH: number,
  out: CameraPose = { ..._pose },
): CameraPose {
  const s = getState();
  const col = s.insertedId ? s.collections.find((c) => c.id === s.insertedId) : undefined;
  const photo = col?.photos[s.slideIndex];
  const { w, h } = projectedPhotoSize(photo?.width, photo?.height);
  const aspect = viewW / Math.max(1, viewH);
  const band = clearBand(viewH);
  const bandH = (band.bottom - band.top) / viewH;
  const sideMargin = Math.min(32, viewW * 0.05);
  const bandW = (viewW - sideMargin * 2) / viewW;

  // World height the frame has to show for the memory to fit both ways.
  const visible = Math.max(h / (FILL.h * bandH), w / (FILL.w * bandW) / aspect);
  const half = visible / 2;
  const distance = Math.min(
    DISTANCE.max,
    Math.max(DISTANCE.min, half / Math.tan((PREFERRED_FOV * Math.PI) / 360)),
  );
  const fov = Math.min(FOV.max, Math.max(FOV.min, (Math.atan(half / distance) * 360) / Math.PI));

  // Aim off-centre so the memory sits in the middle of the clear band.
  const offsetPx = (band.top + band.bottom) / 2 - viewH / 2;
  const cx = SCREEN.x;
  const cy = SCREEN.y + (offsetPx / viewH) * visible;
  const cz = SCREEN.z + 0.05;

  out.tx = cx;
  out.ty = cy;
  out.tz = cz;
  out.px = cx + VIEW_DIR.x * distance;
  out.py = cy + VIEW_DIR.y * distance;
  out.pz = cz + VIEW_DIR.z * distance;
  out.fov = fov;
  out.minDolly = 0;
  return out;
}

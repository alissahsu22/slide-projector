export const ROOM_ID = 'room';

/**
 * The room itself is the focus target after entering and after leaving a
 * tape, so the arrow keys, Enter and Space act on the room straight away
 * instead of on whichever toolbar key happened to hold focus.
 */
export function focusRoom(): void {
  document.getElementById(ROOM_ID)?.focus({ preventScroll: true });
}

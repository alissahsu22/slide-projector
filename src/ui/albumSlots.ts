/**
 * The strip shows the memories already on the tape plus one open slot to add
 * another — structure appears as the tape fills, not as a grid of blanks.
 */
export function albumSlotCount(filled: number, max: number): number {
  return filled >= max ? filled : filled + 1;
}

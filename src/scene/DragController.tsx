import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { cancelDrag, dragState, endDrag, trackDrag } from '../experience/drag';
import { useExperience } from '../state/store';

/**
 * Drives a magazine while it is held. The pointer is read straight off the
 * frame state rather than from captured pointer events, so the drag keeps
 * tracking even when the cursor runs off the magazine it picked up.
 */
export function DragController() {
  const curating = useExperience((s) => s.mode === 'CURATING');

  useEffect(() => {
    if (!curating) return;
    const release = () => {
      if (dragState.active) endDrag();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      cancelDrag();
    };
  }, [curating]);

  useFrame((state, delta) => {
    if (!dragState.active) return;
    trackDrag(
      state.camera,
      state.pointer,
      state.size.width / state.size.height,
      delta,
    );
  }, -4);

  return null;
}

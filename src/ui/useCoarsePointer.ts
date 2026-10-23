import { useSyncExternalStore } from 'react';

/** Touch screens get tap wording; everything else gets click wording. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia('(pointer: coarse)');
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
}

import gsap from 'gsap';

/**
 * GSAP tween as a promise. Interrupted tweens resolve rather than hang, so a
 * sequence that gets overwritten mid-flight still runs its cleanup.
 */
export function tween(target: object, vars: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const prev = vars.onComplete as (() => void) | undefined;
    const prevInterrupt = vars.onInterrupt as (() => void) | undefined;
    gsap.to(target, {
      ...vars,
      onComplete: () => {
        prev?.();
        resolve();
      },
      onInterrupt: () => {
        prevInterrupt?.();
        resolve();
      },
    });
  });
}

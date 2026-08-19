const MUSIC_SRC = '/sounds/warm-nights.m4a';
const MUTED_KEY = 'projector.music.muted';
const TARGET_VOLUME = 0.28;
const FADE_MS = 2200;

let el: HTMLAudioElement | null = null;
let muted = readMuted();
let fadeFrame = 0;
const listeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(value: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, value ? '1' : '0');
  } catch {
    // Private browsing — the preference just won't survive a reload.
  }
}

function getEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio(MUSIC_SRC);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
  }
  return el;
}

function fadeTo(target: number): void {
  const audio = getEl();
  const from = audio.volume;
  const start = performance.now();
  cancelAnimationFrame(fadeFrame);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_MS);
    audio.volume = from + (target - from) * t;
    if (t < 1) fadeFrame = requestAnimationFrame(step);
    else if (target === 0) audio.pause();
  };
  fadeFrame = requestAnimationFrame(step);
}

/** Call from a user gesture — autoplay policies block a cold start otherwise. */
export function startMusic(): void {
  if (muted) return;
  const audio = getEl();
  void audio.play().then(() => fadeTo(TARGET_VOLUME)).catch(() => undefined);
}

export function isMusicMuted(): boolean {
  return muted;
}

export function toggleMusic(): void {
  muted = !muted;
  writeMuted(muted);
  if (muted) fadeTo(0);
  else startMusic();
  for (const fn of listeners) fn(muted);
}

export function subscribeMusic(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

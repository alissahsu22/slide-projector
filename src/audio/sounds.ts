import { SOUND_ENABLED } from './enabled';
import { isMusicMuted } from './music';
import { publicUrl } from '../lib/publicUrl';

export type SoundName =
  | 'pickup'
  | 'insert'
  | 'advance'
  | 'reverse'
  | 'rewind'
  | 'eject'
  | 'switch';

/**
 * Recorded samples in /public/sounds. Names left out here stay synthesized;
 * add a file and an entry to replace one. Several names may share one file.
 */
export const SOUND_FILES: Partial<Record<SoundName, string>> = {
  advance: publicUrl('sounds/slide-click.m4a'),
  reverse: publicUrl('sounds/slide-click.m4a'),
  switch: publicUrl('sounds/switch.mp3'),
};

/** Trims recorded samples down to the level of the synthesized fallbacks. */
const SOUND_GAIN: Partial<Record<SoundName, number>> = {
  advance: 0.55,
  reverse: 0.55,
  switch: 0.7,
};

/** Reverse runs the same carriage sample a touch slower so it reads as backwards. */
const SOUND_RATE: Partial<Record<SoundName, number>> = {
  reverse: 0.92,
};

let ctx: AudioContext | null = null;
let effectsMuted = isMusicMuted();

export function setEffectsMuted(muted: boolean): void {
  effectsMuted = muted;
  if (muted) stopClicks();
}
const buffers = new Map<SoundName, AudioBuffer>();
let unlocked = false;

const CLICK_SOUNDS = new Set<SoundName>(['advance', 'reverse']);
let clickEpoch = 0;
const clickSources: AudioBufferSourceNode[] = [];
const clickTimeouts: number[] = [];

function stopClicks(): void {
  clickEpoch += 1;
  for (const src of clickSources) {
    try {
      src.stop();
    } catch {
      // already stopped
    }
  }
  clickSources.length = 0;
  for (const id of clickTimeouts) window.clearTimeout(id);
  clickTimeouts.length = 0;
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio(): void {
  if (!SOUND_ENABLED) return;
  const audio = getCtx();
  if (audio.state === 'suspended') void audio.resume();
  unlocked = true;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

function noise(duration: number): AudioBuffer {
  const audio = getCtx();
  const n = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buf = audio.createBuffer(1, n, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(
  audio: AudioContext,
  dest: AudioNode,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = audio.createGain();
  g.gain.setValueAtTime(0, audio.currentTime);
  g.gain.linearRampToValueAtTime(peak, audio.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + attack + decay);
  g.connect(dest);
  return g;
}

function click(freq: number, decay: number, gain = 0.4, type: OscillatorType = 'square'): void {
  const audio = getCtx();
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), audio.currentTime + decay);
  const g = envGain(audio, audio.destination, gain, 0.001, decay);
  osc.connect(g);
  osc.start();
  osc.stop(audio.currentTime + decay + 0.02);
}

function thud(freq: number, decay: number, gain = 0.5): void {
  click(freq, decay, gain, 'sine');
}

function noiseBurst(duration: number, freq: number, q: number, gain: number): void {
  const audio = getCtx();
  const src = audio.createBufferSource();
  src.buffer = noise(duration);
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = envGain(audio, audio.destination, gain, 0.001, duration);
  src.connect(filter);
  filter.connect(g);
  src.start();
}

function playBuffer(buf: AudioBuffer, gain: number, rate: number): AudioBufferSourceNode {
  const audio = getCtx();
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = audio.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(audio.destination);
  src.start();
  return src;
}

function trackClick(src: AudioBufferSourceNode): void {
  clickSources.push(src);
  src.onended = () => {
    const i = clickSources.indexOf(src);
    if (i >= 0) clickSources.splice(i, 1);
  };
}

/** Several overlapping mechanical clacks compressed into a rewind burst. */
export function playRewindClacks(count: number, spanMs: number): void {
  if (!SOUND_ENABLED) return;
  stopClicks();
  const n = Math.max(2, Math.round(count));
  const span = Math.max(120, spanMs);
  const epoch = clickEpoch;
  const sample = buffers.get('advance');
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * span * 0.88;
    clickTimeouts.push(
      window.setTimeout(() => {
        if (epoch !== clickEpoch) return;
        if (sample) {
          // Sped up and quieter so the clacks stack into a burst instead of
          // smearing into each other at full length.
          trackClick(playBuffer(sample, 0.3, 1.55 + (i % 3) * 0.06));
          return;
        }
        noiseBurst(0.03, 1450 + i * 50, 2, 0.13);
        click(148 + i * 14, 0.042, 0.26, 'triangle');
        thud(60, 0.065, 0.18);
      }, t),
    );
  }
}

function synth(name: SoundName): void {
  switch (name) {
    case 'pickup':
      noiseBurst(0.08, 900, 1.2, 0.12);
      thud(180, 0.12, 0.18);
      break;
    case 'insert':
      noiseBurst(0.14, 420, 0.8, 0.22);
      thud(90, 0.18, 0.45);
      click(520, 0.07, 0.22);
      window.setTimeout(() => click(240, 0.05, 0.16), 40);
      break;
    case 'advance': {
      const epoch = clickEpoch;
      noiseBurst(0.05, 1800, 2.4, 0.18);
      click(190, 0.06, 0.35);
      clickTimeouts.push(
        window.setTimeout(() => {
          if (epoch !== clickEpoch) return;
          thud(70, 0.08, 0.28);
        }, 18),
      );
      break;
    }
    case 'reverse': {
      const epoch = clickEpoch;
      noiseBurst(0.05, 1400, 2, 0.16);
      click(150, 0.07, 0.32, 'triangle');
      clickTimeouts.push(
        window.setTimeout(() => {
          if (epoch !== clickEpoch) return;
          thud(64, 0.09, 0.26);
        }, 16),
      );
      break;
    }
    case 'rewind':
      playRewindClacks(5, 360);
      break;
    case 'eject':
      click(280, 0.05, 0.2);
      window.setTimeout(() => {
        noiseBurst(0.12, 500, 0.7, 0.16);
        thud(110, 0.14, 0.28);
      }, 30);
      break;
    case 'switch':
      click(420, 0.035, 0.3);
      thud(55, 0.07, 0.28);
      noiseBurst(0.04, 900, 1.6, 0.1);
      break;
  }
}

export function playSound(
  name: SoundName,
  opts?: { interrupt?: boolean },
): void {
  if (!SOUND_ENABLED || effectsMuted) return;
  const audio = getCtx();
  if (audio.state === 'suspended') void audio.resume();
  if (opts?.interrupt || CLICK_SOUNDS.has(name)) stopClicks();
  const buf = buffers.get(name);
  if (buf) {
    const src = playBuffer(buf, SOUND_GAIN[name] ?? 1, SOUND_RATE[name] ?? 1);
    if (CLICK_SOUNDS.has(name)) trackClick(src);
    return;
  }
  synth(name);
}

export async function preloadSoundFiles(): Promise<void> {
  if (!SOUND_ENABLED) return;
  const audio = getCtx();
  const byUrl = new Map<string, SoundName[]>();
  for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
    const url = SOUND_FILES[name];
    if (!url) continue;
    const names = byUrl.get(url);
    if (names) names.push(name);
    else byUrl.set(url, [name]);
  }

  await Promise.all(
    [...byUrl].map(async ([url, names]) => {
      try {
        const res = await fetch(url, { method: 'GET' });
        // A missing file falls through to the SPA index.html with a 200, so
        // the status alone isn't enough to tell that a sample exists.
        if (!res.ok || res.headers.get('content-type')?.startsWith('text/html')) return;
        const arr = await res.arrayBuffer();
        const buf = await audio.decodeAudioData(arr);
        for (const name of names) buffers.set(name, buf);
      } catch {
        // Keep synthesized fallback.
      }
    }),
  );
}

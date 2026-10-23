import { useSyncExternalStore } from 'react';

/** The two reading panels over the room. Only one is open at a time. */
type Panel = 'about' | 'help' | null;

let panel: Panel = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setPanel(next: Panel): void {
  if (panel === next) return;
  panel = next;
  emit();
}

export function setAboutOpen(open: boolean): void {
  if (open) setPanel('about');
  else if (panel === 'about') setPanel(null);
}

export function isAboutOpen(): boolean {
  return panel === 'about';
}

export function useAboutOpen(): boolean {
  return useSyncExternalStore(subscribe, isAboutOpen, () => false);
}

export function setHelpOpen(open: boolean): void {
  if (open) setPanel('help');
  else if (panel === 'help') setPanel(null);
}

export function isHelpOpen(): boolean {
  return panel === 'help';
}

export function useHelpOpen(): boolean {
  return useSyncExternalStore(subscribe, isHelpOpen, () => false);
}

/** Either panel is covering the room, so room keys and hints stand down. */
export function isPanelOpen(): boolean {
  return panel !== null;
}

export function usePanelOpen(): boolean {
  return useSyncExternalStore(subscribe, isPanelOpen, () => false);
}

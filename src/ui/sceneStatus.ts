import { useSyncExternalStore } from 'react';

export function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

let sceneLoading = false;
let webglFailed = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSceneLoading(value: boolean): void {
  if (sceneLoading === value) return;
  sceneLoading = value;
  emit();
}

export function isSceneLoading(): boolean {
  return sceneLoading;
}

export function useSceneLoading(): boolean {
  return useSyncExternalStore(subscribe, isSceneLoading, () => false);
}

export function markWebGLFailed(): void {
  if (webglFailed) return;
  webglFailed = true;
  emit();
}

export function isWebGLFailed(): boolean {
  return webglFailed;
}

export function useWebGLFailed(): boolean {
  return useSyncExternalStore(subscribe, isWebGLFailed, () => false);
}

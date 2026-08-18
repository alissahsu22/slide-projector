const KEY = 'slide-projector:progress';

export type ProgressMap = Record<string, number>;

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgress(collectionId: string, slideIndex: number): void {
  const next = { ...loadProgress(), [collectionId]: slideIndex };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearProgress(collectionId: string): void {
  const next = { ...loadProgress() };
  delete next[collectionId];
  localStorage.setItem(KEY, JSON.stringify(next));
}

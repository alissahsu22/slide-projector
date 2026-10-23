const KEY = 'upstairs:progress';
const CURATION_KEY = 'upstairs:curation';
const VIEWER_KEY = 'upstairs:viewer';
const ENTERED_KEY = 'upstairs:entered';

/** Length the crate stamp can still letter-space without shrinking to nothing. */
export const VIEWER_NAME_MAX = 18;

export type ProgressMap = Record<string, number>;

/**
 * Which magazines the user keeps on the desk, and where every magazine sits on
 * the shelf. Shelf slots are stored rather than derived so a magazine taken to
 * the desk leaves its own gap behind instead of the row closing up.
 */
export type Curation = {
  collectionIds: string[];
  shelfSlots: Record<string, number>;
};

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

/** Null when the user has never curated, so callers can seed a default. */
export function loadCuration(): Curation | null {
  try {
    const raw = localStorage.getItem(CURATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Curation>;
    if (!parsed || !Array.isArray(parsed.collectionIds)) return null;
    return {
      collectionIds: parsed.collectionIds.filter((id) => typeof id === 'string'),
      shelfSlots:
        parsed.shelfSlots && typeof parsed.shelfSlots === 'object'
          ? parsed.shelfSlots
          : {},
    };
  } catch {
    return null;
  }
}

export function saveCuration(curation: Curation): void {
  try {
    localStorage.setItem(CURATION_KEY, JSON.stringify(curation));
  } catch {
    // Private-mode quota failures shouldn't break curating.
  }
}

/** True once the visitor has chosen to enter on this version of the room. */
export function loadEntered(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveEntered(): void {
  try {
    localStorage.setItem(ENTERED_KEY, '1');
  } catch {
    // Private browsing — they'll see the introduction again next visit.
  }
}

/** Optional crate stamp. The room no longer waits on a name to open. */
export function loadViewerName(): string | null {
  try {
    const raw = localStorage.getItem(VIEWER_KEY);
    const name = raw?.trim();
    return name ? name.slice(0, VIEWER_NAME_MAX) : null;
  } catch {
    return null;
  }
}

export function saveViewerName(name: string): void {
  try {
    localStorage.setItem(VIEWER_KEY, name);
  } catch {
    // Private browsing — they'll be asked again next visit.
  }
}

const urls = new Map<string, string>();

export function objectUrlFor(key: string, blob: Blob): string {
  const existing = urls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}

export function revokeObjectUrl(key: string): void {
  const url = urls.get(key);
  if (!url) return;
  URL.revokeObjectURL(url);
  urls.delete(key);
}

export function revokeObjectUrlsWithPrefix(prefix: string): void {
  for (const key of [...urls.keys()]) {
    if (!key.startsWith(prefix)) continue;
    revokeObjectUrl(key);
  }
}

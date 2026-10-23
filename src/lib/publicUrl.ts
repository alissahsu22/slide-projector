/**
 * Resolves a file in `public/` against Vite's `base`, so assets still load when
 * the site is served under a subpath (alissahsu.com/projects/upstairs-room/).
 */
export function publicUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

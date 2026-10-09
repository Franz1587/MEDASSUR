// Images du guide servies dynamiquement par le backend (2026-10) — les PNG
// ne sont plus bundlés dans le build Vite. Cela permet de les mettre à jour
// sur le VPS sans rebuilder le frontend (copier les nouvelles captures dans
// backend/assets/guide/ suffit). L'endpoint GET /guide-assets/:filename est
// public (pas d'auth) car les images sont chargées via <img src> côté client.
export function img(filename: string): string {
  if (!filename) return "";
  return `/guide-assets/${filename}`;
}

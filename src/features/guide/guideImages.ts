// Images du guide (2026-10) — servies par l'API (/api/guide-assets/:filename)
// avec Cache-Control: max-age=86400 (24 h). Après la première visite, toutes
// les captures sont en cache navigateur : plus aucune requête réseau pour les
// 20+ images d'un chapitre. Chemin public (pas d'auth), voir GuideAssetsController.
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export function img(filename: string): string {
  if (!filename) return "";
  return `${API}/guide-assets/${filename}`;
}

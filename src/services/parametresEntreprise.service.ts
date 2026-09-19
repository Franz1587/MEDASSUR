import { API_URL, getAccessToken, http } from "@/lib/http";
import type { ParametresEntreprise } from "@/types/parametresEntreprise";

export async function getParametresEntreprise(): Promise<ParametresEntreprise> {
  return http.get<ParametresEntreprise>("/parametres-entreprise");
}

export async function updateParametresEntreprise(payload: Partial<ParametresEntreprise>): Promise<ParametresEntreprise> {
  return http.patch<ParametresEntreprise>("/parametres-entreprise", payload);
}

// URL publique d'un logo de société uploadé (voir POST /parametres-
// entreprise/logo, servie statiquement hors du préfixe /api — voir
// backend/src/main.ts). Même patron que compagnieLogoUrl.
export function logoEntrepriseUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/logos-entreprises/${logo}`;
}

// Logo (2026-09) — voir demande utilisateur : "on doit pouvoir mettre le
// logo de l'entreprise. C'est ce logo qui remonte sur les quittances, les
// courriers, les prises en charge, les factures, les règlements, les
// cartes."
export async function uploadLogoEntreprise(file: File): Promise<ParametresEntreprise> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/parametres-entreprise/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /parametres-entreprise/logo failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deleteLogoEntreprise(): Promise<ParametresEntreprise> {
  return http.delete<ParametresEntreprise>("/parametres-entreprise/logo");
}

// Page de garde du rapport Statistiques, personnalisable par société
// (2026-09) — voir demande utilisateur : "il faut seulement rendre possible
// la personnalisation de la page de garde par client (compagnie, courtier,
// mutuelle), chacun doit avoir la possibilité de personnaliser sa page de
// garde." Même patron que le logo ci-dessus.
export function pageGardeStatistiquesUrl(fichier?: string | null): string | undefined {
  if (!fichier) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/pages-garde-statistiques/${fichier}`;
}

export async function uploadPageGardeStatistiques(file: File): Promise<ParametresEntreprise> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("pageGarde", file);
  const res = await fetch(`${API_URL}/parametres-entreprise/page-garde-statistiques`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /parametres-entreprise/page-garde-statistiques failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deletePageGardeStatistiques(): Promise<ParametresEntreprise> {
  return http.delete<ParametresEntreprise>("/parametres-entreprise/page-garde-statistiques");
}

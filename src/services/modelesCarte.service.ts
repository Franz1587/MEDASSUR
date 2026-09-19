import { API_URL, getAccessToken, http } from "@/lib/http";
import type { ModeleCarte, CreerModeleCarteInput, ModifierModeleCarteInput } from "@/types/modeleCarte";

// URL publique d'une image de modèle de carte uploadée (voir
// backend/src/modeles-carte/, servie statiquement hors du préfixe /api).
export function modeleCarteImageUrl(fichier?: string | null): string | undefined {
  if (!fichier) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/modeles-carte/${fichier}`;
}

export function getModelesCarte(): Promise<ModeleCarte[]> {
  return http.get<ModeleCarte[]>("/modeles-carte");
}

export function creerModeleCarte(payload: CreerModeleCarteInput): Promise<ModeleCarte> {
  return http.post<ModeleCarte>("/modeles-carte", payload);
}

export function modifierModeleCarte(id: string, payload: ModifierModeleCarteInput): Promise<ModeleCarte> {
  return http.patch<ModeleCarte>(`/modeles-carte/${id}`, payload);
}

export function supprimerModeleCarte(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/modeles-carte/${id}`);
}

async function uploadImage(id: string, face: "recto" | "verso", file: File): Promise<ModeleCarte> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_URL}/modeles-carte/${id}/${face}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /modeles-carte/${id}/${face} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export const uploadImageRectoModeleCarte = (id: string, file: File) => uploadImage(id, "recto", file);
export const uploadImageVersoModeleCarte = (id: string, file: File) => uploadImage(id, "verso", file);

export function supprimerImageRectoModeleCarte(id: string): Promise<ModeleCarte> {
  return http.delete<ModeleCarte>(`/modeles-carte/${id}/recto`);
}

export function supprimerImageVersoModeleCarte(id: string): Promise<ModeleCarte> {
  return http.delete<ModeleCarte>(`/modeles-carte/${id}/verso`);
}

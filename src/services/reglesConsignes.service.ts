import { http, uploadFile, API_URL } from "@/lib/http";
import { openStaticDocument } from "@/services/documents.service";
import type { RegleConsigne, RegleConsigneUpsertInput } from "@/types/reglesConsignes";

// Règles & Consignes (2026-08) — voir backend/src/regles-consignes.
// Lecture ouverte à tout utilisateur authentifié (interne ET portail
// client) ; écriture réservée aux gestionnaires "Système".
export async function getReglesConsignes(actifSeulement = false): Promise<RegleConsigne[]> {
  return http.get<RegleConsigne[]>(`/regles-consignes${actifSeulement ? "?actifSeulement=true" : ""}`);
}

export async function createRegleConsigne(payload: RegleConsigneUpsertInput): Promise<RegleConsigne> {
  return http.post<RegleConsigne>("/regles-consignes", payload);
}

export async function updateRegleConsigne(id: string, payload: Partial<RegleConsigneUpsertInput>): Promise<RegleConsigne> {
  return http.patch<RegleConsigne>(`/regles-consignes/${id}`, payload);
}

export async function deleteRegleConsigne(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/regles-consignes/${id}`);
}

export async function uploadDocumentRegleConsigne(id: string, file: File): Promise<RegleConsigne> {
  return uploadFile<RegleConsigne>(`/regles-consignes/${id}/document`, file, "fichier");
}

export async function deleteDocumentRegleConsigne(id: string): Promise<RegleConsigne> {
  return http.delete<RegleConsigne>(`/regles-consignes/${id}/document`);
}

// Servi statiquement sous /uploads (voir backend/src/main.ts) — même
// principe que assurePhotoUrl (src/services/sante.service.ts).
export function regleConsigneDocumentUrl(fichier?: string | null): string | undefined {
  if (!fichier) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/regles-consignes/${fichier}`;
}

// Ouvre le document joint dans la visionneuse intégrée de l'application —
// jamais un nouvel onglet (voir demande utilisateur), quel que soit
// l'écran (interne ou portail client).
export function openRegleConsigneDocument(fichier: string): Promise<void> {
  return openStaticDocument(regleConsigneDocumentUrl(fichier)!, fichier);
}

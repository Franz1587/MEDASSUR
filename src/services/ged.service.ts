import { http, API_URL, getAccessToken } from "@/lib/http";
import type { GedDocument } from "@/types/ged";

export async function getDocuments(): Promise<GedDocument[]> {
  return http.get<GedDocument[]>("/ged/documents");
}

export interface UploadGedDocumentInput {
  fichier: File;
  sens: "Entrant" | "Sortant";
  entiteLiee?: string;
  prestataireId?: string;
  tags?: string[];
}

// Import réel (2026-09, reprise du chantier GED) — dépose le fichier et
// déclenche la lecture IA + le rapprochement facture côté serveur en un
// seul appel (voir GedController.upload) ; `sens`/`prestataireId`/
// `entiteLiee`/`tags` passent en query (comme ImportController.apercuFactures)
// pour rester un simple multipart fichier + champs texte, sans DTO @Body()
// qui se prête mal au form-data.
export async function uploadDocument(payload: UploadGedDocumentInput): Promise<GedDocument> {
  const token = getAccessToken();
  const params = new URLSearchParams({ sens: payload.sens });
  if (payload.prestataireId) params.set("prestataireId", payload.prestataireId);
  if (payload.entiteLiee) params.set("entiteLiee", payload.entiteLiee);
  if (payload.tags && payload.tags.length > 0) params.set("tags", payload.tags.join(","));
  const form = new FormData();
  form.append("fichier", payload.fichier);
  const res = await fetch(`${API_URL}/ged/documents/upload?${params.toString()}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /ged/documents/upload failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function rapprocherDocument(id: string): Promise<GedDocument> {
  return http.post<GedDocument>(`/ged/documents/${id}/rapprocher`, {});
}

export async function deleteDocument(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/ged/documents/${id}`);
}

// URL directe vers le fichier archivé — même principe que
// urlDocumentAccordPrealable (route générique /uploads/:categorie/:fichier,
// voir main.ts).
export function urlDocumentGed(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/ged/${fichier}`;
}

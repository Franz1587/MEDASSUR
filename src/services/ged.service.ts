import { http } from "@/lib/http";
import type { GedDocument } from "@/types/ged";

export async function getDocuments(): Promise<GedDocument[]> {
  return http.get<GedDocument[]>("/ged/documents");
}

export interface GedDocumentUpsertInput {
  nom: string;
  type: string;
  entiteLiee: string;
  tags: string[];
}

export async function createDocument(payload: GedDocumentUpsertInput): Promise<GedDocument> {
  return http.post<GedDocument>("/ged/documents", payload);
}

export async function deleteDocument(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/ged/documents/${id}`);
}

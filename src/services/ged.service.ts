import { http } from "@/lib/http";
import type { GedDocument } from "@/types/ged";

export async function getDocuments(): Promise<GedDocument[]> {
  return http.get<GedDocument[]>("/ged/documents");
}

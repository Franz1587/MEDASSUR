import { mockDocuments } from "@/data/mock/ged.mock";
import type { GedDocument } from "@/types/ged";

export async function getDocuments(): Promise<GedDocument[]> {
  return mockDocuments;
}

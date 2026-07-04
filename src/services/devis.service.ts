import { mockDevis } from "@/data/mock/devis.mock";
import type { Devis } from "@/types/devis";

export async function getDevis(): Promise<Devis[]> {
  return mockDevis;
}

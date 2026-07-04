import { mockContrats } from "@/data/mock/contrats.mock";
import type { Contrat } from "@/types/contrats";

export async function getContrats(): Promise<Contrat[]> {
  return mockContrats;
}

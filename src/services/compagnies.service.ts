import { mockCompagnies } from "@/data/mock/compagnies.mock";
import type { Compagnie } from "@/types/compagnies";

export async function getCompagnies(): Promise<Compagnie[]> {
  return mockCompagnies;
}

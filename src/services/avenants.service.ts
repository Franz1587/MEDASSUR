import { mockAvenants } from "@/data/mock/avenants.mock";
import type { Avenant } from "@/types/avenants";

export async function getAvenants(): Promise<Avenant[]> {
  return mockAvenants;
}

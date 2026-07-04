import { mockResiliations } from "@/data/mock/resiliations.mock";
import type { Resiliation } from "@/types/resiliations";

export async function getResiliations(): Promise<Resiliation[]> {
  return mockResiliations;
}

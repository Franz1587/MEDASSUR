import { mockRenouvellements } from "@/data/mock/renouvellements.mock";
import type { Renouvellement } from "@/types/renouvellements";

export async function getRenouvellements(): Promise<Renouvellement[]> {
  return mockRenouvellements;
}

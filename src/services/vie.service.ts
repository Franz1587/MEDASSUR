import { mockContratsVie } from "@/data/mock/vie.mock";
import type { ContratVie } from "@/types/vie";

export async function getContratsVie(): Promise<ContratVie[]> {
  return mockContratsVie;
}

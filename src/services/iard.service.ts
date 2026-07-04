import { mockPolicesIard, iardRepartition } from "@/data/mock/iard.mock";
import type { PoliceIard, IardRepartition } from "@/types/iard";

export async function getPolicesIard(): Promise<PoliceIard[]> {
  return mockPolicesIard;
}

export async function getIardRepartition(): Promise<IardRepartition[]> {
  return iardRepartition;
}

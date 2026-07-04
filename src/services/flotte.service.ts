import { mockFlottes } from "@/data/mock/flotte.mock";
import type { Flotte } from "@/types/flotte";

export async function getFlottes(): Promise<Flotte[]> {
  return mockFlottes;
}

import { mockImpayes, recouvrementKanban } from "@/data/mock/recouvrement.mock";
import type { Impaye } from "@/types/recouvrement";

export async function getImpayes(): Promise<Impaye[]> {
  return mockImpayes;
}

export async function getRecouvrementKanban(): Promise<Record<string, string[]>> {
  return recouvrementKanban;
}

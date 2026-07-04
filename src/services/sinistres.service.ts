import { mockSinistres, kanbanColumns } from "@/data/mock/sinistres.mock";
import type { Sinistre } from "@/types/sinistres";

export async function getSinistres(): Promise<Sinistre[]> {
  return mockSinistres;
}

export async function getSinistresKanban(): Promise<Record<string, string[]>> {
  return kanbanColumns;
}

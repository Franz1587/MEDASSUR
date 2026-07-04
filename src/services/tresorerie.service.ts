import { mockComptesBancaires, mockFluxTresorerie } from "@/data/mock/tresorerie.mock";
import type { CompteBancaire, FluxTresorerie } from "@/types/tresorerie";

export async function getComptesBancaires(): Promise<CompteBancaire[]> {
  return mockComptesBancaires;
}

export async function getFluxTresorerie(): Promise<FluxTresorerie[]> {
  return mockFluxTresorerie;
}

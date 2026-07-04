import type { mockComptesBancaires, mockFluxTresorerie } from "@/data/mock/tresorerie.mock";

export type CompteBancaire = (typeof mockComptesBancaires)[number];
export type FluxTresorerie = (typeof mockFluxTresorerie)[number];

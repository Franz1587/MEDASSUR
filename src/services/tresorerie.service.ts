import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { CompteBancaire, FluxTresorerie } from "@/types/tresorerie";

interface ApiCompteBancaire {
  id: string;
  banque: string;
  pays: string;
  devise: string;
  solde: string | number;
}

interface ApiFluxTresorerie {
  id: string;
  date: string;
  libelle: string;
  type: string;
  montant: string | number;
  rapproche: boolean;
}

export async function getComptesBancaires(): Promise<CompteBancaire[]> {
  const data = await http.get<ApiCompteBancaire[]>("/tresorerie/comptes");
  return data.map((c) => ({ ...c, solde: toNumber(c.solde) }));
}

export async function getFluxTresorerie(): Promise<FluxTresorerie[]> {
  const data = await http.get<ApiFluxTresorerie[]>("/tresorerie/flux");
  return data.map((f) => ({ ...f, montant: toNumber(f.montant) }));
}

export interface FluxUpsertInput {
  date: string;
  libelle: string;
  type: "Encaissement" | "Décaissement";
  montant: number;
  compteId: string;
}

export async function createFlux(payload: FluxUpsertInput): Promise<FluxTresorerie> {
  const f = await http.post<ApiFluxTresorerie>("/tresorerie/flux", payload);
  return { ...f, montant: toNumber(f.montant) };
}

export async function rapprocherFlux(id: string): Promise<FluxTresorerie> {
  const f = await http.patch<ApiFluxTresorerie>(`/tresorerie/flux/${id}/rapprocher`);
  return { ...f, montant: toNumber(f.montant) };
}

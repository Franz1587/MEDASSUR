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

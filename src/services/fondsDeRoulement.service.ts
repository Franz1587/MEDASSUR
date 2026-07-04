import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { FondsDeRoulement } from "@/types/fondsDeRoulement";

interface ApiFondsDeRoulement {
  id: string;
  contratId: string;
  montantInitial: string | number;
  montantConsomme: string | number;
  seuilAlerte: string | number;
  statut: string;
  dateAlimentation: string;
  contrat: { client: { nom: string } };
}

export async function getFondsDeRoulement(): Promise<FondsDeRoulement[]> {
  const data = await http.get<ApiFondsDeRoulement[]>("/fonds-de-roulement");
  return data.map((f) => ({
    id: f.id,
    contratId: f.contratId,
    clientNom: f.contrat.client.nom,
    montantInitial: toNumber(f.montantInitial),
    montantConsomme: toNumber(f.montantConsomme),
    seuilAlerte: toNumber(f.seuilAlerte),
    statut: f.statut,
    dateAlimentation: f.dateAlimentation,
  }));
}

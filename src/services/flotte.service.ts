import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Flotte } from "@/types/flotte";

interface ApiFlotte {
  id: string;
  contratId: string;
  nbVehicules: number;
  primeTotal: string | number;
  statut: string;
  client: { nom: string };
  compagnie: { nom: string };
  vehicules: { immatriculation: string; modele: string; conducteur: string; valeurVenale: string | number; statut: string }[];
}

export async function getFlottes(): Promise<Flotte[]> {
  const data = await http.get<ApiFlotte[]>("/flotte");
  return data.map((f) => ({
    id: f.id,
    client: f.client.nom,
    contrat: f.contratId,
    compagnie: f.compagnie.nom,
    nbVehicules: f.nbVehicules,
    primeTotal: toNumber(f.primeTotal),
    statut: f.statut,
    vehicules: f.vehicules.map((v) => ({
      immatriculation: v.immatriculation,
      modele: v.modele,
      conducteur: v.conducteur,
      valeurVenale: toNumber(v.valeurVenale),
      statut: v.statut,
    })),
  }));
}

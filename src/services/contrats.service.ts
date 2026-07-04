import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import { getRenouvellements } from "@/services/renouvellements.service";
import type { Contrat } from "@/types/contrats";

interface ApiContrat {
  id: string;
  branche: string;
  dateDebut: string;
  dateFin: string;
  prime: string | number;
  statut: string;
  client: { nom: string };
  compagnie: { nom: string };
}

export async function getContrats(): Promise<Contrat[]> {
  const [contrats, renouvellements] = await Promise.all([
    http.get<ApiContrat[]>("/contrats"),
    getRenouvellements(),
  ]);
  const joursByContrat = new Map(renouvellements.map((r) => [r.contrat, r.joursRestants]));

  return contrats.map((c) => {
    const jours = joursByContrat.get(c.id);
    return {
      id: c.id,
      client: c.client.nom,
      branche: c.branche,
      compagnie: c.compagnie.nom,
      dateDebut: c.dateDebut,
      dateFin: c.dateFin,
      prime: toNumber(c.prime),
      statut: c.statut,
      jours: jours === undefined ? "—" : `${jours} jours`,
    };
  });
}

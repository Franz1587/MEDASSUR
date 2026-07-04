import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { ContratVie } from "@/types/vie";

interface ApiContratVie {
  id: string;
  assure: string;
  produit: string;
  capitalGaranti: string | number;
  primeAnnuelle: string | number;
  dateEffet: string;
  statut: string;
  compagnie: { nom: string };
  beneficiaires: { nom: string; lien: string; quotePart: number }[];
}

export async function getContratsVie(): Promise<ContratVie[]> {
  const data = await http.get<ApiContratVie[]>("/vie");
  return data.map((c) => ({
    id: c.id,
    assure: c.assure,
    produit: c.produit,
    compagnie: c.compagnie.nom,
    capitalGaranti: toNumber(c.capitalGaranti),
    primeAnnuelle: toNumber(c.primeAnnuelle),
    dateEffet: c.dateEffet,
    statut: c.statut,
    beneficiaires: c.beneficiaires.map((b) => ({ nom: b.nom, lien: b.lien, quotePart: b.quotePart })),
  }));
}

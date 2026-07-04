import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { BordereauReglement } from "@/types/reglement";

interface ApiBordereau {
  id: string;
  prestataireId: string;
  periode: string;
  nbPrisesEnCharge: number;
  montantTotal: string | number;
  montantValide?: string | number | null;
  statut: string;
  dateReception: string;
  datePaiement?: string;
  referenceVirement?: string;
  prestataire: { nom: string };
}

function mapBordereau(b: ApiBordereau): BordereauReglement {
  return {
    id: b.id,
    prestataireId: b.prestataireId,
    prestataireNom: b.prestataire.nom,
    periode: b.periode,
    nbPrisesEnCharge: b.nbPrisesEnCharge,
    montantTotal: toNumber(b.montantTotal),
    montantValide: b.montantValide !== undefined && b.montantValide !== null ? toNumber(b.montantValide) : undefined,
    statut: b.statut,
    dateReception: b.dateReception,
    datePaiement: b.datePaiement,
    referenceVirement: b.referenceVirement,
  };
}

export async function getBordereaux(): Promise<BordereauReglement[]> {
  const data = await http.get<ApiBordereau[]>("/reglement-prestataire");
  return data.map(mapBordereau);
}

export async function genererBordereau(prestataireId: string, periode: string): Promise<BordereauReglement> {
  const data = await http.post<ApiBordereau>("/reglement-prestataire/generer", { prestataireId, periode });
  return mapBordereau(data);
}

export async function validerBordereau(id: string): Promise<BordereauReglement> {
  const data = await http.patch<ApiBordereau>(`/reglement-prestataire/${id}/valider`, {});
  return mapBordereau(data);
}

export async function rejeterBordereau(id: string): Promise<BordereauReglement> {
  const data = await http.patch<ApiBordereau>(`/reglement-prestataire/${id}/rejeter`, {});
  return mapBordereau(data);
}

export async function payerBordereau(id: string, referenceVirement: string): Promise<BordereauReglement> {
  const data = await http.patch<ApiBordereau>(`/reglement-prestataire/${id}/payer`, { referenceVirement });
  return mapBordereau(data);
}

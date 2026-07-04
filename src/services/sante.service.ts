import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { AssureSante, PriseEnCharge } from "@/types/sante";

interface ApiAssureSante {
  id: string;
  nom: string;
  matricule: string;
  contratId: string;
  beneficiaires: number;
  cotisation: string | number;
  statut: string;
}

interface ApiPriseEnCharge {
  id: string;
  prestataire: string;
  type: string;
  montant: string | number;
  statut: string;
  date: string;
  assure: { nom: string };
}

export async function getAssuresSante(): Promise<AssureSante[]> {
  const data = await http.get<ApiAssureSante[]>("/sante/assures");
  return data.map((a) => ({
    id: a.id,
    nom: a.nom,
    matricule: a.matricule,
    police: a.contratId,
    benef: a.beneficiaires,
    cotisation: toNumber(a.cotisation),
    statut: a.statut,
  }));
}

export async function getPriseEnCharges(): Promise<PriseEnCharge[]> {
  const data = await http.get<ApiPriseEnCharge[]>("/sante/prises-en-charge");
  return data.map((pc) => ({
    id: pc.id,
    assure: pc.assure.nom,
    prestataire: pc.prestataire,
    type: pc.type,
    montant: toNumber(pc.montant),
    statut: pc.statut,
    date: pc.date,
  }));
}

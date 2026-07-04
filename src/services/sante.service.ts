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
  dateNaissance?: string;
  statutMatrimonial?: string;
  numeroAssure?: string;
  qrCode?: string;
  statutCarte?: string;
  dateAffiliation?: string;
  dateRadiation?: string;
  motifRadiation?: string;
  ayantsDroit: { nom: string; lienParente: string; dateNaissance: string; statut: string }[];
}

interface ApiPriseEnCharge {
  id: string;
  prestataire: string;
  type: string;
  montant: string | number;
  statut: string;
  date: string;
  assure: { nom: string };
  modePaiement?: string;
  statutControleMedical?: string;
  motifRejet?: string;
  baseRemboursement?: string | number;
  tauxRemboursement?: string | number;
  franchise?: string | number;
  plafondApplique?: string | number;
  resteACharge?: string | number;
  ordrePaiement?: string;
  accordPrealableId?: string | null;
  scoreFraude?: string | number;
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
    dateNaissance: a.dateNaissance,
    statutMatrimonial: a.statutMatrimonial,
    numeroAssure: a.numeroAssure,
    qrCode: a.qrCode,
    statutCarte: a.statutCarte,
    dateAffiliation: a.dateAffiliation,
    dateRadiation: a.dateRadiation,
    motifRadiation: a.motifRadiation,
    ayantsDroit: a.ayantsDroit ?? [],
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
    modePaiement: pc.modePaiement,
    statutControleMedical: pc.statutControleMedical,
    motifRejet: pc.motifRejet,
    baseRemboursement: pc.baseRemboursement !== undefined ? toNumber(pc.baseRemboursement) : undefined,
    tauxRemboursement: pc.tauxRemboursement !== undefined ? toNumber(pc.tauxRemboursement) : undefined,
    franchise: pc.franchise !== undefined ? toNumber(pc.franchise) : undefined,
    plafondApplique: pc.plafondApplique !== undefined ? toNumber(pc.plafondApplique) : undefined,
    resteACharge: pc.resteACharge !== undefined ? toNumber(pc.resteACharge) : undefined,
    ordrePaiement: pc.ordrePaiement,
    accordPrealableId: pc.accordPrealableId,
    scoreFraude: pc.scoreFraude !== undefined ? toNumber(pc.scoreFraude) : undefined,
  }));
}

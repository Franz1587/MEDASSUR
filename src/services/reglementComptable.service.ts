import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { BordereauEligibleLettreCheque, LettreCheque, LettreChequeDetail } from "@/types/reglementComptable";

interface ApiBordereauEligible {
  id: string; numero: string; periode: string; nbPrisesEnCharge: number;
  montantTotal: string | number; montantValide?: string | number | null;
  montantNet: string | number;
  dateReception: string; compagnies: { id: string; nom: string }[];
}

function mapBordereauEligible(b: ApiBordereauEligible): BordereauEligibleLettreCheque {
  return {
    id: b.id, numero: b.numero, periode: b.periode, nbPrisesEnCharge: b.nbPrisesEnCharge,
    montantTotal: toNumber(b.montantTotal),
    montantValide: b.montantValide != null ? toNumber(b.montantValide) : undefined,
    montantNet: toNumber(b.montantNet),
    dateReception: b.dateReception, compagnies: b.compagnies,
  };
}

export async function getBordereauxEligiblesLettreCheque(filtres: { prestataireId: string; compagnieId?: string }): Promise<BordereauEligibleLettreCheque[]> {
  const params = new URLSearchParams();
  params.set("prestataireId", filtres.prestataireId);
  if (filtres.compagnieId) params.set("compagnieId", filtres.compagnieId);
  const data = await http.get<ApiBordereauEligible[]>(`/reglement-comptable/eligibles?${params.toString()}`);
  return data.map(mapBordereauEligible);
}

interface ApiLettreCheque {
  id: string; numero: string; banqueId: string; banque: { nom: string };
  numeroCheque: number; compagnieId?: string | null; compagnie?: { nom: string } | null;
  prestataireId: string; prestataire: { nom: string };
  montantTotal: string | number; statut: string; dateEmission: string;
}

function mapLettreCheque(l: ApiLettreCheque): LettreCheque {
  return {
    id: l.id, numero: l.numero, banqueId: l.banqueId, banqueNom: l.banque.nom,
    numeroCheque: l.numeroCheque, compagnieId: l.compagnieId ?? undefined, compagnieNom: l.compagnie?.nom,
    prestataireId: l.prestataireId, prestataireNom: l.prestataire.nom,
    montantTotal: toNumber(l.montantTotal), statut: l.statut, dateEmission: l.dateEmission,
  };
}

export interface LettresChequeFiltres {
  prestataireId?: string; banqueId?: string; compagnieId?: string;
  du?: string; au?: string; reference?: string;
}

export async function getLettresCheque(filtres?: LettresChequeFiltres): Promise<LettreCheque[]> {
  const params = new URLSearchParams();
  if (filtres?.prestataireId) params.set("prestataireId", filtres.prestataireId);
  if (filtres?.banqueId) params.set("banqueId", filtres.banqueId);
  if (filtres?.compagnieId) params.set("compagnieId", filtres.compagnieId);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  if (filtres?.reference) params.set("reference", filtres.reference);
  const qs = params.toString();
  const data = await http.get<ApiLettreCheque[]>(`/reglement-comptable${qs ? `?${qs}` : ""}`);
  return data.map(mapLettreCheque);
}

interface ApiLettreChequeBordereau {
  id: string; numero: string; periode: string; nbPrisesEnCharge: number;
  montantTotal: string | number; montantValide?: string | number | null;
  montantNet: string | number; statut: string;
}
interface ApiLettreChequeDetail extends ApiLettreCheque {
  bordereaux: ApiLettreChequeBordereau[];
}

function mapLettreChequeBordereau(b: ApiLettreChequeBordereau) {
  return {
    id: b.id, numero: b.numero, periode: b.periode, nbPrisesEnCharge: b.nbPrisesEnCharge,
    montantTotal: toNumber(b.montantTotal),
    montantValide: b.montantValide != null ? toNumber(b.montantValide) : undefined,
    montantNet: toNumber(b.montantNet),
    statut: b.statut,
  };
}

export async function getLettreCheque(id: string): Promise<LettreChequeDetail> {
  const data = await http.get<ApiLettreChequeDetail>(`/reglement-comptable/${id}`);
  return { ...mapLettreCheque(data), bordereaux: data.bordereaux.map(mapLettreChequeBordereau) };
}

export async function genererLettreCheque(payload: {
  banqueId: string; prestataireId: string; compagnieId?: string; bordereauIds: string[];
}): Promise<LettreChequeDetail> {
  const data = await http.post<ApiLettreChequeDetail>("/reglement-comptable/generer", payload);
  return { ...mapLettreCheque(data), bordereaux: data.bordereaux.map(mapLettreChequeBordereau) };
}

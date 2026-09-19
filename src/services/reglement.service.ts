import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type {
  BordereauReglement, BordereauReglementDetail, BordereauReglementLigne, FactureEligibleReglement,
  HistoriqueReglementResultat, HistoriqueReglementLigne, HistoriqueReglementExercice,
} from "@/types/reglement";

interface ApiBordereau {
  id: string;
  numero: string;
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
  medecinId?: string | null;
  medecin?: { nom: string; prenom?: string | null; titre?: string | null } | null;
  lettreCheque?: { numero: string; numeroCheque: number; banque: { nom: string } } | null;
}

function mapBordereau(b: ApiBordereau): BordereauReglement {
  return {
    id: b.id,
    numero: b.numero,
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
    lettreChequeNumero: b.lettreCheque?.numero,
    numeroCheque: b.lettreCheque?.numeroCheque,
    banqueNom: b.lettreCheque?.banque.nom,
    medecinId: b.medecinId,
    medecinNom: b.medecin ? `${b.medecin.titre ? `${b.medecin.titre} ` : ""}${b.medecin.nom}${b.medecin.prenom ? ` ${b.medecin.prenom}` : ""}` : null,
  };
}

export async function getBordereaux(): Promise<BordereauReglement[]> {
  const data = await http.get<ApiBordereau[]>("/reglement-prestataire");
  return data.map(mapBordereau);
}

interface ApiBordereauLigne {
  id: string;
  assureId: string;
  assure: { nom: string; prenom?: string | null };
  familleId?: string | null;
  facture: { id: string; referenceFacture: string } | null;
  decompteNumero: string | null;
  montant: string | number;
  baseRemboursement?: string | number | null;
  resteACharge?: string | number | null;
  date: string;
  statut: string;
}
interface ApiBordereauDetail extends ApiBordereau {
  prisesEnCharge: ApiBordereauLigne[];
}

function mapLigneDetail(l: ApiBordereauLigne): BordereauReglementLigne {
  return {
    id: l.id,
    assureId: l.assureId,
    assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
    familleNom: l.assure.nom.split(" ")[0],
    factureId: l.facture?.id ?? null,
    factureReference: l.facture?.referenceFacture ?? null,
    decompteNumero: l.decompteNumero,
    montant: toNumber(l.montant),
    baseRemboursement: l.baseRemboursement != null ? toNumber(l.baseRemboursement) : undefined,
    resteACharge: l.resteACharge != null ? toNumber(l.resteACharge) : undefined,
    date: l.date,
    statut: l.statut,
  };
}

export async function getBordereau(id: string): Promise<BordereauReglementDetail> {
  const data = await http.get<ApiBordereauDetail>(`/reglement-prestataire/${id}`);
  return { ...mapBordereau(data), lignes: data.prisesEnCharge.map(mapLigneDetail) };
}

export async function genererBordereau(payload: { prestataireId: string; factureIds: string[]; periode?: string; medecinId?: string }): Promise<BordereauReglement> {
  const data = await http.post<ApiBordereau>("/reglement-prestataire/generer", payload);
  return mapBordereau(data);
}

// Changer le bénéficiaire du règlement après coup (2026-08) — voir demande
// utilisateur : "que le règlement se fasse à l'ordre d'un médecin". `null`
// remet le règlement à l'ordre de la structure elle-même.
export async function definirMedecinBordereau(id: string, medecinId: string | null): Promise<BordereauReglement> {
  const data = await http.patch<ApiBordereau>(`/reglement-prestataire/${id}/medecin`, { medecinId });
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

// ── Recherche de factures éligibles à un nouveau règlement ─────────────
interface ApiFactureEligible {
  id: string;
  referenceFacture: string;
  numerosSupplementaires: { numero: string }[];
  prestataireId: string;
  prestataire: { nom: string };
  contratId: string;
  contrat: { client: { id: string; nom: string }; compagnie: { id: string; nom: string } };
  dateReception: string;
  lignes: { montant: string | number }[];
}

function mapFactureEligible(f: ApiFactureEligible): FactureEligibleReglement {
  return {
    id: f.id,
    referenceFacture: f.referenceFacture,
    numerosSupplementaires: f.numerosSupplementaires.map((n) => n.numero),
    prestataireId: f.prestataireId,
    prestataireNom: f.prestataire.nom,
    clientId: f.contrat.client.id,
    clientNom: f.contrat.client.nom,
    compagnieId: f.contrat.compagnie.id,
    compagnieNom: f.contrat.compagnie.nom,
    contratId: f.contratId,
    dateReception: f.dateReception,
    montant: f.lignes.reduce((s, l) => s + toNumber(l.montant), 0),
    nbLignes: f.lignes.length,
  };
}

// ── Historique de factures par exercice (écran "Règlement") ────────────
interface ApiHistoriqueLigne {
  id: string; date: string; exercice: string; assureNom: string; assureId: string;
  factureId: string | null; factureReference: string | null;
  decompteNumero: string | null; numeroSinistre: string | null;
  montant: string | number; montantRembourse: string | number; statutLigne: string;
  bordereauId: string | null; bordereauNumero: string | null; bordereauStatut: string | null;
  lettreChequeNumero: string | null; numeroCheque: number | null; banqueNom: string | null;
  prestataireId: string | null; prestataireNom: string;
}
interface ApiHistoriqueExercice {
  annee: string; nbLignes: number; montantDeclare: string | number; montantRembourse: string | number;
}
interface ApiHistoriqueResultat {
  lignes: ApiHistoriqueLigne[];
  exercices: ApiHistoriqueExercice[];
}

function mapHistoriqueLigne(l: ApiHistoriqueLigne): HistoriqueReglementLigne {
  return { ...l, montant: toNumber(l.montant), montantRembourse: toNumber(l.montantRembourse) };
}
function mapHistoriqueExercice(e: ApiHistoriqueExercice): HistoriqueReglementExercice {
  return { annee: e.annee, nbLignes: e.nbLignes, montantDeclare: toNumber(e.montantDeclare), montantRembourse: toNumber(e.montantRembourse) };
}

export interface HistoriqueReglementFiltres {
  prestataireId?: string; du?: string; au?: string;
  numeroReglement?: string; referenceDecompte?: string; assure?: string;
  referenceReglementComptable?: string;
}

function historiqueParams(filtres: HistoriqueReglementFiltres): URLSearchParams {
  const params = new URLSearchParams();
  if (filtres.prestataireId) params.set("prestataireId", filtres.prestataireId);
  if (filtres.du) params.set("du", filtres.du);
  if (filtres.au) params.set("au", filtres.au);
  if (filtres.numeroReglement) params.set("numeroReglement", filtres.numeroReglement);
  if (filtres.referenceDecompte) params.set("referenceDecompte", filtres.referenceDecompte);
  if (filtres.assure) params.set("assure", filtres.assure);
  if (filtres.referenceReglementComptable) params.set("referenceReglementComptable", filtres.referenceReglementComptable);
  return params;
}

export async function getHistoriqueReglements(filtres: HistoriqueReglementFiltres): Promise<HistoriqueReglementResultat> {
  const qs = historiqueParams(filtres).toString();
  const data = await http.get<ApiHistoriqueResultat>(`/reglement-prestataire/historique${qs ? `?${qs}` : ""}`);
  return { lignes: data.lignes.map(mapHistoriqueLigne), exercices: data.exercices.map(mapHistoriqueExercice) };
}

export async function getFacturesEligiblesReglement(filtres: {
  prestataireId: string; compagnieId?: string; clientId?: string; du?: string; au?: string;
}): Promise<FactureEligibleReglement[]> {
  const params = new URLSearchParams();
  params.set("prestataireId", filtres.prestataireId);
  if (filtres.compagnieId) params.set("compagnieId", filtres.compagnieId);
  if (filtres.clientId) params.set("clientId", filtres.clientId);
  if (filtres.du) params.set("du", filtres.du);
  if (filtres.au) params.set("au", filtres.au);
  const data = await http.get<ApiFactureEligible[]>(`/factures/eligibles-reglement?${params.toString()}`);
  return data.map(mapFactureEligible);
}

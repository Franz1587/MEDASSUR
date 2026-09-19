import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { ApercuLigne, Facture, FactureLigne } from "@/types/facture";

interface ApiFactureLigne {
  id: string;
  assureId: string;
  assure: { nom: string; prenom?: string | null };
  type: string;
  date: string;
  acteMedicalId?: string | null;
  acteMedical?: { libelle: string } | null;
  accordPrealableId?: string | null;
  montant: string | number;
  baseRemboursement?: string | number | null;
  montantTps?: string | number | null;
  resteACharge?: string | number | null;
  tauxRemboursement?: string | number | null;
  plafondApplique?: string | number | null;
  statut: string;
  motifRejet?: string | null;
  montantRejete?: string | number | null;
  nSinistre?: string | null;
  nDeclaration?: string | null;
  natureMaladie?: string | null;
  codeAffection?: string | null;
  quantite?: number | null;
  lettreCleCode?: string | null;
  coefficient?: string | number | null;
  bordereau?: { id: string; numero: string; statut: string; lettreCheque?: { numero: string; numeroCheque: number; banque: { nom: string } } | null } | null;
}

interface ApiFacture {
  id: string;
  prestataireId: string;
  prestataire: { nom: string };
  contratId: string;
  contrat: { client: { nom: string }; compagnie: { nom: string } };
  dateReception: string;
  referenceFacture: string;
  gestionnaireId?: string | null;
  numerosSupplementaires: { id: string; numero: string }[];
  statut: string;
  motifAnnulation?: string | null;
  lignes: ApiFactureLigne[];
}

interface ApiApercuLigne {
  tauxRemboursement?: string | number | null;
  baseRemboursement?: string | number | null;
  resteACharge?: string | number | null;
  plafondApplique?: string | number | null;
  messagePlafond?: string | null;
}

function mapLigne(l: ApiFactureLigne): FactureLigne {
  return {
    id: l.id,
    assureId: l.assureId,
    assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
    typePrestation: l.type,
    datePrestation: l.date,
    acteMedicalId: l.acteMedicalId ?? undefined,
    acteLibelle: l.acteMedical?.libelle,
    accordPrealableId: l.accordPrealableId,
    montant: toNumber(l.montant),
    baseRemboursement: l.baseRemboursement != null ? toNumber(l.baseRemboursement) : undefined,
    montantTps: l.montantTps != null ? toNumber(l.montantTps) : undefined,
    resteACharge: l.resteACharge != null ? toNumber(l.resteACharge) : undefined,
    tauxRemboursement: l.tauxRemboursement != null ? toNumber(l.tauxRemboursement) : undefined,
    plafondApplique: l.plafondApplique != null ? toNumber(l.plafondApplique) : undefined,
    statut: l.statut,
    motifRejet: l.motifRejet ?? undefined,
    montantRejete: l.montantRejete != null ? toNumber(l.montantRejete) : undefined,
    nSinistre: l.nSinistre ?? undefined,
    nDeclaration: l.nDeclaration ?? undefined,
    natureMaladie: (l.natureMaladie as "AffectionCourante" | "AffectionLongue" | null) ?? undefined,
    codeAffection: l.codeAffection ?? undefined,
    quantite: l.quantite ?? undefined,
    lettreCleCode: l.lettreCleCode ?? undefined,
    coefficient: l.coefficient != null ? toNumber(l.coefficient) : undefined,
  };
}

function mapFacture(f: ApiFacture): Facture {
  // Toutes les lignes d'une facture partagent le même bordereau (une
  // facture est verrouillée en bloc dès qu'elle rejoint un règlement, voir
  // FacturesService.findEligiblesReglement) — on prend la première trouvée.
  const bordereau = f.lignes.find((l) => l.bordereau)?.bordereau;
  return {
    id: f.id,
    prestataireId: f.prestataireId,
    prestataireNom: f.prestataire.nom,
    contratId: f.contratId,
    clientNom: f.contrat.client.nom,
    compagnieNom: f.contrat.compagnie.nom,
    dateReception: f.dateReception,
    referenceFacture: f.referenceFacture,
    gestionnaireId: f.gestionnaireId ?? null,
    numerosSupplementaires: f.numerosSupplementaires,
    statut: f.statut,
    motifAnnulation: f.motifAnnulation ?? undefined,
    bordereauId: bordereau?.id,
    bordereauNumero: bordereau?.numero,
    bordereauStatut: bordereau?.statut,
    lettreChequeNumero: bordereau?.lettreCheque?.numero,
    numeroCheque: bordereau?.lettreCheque?.numeroCheque,
    banqueNom: bordereau?.lettreCheque?.banque.nom,
    lignes: f.lignes.map(mapLigne),
  };
}

function mapApercu(a: ApiApercuLigne): ApercuLigne {
  return {
    tauxRemboursement: a.tauxRemboursement != null ? toNumber(a.tauxRemboursement) : undefined,
    baseRemboursement: a.baseRemboursement != null ? toNumber(a.baseRemboursement) : undefined,
    resteACharge: a.resteACharge != null ? toNumber(a.resteACharge) : undefined,
    plafondApplique: a.plafondApplique != null ? toNumber(a.plafondApplique) : undefined,
    messagePlafond: a.messagePlafond ?? undefined,
  };
}

export interface FacturesFiltre {
  prestataireId?: string;
  contratId?: string;
  // Souscripteur (2026-09 — recherche avancée) — passe par la relation
  // contrat côté backend (une Facture n'a pas de clientId direct).
  clientId?: string;
  statut?: string;
  // Recherche par référence — matche referenceFacture OU l'un des
  // numerosSupplementaires (voir FacturesService.findAll).
  reference?: string;
  // Période de réception (JJ/MM/AAAA) — 2026-09, recherche avancée.
  du?: string;
  au?: string;
  gestionnaireId?: string;
}

export async function getFactures(filtre?: FacturesFiltre): Promise<Facture[]> {
  const params = new URLSearchParams();
  if (filtre?.prestataireId) params.set("prestataireId", filtre.prestataireId);
  if (filtre?.contratId) params.set("contratId", filtre.contratId);
  if (filtre?.clientId) params.set("clientId", filtre.clientId);
  if (filtre?.statut) params.set("statut", filtre.statut);
  if (filtre?.reference) params.set("reference", filtre.reference);
  if (filtre?.du) params.set("du", filtre.du);
  if (filtre?.au) params.set("au", filtre.au);
  if (filtre?.gestionnaireId) params.set("gestionnaireId", filtre.gestionnaireId);
  const qs = params.toString();
  const data = await http.get<ApiFacture[]>(`/factures${qs ? `?${qs}` : ""}`);
  return data.map(mapFacture);
}

export async function getFacture(id: string): Promise<Facture> {
  const data = await http.get<ApiFacture>(`/factures/${id}`);
  return mapFacture(data);
}

export interface FactureUpsertInput {
  prestataireId: string;
  contratId: string;
  dateReception: string;
  referenceFacture: string;
}

export async function createFacture(payload: FactureUpsertInput): Promise<Facture> {
  const data = await http.post<ApiFacture>("/factures", payload);
  return mapFacture(data);
}

export async function terminerFacture(id: string): Promise<Facture> {
  const data = await http.patch<ApiFacture>(`/factures/${id}`, { statut: "Soumise" });
  return mapFacture(data);
}

export async function annulerFacture(id: string, motif: string): Promise<Facture> {
  const data = await http.patch<ApiFacture>(`/factures/${id}/annuler`, { motif });
  return mapFacture(data);
}

export interface FactureLigneUpsertInput {
  assureId: string;
  typePrestation: string;
  datePrestation: string;
  // Mode forfaitaire (catalogue ActeMedical) ou codification (lettre clé,
  // voir lettreCleCode ci-dessous) — les deux restent mutuellement exclusifs
  // côté saisie (voir FactureSaisie.tsx), le backend exige au moins l'un.
  acteMedicalId?: string;
  accordPrealableId?: string;
  montant: number;
  // Quantité (2026-08) — nombre d'unités facturées (ex. séances de kiné) ;
  // montant transmis reste toujours le TOTAL, jamais le prix unitaire seul.
  quantite?: number;
  // Codification à la lettre clé (2026-08) — voir types/lettresCles.ts.
  lettreCleCode?: string;
  coefficient?: number;
  // Rejet possible dès la saisie — motifRejet obligatoire si statutInitial="Rejeté".
  statutInitial?: "Accepté" | "Rejeté";
  motifRejet?: string;
  // Rejet partiel (2026-08) — montant contesté, retiré des frais réels
  // avant calcul ; motifRejet obligatoire dès qu'il est renseigné.
  montantRejete?: number;
  // Dossier sinistre santé — repris sur le Décompte de Remboursement
  // Maladie (voir DocumentsService.renderDecompteFacture).
  nSinistre?: string;
  nDeclaration?: string;
  // Obligatoires côté saisie interne (voir FactureSaisie.tsx) — SanteService.
  // creerLigneFacture rejette si absents (sauf traitement d'un bon, qui les
  // hérite automatiquement de la Prescription d'origine).
  natureMaladie?: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
}

export async function apercuLigneFacture(factureId: string, payload: { assureId: string; typePrestation: string; montant: number; acteMedicalId?: string; montantRejete?: number }): Promise<ApercuLigne> {
  const data = await http.post<ApiApercuLigne>(`/factures/${factureId}/lignes/apercu`, payload);
  return mapApercu(data);
}

export async function ajouterLigneFacture(factureId: string, payload: FactureLigneUpsertInput): Promise<FactureLigne> {
  const data = await http.post<ApiFactureLigne>(`/factures/${factureId}/lignes`, payload);
  return mapLigne(data);
}

export async function modifierLigneFacture(factureId: string, ligneId: string, payload: Partial<FactureLigneUpsertInput>): Promise<FactureLigne> {
  const data = await http.patch<ApiFactureLigne>(`/factures/${factureId}/lignes/${ligneId}`, payload);
  return mapLigne(data);
}

export async function rejeterLigneFacture(factureId: string, ligneId: string, motifRejet: string): Promise<FactureLigne> {
  const data = await http.patch<ApiFactureLigne>(`/factures/${factureId}/lignes/${ligneId}/rejeter`, { motifRejet });
  return mapLigne(data);
}

export async function supprimerLigneFacture(factureId: string, ligneId: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/factures/${factureId}/lignes/${ligneId}`);
}

// Numéros de facture prestataire additionnels — une déclaration peut en
// regrouper plusieurs si la saisie a été traitée en batch.
export async function ajouterNumeroFacture(factureId: string, numero: string): Promise<Facture> {
  const data = await http.post<ApiFacture>(`/factures/${factureId}/numeros`, { numero });
  return mapFacture(data);
}

export async function supprimerNumeroFacture(factureId: string, numeroId: string): Promise<Facture> {
  const data = await http.delete<ApiFacture>(`/factures/${factureId}/numeros/${numeroId}`);
  return mapFacture(data);
}

import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { ApercuLigne } from "@/types/facture";
import type { Remboursement, RemboursementLigne } from "@/types/remboursement";

interface ApiRemboursementLigne {
  id: string;
  assureId: string;
  assure: { nom: string; prenom?: string | null };
  prestataireId?: string | null;
  prestataire: string;
  type: string;
  date: string;
  acteMedicalId?: string | null;
  acteMedical?: { libelle: string } | null;
  accordPrealableId?: string | null;
  montant: string | number;
  baseRemboursement?: string | number | null;
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

interface ApiRemboursement {
  id: string;
  beneficiaire: string;
  assurePrincipalId?: string | null;
  assurePrincipal?: { nom: string; prenom?: string | null } | null;
  contratId: string;
  contrat: { client: { nom: string }; compagnie: { nom: string } };
  dateDeclaration: string;
  statut: string;
  motifAnnulation?: string | null;
  lignes: ApiRemboursementLigne[];
}

interface ApiApercuLigne {
  tauxRemboursement?: string | number | null;
  baseRemboursement?: string | number | null;
  resteACharge?: string | number | null;
  plafondApplique?: string | number | null;
  messagePlafond?: string | null;
}

function mapLigne(l: ApiRemboursementLigne): RemboursementLigne {
  return {
    id: l.id,
    assureId: l.assureId,
    assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
    prestataireId: l.prestataireId ?? undefined,
    prestataireNom: l.prestataire,
    typePrestation: l.type,
    datePrestation: l.date,
    acteMedicalId: l.acteMedicalId ?? undefined,
    acteLibelle: l.acteMedical?.libelle,
    accordPrealableId: l.accordPrealableId,
    montant: toNumber(l.montant),
    baseRemboursement: l.baseRemboursement != null ? toNumber(l.baseRemboursement) : undefined,
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

function mapRemboursement(r: ApiRemboursement): Remboursement {
  const bordereau = r.lignes.find((l) => l.bordereau)?.bordereau;
  return {
    id: r.id,
    beneficiaire: r.beneficiaire as "AssurePrincipal" | "Souscripteur",
    assurePrincipalId: r.assurePrincipalId ?? undefined,
    assurePrincipalNom: r.assurePrincipal ? `${r.assurePrincipal.nom} ${r.assurePrincipal.prenom ?? ""}`.trim() : undefined,
    contratId: r.contratId,
    clientNom: r.contrat.client.nom,
    compagnieNom: r.contrat.compagnie.nom,
    dateDeclaration: r.dateDeclaration,
    statut: r.statut,
    motifAnnulation: r.motifAnnulation ?? undefined,
    bordereauId: bordereau?.id,
    bordereauNumero: bordereau?.numero,
    bordereauStatut: bordereau?.statut,
    lettreChequeNumero: bordereau?.lettreCheque?.numero,
    numeroCheque: bordereau?.lettreCheque?.numeroCheque,
    banqueNom: bordereau?.lettreCheque?.banque.nom,
    lignes: r.lignes.map(mapLigne),
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

export interface RemboursementsFiltre {
  contratId?: string;
  // Souscripteur (2026-09 — recherche avancée) — passe par la relation
  // contrat côté backend.
  clientId?: string;
  statut?: string;
  assurePrincipalId?: string;
  // Période de déclaration (JJ/MM/AAAA) — 2026-09, recherche avancée.
  du?: string;
  au?: string;
}

export async function getRemboursements(filtre?: RemboursementsFiltre): Promise<Remboursement[]> {
  const params = new URLSearchParams();
  if (filtre?.contratId) params.set("contratId", filtre.contratId);
  if (filtre?.clientId) params.set("clientId", filtre.clientId);
  if (filtre?.statut) params.set("statut", filtre.statut);
  if (filtre?.assurePrincipalId) params.set("assurePrincipalId", filtre.assurePrincipalId);
  if (filtre?.du) params.set("du", filtre.du);
  if (filtre?.au) params.set("au", filtre.au);
  const qs = params.toString();
  const data = await http.get<ApiRemboursement[]>(`/remboursements${qs ? `?${qs}` : ""}`);
  return data.map(mapRemboursement);
}

export async function getRemboursement(id: string): Promise<Remboursement> {
  const data = await http.get<ApiRemboursement>(`/remboursements/${id}`);
  return mapRemboursement(data);
}

export interface RemboursementUpsertInput {
  beneficiaire: "AssurePrincipal" | "Souscripteur";
  assurePrincipalId?: string;
  contratId: string;
  dateDeclaration: string;
}

export async function createRemboursement(payload: RemboursementUpsertInput): Promise<Remboursement> {
  const data = await http.post<ApiRemboursement>("/remboursements", payload);
  return mapRemboursement(data);
}

export async function terminerRemboursement(id: string): Promise<Remboursement> {
  const data = await http.patch<ApiRemboursement>(`/remboursements/${id}`, { statut: "Soumise" });
  return mapRemboursement(data);
}

export async function annulerRemboursement(id: string, motif: string): Promise<Remboursement> {
  const data = await http.patch<ApiRemboursement>(`/remboursements/${id}/annuler`, { motif });
  return mapRemboursement(data);
}

export interface RemboursementLigneUpsertInput {
  assureId: string;
  // Prestataire par ligne (2026-08) — voir demande utilisateur : le
  // remboursement n'a pas de prestataire en en-tête, chaque bénéficiaire
  // peut avoir consulté une structure différente. L'un des deux est requis :
  // prestataireId (recherché dans le réseau conventionné, même calcul de
  // taux qu'une Facture) ou prestataireNom (saisie libre si non conventionné).
  prestataireId?: string;
  prestataireNom?: string;
  typePrestation: string;
  datePrestation: string;
  acteMedicalId?: string;
  accordPrealableId?: string;
  montant: number;
  quantite?: number;
  lettreCleCode?: string;
  coefficient?: number;
  statutInitial?: "Accepté" | "Rejeté";
  motifRejet?: string;
  montantRejete?: number;
  nSinistre?: string;
  nDeclaration?: string;
  natureMaladie?: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
}

export async function apercuLigneRemboursement(remboursementId: string, payload: { assureId: string; typePrestation: string; montant: number; acteMedicalId?: string; montantRejete?: number; prestataireId?: string }): Promise<ApercuLigne> {
  const data = await http.post<ApiApercuLigne>(`/remboursements/${remboursementId}/lignes/apercu`, payload);
  return mapApercu(data);
}

export async function ajouterLigneRemboursement(remboursementId: string, payload: RemboursementLigneUpsertInput): Promise<RemboursementLigne> {
  const data = await http.post<ApiRemboursementLigne>(`/remboursements/${remboursementId}/lignes`, payload);
  return mapLigne(data);
}

export async function modifierLigneRemboursement(remboursementId: string, ligneId: string, payload: Partial<RemboursementLigneUpsertInput>): Promise<RemboursementLigne> {
  const data = await http.patch<ApiRemboursementLigne>(`/remboursements/${remboursementId}/lignes/${ligneId}`, payload);
  return mapLigne(data);
}

export async function rejeterLigneRemboursement(remboursementId: string, ligneId: string, motifRejet: string): Promise<RemboursementLigne> {
  const data = await http.patch<ApiRemboursementLigne>(`/remboursements/${remboursementId}/lignes/${ligneId}/rejeter`, { motifRejet });
  return mapLigne(data);
}

export async function supprimerLigneRemboursement(remboursementId: string, ligneId: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/remboursements/${remboursementId}/lignes/${ligneId}`);
}

import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import { calculerAge } from "@/lib/age";
import type { AssureSante, PriseEnCharge, MouvementAssure } from "@/types/sante";

// Levée par createAssure/updateAssure quand le téléphone fourni est déjà
// porté par une autre famille et que l'ajout d'un CJ/EF à cette famille
// n'a pas encore été confirmé (voir SanteService.resolveTelephone côté
// backend) — le composant appelant doit proposer une confirmation puis
// renvoyer avec confirmerFamilleExistante: true.
export class ConflitFamilleError extends Error {
  constructor(message: string, public famille: { id: string; nom: string; prenom: string | null }) {
    super(message);
    this.name = "ConflitFamilleError";
  }
}

async function fetchAvecConflitFamille<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const payload = await res.json().catch(() => ({ message: "Conflit non résolu." }));
    throw new ConflitFamilleError(payload.message ?? "Ce numéro est déjà associé à une autre famille.", payload.famille);
  }
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface ApiAssureSante {
  id: string;
  nom: string;
  prenom?: string;
  telephone?: string;
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
  photo?: string;
  familleId?: string;
  typeAssure?: string;
  scolarise?: boolean;
  nationalite?: string;
  sexe?: string;
  adresse?: string;
  nomJeuneFille?: string;
  lieuNaissance?: string;
  email?: string;
  telephoneFixe?: string;
  autreNumero?: string;
  fax?: string;
}

interface ApiPriseEnCharge {
  id: string;
  assureId: string;
  contratId: string;
  prestataire: string;
  type: string;
  montant: string | number;
  statut: string;
  date: string;
  assure: { nom: string };
  modePaiement?: string;
  statutControleMedical?: string;
  motifRejet?: string;
  prescriptionRef?: string;
  factureRef?: string;
  baseRemboursement?: string | number;
  tauxRemboursement?: string | number;
  franchise?: string | number;
  plafondApplique?: string | number;
  resteACharge?: string | number;
  ordrePaiement?: string;
  acteMedical?: { categorieGarantie?: string | null } | null;
  accordPrealableId?: string | null;
  scoreFraude?: string | number;
  gestionnaireId?: string | null;
  // Rattachement à une déclaration de remboursement multi-lignes (2026-08) —
  // absent (null) pour une demande de remboursement autonome soumise depuis
  // le portail assuré (voir Remboursement, RemboursementSaisie.tsx).
  remboursementId?: string | null;
}

// Exporté pour réutilisation par le portail client (voir
// src/services/portailClient.service.ts) — même forme de réponse API,
// juste une route différente (cloisonnée au client connecté).
export function mapAssure(a: ApiAssureSante): AssureSante {
  return {
    id: a.id,
    nom: a.nom,
    prenom: a.prenom,
    telephone: a.telephone,
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
    photo: a.photo,
    familleId: a.familleId,
    typeAssure: a.typeAssure,
    scolarise: a.scolarise,
    nationalite: a.nationalite,
    sexe: a.sexe,
    adresse: a.adresse,
    nomJeuneFille: a.nomJeuneFille,
    lieuNaissance: a.lieuNaissance,
    email: a.email,
    telephoneFixe: a.telephoneFixe,
    autreNumero: a.autreNumero,
    fax: a.fax,
  };
}

// URL publique d'une photo uploadée (voir POST /sante/assures/:id/photo,
// servie statiquement hors du préfixe /api — voir backend/src/main.ts).
export function assurePhotoUrl(photo?: string | null): string | undefined {
  if (!photo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/photos/${photo}`;
}

export async function getAssuresSante(contratId?: string): Promise<AssureSante[]> {
  const data = await http.get<ApiAssureSante[]>(contratId ? `/sante/assures?contratId=${encodeURIComponent(contratId)}` : "/sante/assures");
  return data.map(mapAssure);
}

// Recherche avancée (2026-09 — voir demande utilisateur : "ajouter des
// filtres de recherche avancée dans l'onglet... participant... prenant en
// compte plusieurs facteurs de recherche et le bouton de recherche") —
// fonction séparée de getAssuresSante ci-dessus (ne change pas sa
// signature, réutilisée telle quelle par une dizaine d'écrans).
export interface FiltresAssures {
  contratId?: string; nom?: string; matricule?: string; typeAssure?: string; statut?: string; sexe?: string;
}
export async function rechercherAssuresSante(filtres: FiltresAssures): Promise<AssureSante[]> {
  const params = new URLSearchParams();
  if (filtres.contratId) params.set("contratId", filtres.contratId);
  if (filtres.nom) params.set("nom", filtres.nom);
  if (filtres.matricule) params.set("matricule", filtres.matricule);
  if (filtres.typeAssure) params.set("typeAssure", filtres.typeAssure);
  if (filtres.statut) params.set("statut", filtres.statut);
  if (filtres.sexe) params.set("sexe", filtres.sexe);
  const qs = params.toString();
  const data = await http.get<ApiAssureSante[]>(`/sante/assures${qs ? `?${qs}` : ""}`);
  return data.map(mapAssure);
}

export interface AssureUpsertInput {
  nom: string;
  prenom?: string;
  telephone?: string;
  // Auto-généré par le serveur si non fourni.
  matricule?: string;
  contratId: string;
  beneficiaires: number;
  cotisation: number;
  dateNaissance?: string;
  statutMatrimonial?: "Célibataire" | "Marié" | "Divorcé" | "Veuf";
  dateAffiliation: string;
  // AS par défaut si absent. familleId ne se renseigne que pour ajouter un
  // CJ/EF depuis la fiche d'un assuré principal existant.
  typeAssure?: "AS" | "CJ" | "EF";
  // Enfant (EF) encore scolarisé — voir types/sante.ts.
  scolarise?: boolean;
  familleId?: string;
  confirmerFamilleExistante?: boolean;
  // Fiche détaillée individuelle — propres à chaque personne.
  sexe?: "M" | "F";
  adresse?: string;
  nomJeuneFille?: string;
  lieuNaissance?: string;
  email?: string;
  telephoneFixe?: string;
  autreNumero?: string;
  fax?: string;
}

export async function createAssure(payload: AssureUpsertInput): Promise<AssureSante> {
  const a = await fetchAvecConflitFamille<ApiAssureSante>("/sante/assures", "POST", payload);
  return mapAssure(a);
}

export interface UpdateAssureInput {
  nom?: string;
  prenom?: string;
  telephone?: string;
  dateNaissance?: string;
  statutMatrimonial?: "Célibataire" | "Marié" | "Divorcé" | "Veuf";
  sexe?: "M" | "F";
  scolarise?: boolean;
  adresse?: string;
  nomJeuneFille?: string;
  lieuNaissance?: string;
  email?: string;
  telephoneFixe?: string;
  autreNumero?: string;
  fax?: string;
}

export async function updateAssure(id: string, payload: UpdateAssureInput): Promise<AssureSante> {
  const a = await fetchAvecConflitFamille<ApiAssureSante>(`/sante/assures/${id}`, "PATCH", payload);
  return mapAssure(a);
}

export async function uploadAssurePhoto(id: string, file: File): Promise<AssureSante> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(`${API_URL}/sante/assures/${id}/photo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /sante/assures/${id}/photo failed (${res.status}): ${await res.text()}`);
  return mapAssure(await res.json());
}

export async function deleteAssurePhoto(id: string): Promise<AssureSante> {
  const a = await http.delete<ApiAssureSante>(`/sante/assures/${id}/photo`);
  return mapAssure(a);
}

export async function toggleCarteAssure(id: string): Promise<AssureSante> {
  const a = await http.patch<ApiAssureSante>(`/sante/assures/${id}/carte`);
  return mapAssure(a);
}

export async function deleteAssure(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/sante/assures/${id}`);
}

// Blocage temporaire réversible ("Suspendre") — sans impact sur la
// population/prime du contrat, sans avenant. Cascade aux ayants droit côté
// serveur si `id` est une racine de famille.
export async function suspendreAssure(id: string, suspendre: boolean): Promise<AssureSante> {
  const a = await http.patch<ApiAssureSante>(`/sante/assures/${id}/suspendre`, { suspendre });
  return mapAssure(a);
}

// Sortie définitive tracée ("Retirer du contrat") — radiation douce avec
// impact sur la prime/population du contrat et génération d'un avenant de
// retrait (voir MouvementsService côté backend). Remplace l'ancien
// comportement de `deleteAssure` (suppression physique) pour cette action.
export async function retirerDuContratAssure(id: string, payload: { dateEffet: string; motif?: string }): Promise<AssureSante[]> {
  const radies = await http.post<ApiAssureSante[]>(`/sante/assures/${id}/retrait`, payload);
  return radies.map(mapAssure);
}

// Bascule vers un autre contrat — même fiche conservée (contratId
// changé), jamais recréée (ex. Collège Cadres ↔ Collège Non-Cadres). Ce
// n'est pas un type d'avenant à part : ça génère un Retrait réel sur
// l'ancien contrat et une Incorporation réelle sur le nouveau (voir
// MouvementsService.basculerVersContrat côté backend). L'historique de
// consommation de l'ancien contrat reste intact et consultable.
export async function basculerAssure(id: string, payload: { contratDestinationId: string; avecFamille: boolean; dateEffet: string }): Promise<void> {
  await http.post(`/sante/assures/${id}/bascule`, payload);
}

interface ApiMouvementAssure {
  id: string;
  action: "Incorporation" | "Retrait";
  dateEffet: string;
  avenant: { id: string; type: string; description: string };
}

export async function getMouvementsAssure(id: string): Promise<MouvementAssure[]> {
  const data = await http.get<ApiMouvementAssure[]>(`/sante/assures/${id}/mouvements`);
  return data.map((m) => ({
    id: m.id, action: m.action, dateEffet: m.dateEffet,
    avenantId: m.avenant.id, avenantType: m.avenant.type, avenantDescription: m.avenant.description,
  }));
}

export interface ImportedPersonRowInput {
  matricule: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  typeAssure: string;
  telephone: string;
  // Nom de fichier photo (import différé) — résolu côté client contre les
  // fichiers du dossier sélectionné, uploadé séparément après l'import.
  photo?: string;
  // Actif | Inactif (2026-09) — facultatif, ne touche pas le statut
  // existant si vide/non reconnu (voir SanteService.normaliserStatutImport
  // côté backend).
  statut?: string;
}

export interface ImportPopulationResult {
  imported: number;
  updated: number;
  // Bascules automatiques (2026-09) — personnes déjà sur un autre contrat,
  // dont la ligne importée affirmait le statut "Actif" pour ce contrat :
  // transférées automatiquement (voir SanteService.importPopulation),
  // jamais dupliquées.
  basculees: number;
  rejected: { ligne: number; matricule?: string; nom?: string; motif: string }[];
  resultats: { matricule: string; id: string }[];
}

export async function importPopulation(contratId: string, rows: ImportedPersonRowInput[]): Promise<ImportPopulationResult> {
  return http.post<ImportPopulationResult>("/sante/assures/import", { contratId, rows });
}

// File d'attente des personnes en attente de transfert (2026-09) — voir
// SanteService.importPopulation : un matricule déjà présent sur un autre
// contrat, dont le statut importé n'affirme pas encore "Actif", est
// conservé ici plutôt que rejeté — résolu automatiquement dès qu'un import
// ultérieur affirmera son statut Actif pour le bon contrat.
export interface PersonneEnAttenteTransfert {
  id: string;
  matricule: string;
  nom: string;
  prenom?: string | null;
  contratSourceId: string;
  contratCibleId: string;
  statutImport?: string | null;
  motif: string;
  createdAt: string;
}

export async function getPersonnesEnAttenteTransfert(): Promise<PersonneEnAttenteTransfert[]> {
  return http.get<PersonneEnAttenteTransfert[]>("/sante/personnes-en-attente-transfert");
}

export async function compterPersonnesEnAttenteTransfert(): Promise<{ nombre: number }> {
  return http.get<{ nombre: number }>("/sante/personnes-en-attente-transfert/compter");
}

export async function ignorerPersonneEnAttenteTransfert(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/sante/personnes-en-attente-transfert/${id}`);
}

// Analyse a posteriori des écarts de taux de couverture (2026-09) — voir
// SanteService.analyserEcartsTauxContrat : détecte, dans les prestations
// déjà en base, un changement de contrat jamais annoncé (taux observé
// correspondant à un autre contrat du même souscripteur) — signale dans
// la file d'attente de transfert, ne bascule jamais automatiquement.
export async function analyserEcartsTauxContrat(): Promise<{ detectes: number }> {
  return http.post<{ detectes: number }>("/sante/analyser-ecarts-taux", {});
}

/**
 * Les fichiers d'import population (export compagnie/courtier) sont
 * quasi systématiquement encodés en Windows-1252 (accents français
 * corrompus si lus en UTF-8) — on décode donc explicitement ainsi avant
 * d'envoyer le contenu au serveur.
 */
export async function readPopulationFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("windows-1252").decode(buffer);
}

// En-tête du modèle téléchargeable — reprend les 11 colonnes du format réel
// export compagnie/courtier (5 d'entre elles, "Date de souscription" à
// "Adresse", ne sont pas exploitées par le parseur, voir schema.prisma
// AssureSante) et ajoute Téléphone/Photo en fin de ligne pour rester
// compatible avec les fichiers déjà en circulation (colonnes absentes = "").
export const MODELE_IMPORT_ENTETE = "Matricule;Noms & Prénoms;Nationalité;Dat Nais;Sexe;Type assuré;Date de souscription;Période de PEC;Référence contrat;Produit;Adresse;Téléphone;Photo";
const MODELE_IMPORT_EXEMPLE = "MAT-0001;NDONG Jean Pierre;Gabon;15/03/1985;M;AS;;;;;;074123456;jean-ndong.jpg";

// Windows-1252 est un sur-ensemble de l'ASCII utilisé dans ces modèles
// (aucun caractère hors-ASCII), donc l'encodage UTF-8 par défaut de
// TextEncoder produit des octets identiques — pas de conversion nécessaire.
function telechargerCsv(nomFichier: string, lignes: string[]) {
  const contenu = lignes.join("\r\n") + "\r\n";
  const buffer = new TextEncoder().encode(contenu);
  const blob = new Blob([buffer], { type: "text/csv;charset=windows-1252" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

/** Télécharge le modèle CSV vierge (avec une ligne d'exemple) — même format
 * que readPopulationFile/parseImportRows attendent en entrée, décodé en
 * Windows-1252 pour rester cohérent avec les fichiers compagnie/courtier
 * réels (accents corrects à la réouverture dans Excel). */
export function downloadPopulationTemplate() {
  telechargerCsv("modele-import-population.csv", [MODELE_IMPORT_ENTETE, MODELE_IMPORT_EXEMPLE]);
}

/** Import différé : au lieu d'un modèle vierge, télécharge la population
 * réelle du contrat déjà affiliée, filtrée aux personnes à qui il manque
 * encore une photo, un téléphone (assuré principal uniquement — un CJ/EF
 * hérite du sien), ou les deux. Les champs déjà connus (identité, téléphone
 * existant) sont repris tels quels dans le fichier — seules les colonnes
 * réellement manquantes restent vides à compléter. Retourne le nombre de
 * lignes exportées (0 = rien à compléter, aucun fichier téléchargé). */
export async function downloadPopulationTemplateContrat(contratId: string): Promise<number> {
  const population = (await getAssuresSante()).filter((a) => a.police === contratId);
  const incomplets = population.filter((a) => !a.photo || (!a.familleId && !a.telephone));
  if (incomplets.length === 0) return 0;
  const lignes = incomplets.map((a) => [
    a.matricule,
    `${a.nom} ${a.prenom ?? ""}`.trim(),
    a.nationalite ?? "",
    a.dateNaissance ?? "",
    a.sexe ?? "",
    a.typeAssure ?? "",
    "", "", "", "", "",
    !a.familleId ? (a.telephone ?? "") : "",
    "",
  ].join(";"));
  telechargerCsv(`modele-import-${contratId}.csv`, [MODELE_IMPORT_ENTETE, ...lignes]);
  return incomplets.length;
}

const EXPORT_POPULATION_ENTETE = "N° Matricule;Nom et Prénom;Date de Naissance;Age;Genre;Affiliation;Prime;Effet du Contrat;Statut";

/** Export CSV 100% client de la population affichée (déjà chargée) — pas
 * d'aller-retour serveur, contrairement aux exports PDF/Excel/Word (voir
 * openPopulationExport, documents.service.ts) qui, eux, savent reconstituer
 * la population sur une période passée (`du`/`au`) : le CSV reflète toujours
 * la population ACTUELLE, filtrée par statut uniquement — pour une période
 * antérieure, utiliser un des trois autres formats. Colonnes alignées sur le
 * modèle de liste fourni (2026-08). */
export function exportPopulationCsv(contrat: { id: string; dateDebut: string }, population: AssureSante[], statut?: "tous" | "Actif" | "Radié") {
  const filtree = !statut || statut === "tous" ? population : population.filter((a) => a.statut === statut);
  const lignes = filtree.map((a) => [
    a.matricule,
    `${a.nom} ${a.prenom ?? ""}`.trim(),
    a.dateNaissance ?? "",
    calculerAge(a.dateNaissance) ?? "",
    a.sexe ?? "",
    a.typeAssure ?? "",
    String(a.cotisation ?? ""),
    contrat.dateDebut,
    a.statut,
  ].join(";"));
  telechargerCsv(`Liste-Assures-${contrat.id}.csv`, [EXPORT_POPULATION_ENTETE, ...lignes]);
}

function mapPriseEnCharge(pc: ApiPriseEnCharge): PriseEnCharge {
  return {
    id: pc.id,
    assureId: pc.assureId,
    contratId: pc.contratId,
    assure: pc.assure.nom,
    prestataire: pc.prestataire,
    type: pc.type,
    montant: toNumber(pc.montant),
    statut: pc.statut,
    date: pc.date,
    modePaiement: pc.modePaiement,
    statutControleMedical: pc.statutControleMedical,
    motifRejet: pc.motifRejet,
    prescriptionRef: pc.prescriptionRef,
    factureRef: pc.factureRef,
    baseRemboursement: pc.baseRemboursement !== undefined ? toNumber(pc.baseRemboursement) : undefined,
    tauxRemboursement: pc.tauxRemboursement !== undefined ? toNumber(pc.tauxRemboursement) : undefined,
    franchise: pc.franchise !== undefined ? toNumber(pc.franchise) : undefined,
    plafondApplique: pc.plafondApplique !== undefined ? toNumber(pc.plafondApplique) : undefined,
    resteACharge: pc.resteACharge !== undefined ? toNumber(pc.resteACharge) : undefined,
    ordrePaiement: pc.ordrePaiement,
    accordPrealableId: pc.accordPrealableId,
    scoreFraude: pc.scoreFraude !== undefined ? toNumber(pc.scoreFraude) : undefined,
    gestionnaireId: pc.gestionnaireId ?? null,
    categorieGarantieActe: pc.acteMedical?.categorieGarantie ?? null,
    remboursementId: pc.remboursementId ?? null,
  };
}

// `assureIds` (optionnel) permet de récupérer en un seul appel les PEC de
// toute une famille (assuré principal + ayants droit) — voir l'onglet
// Consommations du profil Participants.
export async function getPriseEnCharges(assureIds?: string[], gestionnaireId?: string): Promise<PriseEnCharge[]> {
  const params = new URLSearchParams();
  if (assureIds && assureIds.length > 0) params.set("assureIds", assureIds.join(","));
  if (gestionnaireId) params.set("gestionnaireId", gestionnaireId);
  const qs = params.toString();
  const data = await http.get<ApiPriseEnCharge[]>(`/sante/prises-en-charge${qs ? `?${qs}` : ""}`);
  return data.map(mapPriseEnCharge);
}

// Toutes les PEC d'un contrat en un seul appel — onglet Consommations de la
// fiche contrat (voir PriseEnCharge.contratId, dénormalisé à la création).
export async function getPriseEnChargesContrat(contratId: string): Promise<PriseEnCharge[]> {
  const data = await http.get<ApiPriseEnCharge[]>(`/sante/prises-en-charge?contratId=${contratId}`);
  return data.map(mapPriseEnCharge);
}

export interface PriseEnChargeUpsertInput {
  assureId: string;
  prestataire: string;
  type: string;
  montant: number;
  date: string;
  modePaiement: "Remboursement" | "TiersPayant";
}

export async function createPriseEnCharge(payload: PriseEnChargeUpsertInput): Promise<PriseEnCharge> {
  const pc = await http.post<ApiPriseEnCharge>("/sante/prises-en-charge", payload);
  return mapPriseEnCharge(pc);
}

export async function updatePriseEnCharge(id: string, payload: Partial<PriseEnChargeUpsertInput> & { statut?: string }): Promise<PriseEnCharge> {
  const pc = await http.patch<ApiPriseEnCharge>(`/sante/prises-en-charge/${id}`, payload);
  return mapPriseEnCharge(pc);
}

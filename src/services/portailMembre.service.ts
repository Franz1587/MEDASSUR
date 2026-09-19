import { http, API_URL, getAccessToken, ecritureHorsLigne } from "@/lib/http";
import { openDocument } from "@/services/documents.service";
import { toNumber } from "@/lib/decimal";

// Portail assuré (2026-08) — voir demande utilisateur : "écran externe
// dédié à l'assuré principal". Endpoints cloisonnés à l'AssureSante du
// compte connecté côté serveur (voir backend/src/portail-membre/) — aucun
// paramètre assureId côté frontend : le backend le déduit du JWT.

export interface MembreIdentite {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  numeroAssure: string | null;
  statutCarte: string | null;
  dateNaissance: string | null;
  photo?: string | null;
  telephone?: string | null;
  email?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  dateAffiliation?: string | null;
  nationalite?: string | null;
  lieuNaissance?: string | null;
  // Informations médicales d'urgence, dans l'E-carnet Santé (2026-09) —
  // auto-déclaratif, jamais déduit par l'application. (Jamais nommées
  // "Passeport Médical" sur la plateforme — voir demande utilisateur.)
  groupeSanguin?: string | null;
  allergies?: string[];
  antecedentsMedicaux?: string[];
  traitementsEnCours?: string[];
  contactUrgenceNom?: string | null;
  contactUrgenceTelephone?: string | null;
  contrat: {
    id: string;
    dateDebut: string;
    dateFin: string;
    client: { nom: string };
    compagnie: { nom: string };
  };
}

export async function getMoi(): Promise<MembreIdentite> {
  return http.get<MembreIdentite>("/portail-membre/moi");
}

export interface UpdateInformationsMedicalesInput {
  groupeSanguin?: string;
  allergies?: string[];
  antecedentsMedicaux?: string[];
  traitementsEnCours?: string[];
  contactUrgenceNom?: string;
  contactUrgenceTelephone?: string;
}

// Mode hors-ligne (2026-09) — voir lib/http.ts (ecritureHorsLigne). JSON pur,
// sans pièce jointe : bon candidat à la mise en file (voir demande
// utilisateur sur le mode hors-ligne). Sans réseau, lève QueuedOfflineError
// au lieu de renvoyer l'identité mise à jour.
export async function modifierInformationsMedicales(payload: UpdateInformationsMedicalesInput): Promise<MembreIdentite> {
  return ecritureHorsLigne<MembreIdentite>("/portail-membre/informations-medicales", payload, "Mise à jour informations médicales", "PATCH");
}

// Statistiques de consommation (2026-08) — voir demande utilisateur :
// "la page d'accueil devra être un tableau de bord qui fait remonter les
// données statistiques de consommation de toute la famille pour l'assuré
// principal, et de l'ayant droit dans son compte". Le périmètre (famille
// entière ou soi-même seul) est déjà résolu côté serveur (voir
// PortailMembreController.dashboard) — rien à filtrer ici.
export interface MembreDashboardBeneficiaire { assureId: string; nom: string; total: number }
export interface MembreDashboardRubrique { rubrique: string; total: number }

export interface MembreDashboard {
  nom: string;
  prenom: string | null;
  statutCarte: string | null;
  priseEnChargeEnAttente: number;
  dernierRemboursement: { id: string; date: string; montant: string | number; baseRemboursement?: string | number | null } | null;
  estAssurePrincipal: boolean;
  totalConsommation: number;
  totalRembourse: number;
  parBeneficiaire: MembreDashboardBeneficiaire[];
  parRubrique: MembreDashboardRubrique[];
}

export async function getMembreDashboard(): Promise<MembreDashboard> {
  return http.get<MembreDashboard>("/portail-membre/dashboard");
}

// Carte d'un membre de la famille (2026-08) — voir demande utilisateur :
// "il faut les cartes de toute la famille". `assureId` = soi-même ou un de
// ses ayants droit (voir getMaFamille), vérifié côté serveur.
export function openCarteDe(assureId: string): Promise<void> {
  return openDocument(`/portail-membre/carte/${assureId}`);
}

export interface MembreGarantie {
  id: string;
  categorie: string;
  libelle: string;
  tauxAssure: string | number | null;
  tauxAyantsDroit: string | number | null;
  tauxApplicable: string | number | null;
  plafond: string | null;
  plafondMontant: string | number | null;
  plafondPeriode: string | null;
}

export async function getMesGaranties(): Promise<MembreGarantie[]> {
  return http.get<MembreGarantie[]>("/portail-membre/garanties");
}

export interface MembreFamilleMembre {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  dateNaissance: string | null;
  statut: string;
  statutCarte: string | null;
  photo?: string | null;
  // Détail (2026-08) — voir demande utilisateur : "il doit pouvoir voir le
  // détail de chacun des membres de sa famille". Champs déjà renvoyés bruts
  // par le backend (AssureSante complet), juste typés ici.
  telephone?: string | null;
  email?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  dateAffiliation?: string | null;
  nationalite?: string | null;
  lieuNaissance?: string | null;
}

export async function getMaFamille(): Promise<MembreFamilleMembre[]> {
  return http.get<MembreFamilleMembre[]>("/portail-membre/famille");
}

export interface MembrePriseEnCharge {
  id: string;
  date: string;
  prestataire: string;
  type: string;
  montant: number;
  statut: string;
  modePaiement: string | null;
  baseRemboursement: number | null;
  resteACharge: number | null;
  prescriptionFichier?: string | null;
  factureFichier?: string | null;
  quittanceFichier?: string | null;
  autreFichier?: string | null;
  // Décompte (2026-08) — voir demande utilisateur : "les documents... de
  // remboursement générés depuis l'écran de l'assurance doivent remonter
  // systématiquement côté portail assuré". factureId non-nul = un décompte
  // existe (ligne tiers payant traitée en interne via FactureSaisie.tsx).
  factureId?: string | null;
  // Rangement (2026-08) — voir demande utilisateur : "l'historique des
  // consommations doit être rangé par rubrique, par exercice et même par
  // bénéficiaire dans la famille". rubrique/exercice résolus côté serveur
  // (PortailMembreController) ; assureId/assureNom identifient le membre de
  // la famille concerné par cette ligne (pas forcément l'assuré principal).
  assureId: string;
  assureNom: string;
  rubrique: string;
  exercice: number | null;
  // Détail de la prestation (2026-08) — voir demande utilisateur : "on
  // doit pouvoir accéder aux détails de la prestation". Champs déjà
  // renvoyés bruts par PortailMembreController (spread de la ligne Prisma),
  // juste typés ici.
  statutControleMedical?: string | null;
  motifRejet?: string | null;
  nSinistre?: string | null;
  nDeclaration?: string | null;
  natureMaladie?: string | null;
  quantite?: number | null;
  tauxRemboursement?: number | null;
  franchise?: number | null;
  plafondApplique?: number | null;
  // Acte (2026-08) — voir demande utilisateur : "dans le détails, il faut
  // de l'acte" (écran Historique de soins).
  acteLibelle?: string | null;
  // Famille brute de l'acte (2026-08) — voir demande utilisateur :
  // "chaque fiche de consultation génère aussi une feuille de soins et
  // chaque saisie d'un examen... génère une feuille d'examen" : décide,
  // par ligne, laquelle des deux proposer (voir GROUPES_ACTES).
  acteFamille?: string | null;
  // Regroupement facture + rubrique (2026-08) — voir demande utilisateur :
  // "dans le cas où une facture a plusieurs actes de même famille, il
  // n'est pas nécessaire de l'éclater. On pourra voir la liste des actes
  // dans les détails en cliquant sur 'Voir le détail'" : présent seulement
  // quand cette ligne EST un regroupement de plusieurs actes d'une même
  // facture — la ligne elle-même porte alors les totaux, `acteLibelle` est
  // null (pas UN acte), et chaque élément de `lignes` est une vraie ligne
  // individuelle (bouton Décompte/Feuille par acte, voir Historique.tsx).
  lignes?: MembrePriseEnCharge[];
}

interface ApiMembrePriseEnCharge extends Omit<MembrePriseEnCharge, "montant" | "baseRemboursement" | "resteACharge" | "assureNom" | "tauxRemboursement" | "franchise" | "plafondApplique" | "lignes"> {
  montant: string | number;
  baseRemboursement?: string | number | null;
  resteACharge?: string | number | null;
  tauxRemboursement?: string | number | null;
  franchise?: string | number | null;
  plafondApplique?: string | number | null;
  assure: { nom: string; prenom: string | null };
  lignes?: ApiMembrePriseEnCharge[];
}

function mapPriseEnCharge(p: ApiMembrePriseEnCharge): MembrePriseEnCharge {
  return {
    ...p,
    montant: toNumber(p.montant),
    baseRemboursement: p.baseRemboursement != null ? toNumber(p.baseRemboursement) : null,
    resteACharge: p.resteACharge != null ? toNumber(p.resteACharge) : null,
    tauxRemboursement: p.tauxRemboursement != null ? toNumber(p.tauxRemboursement) : null,
    franchise: p.franchise != null ? toNumber(p.franchise) : null,
    plafondApplique: p.plafondApplique != null ? toNumber(p.plafondApplique) : null,
    assureNom: `${p.assure.nom} ${p.assure.prenom ?? ""}`.trim(),
    lignes: p.lignes?.map(mapPriseEnCharge),
  };
}

export async function getMesPrisesEnCharge(modePaiement?: "Remboursement" | "TiersPayant"): Promise<MembrePriseEnCharge[]> {
  const qs = modePaiement ? `?modePaiement=${modePaiement}` : "";
  const data = await http.get<ApiMembrePriseEnCharge[]>(`/portail-membre/prises-en-charge${qs}`);
  return data.map(mapPriseEnCharge);
}

export interface CreateRemboursementInput {
  prestataire: string;
  prestataireId?: string;
  type: string;
  montant: number;
  date: string;
  acteMedicalId?: string;
  // Bénéficiaire réel des frais (2026-09) — voir demande utilisateur : "on
  // puisse clairement indiquer pour qui dans la famille on a engagé les
  // frais". Facultatif — repli sur soi-même côté backend.
  beneficiaireId?: string;
}

export async function creerRemboursement(payload: CreateRemboursementInput): Promise<MembrePriseEnCharge> {
  const p = await http.post<ApiMembrePriseEnCharge>("/portail-membre/remboursements", payload);
  return mapPriseEnCharge(p);
}

async function uploadFichierRemboursement(id: string, type: "prescription" | "facture" | "quittance" | "autre", file: File): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("fichier", file);
  const res = await fetch(`${API_URL}/portail-membre/remboursements/${id}/document?type=${type}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`Envoi du document impossible (${res.status})`);
}

export const uploaderPrescriptionRemboursement = (id: string, file: File) => uploadFichierRemboursement(id, "prescription", file);
export const uploaderFactureRemboursement = (id: string, file: File) => uploadFichierRemboursement(id, "facture", file);
export const uploaderQuittanceRemboursement = (id: string, file: File) => uploadFichierRemboursement(id, "quittance", file);
export const uploaderAutreRemboursement = (id: string, file: File) => uploadFichierRemboursement(id, "autre", file);

export interface MembreAccordPrealable {
  id: string;
  type: string;
  description: string;
  dateDemande: string;
  prestataire: string;
  decision: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  montantDevis: string | number | null;
  montantAutorise: string | number | null;
  motifDecision: string | null;
  dateValidite: string | null;
  ordonnanceFichier: string | null;
  devisFichier: string | null;
}

export async function getMesPrisesEnChargePrealables(): Promise<MembreAccordPrealable[]> {
  return http.get<MembreAccordPrealable[]>("/portail-membre/accords-prealables");
}

// Ligne d'acte médical (2026-08) — voir demande utilisateur : "on doit
// sélectionner ou rechercher... les actes [depuis] les données saisies
// côté assurance" — reprend le catalogue ActeMedical réel (getActesMedicaux),
// mêmes champs que AccordPrealableLigneDto côté backend.
export interface LigneAccordPrealableInput {
  acteMedicalId?: string;
  lettreCleCode?: string;
  coefficient?: number;
  description: string;
  plafondReference: number;
  montantDevis: number;
}

export interface CreateAccordPrealableInput {
  // Groupe de garantie (2026-08) — voir demande utilisateur : la valeur
  // vient du VRAI tableau de garanties du contrat (voir getMesGaranties
  // ci-dessus, MembreGarantie.categorie), plus une liste figée à 3 valeurs.
  type: string;
  dateDemande: string;
  prestataire: string;
  prestataireId?: string;
  lignes: LigneAccordPrealableInput[];
}

export async function creerAccordPrealable(payload: CreateAccordPrealableInput): Promise<MembreAccordPrealable> {
  return http.post<MembreAccordPrealable>("/portail-membre/accords-prealables", payload);
}

async function uploadFichierAccordPrealable(id: string, type: "ordonnance" | "devis", file: File): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("fichier", file);
  const res = await fetch(`${API_URL}/portail-membre/accords-prealables/${id}/${type}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`Envoi du document impossible (${res.status})`);
}

export const uploaderOrdonnanceAccordPrealable = (id: string, file: File) => uploadFichierAccordPrealable(id, "ordonnance", file);
export const uploaderDevisAccordPrealable = (id: string, file: File) => uploadFichierAccordPrealable(id, "devis", file);

// Documents générés côté interne, remontés au portail (2026-08) — voir
// demande utilisateur : "les documents de prise en charge et de
// remboursement générés depuis l'écran de l'assurance doivent remonter
// systématiquement côté portail assuré principal". Mêmes PDF que les
// boutons "Certificat de prise en charge" (accord-prealable/index.tsx) et
// "Décompte" (FactureSaisie.tsx) côté interne — le backend vérifie la
// propriété avant de les générer (voir PortailMembreController).
export function openCertificatDe(accordId: string): Promise<void> {
  return openDocument(`/portail-membre/accords-prealables/${accordId}/certificat`);
}

export function openDecompteDe(priseEnChargeId: string): Promise<void> {
  return openDocument(`/portail-membre/prises-en-charge/${priseEnChargeId}/decompte`);
}

// Feuille de soins / feuille d'examen (2026-08) — voir demande utilisateur :
// "le but est de dématérialiser cela".
export function openFeuilleSoinsDe(priseEnChargeId: string): Promise<void> {
  return openDocument(`/portail-membre/prises-en-charge/${priseEnChargeId}/feuille-soins`);
}

export function openFeuilleExamenDe(priseEnChargeId: string): Promise<void> {
  return openDocument(`/portail-membre/prises-en-charge/${priseEnChargeId}/feuille-examen`);
}

// Bon d'examen prescrit par un médecin (2026-08) — identifié par sa
// Prescription (pas par une PriseEnCharge, voir carnet-sante.service.ts).
export function openFeuilleExamenBonDe(prescriptionId: string): Promise<void> {
  return openDocument(`/portail-membre/carnet-sante/bons/${prescriptionId}/feuille-examen`);
}

// E-carnet Santé (2026-08) — voir demande utilisateur : "il faut créer dans
// le compte assuré une rubrique appelée E-carnet Santé... rubrique
// Ordonnance et rubrique Examens & Compte rendu... l'assuré pourra
// lui-même filmer [photographier]... comme des scan existant dans les
// téléphones mobiles pour créer systématiquement des documents au format
// pdf". v1 : photo → PDF, pas d'OCR (confirmé par l'utilisateur).
export type RubriqueCarnetSante = "Ordonnance" | "Examens";

// source (2026-08) — voir demande utilisateur : "les feuilles de soins
// doivent remonter dans ordonnance et les feuilles d'examen dans examens &
// compte rendu" : un document "feuille" est dérivé automatiquement d'un
// vrai bon prescrit (jamais supprimable, jamais de `fichier` statique —
// s'ouvre via openFeuilleSoinsDe/openFeuilleExamenBonDe), distinct d'un
// document "upload" photographié par l'assuré (voir CarnetSante.tsx).
// `numero`/`dateSoins`/`statut` (2026-08) — voir demande utilisateur : "on
// doit voir la référence du bon, la date de soins... et le statut du bon
// (Non traité, Partiellement traité, Traité)" — uniquement renseignés pour
// un document "feuille" (un vrai bon), `null` pour un upload.
export type StatutBonCarnet = "NonTraite" | "PartiellementTraite" | "Traite";
export interface CarnetSanteDocument {
  id: string;
  source: "upload" | "feuille";
  assureId: string;
  assureNom: string;
  rubrique: RubriqueCarnetSante;
  fichier: string | null;
  priseEnChargeId: string | null;
  prescriptionId: string | null;
  numero: string | null;
  dateSoins: string | null;
  statut: StatutBonCarnet | null;
  libelle: string | null;
  dateAjout: string;
}

export async function getCarnetSante(rubrique?: RubriqueCarnetSante): Promise<CarnetSanteDocument[]> {
  const qs = rubrique ? `?rubrique=${rubrique}` : "";
  // `assureNom` est déjà calculé côté serveur (voir carnet-sante.service.ts)
  // — le retraiter ici en lisant `d.assure.nom` plantait ("Cannot read
  // properties of undefined") car cette clé brute n'a jamais existé dans la
  // réponse, seulement `assureNom` déjà prêt.
  return http.get<CarnetSanteDocument[]>(`/portail-membre/carnet-sante${qs}`);
}

export async function ajouterCarnetSante(rubrique: RubriqueCarnetSante, photo: File, opts?: { assureId?: string; libelle?: string }): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("photo", photo);
  form.append("rubrique", rubrique);
  if (opts?.assureId) form.append("assureId", opts.assureId);
  if (opts?.libelle) form.append("libelle", opts.libelle);
  const res = await fetch(`${API_URL}/portail-membre/carnet-sante`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`Envoi du document impossible (${res.status})`);
}

export async function supprimerCarnetSante(id: string): Promise<void> {
  await http.delete(`/portail-membre/carnet-sante/${id}`);
}

export function urlCarnetSante(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/carnet-sante/${fichier}`;
}

import { http, toNumber, uploadFile, API_URL, type RnFilePart } from "./http";

// Miroir mobile de src/services/portailMembre.service.ts (web) — MÊME
// contrat d'API, même backend de production (https://medassur.cloud/api).
// Toute forme de réponse ici DOIT rester identique à celle consommée par le
// portail web : ce fichier ne réinterprète rien, il typent seulement ce que
// PortailMembreController renvoie déjà.

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
  familleId?: string | null;
  // Informations médicales (2026-09) — voir UpdateInformationsMedicalesDto côté
  // backend ; renvoyé brut par GET /portail-membre/moi (spread AssureSante).
  // (Nommage : jamais l'appellation d'un produit concurrent — voir demande utilisateur.)
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

export async function modifierInformationsMedicales(payload: UpdateInformationsMedicalesInput): Promise<MembreIdentite> {
  return http.patch<MembreIdentite>("/portail-membre/informations-medicales", payload);
}

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
  telephone?: string | null;
  email?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  dateAffiliation?: string | null;
  nationalite?: string | null;
  lieuNaissance?: string | null;
  // Champs bruts AssureSante supplémentaires (2026-09) — le backend renvoie
  // la ligne Prisma complète sans `select` restrictif (voir
  // PortailMembreController.famille) ; utiles pour l'écran "Ma carte" (une
  // carte par membre de la famille, voir mission mobile).
  numeroAssure?: string | null;
  qrCode?: string | null;
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
  factureId?: string | null;
  assureId: string;
  assureNom: string;
  rubrique: string;
  exercice: number | null;
  statutControleMedical?: string | null;
  motifRejet?: string | null;
  nSinistre?: string | null;
  nDeclaration?: string | null;
  natureMaladie?: string | null;
  quantite?: number | null;
  tauxRemboursement?: number | null;
  franchise?: number | null;
  plafondApplique?: number | null;
  acteLibelle?: string | null;
  acteFamille?: string | null;
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
  prestataire?: string;
  prestataireId?: string;
  type?: string;
  montant?: number;
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

export type TypeDocumentRemboursement = "prescription" | "facture" | "quittance" | "autre";

export function uploaderDocumentRemboursement(id: string, type: TypeDocumentRemboursement, file: RnFilePart): Promise<void> {
  return uploadFile(`/portail-membre/remboursements/${id}/document?type=${type}`, file, "fichier").then(() => undefined);
}

// Ligne de devis d'un dossier de prise en charge (2026-09, ajout additif
// mobile) — le backend renvoie déjà `lignes` sur chaque AccordPrealable
// (voir AccordPrealableService.findAll/findOne : include lignes.acteMedical)
// mais le type web MembreAccordPrealable ne l'exposait pas encore ; ajouté
// ici pour l'écran de détail mobile (liste des actes du devis), sans rien
// retirer/renommer au contrat existant.
export interface MembreAccordPrealableLigne {
  id: string;
  acteMedicalId?: string | null;
  lettreCleCode?: string | null;
  coefficient?: string | number | null;
  description: string;
  plafondReference: string | number;
  montantDevis: string | number;
}

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
  lignes?: MembreAccordPrealableLigne[];
}

export async function getMesPrisesEnChargePrealables(): Promise<MembreAccordPrealable[]> {
  return http.get<MembreAccordPrealable[]>("/portail-membre/accords-prealables");
}

export interface LigneAccordPrealableInput {
  acteMedicalId?: string;
  lettreCleCode?: string;
  coefficient?: number;
  description: string;
  plafondReference: number;
  montantDevis: number;
}

export interface CreateAccordPrealableInput {
  type: string;
  description?: string;
  dateDemande: string;
  prestataire: string;
  prestataireId?: string;
  montantDevis?: number;
  lignes?: LigneAccordPrealableInput[];
}

export async function creerAccordPrealable(payload: CreateAccordPrealableInput): Promise<MembreAccordPrealable> {
  return http.post<MembreAccordPrealable>("/portail-membre/accords-prealables", payload);
}

export type TypeDocumentAccordPrealable = "ordonnance" | "devis";

export function uploaderDocumentAccordPrealable(id: string, type: TypeDocumentAccordPrealable, file: RnFilePart): Promise<void> {
  return uploadFile(`/portail-membre/accords-prealables/${id}/${type}`, file, "fichier").then(() => undefined);
}

// ── Documents PDF générés côté interne (voir src/api/documents.ts pour
// ouvrirDocument — téléchargement authentifié + feuille de partage native).
export const cheminCarteDe = (assureId: string) => `/portail-membre/carte/${assureId}`;
export const cheminCertificatAccordPrealable = (id: string) => `/portail-membre/accords-prealables/${id}/certificat`;
export const cheminDecompte = (priseEnChargeId: string) => `/portail-membre/prises-en-charge/${priseEnChargeId}/decompte`;
export const cheminFeuilleSoins = (priseEnChargeId: string) => `/portail-membre/prises-en-charge/${priseEnChargeId}/feuille-soins`;
export const cheminFeuilleExamen = (priseEnChargeId: string) => `/portail-membre/prises-en-charge/${priseEnChargeId}/feuille-examen`;
export const cheminFeuilleExamenBon = (prescriptionId: string) => `/portail-membre/carnet-sante/bons/${prescriptionId}/feuille-examen`;

// ── E-carnet Santé ────────────────────────────────────────────────────
export type RubriqueCarnetSante = "Ordonnance" | "Examens";
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
  return http.get<CarnetSanteDocument[]>(`/portail-membre/carnet-sante${qs}`);
}

export async function ajouterCarnetSante(rubrique: RubriqueCarnetSante, photo: RnFilePart, opts?: { assureId?: string; libelle?: string }): Promise<void> {
  const extra: Record<string, string> = { rubrique };
  if (opts?.assureId) extra.assureId = opts.assureId;
  if (opts?.libelle) extra.libelle = opts.libelle;
  await uploadFile(`/portail-membre/carnet-sante`, photo, "photo", extra);
}

export async function supprimerCarnetSante(id: string): Promise<void> {
  await http.delete(`/portail-membre/carnet-sante/${id}`);
}

export function urlCarnetSante(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/carnet-sante/${fichier}`;
}

// ── Accès famille (délégations) — assuré PRINCIPAL uniquement ─────────
export interface Delegation {
  id: string;
  nom: string;
  prenom: string | null;
  typeAssure: string | null;
  matricule: string;
  telephone: string | null;
  email: string | null;
  compte: { id: string; nom: string; email: string; modules: string[] } | null;
}

export async function getDelegations(): Promise<Delegation[]> {
  return http.get<Delegation[]>("/portail-membre/delegations");
}

export async function getModulesDisponiblesDelegation(): Promise<string[]> {
  return http.get<string[]>("/portail-membre/delegations/modules-disponibles");
}

export interface AccorderDelegationInput {
  identifiantType: "matricule" | "email" | "telephone";
  identifiantValeur?: string;
  motDePasse: string;
  modules: string[];
}

export async function accorderDelegation(cibleId: string, payload: AccorderDelegationInput) {
  return http.post(`/portail-membre/delegations/${cibleId}`, payload);
}

export async function modifierModulesDelegation(cibleId: string, modules: string[]) {
  return http.patch(`/portail-membre/delegations/${cibleId}/modules`, { modules });
}

export async function revoquerDelegation(cibleId: string) {
  return http.delete(`/portail-membre/delegations/${cibleId}`);
}

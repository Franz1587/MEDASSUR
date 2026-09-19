import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import { openDocument } from "@/services/documents.service";

// Portail prestataire (2026-08) — voir demande utilisateur : "portail
// externe dédié au prestataire médical", capture de référence fournie par
// l'utilisateur. Endpoints cloisonnés au Prestataire du compte connecté côté
// serveur (voir backend/src/portail-prestataire/) — aucun paramètre
// prestataireId côté frontend : le backend le déduit du JWT. Une prestation
// saisie ici EST une vraie Facture/PriseEnCharge (voir demande utilisateur :
// "l'application doit vraiment être interopérable"), visible et traitable
// côté interne comme côté portail assuré, sans synchronisation supplémentaire.

export interface PrestataireIdentite {
  id: string;
  nom: string;
  type: string;
  ville: string;
  statutConvention: string;
  // Visibilité (2026-08) — voir demande utilisateur : "définir les
  // garanties/actes qui doivent remonter... une pharmacie, un laboratoire
  // n'aura pas besoin de consultation". Vide = aucune restriction.
  garantiesVisibles: string[];
  categoriesActesVisibles: string[];
  // TPS (2026-08) — voir demande utilisateur : "la TPS (si le prestataire y
  // est assujetti)" : n'affiche la colonne TPS dans les lots proposés que
  // pour les établissements réellement assujettis (voir SanteService.
  // calculerTps côté interne, même règle).
  tpsAssujetti: boolean;
}

export async function getMoiPrestataire(): Promise<PrestataireIdentite> {
  return http.get<PrestataireIdentite>("/portail-prestataire/moi");
}

export interface PrestataireDashboard {
  nom: string;
  statutConvention: string;
  totalPrestations: number;
  enSaisie: number;
  soumises: number;
  montantTotal: number;
}

export async function getPrestataireDashboard(): Promise<PrestataireDashboard> {
  return http.get<PrestataireDashboard>("/portail-prestataire/dashboard");
}

// Identification d'un assuré (2026-08) — voir capture de référence
// "Identifier Un Assuré". Renvoie toute la famille du match (assuré
// principal en premier), pour laisser le prestataire choisir le bon
// bénéficiaire (voir capture "Sélectionnez le patient concerné").
export interface PatientFamilleMembre {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  dateNaissance: string | null;
  statutCarte: string | null;
  photo: string | null;
  telephone: string | null;
  familleId: string | null;
  // Statut réel (2026-08) — voir demande utilisateur : "le statut réel de
  // l'assuré... doit remonter, même s'il a déjà été servi un jour". "Actif"
  // sinon radié/suspendu — voir IdentificationAssure.tsx pour le blocage
  // explicite à la sélection ("Désolé, prestation impossible pour ce
  // patient car il n'est plus couvert").
  statut: string;
}

export type CanalRecherchePatient = "telephone" | "matricule" | "numeroAssure";

export async function rechercherPatients(type: CanalRecherchePatient, valeur: string): Promise<PatientFamilleMembre[]> {
  return http.get<PatientFamilleMembre[]>(`/portail-prestataire/patients/recherche?type=${type}&valeur=${encodeURIComponent(valeur)}`);
}

// "Mes patients" (2026-08) — voir demande utilisateur : "ajouter des
// filtres dans les écrans patient pour qu'on puisse rechercher un patient
// déjà existant... ayant déjà été servi au moins une fois par le
// prestataire". Un patient par ligne, statut toujours résolu en direct
// côté serveur (voir PortailPrestataireController.mesPatients).
export async function getMesPatients(): Promise<PatientFamilleMembre[]> {
  return http.get<PatientFamilleMembre[]>("/portail-prestataire/patients");
}

export interface PatientGarantie {
  id: string;
  categorie: string;
  libelle: string;
  tauxApplicable: string | number | null;
  plafondMontant: string | number | null;
  // Plafond en texte libre (2026-08) — repli d'affichage quand aucun
  // montant numérique n'est renseigné (ex. "Chambre" — 50 000 F CFA BTAM,
  // voir demande utilisateur : "Chambre: ....... FCFA/jour").
  plafondTexte: string | null;
  plafondPeriode: string | null;
}

export interface PatientDetail extends PatientFamilleMembre {
  numeroAssure: string | null;
  contrat: {
    id: string;
    dateDebut: string;
    dateFin: string;
    client: { nom: string };
    compagnie: { nom: string };
    garanties: PatientGarantie[];
  };
}

interface ApiPatientDetail extends Omit<PatientDetail, "contrat"> {
  contrat: Omit<PatientDetail["contrat"], "garanties"> & {
    garanties: (Omit<PatientGarantie, "tauxApplicable" | "plafondMontant"> & { tauxApplicable: string | number | null; plafondMontant: string | number | null })[];
  };
}

export async function getPatient(id: string): Promise<PatientDetail> {
  const p = await http.get<ApiPatientDetail>(`/portail-prestataire/patients/${id}`);
  return {
    ...p,
    contrat: {
      ...p.contrat,
      garanties: p.contrat.garanties.map((g) => ({
        ...g,
        tauxApplicable: g.tauxApplicable != null ? toNumber(g.tauxApplicable) : null,
        plafondMontant: g.plafondMontant != null ? toNumber(g.plafondMontant) : null,
      })),
    },
  };
}

// Statut réel, temps réel (2026-08) — voir demande utilisateur : "le
// statut d'une facture ou d'un relevé de facture doit remonter en temps
// réel en fonction du traitement fait côté assurance". Même résolution que
// le scan du QR (voir backend DocumentSignatureService.resoudreStatutActuel),
// attachée directement aux listes — jamais figé sur "Soumise".
export interface DetailStatutActuel { label: string; valeur: string }
export interface StatutActuelDocument { reference: string; statut: string; details: DetailStatutActuel[] }

export interface PrestationLigne {
  id: string;
  assureId: string;
  assureNom: string;
  typePrestation: string;
  datePrestation: string;
  acteMedicalId: string | null;
  acteLibelle?: string;
  montant: number;
  // Quantité (2026-08) — voir demande utilisateur : "la saisie de la
  // pharmacie repose sur trois critères : le médicament, le prix et la
  // quantité" — repris à l'ouverture de la modification d'une ligne (voir
  // Prestations.tsx, ouvrirEdition).
  quantite: number;
  baseRemboursement: number | null;
  resteACharge: number | null;
  tauxRemboursement: number | null;
  statut: string;
  // Annulation d'une ligne (2026-08) — voir demande utilisateur : "on doit
  // pouvoir annuler une prestation faite par erreur" — distinct de
  // Prestation.motifAnnulation (annulation de la FACTURE entière).
  motifAnnulation: string | null;
}

export interface Prestation {
  id: string;
  referenceFacture: string;
  dateReception: string;
  statut: string;
  motifAnnulation?: string;
  statutReel: StatutActuelDocument | null;
  lignes: PrestationLigne[];
}

interface ApiPrestationLigne {
  id: string; assureId: string; assure: { nom: string; prenom?: string | null };
  type: string; date: string; acteMedicalId: string | null; acteMedical?: { libelle: string } | null;
  montant: string | number; quantite?: number | null; baseRemboursement?: string | number | null; resteACharge?: string | number | null;
  tauxRemboursement?: string | number | null; statut: string; motifAnnulation?: string | null;
}
interface ApiPrestation {
  id: string; referenceFacture: string; dateReception: string; statut: string;
  motifAnnulation?: string | null; statutReel: StatutActuelDocument | null; lignes: ApiPrestationLigne[];
}

function mapPrestation(f: ApiPrestation): Prestation {
  return {
    id: f.id, referenceFacture: f.referenceFacture, dateReception: f.dateReception, statut: f.statut,
    motifAnnulation: f.motifAnnulation ?? undefined,
    statutReel: f.statutReel ?? null,
    lignes: f.lignes.map((l) => ({
      id: l.id, assureId: l.assureId, assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
      typePrestation: l.type, datePrestation: l.date, acteMedicalId: l.acteMedicalId, acteLibelle: l.acteMedical?.libelle,
      montant: toNumber(l.montant), quantite: l.quantite ?? 1,
      baseRemboursement: l.baseRemboursement != null ? toNumber(l.baseRemboursement) : null,
      resteACharge: l.resteACharge != null ? toNumber(l.resteACharge) : null,
      tauxRemboursement: l.tauxRemboursement != null ? toNumber(l.tauxRemboursement) : null,
      statut: l.statut,
      motifAnnulation: l.motifAnnulation ?? null,
    })),
  };
}

// Aperçu de calcul, en direct pendant la saisie (2026-08) — voir demande
// utilisateur : "le prestataire doit pouvoir saisir son tarif (en frais
// réels) et l'application doit générer cela comme dans la saisie de
// facture côté assurance" — même bloc "Tarification" (prix de référence,
// taux/part calculée, frais réels) que l'écran interne FactureSaisie.tsx.
export interface ApercuLignePrestation {
  tauxRemboursement?: number;
  baseRemboursement?: number;
  resteACharge?: number;
  plafondApplique?: number;
  messagePlafond?: string;
}
interface ApiApercuLignePrestation {
  tauxRemboursement?: string | number | null;
  baseRemboursement?: string | number | null;
  resteACharge?: string | number | null;
  plafondApplique?: string | number | null;
  messagePlafond?: string | null;
}

export async function apercuLignePrestation(payload: { assureId: string; typePrestation: string; montant: number; acteMedicalId?: string; quantite?: number }): Promise<ApercuLignePrestation> {
  const a = await http.post<ApiApercuLignePrestation>("/portail-prestataire/prestations/apercu", payload);
  return {
    tauxRemboursement: a.tauxRemboursement != null ? toNumber(a.tauxRemboursement) : undefined,
    baseRemboursement: a.baseRemboursement != null ? toNumber(a.baseRemboursement) : undefined,
    resteACharge: a.resteACharge != null ? toNumber(a.resteACharge) : undefined,
    plafondApplique: a.plafondApplique != null ? toNumber(a.plafondApplique) : undefined,
    messagePlafond: a.messagePlafond ?? undefined,
  };
}

export async function getPrestations(): Promise<Prestation[]> {
  const data = await http.get<ApiPrestation[]>("/portail-prestataire/prestations");
  return data.map(mapPrestation);
}

export async function getPrestation(id: string): Promise<Prestation> {
  const data = await http.get<ApiPrestation>(`/portail-prestataire/prestations/${id}`);
  return mapPrestation(data);
}

// Modification / annulation d'une ligne (2026-08) — voir demande
// utilisateur : "dans la ligne de facture... on doit toujours pouvoir
// modifier une facture et la mettre à jour... on doit pouvoir annuler une
// prestation faite par erreur". Même service que la saisie interne — voir
// backend PortailPrestataireController.modifierLignePrestation/
// annulerLignePrestation.
export interface ModifierLignePrestationInput {
  typePrestation?: string;
  datePrestation?: string;
  acteMedicalId?: string;
  montant?: number;
  quantite?: number;
}

export async function modifierLignePrestation(factureId: string, ligneId: string, dto: ModifierLignePrestationInput): Promise<Prestation> {
  await http.patch(`/portail-prestataire/prestations/${factureId}/lignes/${ligneId}`, dto);
  return getPrestation(factureId);
}

// Ajout d'une ligne à une facture déjà saisie (2026-08) — voir demande
// utilisateur : "il faut un vrai formulaire de saisie de facture" : le
// bénéficiaire reste celui de la facture, déduit côté serveur.
export interface AjouterLignePrestationInput {
  typePrestation: string;
  datePrestation: string;
  acteMedicalId?: string;
  montant: number;
  quantite?: number;
  // Nature de l'affection (2026-08) — jamais affichée sur le Décompte
  // (toujours "Affection Courante" à l'écran) — strictement interne/
  // statistique. Code CNAMGS retiré de la saisie prestataire (2026-09) —
  // voir demande utilisateur : "il ne faut pas que l'agent de l'accueil
  // ait la possibilité de renseigner les codes d'affections, cela
  // strictement réservé au médecin traitant" — reste optionnel côté API
  // (déjà le cas côté backend, voir CreateFactureLigneDto), jamais saisi
  // depuis cet écran.
  natureMaladie: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
  // Médecin assigné par l'accueil (2026-09) — voir demande utilisateur :
  // "au niveau de l'accueil, le médecin doit avoir été lié à la prestation
  // consultation qui doit se faire" — obligatoire côté écran uniquement
  // pour une ligne du groupe "Consultation" (voir Prestations.tsx).
  medecinId?: string;
}

export async function ajouterLignePrestation(factureId: string, dto: AjouterLignePrestationInput): Promise<Prestation> {
  const data = await http.post<ApiPrestation>(`/portail-prestataire/prestations/${factureId}/lignes`, dto);
  return mapPrestation(data);
}

export async function annulerLignePrestation(factureId: string, ligneId: string, motif: string): Promise<Prestation> {
  await http.patch(`/portail-prestataire/prestations/${factureId}/lignes/${ligneId}/annuler`, { motif });
  return getPrestation(factureId);
}

// Annulation d'une facture entière (2026-08) — voir demande utilisateur :
// "rendre possible la modification d'une facture ou prestation déjà
// saisie, doit même pour l'annuler". Une facture annulée est déjà exclue
// des lots proposés/relevés côté serveur.
export async function annulerPrestation(factureId: string, motif: string): Promise<Prestation> {
  await http.patch(`/portail-prestataire/prestations/${factureId}/annuler`, { motif });
  return getPrestation(factureId);
}

// Historique des modifications (2026-08) — voir demande utilisateur :
// "l'application doit garder l'historique des factures modifiées et le nom
// de l'utilisateur ayant fait la modification".
export interface ModificationHistorique {
  id: string;
  action: string;
  utilisateur: string;
  utilisateurNom: string;
  dateAction: string;
  details: string | null;
}

export async function getHistoriquePrestation(factureId: string): Promise<ModificationHistorique[]> {
  return http.get<ModificationHistorique[]>(`/portail-prestataire/prestations/${factureId}/historique`);
}

export interface LignePrestationInput {
  acteMedicalId?: string;
  montant: number;
  quantite?: number;
  natureMaladie: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
  medecinId?: string;
}

export interface CreatePrestationInput {
  assureId: string;
  typePrestation: string;
  date: string;
  lignes: LignePrestationInput[];
}

export async function creerPrestation(payload: CreatePrestationInput): Promise<Prestation> {
  const data = await http.post<ApiPrestation>("/portail-prestataire/prestations", payload);
  return mapPrestation(data);
}

// Médecins de CETTE structure (2026-09) — voir demande utilisateur :
// "au niveau de l'accueil, le médecin doit avoir été lié à la prestation
// consultation qui doit se faire" — sélecteur affiché uniquement pour une
// ligne du groupe "Consultation".
export interface MedecinPrestataireOption {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  specialite: string | null;
}

export async function getMedecinsPrestataire(): Promise<MedecinPrestataireOption[]> {
  return http.get<MedecinPrestataireOption[]>("/portail-prestataire/medecins");
}

export async function teletransmettrePrestation(id: string): Promise<Prestation> {
  const data = await http.post<ApiPrestation>(`/portail-prestataire/prestations/${id}/teletransmettre`, {});
  return mapPrestation(data);
}

// Facture imprimable, signée électroniquement (2026-08) — voir demande
// utilisateur, capture de référence "Facture : Générer/Télécharger/
// Visualiser" + "signature électronique unique (QR code) pour chaque
// document... authentification infaillible de chaque prestation faite".
export function voirFacturePrestation(id: string): Promise<void> {
  return openDocument(`/portail-prestataire/prestations/${id}/facture`);
}

// Feuille de soins / feuille d'examen (2026-08) — voir demande utilisateur :
// "chaque fiche de consultation génère aussi une feuille de soins et
// chaque saisie d'un examen, actes de spécialité, analyse médicale génère
// une feuille d'examen. Le but est de dématérialiser cela".
export function voirFeuilleSoinsLigne(factureId: string, ligneId: string): Promise<void> {
  return openDocument(`/portail-prestataire/prestations/${factureId}/lignes/${ligneId}/feuille-soins`);
}

export function voirFeuilleExamenLigne(factureId: string, ligneId: string): Promise<void> {
  return openDocument(`/portail-prestataire/prestations/${factureId}/lignes/${ligneId}/feuille-examen`);
}

// Devis / demande de prise en charge (2026-08) — voir demande utilisateur :
// "la partie 'Devis' est une rubrique permettant au prestataire de faire
// une demande de prise en charge de tout type (selon son profil)... je
// parle bien de l'entente préalable". Même dossier AccordPrealable que la
// saisie interne et le portail assuré — visible immédiatement dans la
// file de décision côté assurance.
export interface DevisMedical {
  id: string;
  type: string;
  description: string;
  dateDemande: string;
  decision: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  montantDevis: string | number | null;
  montantAutorise: string | number | null;
  ordonnanceFichier: string | null;
  devisFichier: string | null;
  assure: { nom: string; prenom: string | null };
}

export async function getDevis(): Promise<DevisMedical[]> {
  return http.get<DevisMedical[]>("/portail-prestataire/devis");
}

export interface LigneDevisInput {
  acteMedicalId?: string;
  lettreCleCode?: string;
  coefficient?: number;
  description: string;
  plafondReference: number;
  montantDevis: number;
}

export interface CreateDevisInput {
  assureId: string;
  type: string;
  dateDemande: string;
  lignes: LigneDevisInput[];
}

export async function creerDevis(payload: CreateDevisInput): Promise<DevisMedical> {
  return http.post<DevisMedical>("/portail-prestataire/devis", payload);
}

async function uploadFichierDevis(id: string, type: "ordonnance" | "devis", file: File): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("fichier", file);
  const res = await fetch(`${API_URL}/portail-prestataire/devis/${id}/${type}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`Envoi du document impossible (${res.status})`);
}

export const uploaderOrdonnanceDevis = (id: string, file: File) => uploadFichierDevis(id, "ordonnance", file);
export const uploaderPieceDevis = (id: string, file: File) => uploadFichierDevis(id, "devis", file);

export function voirCertificatDevis(id: string): Promise<void> {
  return openDocument(`/portail-prestataire/devis/${id}/certificat`);
}

// Relevé de facture (2026-08) — voir demande utilisateur : "dans l'onglet
// gestion financière on aura une rubrique relevé de facture... l'application
// regroupe systématiquement les factures saisies par souscripteur et crée
// les lots automatiquement, attendant simplement que le prestataire appuie
// sur le bouton créer".
// Une ligne par FACTURE, pas par acte (2026-08) — voir demande utilisateur :
// "dans la partie 'Lots proposés — à créer' on doit voir la liste des
// factures devant constituer le lot avec les noms des patients, la date de
// prestation, le montant des frais réel, la part de l'assurance, la part du
// patient, la TPS... et le net à payer", précisé ensuite : "il n'est pas
// nécessaire d'éclater une facture dans un relevé de facture. On peut le
// faire sur le décompte, mais pas sur relevé de facture. Le relevé de
// facture tient compte de la somme des consommations d'un patient par
// rapport à une même référence de facture." Même forme utilisée pour les
// lots proposés ET le détail d'un relevé déjà créé (voir ReleveDetail
// ci-dessous) — montant/part assurance/part patient/TPS sont la somme des
// actes non annulés de cette facture (voir backend RelevesPrestataireService.
// agregerLignesFacture).
export interface LigneApercuReleve {
  id: string;
  referenceFacture: string;
  assureNom: string;
  date: string;
  montant: number;
  baseRemboursement: number | null;
  resteACharge: number | null;
  montantTps: number | null;
}
interface ApiLigneApercuReleve {
  id: string; referenceFacture: string; assureNom: string; date: string;
  montant: string | number; baseRemboursement?: string | number | null; resteACharge?: string | number | null; montantTps?: string | number | null;
}
function mapLigneApercuReleve(l: ApiLigneApercuReleve): LigneApercuReleve {
  return {
    id: l.id, referenceFacture: l.referenceFacture, assureNom: l.assureNom, date: l.date,
    montant: toNumber(l.montant),
    baseRemboursement: l.baseRemboursement != null ? toNumber(l.baseRemboursement) : null,
    resteACharge: l.resteACharge != null ? toNumber(l.resteACharge) : null,
    montantTps: l.montantTps != null ? toNumber(l.montantTps) : null,
  };
}

export interface LotProposeReleve {
  clientId: string;
  clientNom: string;
  periode: string;
  nbFactures: number;
  montantTotal: number;
  lignes: LigneApercuReleve[];
}

export async function getApercuReleves(): Promise<LotProposeReleve[]> {
  return http.get<LotProposeReleve[]>("/portail-prestataire/releves/apercu");
}

export interface Releve {
  id: string;
  numero: string;
  periode: string;
  dateCreation: string;
  montantTotal: number;
  nbFactures: number;
  client: { nom: string };
  statutReel: StatutActuelDocument | null;
}

interface ApiReleve extends Omit<Releve, "montantTotal"> { montantTotal: string | number }

export async function getReleves(): Promise<Releve[]> {
  const data = await http.get<ApiReleve[]>("/portail-prestataire/releves");
  return data.map((r) => ({ ...r, montantTotal: toNumber(r.montantTotal) }));
}

export async function creerReleve(clientId: string, periode: string): Promise<Releve> {
  const r = await http.post<ApiReleve>("/portail-prestataire/releves", { clientId, periode });
  return { ...r, montantTotal: toNumber(r.montantTotal) };
}

// format "xlsx" (2026-08) — voir demande utilisateur : "à côté le bouton
// voir le relevé... pour télécharger ou imprimer le relevé en PDF,
// Excel..." — même pipeline openDocument, le xlsx se télécharge
// automatiquement (voir documents.service.ts openBlobUrl, aucun aperçu
// natif pour ce format).
export function voirDocumentReleve(id: string, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  return openDocument(`/portail-prestataire/releves/${id}/document?format=${format}`);
}

// Détail d'un relevé déjà créé (2026-08) — une ligne par facture, pas par
// acte (voir LigneApercuReleve ci-dessus et la demande utilisateur qui a
// motivé ce choix).
export interface ReleveDetail extends Releve {
  factures: LigneApercuReleve[];
}

interface ApiReleveDetail extends ApiReleve {
  factures: ApiLigneApercuReleve[];
}

async function mapReleveDetail(r: ApiReleveDetail): Promise<ReleveDetail> {
  return {
    ...r, montantTotal: toNumber(r.montantTotal),
    factures: r.factures.map(mapLigneApercuReleve),
  };
}

export async function getReleveDetail(id: string): Promise<ReleveDetail> {
  return mapReleveDetail(await http.get<ApiReleveDetail>(`/portail-prestataire/releves/${id}`));
}

// Factures éligibles à un ajout (2026-08) — alimente le sélecteur "Ajouter
// une facture" du détail d'un relevé déjà créé.
export interface FactureEligibleReleve {
  id: string;
  referenceFacture: string;
  dateReception: string;
  montant: number;
}
interface ApiFactureEligibleReleve extends Omit<FactureEligibleReleve, "montant"> { montant: string | number }

export async function getFacturesEligiblesReleve(releveId: string): Promise<FactureEligibleReleve[]> {
  const data = await http.get<ApiFactureEligibleReleve[]>(`/portail-prestataire/releves/${releveId}/factures-eligibles`);
  return data.map((f) => ({ ...f, montant: toNumber(f.montant) }));
}

// Ajout / retrait d'une facture (2026-08) — voir demande utilisateur : "on
// doit pouvoir ajouter ou retirer une facture d'un relevé".
export async function ajouterFactureReleve(releveId: string, factureId: string): Promise<ReleveDetail> {
  return mapReleveDetail(await http.post<ApiReleveDetail>(`/portail-prestataire/releves/${releveId}/factures`, { factureId }));
}

export async function retirerFactureReleve(releveId: string, factureId: string): Promise<ReleveDetail> {
  return mapReleveDetail(await http.delete<ApiReleveDetail>(`/portail-prestataire/releves/${releveId}/factures/${factureId}`));
}

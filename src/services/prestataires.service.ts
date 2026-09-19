import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Prestataire } from "@/types/prestataires";

interface ApiPrestataire {
  id: string;
  nom: string;
  type: string;
  secteur?: "Public" | "Privé" | null;
  titre?: "Professeur" | "Docteur" | null;
  specialite?: string | null;
  pays: string;
  ville: string;
  telephone?: string | null;
  adresse?: string | null;
  statutConvention: string;
  dateConventionnement?: string;
  delaiPaiementMoyen?: number;
  scoreQualite?: string | number;
  motifSuspension?: string;
  latitude?: number | null;
  longitude?: number | null;
  tpsAssujetti: boolean;
  tpsDateEffet?: string | null;
  tpsDateArret?: string | null;
  grillesTarifaires: { acte: string; plafond: string | number }[];
  garantiesVisibles: string[];
  categoriesActesVisibles: string[];
}

function mapPrestataire(p: ApiPrestataire): Prestataire {
  return {
    ...p,
    scoreQualite: p.scoreQualite !== undefined && p.scoreQualite !== null ? toNumber(p.scoreQualite) : undefined,
    grillesTarifaires: p.grillesTarifaires.map((g) => ({ acte: g.acte, plafond: toNumber(g.plafond) })),
  };
}

export async function getPrestataires(): Promise<Prestataire[]> {
  const data = await http.get<ApiPrestataire[]>("/prestataires");
  return data.map(mapPrestataire);
}

export async function getPrestataire(id: string): Promise<Prestataire> {
  const data = await http.get<ApiPrestataire>(`/prestataires/${id}`);
  return mapPrestataire(data);
}

export interface PrestataireUpsertInput {
  nom: string;
  type: string;
  secteur?: "Public" | "Privé";
  titre?: "Professeur" | "Docteur";
  specialite?: string;
  pays: string;
  ville: string;
  telephone?: string;
  adresse?: string;
  statutConvention: string;
  dateConventionnement?: string;
  tpsAssujetti?: boolean;
  tpsDateEffet?: string;
  tpsDateArret?: string;
  garantiesVisibles?: string[];
  categoriesActesVisibles?: string[];
}

export async function createPrestataire(payload: PrestataireUpsertInput): Promise<Prestataire> {
  const data = await http.post<ApiPrestataire>("/prestataires", payload);
  return mapPrestataire(data);
}

export async function updatePrestataire(id: string, payload: Partial<PrestataireUpsertInput>): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}`, payload);
  return mapPrestataire(data);
}

export async function supprimerPrestataire(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/prestataires/${id}`);
}

export async function suspendrePrestataire(id: string, motif: string): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}/suspendre`, { motif });
  return mapPrestataire(data);
}

// Remet le prestataire "Conventionné" et efface le motif de suspension.
export async function rehabiliterPrestataire(id: string): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}/rehabiliter`, {});
  return mapPrestataire(data);
}

// Détermine le taux de Contrat appliqué au calcul d'une prise en charge
// pour ce prestataire (voir PriseEnChargeService côté backend).
export async function definirSecteurPrestataire(id: string, secteur: "Public" | "Privé"): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}`, { secteur });
  return mapPrestataire(data);
}

// Réseau de soins (2026-08) — géocode l'adresse/ville via Nominatim/
// OpenStreetMap (voir PrestatairesService.geolocaliser), déclenché
// manuellement depuis la fiche prestataire.
export async function geolocaliserPrestataire(id: string): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}/geolocaliser`, {});
  return mapPrestataire(data);
}

export interface GeolocalisationLotResultat {
  traites: number; trouves: number; villesCorrigees: number; restants: number; echecs: number; geolocalises: number; total: number;
}

// Géolocalisation en masse (2026-08) — voir demande utilisateur : "grâce à
// la liste présente... récupérer les coordonnées géographiques réelles et
// authentiques de chaque prestataire". Un appel = un lot (voir
// PrestatairesService.geolocaliserLot) ; l'appelant boucle jusqu'à
// `restants === 0`.
export async function geolocaliserLotPrestataires(taille = 15): Promise<GeolocalisationLotResultat> {
  return http.patch<GeolocalisationLotResultat>("/prestataires/geolocaliser-lot", { taille });
}

// ── État de prélèvement TPS ──────────────────────────────────────────
// Chaque ligne agrégée (prestataire × mois) porte son détail par facture —
// l'état n'est pas qu'un total global, voir feedback "Facture égale
// détails" : transmis individuellement à chaque prestataire, qui doit
// pouvoir retrouver les factures précises ayant motivé le prélèvement.
export interface LigneEtatTpsDetail {
  factureReference: string;
  assureNom: string;
  date: string;
  montant: number;
  baseRemboursement: number;
  montantTps: number;
}

export interface LigneEtatTps {
  prestataireId: string;
  prestataireNom: string;
  mois: string;
  nbLignes: number;
  totalBaseRemboursement: number;
  totalTps: number;
  lignes: LigneEtatTpsDetail[];
}

export async function getEtatTps(filtres?: { prestataireId?: string; annee?: string; du?: string; au?: string }): Promise<LigneEtatTps[]> {
  const params = new URLSearchParams();
  if (filtres?.prestataireId) params.set("prestataireId", filtres.prestataireId);
  if (filtres?.annee) params.set("annee", filtres.annee);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  const qs = params.toString();
  return http.get<LigneEtatTps[]>(`/reglement-prestataire/etat-tps${qs ? `?${qs}` : ""}`);
}

// ── Reporting d'activité (fiche prestataire) ────────────────────────
export interface ExercicePrestataire {
  annee: string;
  nbFactures: number;
  montantDeclare: number;
  montantPaye: number;
  montantEnAttente: number;
  montantRejete: number;
}

// Détail ligne par ligne — qui a consommé, date de soin, frais réel,
// montant remboursé : dans ce métier, "Facture" ne doit jamais rester un
// simple total agrégé.
export interface LignePrestataireDetail {
  factureId: string;
  factureReference: string;
  assureNom: string;
  date: string;
  montant: number;
  montantRembourse: number;
  statutLigne: string;
  statutReglement: string;
}

export interface PrestataireStatistiques {
  ententesPrealables: { total: number; accordees: number; refusees: number; enAttente: number; transformeesEnFacture: number };
  factures: { total: number; enSaisie: number; soumises: number; annulees: number; reglees: number; enAttenteReglement: number };
  exercices: ExercicePrestataire[];
  lignes: LignePrestataireDetail[];
}

interface ApiExercicePrestataire {
  annee: string; nbFactures: number;
  montantDeclare: string | number; montantPaye: string | number; montantEnAttente: string | number; montantRejete: string | number;
}
interface ApiLignePrestataireDetail {
  factureId: string; factureReference: string; assureNom: string; date: string;
  montant: string | number; montantRembourse: string | number; statutLigne: string; statutReglement: string;
}
interface ApiPrestataireStatistiques {
  ententesPrealables: PrestataireStatistiques["ententesPrealables"];
  factures: PrestataireStatistiques["factures"];
  exercices: ApiExercicePrestataire[];
  lignes: ApiLignePrestataireDetail[];
}

// ── Comptes portail génériques par poste ─────────────────────────────
// Voir demande utilisateur : "pour chaque prestataire de la ruche
// excellence, il faut créer des compte utilisateurs génériques pour chaque
// structure médicale... fais apparaitre ces données dans le profil de
// chaque prestataire du réseau dans un onglet portail du prestataire" puis
// "Service Accueil... Service Facturation... Médecin... pour les
// pharmacies... remplacer service.accueil par vendeur et medecin par
// pharmacien" — 3 comptes par établissement (Accueil/Vendeur, Facturation,
// Médecin/Pharmacien selon le type), jamais un seul.
export interface ComptePortailPoste {
  poste: string;
  label: string;
  existe: boolean;
  email: string | null;
  dateCreation: string | null;
}

export interface IdentifiantsPortail {
  email: string;
  motDePasse: string;
  smsEnvoye: boolean;
}

export async function getComptesPortailPrestataire(id: string): Promise<ComptePortailPoste[]> {
  return http.get<ComptePortailPoste[]>(`/prestataires/${id}/comptes-portail`);
}

export async function creerComptePortailPrestataire(id: string, poste: string): Promise<IdentifiantsPortail> {
  return http.post<IdentifiantsPortail>(`/prestataires/${id}/comptes-portail/${poste}`);
}

export async function reinitialiserMotDePassePortailPrestataire(id: string, poste: string): Promise<IdentifiantsPortail> {
  return http.post<IdentifiantsPortail>(`/prestataires/${id}/comptes-portail/${poste}/reinitialiser`);
}

export interface ResultatComptesPortailManquants {
  comptesCrees: number;
  prestatairesTraites: number;
  prestatairesCompletes: number;
  prestatairesTotal: number;
}

// Bouton "Créer les comptes portail manquants" (2026-09) — voir demande
// utilisateur : "un bouton qui permet de lancer automatiquement la
// création des comptes utilisateurs pour les nouveaux prestataires créés."
export async function creerComptesPortailManquants(): Promise<ResultatComptesPortailManquants> {
  return http.post<ResultatComptesPortailManquants>("/prestataires/comptes-portail-manquants");
}

export async function getPrestataireStatistiques(id: string): Promise<PrestataireStatistiques> {
  const data = await http.get<ApiPrestataireStatistiques>(`/prestataires/${id}/statistiques`);
  return {
    ...data,
    exercices: data.exercices.map((e) => ({
      annee: e.annee, nbFactures: e.nbFactures,
      montantDeclare: toNumber(e.montantDeclare), montantPaye: toNumber(e.montantPaye),
      montantEnAttente: toNumber(e.montantEnAttente), montantRejete: toNumber(e.montantRejete),
    })),
    lignes: data.lignes.map((l) => ({
      factureId: l.factureId, factureReference: l.factureReference, assureNom: l.assureNom, date: l.date,
      montant: toNumber(l.montant), montantRembourse: toNumber(l.montantRembourse),
      statutLigne: l.statutLigne, statutReglement: l.statutReglement,
    })),
  };
}

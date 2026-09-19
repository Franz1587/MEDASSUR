import { http } from "@/lib/http";
import { mapContrat, type ApiContrat } from "@/services/contrats.service";
import { mapAssure, type ApiAssureSante } from "@/services/sante.service";
import { openDocument } from "@/services/documents.service";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";
import type { StatistiquesPayload } from "@/services/statistiques.service";

// Portail client (2026-08) — endpoints en lecture seule, cloisonnés au
// Client du compte connecté côté serveur (voir backend/src/portail-client/).
// Aucun paramètre clientId côté frontend : le backend le déduit du JWT.

export interface PortailDashboard {
  nombreContrats: number;
  nombreParticipants: number;
}

export async function getPortailDashboard(): Promise<PortailDashboard> {
  return http.get<PortailDashboard>("/portail-client/dashboard");
}

// Compteur de prises en charge par rubrique (2026-08) — voir demande
// utilisateur : "un compteur de prise en charges par rubrique... par an,
// par mois. avec des jolis graphiques". Nombre de dossiers (pas de
// montant), agrégé sur tous les contrats du client.
export interface PriseEnChargeParRubriquePayload {
  annees: number[];
  rubriques: string[];
  parAnnee: Record<number, { rubrique: string; nombre: number }[]>;
  parMois: Record<number, Array<{ mois: string } & Record<string, number | string>>>;
}

export async function getPriseEnChargeParRubriqueDuClient(): Promise<PriseEnChargeParRubriquePayload> {
  return http.get<PriseEnChargeParRubriquePayload>("/portail-client/dashboard/prises-en-charge");
}

export async function getMesContrats(): Promise<Contrat[]> {
  const data = await http.get<ApiContrat[]>("/portail-client/contrats");
  return data.map((c) => mapContrat(c));
}

export async function getMonContrat(id: string): Promise<Contrat> {
  const data = await http.get<ApiContrat>(`/portail-client/contrats/${id}`);
  return mapContrat(data);
}

export async function getMesParticipants(contratId?: string): Promise<AssureSante[]> {
  const qs = contratId ? `?contratId=${encodeURIComponent(contratId)}` : "";
  const data = await http.get<ApiAssureSante[]>(`/portail-client/participants${qs}`);
  return data.map(mapAssure);
}

// Sous-ensemble sûr pour un souscripteur — le backend retire déjà l'analyse
// narrative (voir PortailClientController), réservée à l'usage interne du
// courtier. Le S/P (sans/avec chargement) est bien transmis (voir demande
// utilisateur : "toutes les rubriques jusqu'au S/P doivent apparaître côté
// client, sauf l'analyse").
export type StatistiquesPayloadClient = Omit<StatistiquesPayload, "analyse">;

export async function getMesStatistiques(contratId: string, du?: string, au?: string): Promise<StatistiquesPayloadClient> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  const qs = params.toString();
  return http.get<StatistiquesPayloadClient>(`/portail-client/statistiques/${contratId}${qs ? `?${qs}` : ""}`);
}

// Téléchargement PDF (2026-08) — voir demande utilisateur : "le client doit
// pouvoir télécharger le fichier statistique en PDF le même que l'assurance
// génère mais sans l'analyse". Même rendu que le module interne, moins la
// rubrique analyse (voir PortailClientController.statistiquesPdfDuClient).
export function openMesStatistiquesPdf(contratId: string, du?: string, au?: string): Promise<void> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  const qs = params.toString();
  return openDocument(`/portail-client/statistiques/${contratId}/pdf${qs ? `?${qs}` : ""}`);
}

// Page dédiée "Détail du contrat" (2026-08) — voir demande utilisateur :
// "une page dédiée permettant d'avoir la liste des mouvements... voir les
// données contractuelles par exercice". Exercice.prime/periodicite ne sont
// pas exposés par ExerciceCompagnie (usage interne plus étroit), d'où ce
// type propre au portail.
export interface ExerciceContratClient {
  id: string;
  numero: number;
  dateDebut: string;
  dateFin: string;
  periodicite: string;
  prime: string | number;
  statut: string;
  compagnie: { id: string; nom: string } | null;
}

export async function getExercicesDuContrat(contratId: string): Promise<ExerciceContratClient[]> {
  return http.get<ExerciceContratClient[]>(`/portail-client/contrats/${contratId}/exercices`);
}

export function openContratDocumentClient(contratId: string, type: "quittance" | "tableau-garanties" = "quittance"): Promise<void> {
  return openDocument(`/portail-client/contrats/${contratId}/document?type=${type}`);
}

export function openAvenantDocumentClient(avenantId: string, type: "avenant" | "quittance" = "avenant"): Promise<void> {
  return openDocument(`/portail-client/avenants/${avenantId}/document?type=${type}`);
}

export function openFactureProductionDocumentClient(id: string): Promise<void> {
  return openDocument(`/portail-client/factures-production/${id}/document`);
}

// Liste des bénéficiaires imprimable/téléchargeable (2026-08) — voir
// demande utilisateur : "la société doit pouvoir générer, télécharger et
// imprimer la liste de ses bénéficiaires (liste totale, liste par type de
// statut)". Ouvre dans la visionneuse intégrée (jamais un nouvel onglet),
// qui offre déjà impression et téléchargement natifs.
export function openMesParticipantsListe(contratId: string, statut?: "tous" | "Actif" | "Radié"): Promise<void> {
  const qs = statut && statut !== "tous" ? `?statut=${encodeURIComponent(statut)}` : "";
  return openDocument(`/portail-client/contrats/${contratId}/participants/document${qs}`);
}

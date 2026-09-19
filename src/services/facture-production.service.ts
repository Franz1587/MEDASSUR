import { http } from "@/lib/http";

// Facture Production (2026-08) — génération MANUELLE à la demande (voir
// demande utilisateur), une par opération. Voir backend/src/facture-production.
export interface FactureProductionLigne {
  id: string;
  libelle: string;
  periodeDebut?: string | null;
  periodeFin?: string | null;
  montant: number;
  contratId?: string | null;
  avenantId?: string | null;
}

export interface FactureProduction {
  id: string;
  numero: number;
  compagnieId: string;
  clientId: string;
  contratId?: string | null;
  dateEmission: string;
  lieuEmission: string;
  referenceBonReception?: string | null;
  referenceBonCommande?: string | null;
  objet: string;
  typePaiement: string;
  notePaiement?: string | null;
  statut: string;
  createdAt: string;
  compagnie: { id: string; nom: string };
  client: { id: string; nom: string };
  contrat?: { id: string; numeroPolice?: string | null } | null;
  lignes: FactureProductionLigne[];
}

export interface FactureProductionLigneInput {
  libelle: string;
  periodeDebut?: string;
  periodeFin?: string;
  montant: number;
  contratId?: string;
  avenantId?: string;
}

export interface FactureProductionUpsertInput {
  compagnieId: string;
  clientId: string;
  contratId?: string;
  dateEmission: string;
  lieuEmission?: string;
  referenceBonReception?: string;
  referenceBonCommande?: string;
  objet: string;
  typePaiement?: string;
  notePaiement?: string;
  lignes: FactureProductionLigneInput[];
}

// Voir schema.prisma FactureProduction.typePaiement.
export const TYPES_PAIEMENT_FACTURE_PRODUCTION = ["Paiement intégral", "1ère échéance", "2ème échéance", "3ème échéance", "4ème échéance"] as const;

export interface FactureProductionFiltres {
  compagnieId?: string;
  clientId?: string;
  du?: string;
  au?: string;
  reference?: string;
}

// Mouvement (Affaire Nouvelle ou Avenant) pas encore lié à une Facture
// Production, suggéré dès que le souscripteur (et éventuellement la
// compagnie) est choisi — voir demande utilisateur : "l'application doit
// voir les mouvements... et qui ne sont pas encore liés à une facture
// production... afin que l'application remplisse automatiquement les
// lignes de la facture."
export interface MouvementNonFacture {
  contratId: string;
  avenantId: string | null;
  compagnieId: string;
  libelle: string;
  periodeDebut: string | null;
  periodeFin: string | null;
  montant: number;
}

export async function getMouvementsNonFactures(clientId: string, compagnieId?: string): Promise<MouvementNonFacture[]> {
  const params = new URLSearchParams({ clientId });
  if (compagnieId) params.set("compagnieId", compagnieId);
  return http.get<MouvementNonFacture[]>(`/facture-production/mouvements-non-factures?${params.toString()}`);
}

export async function getObjetsSuggeres(): Promise<string[]> {
  return http.get<string[]>("/facture-production/objets-suggeres");
}

export async function getFacturesProduction(filtres?: FactureProductionFiltres): Promise<FactureProduction[]> {
  const params = new URLSearchParams();
  if (filtres?.compagnieId) params.set("compagnieId", filtres.compagnieId);
  if (filtres?.clientId) params.set("clientId", filtres.clientId);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  if (filtres?.reference) params.set("reference", filtres.reference);
  const qs = params.toString();
  return http.get<FactureProduction[]>(`/facture-production${qs ? `?${qs}` : ""}`);
}

export async function createFactureProduction(payload: FactureProductionUpsertInput): Promise<FactureProduction> {
  return http.post<FactureProduction>("/facture-production", payload);
}

// Portail client (2026-08) — voir demande utilisateur : "un onglet pour les
// factures de production émises" sur la page dédiée au contrat. Cloisonné
// côté serveur (voir PortailClientController.facturesProductionDuContrat),
// contrairement à GET /facture-production qui retourne tout sans filtre.
export async function getFacturesProductionDuContrat(contratId: string): Promise<FactureProduction[]> {
  return http.get<FactureProduction[]>(`/portail-client/contrats/${contratId}/factures-production`);
}

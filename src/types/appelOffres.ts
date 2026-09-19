import type { Cotation } from "@/types/cotation";

export interface PropositionCommerciale {
  id: string;
  niveau: string;
  primeProposee: number;
  descriptionGaranties: string;
  statut: string;
  cotations: Cotation[];
}

export interface AppelOffresDocument {
  id: string;
  nom: string;
  fichier: string;
  type: string;
  compagnieId?: string | null;
  tailleOctets: number;
  createdAt: string;
}

export interface AppelOffres {
  id: string;
  prospectId: string;
  // Nom de fichier sous backend/uploads/logos-prospects/ — voir
  // uploadProspectLogo() dans crm.service.ts.
  prospect: { id: string; nom: string; logo: string | null };
  clientNom: string;
  cahierCharges: string;
  garantiesDemandees: string;
  historiqueSinistres?: string;
  projectionSP: number;
  estimationPepm: number;
  estimationFondsRoulement: number;
  statut: string;
  dateCreation: string;
  propositions: PropositionCommerciale[];
  cotations: Cotation[];
  documents: AppelOffresDocument[];
}

export interface AppelOffresUpsertInput {
  prospectId: string;
  clientNom: string;
  cahierCharges: string;
  garantiesDemandees: string;
  historiqueSinistres?: string;
  projectionSP: number;
  estimationPepm: number;
  estimationFondsRoulement: number;
  statut?: string;
}

export interface PropositionUpsertInput {
  niveau: string;
  primeProposee: number;
  descriptionGaranties: string;
  cotationIds?: string[];
  statut?: string;
}

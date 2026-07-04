export interface PropositionCommerciale {
  id: string;
  niveau: string;
  primeProposee: number;
  descriptionGaranties: string;
  statut: string;
}

export interface AppelOffres {
  id: string;
  prospectId: string;
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
}

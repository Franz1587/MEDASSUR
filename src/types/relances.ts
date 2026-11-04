export interface NiveauRelance {
  id: string;
  ordre: number;
  joursAvantEcheance: number;
  objet: string;
  corps: string;
  actif: boolean;
}

export interface RelanceEnvoyee {
  id: string;
  contratId: string;
  sentAt: string;
  statut: string;
  communicationId?: string | null;
  niveauRelance: { ordre: number; joursAvantEcheance: number };
  contrat: { dateFin: string; numeroPolice?: string | null; client: { nom: string; email?: string | null } };
}

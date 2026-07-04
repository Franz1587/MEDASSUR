export interface GrilleTarifaire {
  acte: string;
  plafond: number;
}

export interface Prestataire {
  id: string;
  nom: string;
  type: string;
  pays: string;
  ville: string;
  statutConvention: string;
  dateConventionnement?: string;
  delaiPaiementMoyen?: number;
  scoreQualite?: number;
  motifSuspension?: string;
  grillesTarifaires: GrilleTarifaire[];
}

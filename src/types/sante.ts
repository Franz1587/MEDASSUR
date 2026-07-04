export interface AyantDroit {
  nom: string;
  lienParente: string;
  dateNaissance: string;
  statut: string;
}

export interface AssureSante {
  id: string;
  nom: string;
  matricule: string;
  police: string;
  benef: number;
  cotisation: number;
  statut: string;
  dateNaissance?: string;
  statutMatrimonial?: string;
  numeroAssure?: string;
  qrCode?: string;
  statutCarte?: string;
  dateAffiliation?: string;
  dateRadiation?: string;
  motifRadiation?: string;
  ayantsDroit: AyantDroit[];
}

export interface PriseEnCharge {
  id: string;
  assure: string;
  prestataire: string;
  type: string;
  montant: number;
  statut: string;
  date: string;
  modePaiement?: string;
  statutControleMedical?: string;
  motifRejet?: string;
  baseRemboursement?: number;
  tauxRemboursement?: number;
  franchise?: number;
  plafondApplique?: number;
  resteACharge?: number;
  ordrePaiement?: string;
  accordPrealableId?: string | null;
  scoreFraude?: number;
}

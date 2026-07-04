export interface Cotation {
  id: string;
  clientNom: string;
  agePopulationMoyen: number;
  sexeRatio: string;
  historiqueSinistres: number;
  niveauGaranties: string;
  territorialite: string;
  stopLoss: number;
  primePure: number;
  chargements: number;
  marge: number;
  commission: number;
  pepm: number;
  tarifFinal: number;
  dateCreation: string;
}

export interface CotationInput {
  clientNom: string;
  agePopulationMoyen: number;
  sexeRatio: string;
  historiqueSinistres: number;
  niveauGaranties: string;
  territorialite: string;
  stopLoss: number;
  primePure: number;
  effectifAssure: number;
}

export interface TarifCalcule {
  chargements: number;
  marge: number;
  commission: number;
  tarifFinal: number;
  pepm: number;
}

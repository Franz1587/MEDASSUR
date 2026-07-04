export interface AccordPrealable {
  id: string;
  assureId: string;
  assureNom: string;
  type: string;
  description: string;
  dateDemande: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  decision: string;
  montantAutorise?: number;
  dateDecision?: string;
}

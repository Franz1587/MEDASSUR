export interface BordereauReglement {
  id: string;
  prestataireId: string;
  prestataireNom: string;
  periode: string;
  nbPrisesEnCharge: number;
  montantTotal: number;
  montantValide?: number;
  statut: string;
  dateReception: string;
  datePaiement?: string;
  referenceVirement?: string;
}

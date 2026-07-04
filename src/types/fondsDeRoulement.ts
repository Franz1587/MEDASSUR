export interface FondsDeRoulement {
  id: string;
  contratId: string;
  clientNom: string;
  montantInitial: number;
  montantConsomme: number;
  seuilAlerte: number;
  statut: string;
  dateAlimentation: string;
}

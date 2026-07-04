export interface HonorairesGestion {
  id: string;
  contratId: string;
  clientNom: string;
  periode: string;
  montantSinistres: number;
  tauxHonoraires: number;
  montantHonoraires: number;
  plafond?: number;
  statut: string;
}

// Commissions (2026-08, refonte) — calculées à partir de Contrat, plus de
// saisie manuelle. Voir backend/src/commissions/commissions.service.ts.
export interface Commission {
  id: string;
  compagnieId: string;
  compagnie: string;
  periode: string;
  periodeMensuelle: string | null;
  primeNette: number;
  tauxCommission: string;
  montantCommission: number;
  statut: "En attente" | "Reversé";
}

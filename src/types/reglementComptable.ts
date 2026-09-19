// Règlement comptable — lettre chèque (voir backend/prisma/schema.prisma
// LettreCheque). Second palier du règlement : regroupe des
// BordereauReglement "Validé" du même prestataire sur un seul chèque,
// dont le numéro est tiré atomiquement d'un lot pré-paramétré par banque
// (voir src/types/banques.ts).
export interface BordereauEligibleLettreCheque {
  id: string;
  numero: string;
  periode: string;
  nbPrisesEnCharge: number;
  montantTotal: number;
  montantValide?: number;
  // Net à payer (baseRemboursement - montantTps des lignes) — c'est ce
  // montant, jamais les frais réels, qui sera celui du chèque.
  montantNet: number;
  dateReception: string;
  compagnies: { id: string; nom: string }[];
}

export interface LettreChequeBordereau {
  id: string;
  numero: string;
  periode: string;
  nbPrisesEnCharge: number;
  montantTotal: number;
  montantValide?: number;
  montantNet: number;
  statut: string;
}

export interface LettreCheque {
  id: string;
  numero: string;
  banqueId: string;
  banqueNom: string;
  numeroCheque: number;
  compagnieId?: string;
  compagnieNom?: string;
  prestataireId: string;
  prestataireNom: string;
  montantTotal: number;
  statut: string;
  dateEmission: string;
}

export interface LettreChequeDetail extends LettreCheque {
  bordereaux: LettreChequeBordereau[];
}

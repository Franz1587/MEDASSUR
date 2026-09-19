// Paramétrage des banques et de leurs lots de numéros de chèque — voir
// backend/prisma/schema.prisma Banque/LotCheques, utilisé par le
// règlement comptable (lettre chèque) de l'écran "Règlement".
export interface LotCheques {
  id: string;
  banqueId: string;
  numeroDebut: number;
  numeroFin: number;
  numeroProchain: number;
  statut: string; // Actif | Épuisé
  createdAt: string;
}

export interface Banque {
  id: string;
  nom: string;
  codeBanque?: string;
  compteNumero?: string;
  // Coordonnées de l'agence (2026-09) — imprimées sur la Lettre chèque
  // (encadré "CE-060809 Payable en France..." du modèle de référence).
  adresse?: string;
  ville?: string;
  telephone?: string;
  statut: string; // Actif | Inactif
  lots: LotCheques[];
}

export interface BanqueUpsertInput {
  nom: string;
  codeBanque?: string;
  compteNumero?: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  statut?: string;
}

// Mouvement bancaire (2026-08) — voir demande utilisateur : "voir
// l'historique des mouvement de ses banque en fonction des paiement des
// sinistres". Une LettreCheque EST le règlement bancaire réel des
// sinistres (bordereaux de règlement prestataire réglés par chèque).
export interface MouvementBanque {
  id: string;
  numero: string;
  numeroCheque: number;
  montantTotal: number;
  statut: string; // Émise | Annulée
  dateEmission: string;
  prestataireNom: string;
  compagnieNom?: string;
}

// Classement d'usage par banque (2026-08) — voir demande utilisateur :
// "ça permettra de savoir la banque la plus utilisée par les clients dans
// le cadre des transactions bancaires."
export interface StatistiqueBanque {
  banqueId: string;
  banqueNom: string;
  statut: string;
  nombreLettresCheque: number;
  montantTotal: number;
}

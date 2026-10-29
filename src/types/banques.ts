// Paramétrage des banques et de leurs lots de numéros de chèque — voir
// backend/prisma/schema.prisma Banque/LotCheques/CompteReglement, utilisé
// par le règlement comptable (lettre chèque) de l'écran "Règlement".
export interface LotCheques {
  id: string;
  banqueId: string;
  compteReglementId?: string | null;
  numeroDebut: number;
  numeroFin: number;
  numeroProchain: number;
  statut: string; // Actif | Épuisé
  createdAt: string;
}

// Compte de règlement — sous-compte d'une banque pour les règlements
// prestataires (2026-10, demande utilisateur : "Orabank Sanlam, Orabank NSIA").
export interface CompteReglement {
  id: string;
  banqueId: string;
  libelle: string;
  compteNumero?: string | null;
  statut: string; // Actif | Inactif
  createdAt: string;
  lots: LotCheques[];
}

export interface CompteReglementUpsertInput {
  banqueId: string;
  libelle: string;
  compteNumero?: string;
  statut?: string;
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
  compteReglements: CompteReglement[];
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
  compteReglementLibelle?: string | null;
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

export interface BordereauReglement {
  id: string;
  // N° de règlement — séquentiel, unique, jamais de doublon (voir
  // ReglementPrestataireService.genererBordereau / reglement_numero_seq).
  numero: string;
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
  // Règlement comptable (lettre chèque) auquel ce bordereau a été
  // rattaché — absent tant que la comptabilité n'a pas encore émis de
  // chèque pour ce règlement (voir schema.prisma LettreCheque).
  lettreChequeNumero?: string;
  numeroCheque?: number;
  banqueNom?: string;
  // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur :
  // "lorsqu'on fait un règlement pour une structure médicale, que le
  // règlement se fasse à l'ordre d'un médecin intervenant dans la
  // structure". Absent = règlement à l'ordre de la structure elle-même.
  medecinId?: string | null;
  medecinNom?: string | null;
}

// Détail complet d'un règlement — écran de consultation (voir
// ReglementPrestataireService.findOne).
export interface BordereauReglementLigne {
  id: string;
  assureId: string;
  assureNom: string;
  familleNom: string;
  factureId: string | null;
  factureReference: string | null;
  // N° du Décompte pour ce couple (Facture, assuré) — null si pas encore généré.
  decompteNumero: string | null;
  montant: number;
  baseRemboursement?: number;
  resteACharge?: number;
  date: string;
  statut: string;
}

export interface BordereauReglementDetail extends BordereauReglement {
  lignes: BordereauReglementLigne[];
}

// Historique de factures par exercice — écran de consultation depuis
// "Règlement" (voir ReglementPrestataireService.historique). Toujours
// ligne par ligne (assuré, date de soin, frais réel, remboursé), jamais
// un simple total agrégé — voir feedback "Facture égale détails".
export interface HistoriqueReglementLigne {
  id: string;
  date: string;
  exercice: string;
  assureNom: string;
  assureId: string;
  factureId: string | null;
  factureReference: string | null;
  decompteNumero: string | null;
  numeroSinistre: string | null;
  montant: number;
  montantRembourse: number;
  statutLigne: string;
  bordereauId: string | null;
  bordereauNumero: string | null;
  bordereauStatut: string | null;
  // Règlement comptable (lettre chèque) auquel le bordereau de cette ligne
  // a lui-même été rattaché — absent tant que la comptabilité n'a pas
  // encore émis de chèque pour ce règlement (voir schema.prisma
  // LettreCheque / BordereauReglement.lettreChequeId).
  lettreChequeNumero: string | null;
  numeroCheque: number | null;
  banqueNom: string | null;
  prestataireId: string | null;
  prestataireNom: string;
}

export interface HistoriqueReglementExercice {
  annee: string;
  nbLignes: number;
  montantDeclare: number;
  montantRembourse: number;
}

export interface HistoriqueReglementResultat {
  lignes: HistoriqueReglementLigne[];
  exercices: HistoriqueReglementExercice[];
}

// Facture éligible à un nouveau règlement — écran de recherche/génération
// (voir FacturesService.findEligiblesReglement).
export interface FactureEligibleReglement {
  id: string;
  referenceFacture: string;
  numerosSupplementaires: string[];
  prestataireId: string;
  prestataireNom: string;
  clientId: string;
  clientNom: string;
  compagnieId: string;
  compagnieNom: string;
  contratId: string;
  dateReception: string;
  montant: number;
  nbLignes: number;
}

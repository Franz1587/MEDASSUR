export interface FactureLigne {
  id: string;
  assureId: string;
  assureNom: string;
  typePrestation: string;
  datePrestation: string;
  acteMedicalId?: string;
  acteLibelle?: string;
  accordPrealableId?: string | null;
  montant: number;
  baseRemboursement?: number;
  // TPS retenue sur cette ligne (9,5% de baseRemboursement, prestataires
  // assujettis uniquement) — net à payer au prestataire = baseRemboursement
  // - montantTps, jamais les frais réels (voir feedback-montant-net-a-payer).
  montantTps?: number;
  resteACharge?: number;
  tauxRemboursement?: number;
  plafondApplique?: number;
  statut: string;
  motifRejet?: string;
  // Rejet partiel (2026-08) — montant contesté par le contrôle médical,
  // retiré des frais réels avant calcul de la part assurance/assuré ; la
  // ligne reste "Déclaré" (distinct d'un rejet total, statut "Rejeté").
  montantRejete?: number;
  // Dossier sinistre santé — repris sur le Décompte de Remboursement
  // Maladie (voir DocumentsService.renderDecompteFacture).
  nSinistre?: string;
  nDeclaration?: string;
  // Nature de l'affection + code CNAMGS (2026-08) — voir demande
  // utilisateur : "il fallait créer une rubrique nature de l'affection
  // dans la saisie de la facture... ça permettra à l'application d'avoir
  // des données statistique réels de santé". Jamais affichés sur le
  // Décompte remis au tiers (toujours "Affection Courante" à l'écran) —
  // strictement internes.
  natureMaladie?: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
  // Quantité (2026-08) — nombre d'unités facturées (ex. séances de kiné) ;
  // montant reste toujours le TOTAL (quantité × prix unitaire).
  quantite?: number;
  // Codification à la lettre clé (2026-08) — mode de tarification alternatif
  // au catalogue ActeMedical (voir types/lettresCles.ts). Mutuellement
  // exclusif avec acteMedicalId côté saisie (voir FactureSaisie.tsx).
  lettreCleCode?: string;
  coefficient?: number;
}

export interface Facture {
  id: string;
  prestataireId: string;
  prestataireNom: string;
  contratId: string;
  clientNom: string;
  compagnieNom: string;
  dateReception: string;
  referenceFacture: string;
  // Tableau de bord personnel (2026-08) — voir demande utilisateur : "le
  // tableau de bord [doit] faire remonter les informations en fonction du
  // profil de l'utilisateur." L'agent qui a saisi cette facture.
  gestionnaireId?: string | null;
  // Numéros de facture prestataire additionnels — une déclaration peut en
  // regrouper plusieurs (voir schema.prisma NumeroFacture).
  numerosSupplementaires: { id: string; numero: string }[];
  statut: string;
  motifAnnulation?: string;
  // Référence du règlement — dès qu'une ligne est rattachée à un
  // bordereau, la facture entière est considérée verrouillée (voir
  // FacturesService.findEligiblesReglement) : cette référence est celle
  // du bordereau qui la couvre.
  bordereauNumero?: string;
  bordereauId?: string;
  bordereauStatut?: string;
  // Règlement comptable (lettre chèque) auquel le bordereau de cette
  // facture a lui-même été rattaché — voir schema.prisma LettreCheque /
  // BordereauReglement.lettreChequeId. Absent tant que la comptabilité n'a
  // pas encore émis de chèque pour ce règlement.
  lettreChequeNumero?: string;
  numeroCheque?: number;
  banqueNom?: string;
  lignes: FactureLigne[];
}

export interface ApercuLigne {
  tauxRemboursement?: number;
  baseRemboursement?: number;
  resteACharge?: number;
  plafondApplique?: number;
  // Reste sur le plafond de rubrique après cette demande, en langage clair
  // (voir demande utilisateur — rubriques plafonnées uniquement : Optique,
  // Dentisterie…). Absent hors rubrique plafonnée.
  messagePlafond?: string;
}

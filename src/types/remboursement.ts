// Voir demande utilisateur : "le remboursement ne se fait pas à l'ordre
// d'un prestataire, mais plutôt à l'ordre de l'assuré ou de son
// souscripteur... la saisie de remboursement se fait comme celle de la
// facture" — même structure qu'une Facture (types/facture.ts), sans
// prestataire en en-tête ; chaque ligne porte SON PROPRE prestataire
// (optionnel — conventionné ou saisi librement).
export interface RemboursementLigne {
  id: string;
  assureId: string;
  assureNom: string;
  prestataireId?: string;
  prestataireNom: string;
  typePrestation: string;
  datePrestation: string;
  acteMedicalId?: string;
  acteLibelle?: string;
  accordPrealableId?: string | null;
  montant: number;
  baseRemboursement?: number;
  resteACharge?: number;
  tauxRemboursement?: number;
  plafondApplique?: number;
  statut: string;
  motifRejet?: string;
  montantRejete?: number;
  nSinistre?: string;
  nDeclaration?: string;
  natureMaladie?: "AffectionCourante" | "AffectionLongue";
  codeAffection?: string;
  quantite?: number;
  lettreCleCode?: string;
  coefficient?: number;
}

export interface Remboursement {
  id: string;
  beneficiaire: "AssurePrincipal" | "Souscripteur";
  assurePrincipalId?: string;
  assurePrincipalNom?: string;
  contratId: string;
  clientNom: string;
  compagnieNom: string;
  dateDeclaration: string;
  statut: string;
  motifAnnulation?: string;
  bordereauNumero?: string;
  bordereauId?: string;
  bordereauStatut?: string;
  lettreChequeNumero?: string;
  numeroCheque?: number;
  banqueNom?: string;
  lignes: RemboursementLigne[];
}

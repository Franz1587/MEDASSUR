export interface AssureSante {
  id: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  matricule: string;
  police: string;
  benef: number;
  cotisation: number;
  statut: string;
  dateNaissance?: string;
  statutMatrimonial?: string;
  numeroAssure?: string;
  qrCode?: string;
  statutCarte?: string;
  dateAffiliation?: string;
  dateRadiation?: string;
  motifRadiation?: string;
  photo?: string;
  // Famille — familleId vide = cette personne EST la racine de famille
  // (assuré principal) ; sinon = id de sa racine. Un CJ/EF n'a pas son
  // propre téléphone : il hérite de celui de sa racine à l'affichage.
  familleId?: string;
  // Import population — voir src/services/sante.service.ts
  typeAssure?: string; // AS | CJ | EF
  // Enfant (EF) encore scolarisé — ouvre droit à Contrat.limiteAgeEnfantScolarise
  // au lieu de limiteAgeEnfant, sans effet pour AS/CJ (voir schema.prisma).
  scolarise?: boolean;
  nationalite?: string;
  sexe?: string;
  // Fiche détaillée individuelle (2026-08) — propres à chaque personne,
  // contrairement à `telephone` (porté uniquement par la racine de famille).
  adresse?: string;
  nomJeuneFille?: string;
  lieuNaissance?: string;
  email?: string;
  telephoneFixe?: string;
  autreNumero?: string;
  fax?: string;
}

export interface PriseEnCharge {
  id: string;
  assureId: string;
  assure: string;
  // Dénormalisé côté backend à la création — reste rattaché au contrat en
  // vigueur au moment de la prise en charge, indépendamment d'une bascule
  // ultérieure de l'assuré vers un autre contrat.
  contratId: string;
  prestataire: string;
  type: string;
  montant: number;
  statut: string;
  date: string;
  modePaiement?: string;
  statutControleMedical?: string;
  motifRejet?: string;
  prescriptionRef?: string;
  factureRef?: string;
  baseRemboursement?: number;
  tauxRemboursement?: number;
  franchise?: number;
  plafondApplique?: number;
  resteACharge?: number;
  ordrePaiement?: string;
  accordPrealableId?: string | null;
  scoreFraude?: number;
  gestionnaireId?: string | null;
  // Rubrique exacte de l'acte lié, si connu (2026-08) — voir demande
  // utilisateur : "Autre ça ne veut rien dire en assurance santé" —
  // préférée au rapprochement texte approximatif pour l'affichage par
  // rubrique (voir ConsommationsTab.tsx, resoudreCategorie).
  categorieGarantieActe?: string | null;
  // Voir services/remboursements.service.ts — présent seulement pour une
  // ligne saisie via une déclaration de remboursement multi-lignes.
  remboursementId?: string | null;
}

// Historique des mouvements (avenants Incorporation/Retrait) concernant une
// personne — voir SanteService.mouvementsDe (backend) et l'onglet "Statut &
// mouvements" du profil Participants.
export interface MouvementAssure {
  id: string;
  action: "Incorporation" | "Retrait";
  dateEffet: string;
  avenantId: string;
  avenantType: string;
  avenantDescription: string;
}

// Une Cotation = l'offre réelle d'une compagnie pour une branche (voir
// documents.service.ts renderCotationOffre côté backend) — pas un
// simulateur actuariel abstrait.

export interface CotationGarantieLigne {
  categorie: string;
  libelle: string;
  plafond: string;
  // Taux de remboursement par type de structure (ex. "Hôpitaux publics,
  // CNSS..." vs "Clinique et secteur privé...") — optionnels : la plupart
  // des garanties n'ont qu'un plafond, sans distinction de structure.
  tauxStructurePrivee?: string;
  tauxStructurePublique?: string;
}

export interface Cotation {
  id: string;
  appelOffresId?: string | null;
  compagnieId?: string | null;
  // Tableau de bord personnel (2026-08) — voir demande utilisateur : "le
  // tableau de bord [doit] faire remonter les informations en fonction du
  // profil de l'utilisateur." L'agent qui a créé la cotation.
  gestionnaireId?: string | null;
  compagnie?: { id: string; nom: string; logo?: string | null } | null;
  branche: string; // "Maladie" | "Assistance"
  clientNom: string;
  population: number;
  territorialite: string;
  tauxCouvertureAmbulatoire?: string | null;
  tauxCouvertureHospitalisation?: string | null;
  exclusions?: string | null;
  clauseAjustement?: string | null;
  limiteAgeAdulte?: number | null;
  limiteAgeEnfant?: number | null;
  plafondFamilial?: number | null;
  conditionsFermete?: string | null;
  primeNette: number;
  montantCartes: number;
  montantAccessoires: number;
  montantTaxe: number;
  primeTTC: number;
  dateCreation: string;
  // Nom de fichier sous backend/uploads/logos-cotations/ — utilisé sur le
  // document généré quand la cotation n'a pas d'appel d'offres (donc pas de
  // Prospect à rattacher, voir uploadProspectLogo pour ce cas).
  logo?: string | null;
  garanties: CotationGarantieLigne[];
  // Offre santé (2026-10) : contenu lu par ARIANA dans la proposition de
  // la compagnie, voir backend/src/cotation/contenu-offre.ts.
  contenuOffre?: ContenuOffre | null;
  documentSourceId?: string | null;
}

// Miroir de backend/src/cotation/contenu-offre.ts.
export interface LigneGarantie { libelle: string; taux?: string | null; plafond?: string | null }
export interface SectionGaranties { titre?: string | null; plafondCommun?: string | null; lignes: LigneGarantie[] }
export interface TableauGaranties {
  style: "grille" | "colonnes";
  titreColonneGaranties?: string | null;
  titreColonneTaux?: string | null;
  territorialite: string;
  tauxAmbulatoire?: string | null;
  tauxHospitalisation?: string | null;
  titreCollege?: string | null;
  sections: SectionGaranties[];
  piedTableau?: string | null;
}
export interface ContenuOffre {
  titre: string[];
  designationRecap: string[];
  libelleComparatif: string;
  population: number;
  garanties: string[];
  limites: { texte: string; detail?: string | null }[];
  mentionsFraisReels: boolean;
  tableau?: TableauGaranties | null;
  primeParPersonne?: number | null;
  primeCommuniquee?: number | null;
  primeNonCommuniquee?: boolean;
  ordre?: number;
  remarques?: string | null;
  controleCompagnie?: { taxe: number | null; ttc: number | null } | null;
}

export interface ParametresOffre {
  titreDocument: string;
  exercice: string;
  date: string;
  redacteur: string[];
  chargeClientele: string;
  telephone: string;
  telecopie: string;
  adresseAssure: string;
  periode: string;
  duree: string;
  mentionSignature: string;
  lieuSignature: string;
  ordreCompagnies?: string[];
  cotationIdsExclues?: string[];
  pagesPresentation: boolean;
  annexeReseau: boolean;
}

export interface CotationInput {
  appelOffresId?: string;
  compagnieId?: string;
  branche: string;
  clientNom: string;
  population: number;
  territorialite: string;
  tauxCouvertureAmbulatoire?: string;
  tauxCouvertureHospitalisation?: string;
  exclusions?: string;
  clauseAjustement?: string;
  limiteAgeAdulte?: number;
  limiteAgeEnfant?: number;
  plafondFamilial?: number;
  conditionsFermete?: string;
  primeNette: number;
  montantCartes: number;
  montantAccessoires: number;
  garanties: CotationGarantieLigne[];
  contenuOffre?: ContenuOffre;
}

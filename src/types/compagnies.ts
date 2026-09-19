export interface AccessoireTranche {
  id: string;
  borneMin: number;
  borneMax: number | null;
  montant: number;
}

export interface SurprimeAge {
  id: string;
  ageMin: number;
  ageMax: number | null;
  tauxPourcent: number;
}

export interface ClauseAjustement {
  id: string;
  spMin: number;
  spMax: number | null;
  tauxAjustement: number;
  description: string | null;
}

export interface Territorialite {
  id: string;
  libelle: string;
}

export interface TauxCouverture {
  id: string;
  tauxAmbulatoire: string;
  tauxHospitalisation: string;
}

// Ligne du tableau de garanties/plafonds propre à cette compagnie (2026-08)
// — voir Cotation/CotationGarantieLigne, qui s'en pré-remplit.
export interface GarantieCatalogueLigne {
  id: string;
  branche: string; // "Maladie" | "Assistance"
  categorie: string;
  libelle: string;
  tauxAssureDefaut: number | null;
  tauxAyantsDroitDefaut: number | null;
  plafondDefaut: string | null;
  // Pré-remplissage de CotationGarantieLigne.tauxStructurePrivee/Publique —
  // texte libre, distinct de tauxAssureDefaut/tauxAyantsDroitDefaut qui
  // restent un pourcentage pour le Contrat.
  tauxStructurePriveeDefaut: string | null;
  tauxStructurePubliqueDefaut: string | null;
}

export interface Compagnie {
  id: string;
  nom: string;
  pays: string;
  // Code interne — repris sur le Décompte de Remboursement Maladie
  // ("Compagnie <code> <nom>", voir DocumentsService.renderDecompteFacture).
  code?: string | null;
  // Préfixe des numéros de police (2026-08) — distinct de `code` ci-dessus,
  // ex. "1000" pour NSIA, "R060" pour BGFI ASSURANCES (peut contenir des
  // lettres) — voir ContratsService.prochainNumeroPolice.
  prefixeNumeroPolice?: string | null;
  // Code du courtier auprès de CETTE compagnie (2026-08) — voir Bordereau
  // de Production, colonne "Code Assuré" (identique sur toutes les lignes
  // d'une même section compagnie).
  codeCourtier?: string | null;
  logo?: string | null;
  // Auto-Gestion — renseigné = ce n'est pas une vraie compagnie mais le
  // profil auto-géré d'un souscripteur (voir écran Auto-Gestion).
  clientId?: string | null;
  tauxCommissionMaladie: number | null;
  tauxCommissionAssistance: number | null;
  contrats: number;
  prime: number;
  accessoires: AccessoireTranche[];
  surprimesAge: SurprimeAge[];
  clausesAjustement: ClauseAjustement[];
  territorialites: Territorialite[];
  tauxCouverture: TauxCouverture[];
  garantiesCatalogue: GarantieCatalogueLigne[];
  // Valeurs par défaut reprises pour pré-remplir une nouvelle Cotation.
  plafondFamilialDefaut: number | null;
  limiteAgeAdulteDefaut: number | null;
  limiteAgeEnfantDefaut: number | null;

  // Papier en-tête / pied de page légal (2026-08) — repris sur les
  // documents imprimés sur le papier de la compagnie (ex. Facture
  // Production), jamais sur les documents MedAssur.
  raisonSociale: string | null;
  capitalSocial: string | null;
  rccm: string | null;
  statistique: string | null;
  adresseSiege: string | null;
  boitePostale: string | null;
  ville: string | null;
  telephone: string | null;
  fax: string | null;
  emailContact: string | null;
  siteWeb: string | null;
  // Coordonnées bancaires (2026-08) — reprises sur la Facture Production.
  banqueNom: string | null;
  banqueNumeroCompte: string | null;
  // Note de paiement par défaut (2026-08) — pré-remplit le formulaire
  // Facture Production, reste éditable au cas par cas.
  notePaiementDefaut: string | null;
  // Pied de page légal — texte exact tel qu'imprimé sur le papier en-tête
  // réel, imprimé verbatim sur la Facture Production (prioritaire sur une
  // reconstruction depuis les champs structurés ci-dessus).
  piedDePageLegal: string | null;
}

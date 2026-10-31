// Contenu « offre santé » d'une cotation (2026-10) — voir demande
// utilisateur : ARIANA lit la proposition d'une compagnie (PDF, scan
// compris) et l'offre LA RUCHE est générée « avec le même rendu à 100 % »
// que les modèles Word (OFFRE SANTE LAY PRO / BW ENERGY / ETS MSSZ).
// Stocké tel quel dans Cotation.contenuOffre (JSON) : la mise en page des
// propositions varie trop d'une compagnie à l'autre pour des colonnes SQL.
// Les montants (prime nette, cartes, accessoires, taxe, TTC) restent dans
// les colonnes Decimal de Cotation, seule source de vérité des primes.

export interface LigneGarantie {
  libelle: string;
  taux?: string | null;
  plafond?: string | null;
}

export interface SectionGaranties {
  titre?: string | null;
  // Plafond unique valable pour toute la rubrique (cellule fusionnée du
  // style « grille », ex. « 80% frais réels exposés selon BTAM »).
  plafondCommun?: string | null;
  lignes: LigneGarantie[];
}

// « grille » = tableau LA RUCHE à bandeaux de rubriques (OFFRE ETS MSSZ) ;
// « colonnes » = tableau Garanties / Taux / Plafond à lignes alternées
// (propositions OGAR, AXA, SANLAM de l'OFFRE LAY PRO).
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

export interface LimiteGarantie {
  texte: string;
  // Suite sans puce sous l'élément (ex. « L'examen des bulletins
  // d'adhésion… » sous « Cette cotation est ferme sous réserve de : »).
  detail?: string | null;
}

export interface ContenuOffre {
  // Lignes du bandeau de la page « Proposition », ex. ["PROPOSITION SANTE
  // LAY PRO :", "GABON UNIQUEMENT", "80% Ambulatoires &", "100 % hospitalisations"].
  titre: string[];
  // Ligne du récapitulatif des primes (une entrée = une ligne imprimée).
  designationRecap: string[];
  // Libellé de ligne du tableau comparatif final ; deux cotations de
  // compagnies différentes avec le même libellé tombent sur la même ligne.
  libelleComparatif: string;
  population: number;
  garanties: string[];
  limites: LimiteGarantie[];
  mentionsFraisReels: boolean;
  tableau?: TableauGaranties | null;
  primeParPersonne?: number | null;
  // Prime annoncée par la compagnie avant réduction commerciale obtenue.
  primeCommuniquee?: number | null;
  primeNonCommuniquee?: boolean;
  // Ordre d'affichage parmi les cotations d'une même compagnie.
  ordre?: number;
  // Relecture : points incertains signalés par ARIANA, et taxe/TTC écrits
  // par la compagnie (le décompte LA RUCHE est recalculé, cartes comprises).
  remarques?: string | null;
  controleCompagnie?: { taxe: number | null; ttc: number | null } | null;
}

// Paramètres du document complet, propres à un appel d'offres
// (AppelOffres.parametresOffre). Pré-remplis à la première génération.
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

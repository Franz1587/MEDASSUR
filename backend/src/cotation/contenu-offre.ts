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

// Garanties imprimées par LA RUCHE sur toute proposition Maladie (puces ➢).
export const GARANTIES_STANDARD = [
  "Maladie : (consultations, visite, analyses médicales, pharmacie, consultations de spécialistes, sauf les spécialistes soumises à plafond listées ci-après)",
  "Hospitalisations médicales et chirurgicales", "Prothèses en général (autres que dentaires et optiques)", "Maternité",
  "Dentisterie (soins dentaires, prothèses, orthodontie, chirurgie dentaire)", "Orthophonie", "Lunetterie",
  "Cures thermales et massages", "Evacuation sanitaire (intérieur du pays vers Libreville)",
];

export interface CotationSaisie {
  branche: string; clientNom: string; population: number; territorialite: string;
  tauxCouvertureAmbulatoire?: string | null; tauxCouvertureHospitalisation?: string | null;
  plafondFamilial?: unknown; exclusions?: string | null; clauseAjustement?: string | null;
  limiteAgeAdulte?: number | null; conditionsFermete?: string | null; primeNette: unknown;
  garanties: { categorie: string; libelle: string; plafond: string; tauxStructurePrivee?: string | null; tauxStructurePublique?: string | null }[];
}

// Cotation saisie à la main (sans lecture ARIANA) → même contenu que celui
// qu'ARIANA rédige, pour que le document soit identique quelle que soit
// l'origine de la cotation.
export function contenuDepuisCotation(c: CotationSaisie): ContenuOffre {
  const pct = (v?: string | null) => (v ? (/%/.test(v) ? v.trim() : `${v.trim()}%`) : "");
  const amb = pct(c.tauxCouvertureAmbulatoire), hosp = pct(c.tauxCouvertureHospitalisation);
  const terr = c.territorialite?.trim() || "Gabon uniquement";
  const terrPhrase = terr.charAt(0).toUpperCase() + terr.slice(1).toLowerCase();
  const population = c.population > 0 ? c.population : 1;
  const net = Number(c.primeNette);
  const plafond = Number(c.plafondFamilial ?? 0);
  const multi = new Set(c.garanties.map((g) => g.categorie)).size > 1;
  const sections: SectionGaranties[] = [];
  for (const g of c.garanties) {
    const titre = multi ? g.categorie : null;
    let s = sections.find((x) => x.titre === titre);
    if (!s) sections.push((s = { titre, lignes: [] }));
    const taux = [g.tauxStructurePrivee, g.tauxStructurePublique].filter(Boolean).join(" / ");
    s.lignes.push({ libelle: g.libelle, taux: taux || null, plafond: g.plafond || null });
  }
  if (c.branche === "Assistance") {
    return {
      titre: ["PROPOSITION", "ASSISTANCE"], designationRecap: ["Assistance"], libelleComparatif: `${c.clientNom} - Assistance`,
      population, garanties: c.garanties.map((g) => g.libelle), limites: [], mentionsFraisReels: false, tableau: null,
      primeParPersonne: net ? Math.round(net / population) : null,
    };
  }
  return {
    titre: [`PROPOSITION SANTE ${c.clientNom.toUpperCase()} :`, terr.toUpperCase(), ...(amb ? [`${amb} Ambulatoires &`] : []), ...(hosp ? [`${hosp.replace("%", " %")} hospitalisations`] : [])],
    designationRecap: amb && hosp ? [`Maladie ${c.clientNom} : ${terrPhrase} - ${amb}`, `Frais médicaux & ${hosp} Hospitalisations`] : [`Maladie ${c.clientNom} : ${terrPhrase}`],
    libelleComparatif: amb && hosp ? `${c.clientNom} - ${terrPhrase} (${amb} / ${hosp})` : `${c.clientNom} - ${terrPhrase}`,
    population, garanties: GARANTIES_STANDARD,
    limites: [
      ...(plafond ? [{ texte: `Le plafond de remboursement est fixé à ${Math.round(plafond).toLocaleString("fr-FR").replace(/\s/g, ".")} FCFA par famille et par année d’assurance y compris rechutes et séquelles.` }] : []),
      ...(c.exclusions ? [{ texte: c.exclusions }] : []),
      ...(c.clauseAjustement ? [{ texte: c.clauseAjustement }] : []),
      ...(c.limiteAgeAdulte ? [{ texte: `Limite d’âge fixée à ${c.limiteAgeAdulte} ans` }] : []),
      ...(c.conditionsFermete ? [{ texte: "Cette cotation est ferme sous réserve de :", detail: c.conditionsFermete }] : []),
    ],
    mentionsFraisReels: true,
    tableau: sections.length ? {
      style: "colonnes", territorialite: terr.toUpperCase(),
      titreColonneTaux: c.garanties.some((g) => g.tauxStructurePublique) ? "TAUX (privé / public)" : "TAUX", sections,
    } : null,
    primeParPersonne: net ? Math.round(net / population) : null,
  };
}

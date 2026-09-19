// Nomenclature à lettres clés (2026-08) — deuxième mode de tarification
// d'un acte (codification), alternatif au montant forfaitaire du catalogue
// ActeMedical : montant = coefficient (saisi pour l'acte précis) × valeur
// unitaire (fixée ici, par lettre). Voir backend/prisma/schema.prisma
// LettreCle.
export interface LettreCle {
  code: string;
  libelle: string;
  valeurUnitaire: number;
  // Listes à choix multiple (2026-08) — tableau vide = s'applique à
  // toutes les catégories/spécialités, aucune restriction (voir demande
  // utilisateur : "lier cela à toutes les garanties"/"toutes les spécialités").
  categoriesGarantie: string[];
  specialites: string[];
  actif: boolean;
}

// Catégories de garantie sélectionnables pour une lettre clé — les
// catégories réelles du tableau de garanties (voir CATEGORIES_GARANTIE,
// features/actes-medicaux/index.tsx) plus "Chirurgie"/"EVASAN", qui ne sont
// pas des Garantie.categorie à part entière (la chirurgie relève de la
// rubrique Hospitalisation) mais restent des types d'acte à part entière
// utiles pour filtrer la nomenclature (voir AccordPrealable.type).
export const CATEGORIES_GARANTIE_LETTRE_CLE = ["Consultation/Divers", "Hospitalisation", "Chirurgie", "EVASAN", "Dentisterie", "Kinésithérapie & Cure thermale", "Ambulatoire"];

// KC/KA/K Loc (chirurgien/anesthésiste/location du bloc opératoire) — à la
// saisie d'un acte chirurgical, seul le coefficient du KC est renseigné ;
// celui du KA en est dérivé (KC/2) puis celui du K Loc (KC+KA), voir
// FactureSaisie.tsx / accord-prealable/index.tsx.
export const CODE_KC = "KC";
export const CODE_KA = "KA";
export const CODE_K_LOC = "K Loc";

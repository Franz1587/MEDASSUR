import { RUBRIQUES_PLAFONNEES } from "../sante/dto/create-facture-ligne.dto";

// Résolution canonique "ligne de prestation → rubrique du tableau de
// garanties du CONTRAT" (2026-09) — voir demande utilisateur : "les
// statistiques doivent être en harmonie parfaite avec le tableau de
// garantie du contrat... les rubriques sont celles du tableau de garanties
// du contrat." Remplace 4 implémentations dupliquées et incohérentes
// (statistiques.service.ts, portail-membre.util.ts, documents.service.ts,
// ConsommationsTab.tsx côté frontend) — util pur (pas un service Nest,
// comme groupes-actes.util.ts) pour rester importable depuis n'importe quel
// module sans créer de dépendance de module.
export interface ActeInfoRubrique {
  famille: string;
  categorieGarantie: string | null;
}

export function resoudreRubriqueContrat(
  garantiesContrat: { categorie: string }[],
  ligne: { type: string },
  acteInfo?: ActeInfoRubrique | null,
): string {
  // Garde "DIVERS" — un import d'historique en masse ("reprise
  // d'antériorité") rattache TOUTES ses lignes à un seul acte générique
  // placeholder (famille "DIVERS") dont la categorieGarantie
  // ("Consultation/Divers") ne reflète jamais le type réel de la ligne.
  // Ignorer l'acte dans ce cas précis et se rabattre sur `ligne.type`, qui
  // porte la vraie info (Ambulatoire/Hospitalisation/Autre...) — même
  // garde que portail-membre.util.ts historiquement, désormais partagée.
  const categorieActe = acteInfo && acteInfo.famille.trim().toUpperCase() !== "DIVERS" ? acteInfo.categorieGarantie : null;
  const candidat = (categorieActe ?? ligne.type).trim();
  if (!candidat) return "Non précisé";

  // Cas idéal : la rubrique correspond à une ligne réelle du tableau de
  // garanties de CE contrat — on retourne la casse exacte du contrat
  // plutôt que celle du candidat, pour un affichage identique partout.
  const match = garantiesContrat.find((g) => g.categorie.trim().toLowerCase() === candidat.toLowerCase());
  if (match) return match.categorie;

  // Rubrique plafonnée (a besoin d'une ligne Garantie pour avoir un
  // taux/plafond défini) mais aucune ligne ne correspond sur ce contrat —
  // signal honnête d'un tableau de garanties incomplet plutôt qu'un
  // chiffre qui semblerait rattaché à une garantie qui n'existe pas.
  if (RUBRIQUES_PLAFONNEES.includes(candidat)) return `Hors tableau de garanties (${candidat})`;

  // Grande rubrique sans plafond (Consultations, Actes de Spécialités,
  // Pharmacie, Imagerie, Analyses Médicale, Petite Chirurgie/Soins,
  // Hospitalisation, Ambulatoire...) — suit le taux plat du contrat, n'a
  // jamais eu besoin d'une ligne Garantie pour être légitime.
  return candidat;
}

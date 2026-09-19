// Nature de l'affection — "Affection Courante" / "Affection Longue"
// (2026-08) — voir demande utilisateur : "il fallait créer une rubrique
// nature de l'affection dans la saisie de la facture... 1- Affection
// Courante, 2- Affection Longue". Saisie à chaque ligne de facture,
// strictement interne — jamais affichée sur le Décompte remis au tiers
// (toujours "Affection Courante" à l'écran, voir DocumentsService.
// renderDecompteFacture), utilisable pour des statistiques de santé réelles
// (identifier les cas graves qui pourraient déséquilibrer un contrat).
export type NatureMaladie = "AffectionCourante" | "AffectionLongue";

export const OPTIONS_NATURE_MALADIE: { valeur: NatureMaladie; label: string }[] = [
  { valeur: "AffectionCourante", label: "Affection Courante" },
  { valeur: "AffectionLongue", label: "Affection Longue" },
];

export const LABEL_NATURE_MALADIE: Record<NatureMaladie, string> = {
  AffectionCourante: "Affection Courante",
  AffectionLongue: "Affection Longue",
};

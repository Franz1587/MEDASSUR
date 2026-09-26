// Référence d'un contrat (2026-09) — voir demande utilisateur : "Arrête de
// référencer les contrats par autre chose que le numéro de police compagnie.
// Le seul numéro qui est valable c'est le numéro compagnie. Ne pas confondre
// le numéro d'identification du souscripteur dans l'application avec le
// numéro de police qui permet véritablement de référencer un contrat."
//
// RÈGLE : un contrat ne s'affiche, ne se cite et ne se nomme JAMAIS par son
// identifiant interne (Contrat.id, ex. "260144") — uniquement par son numéro
// de police compagnie, via cette fonction. L'id interne ne sert qu'aux
// clés techniques (URL d'API, value d'un <option>, key React).
export const POLICE_NON_RENSEIGNEE = "Police non renseignée";

export function numeroPolice(contrat: { numeroPolice?: string | null } | null | undefined): string {
  return contrat?.numeroPolice?.trim() || POLICE_NON_RENSEIGNEE;
}

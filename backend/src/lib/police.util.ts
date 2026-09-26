// Référence d'un contrat (2026-09) — voir demande utilisateur : "Arrête de
// référencer les contrats par autre chose que le numéro de police compagnie.
// Le seul numéro qui est valable c'est le numéro compagnie. Ne pas confondre
// le numéro d'identification du souscripteur dans l'application avec le
// numéro de police qui permet véritablement de référencer un contrat."
//
// RÈGLE : aucun texte destiné à un humain (document, libellé comptable,
// message d'erreur, notification, réponse de l'agent IA) ne cite l'id interne
// d'un contrat (Contrat.id, ex. "260144") — uniquement son numéro de police,
// via cette fonction. Même règle côté frontend : src/lib/police.ts.
export const POLICE_NON_RENSEIGNEE = "Police non renseignée";

export function numeroPolice(contrat: { numeroPolice?: string | null } | null | undefined): string {
  return contrat?.numeroPolice?.trim() || POLICE_NON_RENSEIGNEE;
}

// Numéro de police utilisable dans un nom de fichier téléchargé ("84/0026"
// → "84-0026") — jamais l'id interne à la place.
export function policePourNomFichier(contrat: { numeroPolice?: string | null } | null | undefined): string {
  return (contrat?.numeroPolice?.trim() || "sans-police").replace(/[\\/:*?"<>|\s]+/g, "-");
}

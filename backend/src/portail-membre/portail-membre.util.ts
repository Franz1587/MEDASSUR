// Rapprochement entre une PriseEnCharge et les garanties du contrat — même
// logique (et même limite "best effort" pour les lignes sans acte lié) que
// DocumentsService.resoudreCategorieConsommation / ConsommationsTab.tsx
// (frontend) : dupliquée ici plutôt qu'exportée depuis un module qui n'a
// pas vocation à être une dépendance du portail assuré, comme déjà fait
// dans les 2 autres endroits.
//
// groupeActeLibelle (2026-08) — voir demande utilisateur : "'Consultation/
// Divers' ça ne veut rien dire. Chaque acte est lié à une famille, c'est
// donc la famille qui doit remonter" : quand la ligne est liée à un acte du
// catalogue, GROUPES_ACTES (via ActeMedical.famille) donne une rubrique
// bien plus parlante pour l'assuré ("Analyse", "Consultation", "Pharmacie"…)
// que Garantie.categorie (8 rubriques CONTRACTUELLES larges, qui restent la
// bonne granularité côté suivi de plafond interne — voir DocumentsService.
// resoudreCategorieConsommation, volontairement pas touché). Et si même le
// repli texte échoue, mieux vaut afficher le type réel de la ligne
// ("Ambulatoire", "Transport"...) qu'un "Autre" qui ne dit rien.
export function resoudreCategorieConsommation(
  garanties: { categorie: string; libelle: string }[], type: string, groupeActeLibelle?: string | null,
): string {
  if (groupeActeLibelle) return groupeActeLibelle;
  const t = type.trim().toLowerCase();
  if (!t) return "Autre";
  const categorieDirecte = garanties.find((g) => g.categorie.trim().toLowerCase() === t);
  if (categorieDirecte) return categorieDirecte.categorie;
  const exact = garanties.find((g) => g.libelle.trim().toLowerCase() === t);
  if (exact) return exact.categorie;
  const partiel = garanties.find((g) => t.includes(g.libelle.trim().toLowerCase()) || g.libelle.trim().toLowerCase().includes(t));
  return partiel ? partiel.categorie : type.trim() || "Autre";
}

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Exercice auquel appartient une date de soin (2026-08) — voir demande
// utilisateur : "l'historique des consommations doit être rangé... par
// exercice". null quand la date ne tombe dans aucun exercice connu du
// contrat (donnée antérieure au suivi par exercice, ou exercice pas encore
// créé).
export function resoudreExercice(exercices: { numero: number; dateDebut: string; dateFin: string }[], date: string): number | null {
  const d = parseDateFr(date);
  if (!d) return null;
  const match = exercices.find((e) => {
    const debut = parseDateFr(e.dateDebut);
    const fin = parseDateFr(e.dateFin);
    return debut && fin && d >= debut && d <= fin;
  });
  return match?.numero ?? null;
}

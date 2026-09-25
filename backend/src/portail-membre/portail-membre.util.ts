import { resoudreRubriqueContrat } from "../actes-medicaux/rubrique-contrat.util";

// Rapprochement entre une PriseEnCharge et les garanties du contrat (2026-09
// — voir demande utilisateur : "les statistiques doivent être en harmonie
// parfaite avec le tableau de garantie du contrat... les rubriques sont
// celles du tableau de garanties du contrat"). Délègue désormais à
// resoudreRubriqueContrat (backend/src/actes-medicaux/rubrique-contrat.util.ts),
// la même fonction canonique utilisée par StatistiquesService/
// DocumentsService/ConsommationsTab — remplace la préférence historique
// (2026-08) pour la "famille" fine du catalogue (GROUPES_ACTES), plus
// parlante mais déconnectée du tableau de garanties réel : l'assuré voit
// désormais exactement les mêmes libellés de rubrique que le contrat/le
// souscripteur.
export function resoudreCategorieConsommation(
  garanties: { categorie: string; libelle: string }[], type: string, acteInfo?: { famille: string; categorieGarantie: string | null } | null,
): string {
  return resoudreRubriqueContrat(garanties, { type }, acteInfo);
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

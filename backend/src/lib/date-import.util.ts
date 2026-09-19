// Dates à l'import (2026-08) — voir demande utilisateur : lors de l'import
// en masse (Contrats, Factures, Prises en charge, et par extension tout
// autre onglet du même moteur — Règlements, Assurés), certains anciens
// systèmes exportent leurs dates au format `Date.toString()` Java/JS
// ("Wed Jul 15 00:00:00 UTC 2026", éventuellement avec une heure réelle —
// "Wed Jul 15 10:24:10 UTC 2026") plutôt que JJ/MM/AAAA attendu par
// l'application. Traduit systématiquement vers JJ/MM/AAAA, quelle que soit
// la colonne, sans jamais retoucher une date déjà au bon format (voir
// garde ci-dessous — `new Date()` lirait "05/07/2026" à l'anglo-saxonne,
// donc n'est JAMAIS appelé sur une chaîne purement numérique à séparateurs).

function formatDateFr(d: Date): string {
  const jj = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${d.getUTCFullYear()}`;
}

export function normaliserDateImport(valeur: unknown): string | undefined {
  if (valeur === null || valeur === undefined) return undefined;

  // ExcelJS rend parfois directement un objet Date pour une cellule mise
  // en forme "date" — jamais réinterprété via new Date(), déjà exploitable.
  if (valeur instanceof Date) {
    return isNaN(valeur.getTime()) ? undefined : formatDateFr(valeur);
  }

  const s = String(valeur).trim();
  if (!s) return undefined;

  // Déjà au format attendu (séparateurs "/" ou "-", jour/mois non
  // obligatoirement zéro-paddés en entrée) — normalisé tel quel, JAMAIS
  // reparsé par new Date().
  const dejaFr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dejaFr) {
    const [, j, m, a] = dejaFr;
    return `${j.padStart(2, "0")}/${m.padStart(2, "0")}/${a}`;
  }

  // Format "Wed Jul 15 00:00:00 UTC 2026" (et toute variante textuelle
  // avec mois/jour en lettres — jamais un simple MM/JJ/AAAA numérique
  // ambigu) : le moteur JS le parse nativement sans ambiguïté.
  if (/[A-Za-z]{3}.*\d{4}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return formatDateFr(d);
  }

  // Format inconnu — laissé tel quel ; la validation en aval (dateDebut/
  // dateFin obligatoires, etc.) rejette proprement si ce n'est finalement
  // pas une date exploitable, plutôt qu'un échec silencieux ici.
  return s;
}

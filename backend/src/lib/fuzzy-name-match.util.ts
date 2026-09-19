// Rapprochement approximatif de raisons sociales/noms à l'import (2026-08)
// — voir demande utilisateur : reprise d'antériorité où le même
// souscripteur/compagnie apparaît sous un libellé légèrement différent
// d'un système à l'autre — mots dans un autre ordre ("SYLVERE DENIS
// RETENO NDIAYE" en base vs "RETENO NDIAYE SYLVERE DENIS" importé),
// abrégés ("ETUDE M GEY" vs "ETUDE MAITRE GEY BEKALE ANNE", "GABON ENV"
// vs "GABON ENVIRONNEMENT"), ou avec des mots en plus ("LA POSTE" vs
// "LA POSTE SA"). Utilisé par ContratsService.resoudreClient/
// resoudreCompagnie — jamais pour un rapprochement où la casse/l'accent
// suffit (ceux-là restent une correspondance exacte, prioritaire).

// Plage Unicode des diacritiques combinants (U+0300-U+036F, appliqués
// après normalize("NFD") pour retirer les accents avant comparaison).
const DIACRITIQUES = /[̀-ͯ]/g;

function tokeniser(s: string): string[] {
  return s
    .normalize("NFD").replace(DIACRITIQUES, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Comme tokeniser(), mais conserve le texte ORIGINAL de chaque mot (casse,
// accents) à côté de sa forme normalisée — utilisé par motsNonApparies()
// pour reconstruire un `produit` lisible plutôt qu'une simple découpe de
// caractères (qui couperait "ENVIRONNEMENT" en plein milieu si le
// candidat enregistré est abrégé "ENV").
function tokeniserAvecOriginal(s: string): { original: string; normalise: string }[] {
  const mots = s.match(/[\p{L}\p{N}]+/gu) ?? [];
  return mots.map((original) => ({
    original,
    normalise: original.normalize("NFD").replace(DIACRITIQUES, "").toUpperCase(),
  }));
}

// Un candidat "matche" si TOUS ses mots (le nom enregistré — généralement
// le plus court/abrégé des deux) se retrouvent, dans N'IMPORTE QUEL ORDRE,
// en préfixe d'un mot DISTINCT de la valeur importée (chaque mot importé
// n'est consommé qu'une fois) — jamais l'inverse : la valeur importée peut
// porter des mots en plus (suffixe "SA", collège, agence…), jamais le
// candidat enregistré.
export function correspondApproximativement(nomCandidat: string, valeurImportee: string): boolean {
  const motsCandidat = tokeniser(nomCandidat);
  if (motsCandidat.length === 0) return false;
  const disponibles = tokeniser(valeurImportee);
  for (const motCandidat of motsCandidat) {
    const idx = disponibles.findIndex((m) => m.startsWith(motCandidat));
    if (idx === -1) return false;
    disponibles.splice(idx, 1);
  }
  return true;
}

// Parmi les candidats qui matchent, retient le nom le plus "complet" (le
// plus de mots) — la correspondance la plus spécifique l'emporte (ex.
// "SOFERGA CDG" plutôt que "SOFERGA" si les deux matchent la même valeur).
export function meilleurCandidat<T>(candidats: T[], nomDe: (c: T) => string, valeurImportee: string): T | null {
  const correspondants = candidats.filter((c) => correspondApproximativement(nomDe(c), valeurImportee));
  if (correspondants.length === 0) return null;
  correspondants.sort((a, b) => tokeniser(nomDe(b)).length - tokeniser(nomDe(a)).length);
  return correspondants[0];
}

// Mots de la valeur importée qui n'ont servi à matcher AUCUN mot du nom
// candidat — ex. "GABON ENVIRONNEMENT" apparié à "GABON ENV" : "GABON" et
// "ENVIRONNEMENT" (le mot ENTIER, pas juste "ENV") sont consommés, il ne
// reste rien ; "LA POSTE SA" apparié à "LA POSTE" : il reste "SA". Repris
// comme Contrat.produit (collège, agence…) plutôt que silencieusement
// perdu — jamais une découpe de caractères, qui couperait un mot abrégé en
// plein milieu.
export function motsNonApparies(nomCandidat: string, valeurImportee: string): string {
  const motsCandidat = tokeniser(nomCandidat);
  const disponibles = tokeniserAvecOriginal(valeurImportee);
  for (const motCandidat of motsCandidat) {
    const idx = disponibles.findIndex((m) => m.normalise.startsWith(motCandidat));
    if (idx !== -1) disponibles.splice(idx, 1);
  }
  return disponibles.map((m) => m.original).join(" ");
}

// Heuristique "ressemble à un nom de particulier" (2026-08 — voir demande
// utilisateur : "quand le nom du contrat est le nom d'un particulier, cela
// veut dire que le contrat est pour un particulier") — SEULEMENT utilisée
// en tout dernier repli, quand aucun souscripteur existant (direct, sigle,
// flou) ne correspond. Volontairement prudente : 2 à 5 mots, uniquement
// des lettres (jamais de chiffre ni de "&"), aucun mot caractéristique
// d'une raison sociale. En cas de doute, la ligne reste rejetée plutôt que
// de créer un mauvais souscripteur.
const MOTS_SOCIETE = new Set([
  "SA", "SARL", "SAS", "SUARL", "GIE", "ETS", "ETABLISSEMENT", "ETABLISSEMENTS",
  "ETUDE", "AGENCE", "COMPAGNIE", "COMPLEXE", "GROUPE", "GROUP", "SOCIETE", "SOCIETE",
  "ENTREPRISE", "CABINET", "CONSULTING", "CONSULTG", "SERVICES", "SERVICE",
  "INDUSTRIE", "INDUSTRIEL", "INDUSTRIELLE", "HOLDING", "INTERNATIONAL",
  "ENERGY", "ENERGIE", "MINE", "MINES", "PORT", "BANQUE", "ASSURANCE", "ASSURANCES",
  "GABON", "TRANSPORT", "TRANSPORTS", "TRAVAUX", "MARITIME", "PARTNERS", "CONSEILS", "CONSEIL",
]);

export function ressembleAUnParticulier(valeur: string): boolean {
  if (/[0-9&]/.test(valeur)) return false;
  const mots = tokeniser(valeur);
  if (mots.length < 2 || mots.length > 5) return false;
  return mots.every((m) => !MOTS_SOCIETE.has(m));
}

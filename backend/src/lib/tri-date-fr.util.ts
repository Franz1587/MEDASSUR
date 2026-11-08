// Les dates métier sont stockées en texte "JJ/MM/AAAA" : un `orderBy` en base
// les trie par jour du mois (« 30/01 » avant « 05/02 »), jamais chronologiquement.
// Tout tri par date de soins passe donc par ces helpers, en mémoire.

/** Clé chronologique AAAAMMJJ d'une date "JJ/MM/AAAA" (ou ISO "AAAA-MM-JJ") ; null si illisible. */
export function cleDateFr(s?: string | null): number | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  return null;
}

/**
 * Tri stable par clé de date (récent d'abord par défaut). Les éléments sans date
 * valide sont toujours placés en dernier ; à date égale l'ordre d'origine est conservé.
 */
export function trierParDate<T>(items: readonly T[], cle: (item: T) => number | null, ordre: "asc" | "desc" = "desc"): T[] {
  const indexes = items.map((item, i) => ({ item, i, k: cle(item) }));
  indexes.sort((a, b) => {
    if (a.k === null && b.k === null) return a.i - b.i;
    if (a.k === null) return 1;
    if (b.k === null) return -1;
    return a.k === b.k ? a.i - b.i : ordre === "desc" ? b.k - a.k : a.k - b.k;
  });
  return indexes.map((x) => x.item);
}

/**
 * Date de soins d'une facture = date de soins la plus récente de ses prestations
 * (repli : date de réception si la facture n'a encore aucune ligne datée).
 */
export function cleDateSoinsFacture(f: { dateReception?: string | null; lignes: readonly { date?: string | null }[] }): number | null {
  let max: number | null = null;
  for (const l of f.lignes) {
    const k = cleDateFr(l.date);
    if (k !== null && (max === null || k > max)) max = k;
  }
  return max ?? cleDateFr(f.dateReception);
}

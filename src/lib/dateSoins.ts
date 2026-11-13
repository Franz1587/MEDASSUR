// Dates métier en texte "JJ/MM/AAAA" : le tri alphabétique est faux (jour du mois d'abord),
// on convertit en clé chronologique AAAAMMJJ.

export function cleDateFr(s?: string | null): number | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  return null;
}

/** Tri stable par date de soins ; les dates illisibles vont toujours en dernier. */
export function trierParDateSoins<T>(items: readonly T[], date: (item: T) => string | null | undefined, ordre: "asc" | "desc" = "asc"): T[] {
  return items
    .map((item, i) => ({ item, i, k: cleDateFr(date(item)) }))
    .sort((a, b) => {
      if (a.k === null && b.k === null) return a.i - b.i;
      if (a.k === null) return 1;
      if (b.k === null) return -1;
      return a.k === b.k ? a.i - b.i : ordre === "desc" ? b.k - a.k : a.k - b.k;
    })
    .map((x) => x.item);
}

/** "12/03/2026" ou "12/03/2026 → 20/03/2026" ; "—" si aucune date exploitable. */
export function plageDatesSoins(dates: readonly (string | null | undefined)[]): string {
  const valides = trierParDateSoins(dates.filter((d) => cleDateFr(d) !== null), (d) => d, "asc") as string[];
  if (valides.length === 0) return "—";
  const premiere = valides[0], derniere = valides[valides.length - 1];
  return cleDateFr(premiere) === cleDateFr(derniere) ? premiere : `${premiere} → ${derniere}`;
}

// Extraction de texte depuis une cellule ExcelJS (2026-08) — voir demande
// utilisateur : "[object Object]" remontait pour toute cellule texte enrichi
// (richText) ou lien hypertexte, au lieu de sa vraie valeur. ExcelJS rend
// une cellule "normale" en string/number/boolean/Date directement, mais une
// cellule mise en forme caractère par caractère (texte enrichi — courant
// après un copier-coller depuis un autre classeur) en objet
// `{ richText: [{ text, font? }, …] }`, et un lien hypertexte en objet
// `{ text, hyperlink }`. Sans traitement dédié, `String(valeur)` sur l'un
// de ces objets donne littéralement "[object Object]" — jamais le texte
// réel. Utilisé par tout import (Contrats, Factures, Prises en charge,
// Règlements, Assurés) qui lit des cellules brutes.
export function texteBrutDeCellule(valeur: unknown): string | undefined {
  if (valeur === null || valeur === undefined) return undefined;
  if (valeur instanceof Date) return valeur.toString();
  if (typeof valeur !== "object") {
    const s = String(valeur).trim();
    return s || undefined;
  }
  const v = valeur as Record<string, unknown>;
  // Cellule formule — déjà calculée (voir `result`), jamais la formule
  // elle-même.
  if ("result" in v) return texteBrutDeCellule(v.result);
  // Texte enrichi — concatène les segments dans l'ordre, sans leur mise en
  // forme (gras/couleur/taille — non pertinente pour une valeur importée).
  if (Array.isArray(v.richText)) {
    const s = v.richText.map((seg) => (seg && typeof seg === "object" && "text" in seg ? String((seg as { text: unknown }).text ?? "") : "")).join("").trim();
    return s || undefined;
  }
  // Lien hypertexte — le texte affiché, jamais l'URL.
  if (typeof v.text === "string") {
    const s = v.text.trim();
    return s || undefined;
  }
  // Cellule en erreur (#REF!, #N/A…) — aucune valeur exploitable.
  if ("error" in v) return undefined;
  return undefined;
}

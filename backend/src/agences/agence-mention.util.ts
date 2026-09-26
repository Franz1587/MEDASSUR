// Reconnaissance d'une agence à partir des mentions déclarées par
// l'utilisateur (Agence.mentionsImport, écran Agences) — voir demande
// utilisateur : "il faut rendre paramétrable la création des agences au
// lieu de laisser juste le code le décider." Util pur (même esprit que
// rubrique-contrat.util.ts), sans aucune correspondance codée en dur.

export function cleMention(valeur: string): string {
  return valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// Mention cherchée comme MOT(S) ENTIER(S) : "POG" reconnaît "OGAR
// ASSURANCES POG" mais jamais "POGO" ni "APOGEE". Seules les agences
// actives sont candidates ; en cas de plusieurs agences possibles, la
// mention la plus longue (la plus précise) l'emporte.
export function trouverAgenceParMention<A extends { statut: string; mentionsImport: string[] }>(agences: A[], textes: (string | undefined | null)[]): A | null {
  const cibles = textes.filter((t): t is string => !!t).map((t) => ` ${cleMention(t)} `);
  let meilleure: { agence: A; longueur: number } | null = null;
  for (const agence of agences) {
    if (agence.statut !== "Actif") continue;
    for (const mention of agence.mentionsImport) {
      const cle = cleMention(mention);
      if (!cle) continue;
      if (cibles.some((t) => t.includes(` ${cle} `)) && (!meilleure || cle.length > meilleure.longueur)) {
        meilleure = { agence, longueur: cle.length };
      }
    }
  }
  return meilleure?.agence ?? null;
}

// Colonne "Agence" explicite d'un fichier d'import : reconnue par nom,
// code ou l'une des mentions déclarées (insensible à la casse/aux accents).
export function trouverAgenceParValeur<A extends { nom: string; code: string | null; statut: string; mentionsImport: string[] }>(agences: A[], valeur: string): A | null {
  const cle = cleMention(valeur);
  if (!cle) return null;
  return (
    agences.find((a) => cleMention(a.nom) === cle || (a.code != null && cleMention(a.code) === cle) || a.mentionsImport.some((m) => cleMention(m) === cle)) ?? null
  );
}

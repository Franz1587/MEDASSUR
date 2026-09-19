// Le FCFA n'a pas de sous-unité utilisée en pratique : tout montant est
// systématiquement arrondi (au plus proche) avant affichage — jamais de
// virgule, quel que soit l'endroit de l'application où le calcul est fait.
export function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
}

// Montant intégral, jamais abrégé ("1,5M"/"120K") — l'utilisateur doit
// toujours pouvoir lire le chiffre exact (ex: 1 500 000). Les appelants
// ajoutent eux-mêmes le suffixe "FCFA" quand nécessaire (voir call sites).
export function fmtM(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

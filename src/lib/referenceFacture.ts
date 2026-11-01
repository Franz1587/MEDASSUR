// Référence de facture lisible — les factures télétransmises par le système
// externe d'un prestataire portent "<PRÉFIXE>-<uuid>-<horodatage>"
// (MS-PRESTA-…, ISFCT-…). L'UUID est opaque ; l'horodatage AAAAMMJJHHmm…
// est la vraie information, affichée à la place. La référence d'origine
// reste en base et dans l'infobulle. Même règle côté serveur :
// backend/src/factures/reference-facture.util.ts.
const REFERENCE_TELETRANSMISE = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d*$/i;

export function referenceLisible(reference: string | null | undefined): string {
  const ref = reference ?? "";
  const m = REFERENCE_TELETRANSMISE.exec(ref.trim());
  if (!m) return ref;
  const [, annee, mois, jour, heure, minute] = m;
  return `Télétrans. ${jour}/${mois}/${annee} ${heure}h${minute}`;
}

// Recherche : la référence d'origine OU son libellé lisible.
export function referenceCorrespond(reference: string | null | undefined, recherche: string): boolean {
  const q = recherche.trim().toLowerCase();
  return !q || (reference ?? "").toLowerCase().includes(q) || referenceLisible(reference).toLowerCase().includes(q);
}

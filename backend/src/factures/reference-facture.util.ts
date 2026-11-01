// Référence de télétransmission : "<PRÉFIXE>-<uuid>-<horodatage numérique>"
// générée par le système externe d'un prestataire (MS-PRESTA-…, ISFCT-…),
// jamais saisie à la main. Même règle côté web : src/lib/referenceFacture.ts.
const REFERENCE_TELETRANSMISE = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d*$/i;

export function estReferenceTeleTransmise(reference: string): boolean {
  return REFERENCE_TELETRANSMISE.test(reference.trim());
}

// Affichage : seule la date/heure de l'horodatage est une vraie information.
export function referenceLisible(reference: string): string {
  const m = REFERENCE_TELETRANSMISE.exec(reference.trim());
  if (!m) return reference;
  const [, annee, mois, jour, heure, minute] = m;
  return `Télétrans. ${jour}/${mois}/${annee} ${heure}h${minute}`;
}

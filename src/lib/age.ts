// Dates stockées en JJ/MM/AAAA (string, saisie française) — âge révolu au
// jour près (anniversaire non encore passé cette année = âge - 1).
export function calculerAge(dateNaissance?: string): number | null {
  return ageALaDate(dateNaissance);
}

// Âge révolu à une date de référence JJ/MM/AAAA (défaut : aujourd'hui) —
// ex. début d'un exercice pour la surprime d'âge de cet exercice.
export function ageALaDate(dateNaissance?: string | null, reference?: string | null): number | null {
  if (!dateNaissance) return null;
  const [d, m, y] = dateNaissance.split("/").map(Number);
  if (!d || !m || !y) return null;
  const naissance = new Date(y, m - 1, d);
  const [rd, rm, ry] = (reference ?? "").split("/").map(Number);
  const auj = rd && rm && ry ? new Date(ry, rm - 1, rd) : new Date();
  let age = auj.getFullYear() - naissance.getFullYear();
  const anniversairePasse = auj.getMonth() > naissance.getMonth() || (auj.getMonth() === naissance.getMonth() && auj.getDate() >= naissance.getDate());
  if (!anniversairePasse) age--;
  return age >= 0 ? age : null;
}

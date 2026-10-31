// Durée d'une garantie à partir des dates d'effet et d'échéance (JJ/MM/AAAA),
// échéance incluse : 01/01/2027 → 31/12/2027 = « Un an ».
const lire = (s?: string) => {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};
const ecrire = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function dureeEntre(effet?: string, echeance?: string): string {
  const a = lire(effet), b = lire(echeance);
  if (!a || !b || b < a) return "";
  const fin = new Date(b);
  fin.setDate(fin.getDate() + 1);
  if (fin.getDate() === a.getDate()) {
    const mois = (fin.getFullYear() - a.getFullYear()) * 12 + fin.getMonth() - a.getMonth();
    if (mois % 12 === 0) return mois === 12 ? "Un an" : `${mois / 12} ans`;
    return `${mois} mois`;
  }
  return `${Math.round((fin.getTime() - a.getTime()) / 86_400_000)} jours`;
}

// Échéance proposée : un an moins un jour après la date d'effet.
export function echeanceUnAn(effet?: string): string {
  const a = lire(effet);
  if (!a) return "";
  const b = new Date(a.getFullYear() + 1, a.getMonth(), a.getDate() - 1);
  return ecrire(b);
}

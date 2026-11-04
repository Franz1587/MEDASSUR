// Règle métier des périodes de contrat : l'échéance est la VEILLE de la date
// anniversaire, jamais le même jour/mois que la date d'effet
// (effet 01/01/2026 → échéance 31/12/2026), et un renouvellement démarre le
// lendemain de l'échéance précédente (01/01/2027 → 31/12/2027).

export function parseDateFr(s?: string | null): Date | null {
  const [d, m, y] = (s ?? "").split("/").map(Number);
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1 ? date : null;
}

export function formatDateFr(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function decaler(date: string, jours: number): string {
  const d = parseDateFr(date);
  if (!d) return date;
  d.setDate(d.getDate() + jours);
  return formatDateFr(d);
}

export const lendemain = (date: string) => decaler(date, 1);
export const veille = (date: string) => decaler(date, -1);

// Échéance d'une période de 12 mois commençant à `dateEffet`.
export function echeanceParDefaut(dateEffet: string): string {
  const d = parseDateFr(dateEffet);
  if (!d) return dateEffet;
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return formatDateFr(d);
}

// Échéance tombant le jour anniversaire de la date d'effet → ramenée à la veille.
// Toute autre échéance (période courte, date libre) est laissée telle quelle.
export function normaliserEcheance(dateEffet: string, dateFin: string): string {
  const effet = parseDateFr(dateEffet);
  const fin = parseDateFr(dateFin);
  if (!effet || !fin) return dateFin;
  const anniversaire = fin.getFullYear() > effet.getFullYear() && fin.getDate() === effet.getDate() && fin.getMonth() === effet.getMonth();
  return anniversaire ? veille(dateFin) : dateFin;
}

// Une échéance doit être postérieure à la date d'effet.
export function echeanceValide(dateEffet: string, dateFin: string): boolean {
  const effet = parseDateFr(dateEffet);
  const fin = parseDateFr(dateFin);
  return !!effet && !!fin && fin > effet;
}

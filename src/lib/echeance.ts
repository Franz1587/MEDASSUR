// Même règle que backend/src/contrats/echeance.util.ts : l'échéance est la
// veille de la date anniversaire (effet 01/03/2026 → échéance 28/02/2027).
function parse(s: string): Date | null {
  const [d, m, y] = (s ?? "").split("/").map(Number);
  if (!d || !m || !y || y < 1900) return null;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1 ? date : null;
}

function format(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function echeanceParDefaut(dateEffet: string): string {
  const d = parse(dateEffet);
  if (!d) return "";
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return format(d);
}

export function normaliserEcheance(dateEffet: string, dateFin: string): string {
  const effet = parse(dateEffet);
  const fin = parse(dateFin);
  if (!effet || !fin) return dateFin;
  if (fin.getFullYear() > effet.getFullYear() && fin.getDate() === effet.getDate() && fin.getMonth() === effet.getMonth()) {
    fin.setDate(fin.getDate() - 1);
    return format(fin);
  }
  return dateFin;
}

// Nouvelle date d'effet : l'échéance suit si elle était vide ou encore la valeur proposée automatiquement.
export function echeanceApresEffet(ancienEffet: string, nouvelEffet: string, echeanceActuelle: string): string {
  const proposee = echeanceParDefaut(nouvelEffet);
  if (!proposee) return echeanceActuelle;
  return !echeanceActuelle || echeanceActuelle === echeanceParDefaut(ancienEffet) ? proposee : normaliserEcheance(nouvelEffet, echeanceActuelle);
}

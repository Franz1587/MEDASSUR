import { API_URL, getAccessToken } from "@/lib/http";

// Les endpoints PDF sont protégés par JWT — une simple navigation
// window.open() n'enverrait pas l'en-tête Authorization. On récupère donc
// le PDF via fetch authentifié, puis on ouvre le Blob obtenu dans un nouvel
// onglet (aperçu/impression/téléchargement natifs du navigateur).
async function openBlobUrl(res: Response) {
  if (!res.ok) {
    throw new Error(`Génération du document impossible (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openDocument(path: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  await openBlobUrl(res);
}

export function openQuittance(contratId: string): Promise<void> {
  return openDocument(`/documents/quittance/${contratId}`);
}

export function openQuittanceAvenant(avenantId: string): Promise<void> {
  return openDocument(`/documents/quittance-avenant/${avenantId}`);
}

export function openTableauGaranties(contratId: string): Promise<void> {
  return openDocument(`/documents/tableau-garanties/${contratId}`);
}

export function openAvenantDocument(avenantId: string): Promise<void> {
  return openDocument(`/documents/avenant/${avenantId}`);
}

export function openCarteAssurance(assureId: string): Promise<void> {
  return openDocument(`/documents/carte/${assureId}`);
}

export async function genererCartesEnMasse(payload: { contratId?: string; assureIds?: string[] }): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/documents/cartes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  await openBlobUrl(res);
}

export async function openStatistiques(
  contratId: string, du: string | undefined, au: string | undefined,
  format: "pdf" | "docx",
  analyse?: unknown, rubriques?: string[], primeForcee?: number | null,
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/documents/statistiques/${contratId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ format, du, au, analyse, rubriques, ...(primeForcee ? { primeForcee } : {}) }),
  });
  await openBlobUrl(res);
}

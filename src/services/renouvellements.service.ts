import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Renouvellement } from "@/types/renouvellements";

interface ApiRenouvellement {
  id: string;
  contratId: string;
  joursRestants: number;
  primeActuelle: string | number;
  primeProposee: string | number;
  sinistralite: string;
  statut: string;
  contrat: { clientId: string; branche: string; dateFin: string; gestionnaireId?: string | null; client: { nom: string }; compagnie: { nom: string } };
}

function mapRenouvellement(r: ApiRenouvellement): Renouvellement {
  return {
    id: r.id,
    contrat: r.contratId,
    clientId: r.contrat.clientId,
    client: r.contrat.client.nom,
    branche: r.contrat.branche,
    compagnie: r.contrat.compagnie.nom,
    dateFin: r.contrat.dateFin,
    joursRestants: r.joursRestants,
    primeActuelle: toNumber(r.primeActuelle),
    primeProposee: toNumber(r.primeProposee),
    sinistralite: r.sinistralite,
    statut: r.statut,
    // Tableau de bord personnel (2026-08) — voir demande utilisateur : "le
    // tableau de bord [doit] faire remonter les informations en fonction
    // du profil de l'utilisateur."
    gestionnaireId: r.contrat.gestionnaireId ?? null,
  };
}

export async function getRenouvellements(): Promise<Renouvellement[]> {
  const data = await http.get<ApiRenouvellement[]>("/renouvellements");
  return data.map(mapRenouvellement);
}

export async function relancerRenouvellement(id: string): Promise<Renouvellement> {
  const r = await http.patch<ApiRenouvellement>(`/renouvellements/${id}/relancer`);
  return mapRenouvellement(r);
}

export async function relancerTousLesRenouvellements(): Promise<{ relances: number }> {
  return http.post<{ relances: number }>("/renouvellements/relancer-tout");
}

export async function renouvelerContrat(id: string): Promise<Renouvellement> {
  const r = await http.patch<ApiRenouvellement>(`/renouvellements/${id}/renouveler`);
  return mapRenouvellement(r);
}

export async function marquerRenouvellementPerdu(id: string, initiateur?: string): Promise<Renouvellement> {
  const r = await http.patch<ApiRenouvellement>(`/renouvellements/${id}/perdu`, { initiateur });
  return mapRenouvellement(r);
}

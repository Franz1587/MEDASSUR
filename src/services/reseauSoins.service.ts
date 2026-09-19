import { http } from "@/lib/http";

// Réseau de soins (2026-08) — voir demande utilisateur : "liste des
// prestataires réseau rangée par type et par ville... on doit pouvoir
// géolocaliser un prestataire... la liste des médecins selon les
// spécialités qui interviennent chez eux". Champs volontairement réduits
// (voir backend PrestatairesService.SELECT_RESEAU) par rapport au type
// interne complet Prestataire — pas de données de gestion (scoreQualite,
// TPS…) exposées au portail client.
export interface PrestataireReseau {
  id: string;
  nom: string;
  type: string;
  secteur?: "Public" | "Privé" | null;
  titre?: "Professeur" | "Docteur" | null;
  specialite?: string | null;
  pays: string;
  ville: string;
  telephone?: string | null;
  adresse?: string | null;
  statutConvention: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PrestataireReseauDetail extends PrestataireReseau {
  medecins: PrestataireReseau[];
}

export async function getReseauSoins(filtres?: { type?: string; ville?: string; q?: string }): Promise<PrestataireReseau[]> {
  const params = new URLSearchParams();
  if (filtres?.type) params.set("type", filtres.type);
  if (filtres?.ville) params.set("ville", filtres.ville);
  if (filtres?.q) params.set("q", filtres.q);
  const qs = params.toString();
  return http.get<PrestataireReseau[]>(`/prestataires/reseau${qs ? `?${qs}` : ""}`);
}

export async function getPrestataireReseau(id: string): Promise<PrestataireReseauDetail> {
  return http.get<PrestataireReseauDetail>(`/prestataires/reseau/${id}`);
}

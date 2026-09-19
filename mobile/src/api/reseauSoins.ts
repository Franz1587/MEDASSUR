import { http } from "./http";

// Miroir mobile de src/services/reseauSoins.service.ts (web). Réel réseau de
// soins (Prestataire), pas une liste inventée. latitude/longitude ne sont
// renseignées que pour les prestataires réellement géolocalisés (voir
// backend/prisma/schema.prisma Prestataire.latitude/longitude) — jamais
// inventées côté mobile : un prestataire sans coordonnées ne doit
// simplement pas apparaître sur une carte.
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

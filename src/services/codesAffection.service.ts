import { http } from "@/lib/http";

// Codification des affections CNAMGS (2026-08) — voir demande utilisateur :
// "implémenter dans la base de données les codes d'affection". Catalogue
// de référence, jamais de saisie libre.
export interface CodeAffection {
  code: string;
  libelle: string;
  chapitre: string;
}

export async function getCodesAffection(): Promise<CodeAffection[]> {
  return http.get<CodeAffection[]>("/codes-affection");
}

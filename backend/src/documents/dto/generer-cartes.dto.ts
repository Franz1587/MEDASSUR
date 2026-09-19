import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

// Génération en masse de cartes d'assurance — soit tout un contrat
// (contratId, tous les assurés actifs), soit une sélection explicite
// (assureIds : une famille, ou une sélection libre depuis l'écran Cartes).
export class GenererCartesDto {
  @IsOptional()
  @IsString()
  contratId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assureIds?: string[];

  // Génération recto seul (2026-09) — voir demande utilisateur : "pour la
  // génération des cartes en masse pour un contrat bien spécifique, il
  // faut prévoir une génération uniquement avec le recto sans les verso et
  // une génération avec les recto-verso comme c'est déjà le cas." Absent
  // ou false = comportement historique inchangé (recto-verso).
  @IsOptional()
  @IsBoolean()
  rectoUniquement?: boolean;
}

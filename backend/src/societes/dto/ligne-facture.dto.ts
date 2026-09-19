import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class LigneFactureDto {
  // Rubrique d'origine (2026-09) — voir demande utilisateur : "les
  // rubriques font référence aux différentes lignes de facturation" —
  // facultatif, une ligne peut rester libre sans rubrique choisie.
  @IsOptional()
  @IsString()
  rubriqueCode?: string;

  @IsString()
  @MinLength(1)
  designation: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantite?: number;

  @IsNumber()
  prixUnitaire: number;
}

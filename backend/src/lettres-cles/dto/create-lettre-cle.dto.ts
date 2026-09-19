import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateLettreCleDto {
  @IsString()
  code: string;

  @IsString()
  libelle: string;

  @IsNumber()
  @Min(0)
  valeurUnitaire: number;

  // Listes à choix multiple — tableau vide (ou absent) = s'applique à
  // toutes les catégories/spécialités, aucune restriction (voir demande
  // utilisateur : "lier cela à toutes les garanties"/"toutes les spécialités").
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoriesGarantie?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialites?: string[];

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

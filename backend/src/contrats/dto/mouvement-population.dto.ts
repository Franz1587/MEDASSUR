import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

// Une personne ajoutée depuis l'écran dédié "Gestion des assurés" — mêmes
// rubriques que la saisie manuelle déjà en place, matricule auto-généré
// si absent (voir ContratsService.mouvementPopulation).
export class AjoutPersonneDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  matricule?: string;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  typeAssure?: string; // AS | CJ | EF

  @IsInt()
  @Min(0)
  beneficiaires: number;

  @IsNumber()
  cotisation: number;
}

export class MouvementPopulationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AjoutPersonneDto)
  ajouts?: AjoutPersonneDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retraitIds?: string[];

  @IsString()
  dateEffet: string;
}

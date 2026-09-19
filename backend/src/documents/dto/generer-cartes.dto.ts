import { IsArray, IsOptional, IsString } from "class-validator";

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
}

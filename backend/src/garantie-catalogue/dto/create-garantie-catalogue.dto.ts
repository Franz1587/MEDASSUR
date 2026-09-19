import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateGarantieCatalogueDto {
  @IsOptional()
  @IsIn(["Maladie", "Assistance"])
  branche?: string;

  @IsString()
  categorie: string;

  @IsString()
  libelle: string;

  @IsOptional()
  @IsNumber()
  tauxAssureDefaut?: number;

  @IsOptional()
  @IsNumber()
  tauxAyantsDroitDefaut?: number;

  @IsOptional()
  @IsString()
  plafondDefaut?: string;
}

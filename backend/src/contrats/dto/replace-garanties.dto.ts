import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class GarantieDto {
  @IsString()
  categorie: string;

  @IsString()
  libelle: string;

  @IsOptional()
  @IsNumber()
  tauxAssure?: number;

  @IsOptional()
  @IsNumber()
  tauxAyantsDroit?: number;

  @IsOptional()
  @IsString()
  plafond?: string;

  // Enveloppe partagée exploitable en calcul — voir Garantie.plafondMontant.
  @IsOptional()
  @IsNumber()
  plafondMontant?: number;

  @IsOptional()
  @IsString()
  plafondPeriode?: string;
}

export class ReplaceGarantiesDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => GarantieDto)
  garanties: GarantieDto[];
}

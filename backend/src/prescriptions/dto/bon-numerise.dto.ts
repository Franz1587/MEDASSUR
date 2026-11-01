import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreatePrescriptionLigneDto } from "./create-prescription.dto";

// Ordonnance / bon d'examen papier converti en électronique par l'assuré
// (2026-11), après relecture des lignes lues par ARIANA.
export class ValiderBonNumeriseDto {
  @IsString()
  assureId: string;

  @IsOptional()
  @IsString()
  prescripteurNom?: string;

  @IsOptional()
  @IsString()
  structureNom?: string;

  @IsOptional()
  @IsString()
  dateOrdonnance?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionLigneDto)
  lignes: CreatePrescriptionLigneDto[];
}
